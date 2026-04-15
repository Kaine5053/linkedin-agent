// ============================================================
// Notification utility
// Called by API routes (not the VPS worker) to create
// in-app and email notifications when key events happen.
// ============================================================

import { createServerClient } from '../supabase/client'

interface NotificationParams {
  userId:     string
  type:       string
  title:      string
  body?:      string
  leadId?:    string
  actionUrl?: string
}

/**
 * Create an in-app notification. Never throws — failures are logged
 * but must not interrupt the main operation.
 */
export async function createNotification(params: NotificationParams): Promise<string | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('in_app_notifications')
      .insert({
        user_id:    params.userId,
        type:       params.type,
        title:      params.title,
        body:       params.body ?? null,
        lead_id:    params.leadId ?? null,
        action_url: params.actionUrl ?? null,
        read:       false,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[notifications] Failed to create notification:', error.message)
      return null
    }

    // Optional: send email if user has email notifications enabled
    // (check prefs table before firing)
    await maybeEmailNotify(params)

    return data.id
  } catch (err) {
    console.error('[notifications] Unexpected error:', err)
    return null
  }
}

/**
 * Create a "DM Ready" notification for a specific lead.
 * Called from the worker-result webhook when dm_ready stage is reached.
 */
export async function notifyDmReady(userId: string, leadId: string, leadName: string): Promise<void> {
  await createNotification({
    userId,
    leadId,
    type:      'dm_ready',
    title:     `✨ DM ready: ${leadName}`,
    body:      `${leadName} has been engaged enough — AI is drafting a personalised DM for your review.`,
    actionUrl: '/dm-queue',
  })
}

/**
 * Create a "Connection Accepted" notification.
 */
export async function notifyConnectionAccepted(
  userId: string, leadId: string, leadName: string, company: string | null
): Promise<void> {
  await createNotification({
    userId,
    leadId,
    type:      'connection_accepted',
    title:     `🤝 ${leadName} connected`,
    body:      company ? `${leadName} from ${company} accepted your connection request.` : undefined,
    actionUrl: '/board',
  })
}

/**
 * Create a worker error notification.
 */
export async function notifyWorkerError(
  userId: string, errorMsg: string, actionId?: string
): Promise<void> {
  await createNotification({
    userId,
    type:      'worker_error',
    title:     '⚠ Worker error',
    body:      errorMsg.slice(0, 200),
    actionUrl: '/audit',
  })
}

/**
 * Create a daily cap reached notification.
 */
export async function notifyDailyCap(
  userId: string, actionType: string, count: number
): Promise<void> {
  await createNotification({
    userId,
    type:      'daily_cap',
    title:     '📊 Daily limit reached',
    body:      `${count} ${actionType.replace('_', ' ')}s sent today — the worker will resume tomorrow.`,
    actionUrl: '/board',
  })
}

// ── Optional email notification (stub — wire up Resend/Sendgrid) ──

async function maybeEmailNotify(params: NotificationParams): Promise<void> {
  try {
    const supabase = createServerClient()

    const { data: prefs } = await supabase
      .from('notification_prefs')
      .select('email_enabled, email_address, email_dm_ready, email_worker_error')
      .eq('user_id', params.userId)
      .single()

    if (!prefs?.email_enabled || !prefs?.email_address) return

    const shouldEmail =
      (params.type === 'dm_ready'      && prefs.email_dm_ready) ||
      (params.type === 'worker_error'  && prefs.email_worker_error)

    if (!shouldEmail) return

    // ── Send email via Resend (add RESEND_API_KEY to Vercel env) ──
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'LinkedIn Agent <noreply@yourdomain.com>',
        to:      [prefs.email_address],
        subject: params.title,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#0073ea;margin-bottom:8px">${params.title}</h2>
            ${params.body ? `<p style="color:#555;line-height:1.6">${params.body}</p>` : ''}
            ${params.actionUrl ? `
              <a href="${process.env.NEXT_PUBLIC_APP_URL}${params.actionUrl}"
                 style="display:inline-block;margin-top:16px;background:#0073ea;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500">
                Open in dashboard →
              </a>
            ` : ''}
            <p style="color:#aaa;font-size:12px;margin-top:24px">
              LinkedIn Agent — you can manage notification preferences in Settings.
            </p>
          </div>
        `,
      }),
    })
  } catch (err) {
    // Email failure must never crash the main flow
    console.warn('[notifications] Email send failed:', err)
  }
}
