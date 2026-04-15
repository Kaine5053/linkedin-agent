// ============================================================
// GET  /api/worker/config  — fetch worker config for the user
// PATCH /api/worker/config — update pause/safe_mode/overrides
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { audit } from '@/lib/utils/audit'
import { createNotification } from '@/lib/utils/notifications'

export async function GET(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const supabase = createServerClient()

  // Upsert default row if it doesn't exist
  const { data, error } = await supabase
    .from('worker_config')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select()
    .single()

  // If upsert returned nothing (row already existed), just select
  if (error || !data) {
    const { data: existing } = await supabase
      .from('worker_config')
      .select('*')
      .eq('user_id', user.id)
      .single()
    return NextResponse.json({ config: existing })
  }

  return NextResponse.json({ config: data })
}

export async function PATCH(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  // Fetch current config for comparison
  const { data: current } = await supabase
    .from('worker_config')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const updates: Record<string, unknown> = {}

  // ── Pause All ─────────────────────────────────────────
  if (typeof body.paused === 'boolean') {
    updates.paused = body.paused
    if (body.paused) {
      updates.paused_at     = new Date().toISOString()
      updates.paused_reason = body.reason ?? 'Manual pause'
    } else {
      updates.paused_at     = null
      updates.paused_reason = null
    }
  }

  // ── Safe Mode ─────────────────────────────────────────
  if (typeof body.safe_mode === 'boolean') {
    updates.safe_mode = body.safe_mode
  }

  // ── Daily overrides ───────────────────────────────────
  if (body.daily_connection_override !== undefined) {
    const v = body.daily_connection_override === null
      ? null
      : Math.max(1, Math.min(30, Number(body.daily_connection_override)))
    updates.daily_connection_override = v
  }
  if (body.daily_comment_override !== undefined) {
    const v = body.daily_comment_override === null
      ? null
      : Math.max(1, Math.min(40, Number(body.daily_comment_override)))
    updates.daily_comment_override = v
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('worker_config')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('[worker/config] Update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // ── Audit + notifications for state changes ───────────
  if (typeof body.paused === 'boolean' && body.paused !== current?.paused) {
    await audit({
      user_id:    user.id,
      event_type: body.paused ? 'pause_on' : 'pause_off',
      payload:    { reason: body.reason ?? null },
    } as any)

    await createNotification({
      userId:    user.id,
      type:      body.paused ? 'pause_on' : 'pause_off',
      title:     body.paused ? '⏸ Worker paused' : '▶ Worker resumed',
      body:      body.paused
        ? `All actions paused. Reason: ${body.reason ?? 'manual'}`
        : 'Worker is active again — actions will resume on schedule.',
      actionUrl: '/board',
    })
  }

  if (typeof body.safe_mode === 'boolean' && body.safe_mode !== current?.safe_mode) {
    await createNotification({
      userId:    user.id,
      type:      body.safe_mode ? 'safe_mode_on' : 'safe_mode_off',
      title:     body.safe_mode ? '🛡 Safe mode enabled' : '🛡 Safe mode disabled',
      body:      body.safe_mode
        ? 'Only profile views will execute. Connections, comments, and DMs are queued but not sent.'
        : 'Full automation resumed.',
      actionUrl: '/settings',
    })
  }

  return NextResponse.json({ config: data })
}
