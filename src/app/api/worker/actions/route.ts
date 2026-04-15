// ============================================================
// POST /api/worker/actions
// Manual override: trigger, skip, or reschedule an action.
//
// Body:
//   { action_id, operation: 'trigger_now' | 'skip' | 'reschedule', delay_minutes? }
//
// 'trigger_now'  — sets execute_after = now() so worker picks up immediately
// 'skip'         — marks the action as skipped, does NOT execute it
// 'reschedule'   — sets execute_after to now() + delay_minutes
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { calculateExecuteAfter } from '@/lib/utils/pacing'
import { audit } from '@/lib/utils/audit'
import type { UserSettings, ActionType } from '@/types'

export async function POST(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const body = await req.json().catch(() => ({}))
  const { action_id, operation, delay_minutes } = body

  if (!action_id || !operation) {
    return NextResponse.json({ error: 'action_id and operation required' }, { status: 400 })
  }

  if (!['trigger_now', 'skip', 'reschedule'].includes(operation)) {
    return NextResponse.json({ error: 'operation must be trigger_now, skip, or reschedule' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Verify action belongs to this user
  const { data: action, error: fetchErr } = await supabase
    .from('pending_actions')
    .select('id, user_id, lead_id, action_type, status, execute_after')
    .eq('id', action_id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  if (!['pending', 'scheduled', 'failed'].includes(action.status)) {
    return NextResponse.json(
      { error: `Cannot override action in status: ${action.status}` },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  let updatePayload: Record<string, unknown> = {}
  let auditEvent: string

  switch (operation) {
    case 'trigger_now':
      // Set execute_after to 10 seconds from now so worker picks it up on next poll
      updatePayload = {
        status:        'scheduled',
        execute_after: new Date(Date.now() + 10_000).toISOString(),
        attempts:      0,
        last_error:    null,
      }
      auditEvent = 'action.manual_trigger'
      break

    case 'skip':
      updatePayload = {
        status:       'skipped',
        completed_at: now,
        result:       { success: false, skipped: true, reason: 'manually skipped by user' },
      }
      auditEvent = 'action.manual_skip'
      break

    case 'reschedule': {
      const mins = Math.max(1, Math.min(1440, Number(delay_minutes ?? 60)))
      updatePayload = {
        status:        'scheduled',
        execute_after: new Date(Date.now() + mins * 60_000).toISOString(),
        attempts:      0,
        last_error:    null,
      }
      auditEvent = 'action.manual_reschedule'
      break
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('pending_actions')
    .update(updatePayload)
    .eq('id', action_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  await audit({
    user_id:    user.id,
    lead_id:    action.lead_id,
    action_id:  action_id,
    event_type: auditEvent as any,
    payload: {
      operation,
      action_type:    action.action_type,
      previous_status: action.status,
      new_execute_after: updated.execute_after,
      delay_minutes:   delay_minutes ?? null,
    },
  })

  return NextResponse.json({ action: updated })
}

// GET — list pending actions for a lead (so the UI can show manual override buttons)
export async function GET(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const { searchParams } = new URL(req.url)
  const leadId     = searchParams.get('lead_id')
  const statusFilter = searchParams.get('status') ?? 'pending,scheduled,failed'
  const supabase   = createServerClient()

  let query = supabase
    .from('pending_actions')
    .select('id, action_type, status, execute_after, attempts, last_error, created_at, payload')
    .eq('user_id', user.id)
    .in('status', statusFilter.split(','))
    .order('execute_after', { ascending: true })
    .limit(50)

  if (leadId) query = query.eq('lead_id', leadId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })

  return NextResponse.json({ actions: data ?? [] })
}
