// ============================================================
// GET  /api/actions/dm-queue     — list DMs awaiting approval
// POST /api/actions/dm-queue     — approve or reject a DM draft
//
// CRITICAL: No DM is ever sent without explicit user approval here.
// Approval writes the message into pending_actions.payload so the
// VPS worker can execute it. Rejection marks the draft rejected.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { calculateExecuteAfter } from '@/lib/utils/pacing'
import { audit } from '@/lib/utils/audit'
import type { UserSettings, ApproveDmRequest } from '@/types'

// GET — list all DM drafts awaiting review
export async function GET(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('dm_drafts')
    .select(`
      *,
      leads ( id, full_name, linkedin_url, company, job_title, stage,
              comments ( post_url, comment_text, posted_at ) ),
      campaigns ( id, name )
    `)
    .eq('leads.user_id', authedUser.id)
    .eq('status', 'pending_review')
    .order('drafted_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch DM queue' }, { status: 500 })
  }

  return NextResponse.json({ drafts: data })
}

// POST — approve or reject a DM draft
export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body: ApproveDmRequest & { action: 'approve' | 'reject' } = await req.json()

  if (!body.dm_draft_id || !body.action) {
    return NextResponse.json(
      { error: 'dm_draft_id and action (approve|reject) are required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Fetch draft and verify ownership via lead→user_id
  const { data: draft, error: draftErr } = await supabase
    .from('dm_drafts')
    .select('*, leads!inner(id, user_id, campaign_id, stage)')
    .eq('id', body.dm_draft_id)
    .eq('leads.user_id', authedUser.id)
    .single()

  if (draftErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  if (draft.status !== 'pending_review') {
    return NextResponse.json(
      { error: `Draft is already ${draft.status}` },
      { status: 409 }
    )
  }

  // ── REJECT ─────────────────────────────────────────────
  if (body.action === 'reject') {
    await supabase
      .from('dm_drafts')
      .update({ status: 'rejected' })
      .eq('id', body.dm_draft_id)

    await audit({
      user_id:    authedUser.id,
      lead_id:    draft.leads.id,
      event_type: 'dm.rejected',
      payload:    { dm_draft_id: body.dm_draft_id },
    })

    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // ── APPROVE ────────────────────────────────────────────
  // The message to send — either the edited version or original draft
  const messageText = body.edited_text?.trim() || draft.draft_text

  if (!messageText) {
    return NextResponse.json({ error: 'Message text is empty' }, { status: 400 })
  }

  // Fetch user settings for pacing
  const { data: user } = await supabase
    .from('users')
    .select('settings, timezone')
    .eq('id', authedUser.id)
    .single()

  const settings = user?.settings as UserSettings
  const timezone = user?.timezone ?? 'UTC'

  // Calculate when to send (paced, within working hours)
  const pacing = await calculateExecuteAfter({
    userId:     authedUser.id,
    actionType: 'dm_send',
    settings,
    timezone,
  })

  // Create the send action in pending_actions
  const { data: action, error: actionErr } = await supabase
    .from('pending_actions')
    .insert({
      lead_id:       draft.leads.id,
      user_id:       authedUser.id,
      campaign_id:   draft.leads.campaign_id,
      action_type:   'dm_send',
      status:        'scheduled',
      execute_after: pacing.execute_after.toISOString(),
      payload: {
        message_text: messageText,
        dm_draft_id:  body.dm_draft_id,
      },
    })
    .select()
    .single()

  if (actionErr) {
    return NextResponse.json({ error: 'Failed to schedule DM send' }, { status: 500 })
  }

  // Update draft status
  const newStatus = body.edited_text ? 'edited' : 'approved'
  await supabase
    .from('dm_drafts')
    .update({
      status:         newStatus,
      edited_text:    body.edited_text ?? null,
      approved_by:    authedUser.id,
      approved_at:    new Date().toISOString(),
      send_action_id: action.id,
    })
    .eq('id', body.dm_draft_id)

  await audit({
    user_id:    authedUser.id,
    lead_id:    draft.leads.id,
    action_id:  action.id,
    event_type: body.edited_text ? 'dm.edited' : 'dm.approved',
    payload: {
      dm_draft_id:   body.dm_draft_id,
      execute_after: pacing.execute_after.toISOString(),
      was_edited:    !!body.edited_text,
    },
  })

  return NextResponse.json({
    success:       true,
    status:        newStatus,
    execute_after: pacing.execute_after.toISOString(),
    action_id:     action.id,
  })
}
