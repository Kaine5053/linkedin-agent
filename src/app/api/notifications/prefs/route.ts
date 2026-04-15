// GET  /api/notifications/prefs — fetch preferences
// PUT  /api/notifications/prefs — update preferences

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('notification_prefs')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select()
    .single()

  if (!data) {
    const { data: existing } = await supabase
      .from('notification_prefs')
      .select('*')
      .eq('user_id', user.id)
      .single()
    return NextResponse.json({ prefs: existing })
  }

  return NextResponse.json({ prefs: data })
}

export async function PUT(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const ALLOWED = [
    'notify_dm_ready', 'notify_connected', 'notify_daily_cap',
    'notify_worker_error', 'notify_reply',
    'email_enabled', 'email_address', 'email_dm_ready', 'email_worker_error',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  if (updates.email_address && typeof updates.email_address === 'string') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email_address)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('notification_prefs')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ prefs: data })
}
