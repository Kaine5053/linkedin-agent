// ============================================================
// POST /api/ai/generate/dm
//
// Generates a personalised DM draft using the lead's full
// engagement history and stores it in dm_drafts for approval.
//
// CRITICAL: This route NEVER writes to pending_actions.
// The DM is only scheduled for sending AFTER the user approves
// it via POST /api/actions/dm-queue (the approval gate).
//
// Also handles regeneration: if dm_draft_id is provided,
// the existing draft is updated and reset to pending_review.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createServerClient } from '@/lib/supabase/client'
import { generateDmDraft } from '@/lib/ai/service'
import { audit } from '@/lib/utils/audit'
import type { GenerateDmRequest } from '@/types'
import { AiError } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: GenerateDmRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lead_id, campaign_id, dm_draft_id, regen_instruction } = body

  if (!lead_id || !campaign_id) {
    return NextResponse.json({ error: 'lead_id and campaign_id are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Verify lead ownership
  const { data: lead } = await supabase
    .from('leads')
    .select('id, stage, user_id, full_name, comment_count')
    .eq('id', lead_id)
    .eq('user_id', authedUser.id)
    .single()

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // If regenerating, verify the existing draft belongs to this user
  if (dm_draft_id) {
    const { data: existingDraft } = await supabase
      .from('dm_drafts')
      .select('id, leads!inner(user_id)')
      .eq('id', dm_draft_id)
      .eq('leads.user_id', authedUser.id)
      .single()

    if (!existingDraft) {
      return NextResponse.json({ error: 'DM draft not found' }, { status: 404 })
    }
  }

  // Generate DM via Claude
  let generation
  try {
    generation = await generateDmDraft({
      userId:            authedUser.id,
      leadId:            lead_id,
      campaignId:        campaign_id,
      existingDraftId:   dm_draft_id,
      regenInstruction:  regen_instruction,
    })
  } catch (err) {
    const msg = err instanceof AiError ? err.message : 'DM generation failed'
    console.error('[api/generate/dm] Error:', err)
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  await audit({
    user_id:    authedUser.id,
    lead_id:    lead_id,
    event_type: 'dm.drafted',
    payload: {
      dm_draft_id:    generation.dm_draft_id,
      generation_id:  generation.generation_id,
      is_regen:       !!dm_draft_id,
      regen_hint:     regen_instruction ?? null,
      safety_flags:   generation.safety_flags,
      message_length: generation.message.length,
    },
  })

  return NextResponse.json({
    message:       generation.message,
    dm_draft_id:   generation.dm_draft_id,
    generation_id: generation.generation_id,
    safety_flags:  generation.safety_flags,
    status:        'pending_review',
    // Remind the caller that this must go through the approval gate
    next_step:     'POST /api/actions/dm-queue with action: "approve" to schedule sending',
  }, { status: 201 })
}
