// ============================================================
// POST /api/ai/generate/connection-note
//
// Generates a personalised connection note via Claude,
// then writes a connection_request job to pending_actions.
//
// Flow:
//   1. Auth + validate request
//   2. Call generateConnectionNote() — Claude + safety checks
//   3. Write pending_action with AI-generated note as payload
//   4. Return the note for user preview (not approval-gated —
//      connection notes are short enough to review inline)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/client'
import { createServerClient } from '@/lib/supabase/client'
import { generateConnectionNote } from '@/lib/ai/service'
import { calculateExecuteAfter } from '@/lib/utils/pacing'
import { markGenerationUsed } from '@/lib/ai/logger'
import { audit } from '@/lib/utils/audit'
import type { GenerateConnectionNoteRequest, UserSettings } from '@/types'
import { AiError } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: GenerateConnectionNoteRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lead_id, campaign_id, regenerate_hint } = body

  if (!lead_id || !campaign_id) {
    return NextResponse.json({ error: 'lead_id and campaign_id are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Verify lead belongs to this user
  const { data: lead } = await supabase
    .from('leads')
    .select('id, stage, user_id')
    .eq('id', lead_id)
    .eq('user_id', authedUser.id)
    .single()

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Generate with Claude
  let generation
  try {
    generation = await generateConnectionNote({
      userId:     authedUser.id,
      leadId:     lead_id,
      campaignId: campaign_id,
      hint:       regenerate_hint,
    })
  } catch (err) {
    const msg = err instanceof AiError ? err.message : 'AI generation failed'
    console.error('[api/connection-note] Generation error:', err)
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // Fetch user settings for pacing
  const { data: user } = await supabase
    .from('users')
    .select('settings, timezone')
    .eq('id', authedUser.id)
    .single()

  const settings = user?.settings as UserSettings
  const timezone = user?.timezone ?? 'UTC'

  // Calculate paced schedule time
  const pacing = await calculateExecuteAfter({
    userId:     authedUser.id,
    actionType: 'connection_request',
    settings,
    timezone,
  })

  if (!pacing.allowed) {
    // Mark generation as unused — daily cap hit
    if (generation.generation_id) {
      await markGenerationUsed(generation.generation_id, false)
    }
    return NextResponse.json({
      error:   `Daily connection limit reached: ${pacing.reason}`,
      note:    generation.note, // still return the note so user can see it
      queued:  false,
    }, { status: 429 })
  }

  // Write the pending_action with the AI-generated note
  const { data: action, error: actionErr } = await supabase
    .from('pending_actions')
    .insert({
      lead_id:       lead_id,
      user_id:       authedUser.id,
      campaign_id:   campaign_id,
      action_type:   'connection_request',
      status:        'scheduled',
      execute_after: pacing.execute_after.toISOString(),
      payload:       { note: generation.note },
    })
    .select('id')
    .single()

  if (actionErr) {
    console.error('[api/connection-note] Action insert error:', actionErr)
    return NextResponse.json({ error: 'Failed to schedule action' }, { status: 500 })
  }

  // Update generation log with action_id
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
      action_type:     'connection_request',
      note_length:     generation.note.length,
      ai_generated:    true,
      generation_id:   generation.generation_id,
      execute_after:   pacing.execute_after.toISOString(),
      safety_flags:    generation.safety_flags,
    },
  })

  return NextResponse.json({
    note:          generation.note,
    char_count:    generation.char_count,
    generation_id: generation.generation_id,
    action_id:     action.id,
    execute_after: pacing.execute_after.toISOString(),
    safety_flags:  generation.safety_flags,
    queued:        true,
  }, { status: 201 })
}
