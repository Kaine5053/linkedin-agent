// ============================================================
// POST /api/webhooks/worker-result
//
// Called by the VPS Playwright worker after each action completes.
// Authenticated with a shared secret (WORKER_WEBHOOK_SECRET).
//
// The worker POSTs the result here. This route:
//   1. Validates the secret
//   2. Updates pending_actions with the result
//   3. Advances the lead's stage
//   4. Increments comment_count (triggers dm_ready check via DB trigger)
//   5. Writes to audit_log
//   6. (Supabase Realtime broadcasts the change to the dashboard)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'
import { auditStageChange, auditActionResult } from '@/lib/utils/audit'
import type { ActionResult, LeadStage } from '@/types'
import {
  notifyDmReady,
  notifyConnectionAccepted,
  notifyWorkerError,
  notifyDailyCap,
} from '@/lib/utils/notifications'

interface WorkerResultPayload {
  action_id:  string
  result:     ActionResult
  worker_ip?: string
}

// Map action completion to next lead stage
const STAGE_TRANSITIONS: Record<string, LeadStage | null> = {
  connection_request: 'connection_sent',
  post_comment:       null,             // stage stays 'commenting'; comment_count increments
  dm_send:            'dm_sent',
  profile_view:       null,             // no stage change
  post_like:          null,
}

export async function POST(req: NextRequest) {
  // ── Authenticate the worker ─────────────────────────────
  const secret = req.headers.get('X-Worker-Secret')
  if (!secret || secret !== process.env.WORKER_WEBHOOK_SECRET) {
    console.warn('[worker-result] Rejected request — invalid or missing secret')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: WorkerResultPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action_id, result, worker_ip } = body

  if (!action_id || !result) {
    return NextResponse.json({ error: 'action_id and result are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // ── Fetch the action ────────────────────────────────────
  const { data: action, error: fetchErr } = await supabase
    .from('pending_actions')
    .select('*, leads!inner(id, user_id, stage, campaign_id, comment_count)')
    .eq('id', action_id)
    .single()

  if (fetchErr || !action) {
    console.error('[worker-result] Action not found:', action_id)
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  const lead    = action.leads
  const now     = new Date().toISOString()
  const success = result.success

  // ── Update pending_action ───────────────────────────────
  await supabase
    .from('pending_actions')
    .update({
      status:       success ? 'completed' : 'failed',
      result,
      attempts:     action.attempts + 1,
      last_error:   success ? null : (result.error ?? 'Unknown error'),
      completed_at: now,
    })
    .eq('id', action_id)

  // ── Audit the result ────────────────────────────────────
  await auditActionResult({
    user_id:     lead.user_id,
    lead_id:     lead.id,
    action_id:   action_id,
    success,
    action_type: action.action_type,
    error:       result.error,
    worker_ip,
  })

  if (!success) {
    // Failed actions don't advance stage.
    // Worker will retry up to 3 times with backoff.
    // Notify the user if this is a persistent error (3+ attempts)
    if (action.attempts >= 3) {
      notifyWorkerError(
        lead.user_id,
        `Action ${action.action_type} failed after 3 attempts: ${result.error ?? 'Unknown error'}`,
        action_id,
      ).catch(console.warn)
    }
    return NextResponse.json({ received: true, stage_changed: false })
  }

  // ── Advance lead stage (on success) ────────────────────
  const nextStage = STAGE_TRANSITIONS[action.action_type]
  const leadUpdates: Record<string, unknown> = { last_activity_at: now }

  if (nextStage && nextStage !== lead.stage) {
    leadUpdates.stage = nextStage

    // Set the relevant timestamp for the new stage
    if (nextStage === 'connection_sent') leadUpdates.connection_sent_at = now
    if (nextStage === 'dm_sent')         leadUpdates.dm_sent_at = now

    // Notify on connection accepted
    if (nextStage === 'connected') {
      const { data: fullLead } = await supabase
        .from('leads').select('full_name, company').eq('id', lead.id).single()
      if (fullLead) {
        notifyConnectionAccepted(lead.user_id, lead.id, fullLead.full_name, fullLead.company)
          .catch(console.warn)
      }
    }

    // Notify when DM ready
    if (nextStage === 'dm_ready') {
      const { data: fullLead } = await supabase
        .from('leads').select('full_name').eq('id', lead.id).single()
      if (fullLead) {
        notifyDmReady(lead.user_id, lead.id, fullLead.full_name).catch(console.warn)
      }
    }

    await supabase
      .from('leads')
      .update(leadUpdates)
      .eq('id', lead.id)

    await auditStageChange({
      user_id:    lead.user_id,
      lead_id:    lead.id,
      from_stage: lead.stage,
      to_stage:   nextStage,
      reason:     `action.${action.action_type} completed`,
    })
  }

  // ── Special: post_comment → increment comment_count ────
  // The DB trigger check_dm_trigger fires on this update and
  // will automatically advance stage to dm_ready if threshold hit.
  if (action.action_type === 'post_comment') {
    const newCount = (lead.comment_count ?? 0) + 1

    // Write the comment record
    const commentPayload = action.payload as {
      post_url: string
      post_snippet?: string
      comment_text: string
    }

    await supabase.from('comments').insert({
      lead_id:      lead.id,
      action_id:    action_id,
      post_url:     commentPayload.post_url,
      post_snippet: commentPayload.post_snippet ?? null,
      comment_text: commentPayload.comment_text,
      status:       'posted',
      posted_at:    now,
    })

    // Increment comment_count — triggers check_dm_trigger DB function
    await supabase
      .from('leads')
      .update({ comment_count: newCount, last_activity_at: now })
      .eq('id', lead.id)

    // Check day-7 DM trigger: if connected 7+ days ago and still commenting
    await checkDaySevenTrigger(lead.id, lead.user_id, lead.campaign_id, supabase)
  }

  // Supabase Realtime broadcasts the leads table update automatically —
  // no manual push needed. The dashboard will receive it within ~200ms.

  return NextResponse.json({ received: true, stage_changed: !!nextStage })
}

/**
 * If lead has been connected for dm_trigger_days (default 7) and hasn't
 * yet reached the comment threshold, still advance to dm_ready.
 */
async function checkDaySevenTrigger(
  leadId: string,
  userId: string,
  campaignId: string,
  supabase: ReturnType<typeof createServerClient>
) {
  const { data: lead } = await supabase
    .from('leads')
    .select('stage, connected_at, comment_count')
    .eq('id', leadId)
    .single()

  if (!lead || lead.stage !== 'commenting' || !lead.connected_at) return

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('dm_trigger_days')
    .eq('id', campaignId)
    .single()

  if (!campaign) return

  const daysSinceConnected =
    (Date.now() - new Date(lead.connected_at).getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceConnected >= campaign.dm_trigger_days) {
    const now = new Date().toISOString()
    await supabase
      .from('leads')
      .update({ stage: 'dm_ready', dm_ready_at: now })
      .eq('id', leadId)

    await auditStageChange({
      user_id:    userId,
      lead_id:    leadId,
      from_stage: 'commenting',
      to_stage:   'dm_ready',
      reason:     `day ${campaign.dm_trigger_days} trigger`,
    })

    // Notify user that DM is ready
    const { data: lRow } = await supabase
      .from('leads').select('full_name').eq('id', leadId).single()
    if (lRow) {
      notifyDmReady(userId, leadId, lRow.full_name).catch(console.warn)
    }
  }
}
