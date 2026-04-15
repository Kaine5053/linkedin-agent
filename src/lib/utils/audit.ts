// ============================================================
// Audit Logger
// Every agent action, lead stage change, approval, and error
// is written here. The audit_log table is read-only via RLS
// so records cannot be altered after the fact.
// ============================================================

import { createServerClient } from '../supabase/client'

export type AuditEventType =
  // Lead lifecycle
  | 'lead.imported'
  | 'lead.stage_changed'
  | 'lead.archived'
  // Actions
  | 'action.created'
  | 'action.started'
  | 'action.completed'
  | 'action.failed'
  | 'action.skipped'
  // DM workflow
  | 'dm.drafted'
  | 'dm.approved'
  | 'dm.edited'
  | 'dm.rejected'
  | 'dm.sent'
  // Pacing
  | 'pacing.daily_cap_reached'
  | 'pacing.outside_working_hours'
  | 'pacing.weekend_pause'
  // Auth / system
  | 'user.session_updated'
  | 'campaign.created'
  | 'campaign.updated'
  | 'error.worker'

interface AuditPayload {
  user_id: string
  event_type: AuditEventType
  payload?: Record<string, unknown>
  lead_id?: string
  action_id?: string
  worker_ip?: string
}

/**
 * Write an immutable audit log entry.
 * Never throws — audit failures are logged to console but never
 * allowed to break the main operation.
 */
export async function audit(params: AuditPayload): Promise<void> {
  try {
    const supabase = createServerClient()

    const { error } = await supabase.from('audit_log').insert({
      user_id:    params.user_id,
      event_type: params.event_type,
      payload:    params.payload ?? {},
      lead_id:    params.lead_id ?? null,
      action_id:  params.action_id ?? null,
      worker_ip:  params.worker_ip ?? null,
      occurred_at: new Date().toISOString(),
    })

    if (error) {
      // Audit failure must not crash the caller
      console.error('[audit] Failed to write audit log:', error.message, params)
    }
  } catch (err) {
    console.error('[audit] Unexpected error writing audit log:', err)
  }
}

/**
 * Convenience: audit a lead stage change with before/after.
 */
export async function auditStageChange(params: {
  user_id: string
  lead_id: string
  from_stage: string
  to_stage: string
  reason?: string
}) {
  await audit({
    user_id:    params.user_id,
    lead_id:    params.lead_id,
    event_type: 'lead.stage_changed',
    payload: {
      from:   params.from_stage,
      to:     params.to_stage,
      reason: params.reason,
    },
  })
}

/**
 * Convenience: audit a completed or failed action.
 */
export async function auditActionResult(params: {
  user_id: string
  lead_id: string
  action_id: string
  success: boolean
  action_type: string
  error?: string
  worker_ip?: string
}) {
  await audit({
    user_id:    params.user_id,
    lead_id:    params.lead_id,
    action_id:  params.action_id,
    worker_ip:  params.worker_ip,
    event_type: params.success ? 'action.completed' : 'action.failed',
    payload: {
      action_type: params.action_type,
      success:     params.success,
      error:       params.error,
    },
  })
}
