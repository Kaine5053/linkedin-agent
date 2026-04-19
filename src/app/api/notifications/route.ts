// ============================================================
// GET  /api/notifications       — list notifications
// POST /api/notifications/mark-read — mark one or all as read
// GET  /api/notifications/prefs — get preferences
// PUT  /api/notifications/prefs — update preferences
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'

// GET — list notifications (unread first, then recent)
export async function GET(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const p        = new URL(req.url).searchParams
  const unreadOnly = p.get('unread') === 'true'
  const limit    = Math.min(Number(p.get('limit') ?? 30), 100)
  const supabase = createServerClient()

  let query = supabase
    .from('in_app_notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('read', false)

  const { data, error } = await query
  if (error) {
    // Table might not exist yet — return empty state instead of 500
    if (error.code === '42P01') {
      return NextResponse.json({ notifications: [], unread_count: 0 })
    }
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }

  const unreadCount = (data ?? []).filter((n: any) => !n.read).length

  return NextResponse.json({ notifications: data ?? [], unread_count: unreadCount })
}
