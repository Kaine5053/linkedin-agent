// ============================================================
// GET    /api/leads/[id]  — full lead detail with joins
// PATCH  /api/leads/[id]  — update lead (manual stage override, notes)
// DELETE /api/leads/[id]  — archive a lead
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { auditStageChange, audit } from '@/lib/utils/audit'
import type { LeadStage } from '@/types'

// GET — full lead detail with comments, dm_drafts, pending_actions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let authedUser: { id: string }
  try { authedUser = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const supabase = createServerClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      comments (
        id, post_url, post_snippet, comment_text, posted_at, status
      ),
      dm_drafts (
        id, status, draft_text, drafted_at, approved_at, edited_text
      ),
      pending_actions (
        id, action_type, status, execute_after, created_at, completed_at, result
      )
    `)
    .eq('id', id)
    .eq('user_id', authedUser.id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Sort comments by most recent first
  if (lead.comments) {
    lead.comments.sort((a: any, b: any) =>
      new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
    )
  }

  // Sort dm_drafts by most recent first
  if (lead.dm_drafts) {
    lead.dm_drafts.sort((a: any, b: any) =>
      new Date(b.drafted_at).getTime() - new Date(a.drafted_at).getTime()
    )
  }

  // Sort pending_actions by most recent first
  if (lead.pending_actions) {
    lead.pending_actions.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  return NextResponse.json({ lead })
}

const VALID_STAGES: LeadStage[] = [
  'imported', 'connection_sent', 'connected',
  'engaging', 'commenting',  // 'commenting' is the DB value; 'engaging' is UI alias
  'dm_ready', 'dm_sent', 'replied', 'won', 'lost',
  'nurturing', 'archived',
]

// UI uses 'engaging' but the DB column stores 'commenting'
// Normalise before writing to DB
function normaliseStage(stage: string): string {
  if (stage === 'engaging') return 'commenting'
  return stage
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Fetch existing lead to verify ownership and get current stage
  const { data: existing, error: fetchErr } = await supabase
    .from('leads')
    .select('id, stage, user_id')
    .eq('id', id)
    .eq('user_id', authedUser.id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  // Only allow safe field updates
  if (body.notes !== undefined)    updates.notes = body.notes
  if (body.company !== undefined)  updates.company = body.company
  if (body.job_title !== undefined) updates.job_title = body.job_title

  // Stage override — log before/after
  if (body.stage !== undefined) {
    if (!VALID_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: `Invalid stage: ${body.stage}` }, { status: 400 })
    }
    updates.stage = body.stage

    // Update relevant timestamps when stage changes
    const now = new Date().toISOString()
    if (body.stage === 'connection_sent') updates.connection_sent_at = now
    if (body.stage === 'connected')       updates.connected_at = now
    if (body.stage === 'dm_ready')        updates.dm_ready_at = now
    if (body.stage === 'dm_sent')         updates.dm_sent_at = now
    updates.last_activity_at = now
  }

  const { data: updated, error: updateErr } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Audit stage change if applicable
  if (body.stage && body.stage !== existing.stage) {
    await auditStageChange({
      user_id:    authedUser.id,
      lead_id:    id,
      from_stage: existing.stage,
      to_stage:   body.stage,
      reason:     'manual override',
    })
  }

  return NextResponse.json({ lead: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Soft-delete: move to archived rather than hard delete
  const { error } = await supabase
    .from('leads')
    .update({ stage: 'archived', last_activity_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', authedUser.id)

  if (error) {
    return NextResponse.json({ error: 'Archive failed' }, { status: 500 })
  }

  await audit({
    user_id:    authedUser.id,
    lead_id:    id,
    event_type: 'lead.archived',
    payload:    { method: 'manual' },
  })

  return NextResponse.json({ success: true })
}
