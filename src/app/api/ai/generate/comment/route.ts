// ============================================================
// POST /api/ai/generate/comment
//
// Generates a vibe-matched LinkedIn comment for a specific post.
// The post content must be provided by the caller (the VPS worker
// reads it from LinkedIn and sends it here, OR the user provides
// it manually via the dashboard).
//
// After generation, writes a post_comment job to pending_actions.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createServerClient } from '@/lib/supabase/client'
import { generateComment } from '@/lib/ai/service'
import { calculateExecuteAfter } from '@/lib/utils/pacing'
import { audit } from '@/lib/utils/audit'
import type { GenerateCommentRequest, UserSettings } from '@/types'
import { AiError } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: GenerateCommentRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lead_id, post_url, post_content, post_author, tone_override } = body

  if (!lead_id || !post_url || !post_content) {
    return NextResponse.json(
      { error: 'lead_id, post_url, and post_content are required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Verify lead ownership and get campaign_id
  const { data: lead } = await supabase
    .from('leads')
    .select('id, campaign_id, stage, user_id')
    .eq('id', lead_id)
    .eq('user_id', authedUser.id)
    .single()

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Only comment on connected leads
  if (!['connected', 'commenting', 'dm_ready'].includes(lead.stage)) {
    return NextResponse.json(
      { error: `Cannot comment on lead in stage "${lead.stage}" — lead must be connected first` },
      { status: 409 }
    )
  }

  // Generate comment via Claude
  let generation
  try {
    generation = await generateComment({
      userId:       authedUser.id,
      leadId:       lead_id,
      postUrl:      post_url,
      postContent:  post_content,
      postAuthor:   post_author ?? 'the author',
      toneOverride: tone_override as Parameters<typeof generateComment>[0]['toneOverride'],
    })
  } catch (err) {
    const msg = err instanceof AiError ? err.message : 'Comment generation failed'
    console.error('[api/generate/comment] Error:', err)
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // Pacing
  const { data: user } = await supabase
    .from('users')
    .select('settings, timezone')
    .eq('id', authedUser.id)
    .single()

  const pacing = await calculateExecuteAfter({
    userId:     authedUser.id,
    actionType: 'post_comment',
    settings:   user?.settings as UserSettings,
    timezone:   user?.timezone ?? 'UTC',
  })

  if (!pacing.allowed) {
    return NextResponse.json({
      error:   `Daily comment limit reached: ${pacing.reason}`,
      comment: generation.comment,
      queued:  false,
    }, { status: 429 })
  }

  // Write pending_action
  const { data: action, error: actionErr } = await supabase
    .from('pending_actions')
    .insert({
      lead_id:       lead_id,
      user_id:       authedUser.id,
      campaign_id:   lead.campaign_id,
      action_type:   'post_comment',
      status:        'scheduled',
      execute_after: pacing.execute_after.toISOString(),
      payload: {
        post_url,
        comment_text:  generation.comment,
        post_snippet:  post_content.slice(0, 120),
      },
    })
    .select('id')
    .single()

  if (actionErr) {
    return NextResponse.json({ error: 'Failed to schedule comment' }, { status: 500 })
  }

  // Link generation to action
  if (generation.generation_id) {
    await supabase
      .from('ai_generations')
      .update({ action_id: action.id, was_used: true })
      .eq('id', generation.generation_id)
  }

  await audit({
    user_id:    authedUser.id,
    lead_id:    lead_id,
    action_id:  action.id,
    event_type: 'action.created',
    payload: {
      action_type:   'post_comment',
      post_url,
      tone_used:     generation.tone_used,
      ai_generated:  true,
      generation_id: generation.generation_id,
      execute_after: pacing.execute_after.toISOString(),
    },
  })

  return NextResponse.json({
    comment:       generation.comment,
    tone_used:     generation.tone_used,
    generation_id: generation.generation_id,
    action_id:     action.id,
    execute_after: pacing.execute_after.toISOString(),
    safety_flags:  generation.safety_flags,
    queued:        true,
  }, { status: 201 })
}
