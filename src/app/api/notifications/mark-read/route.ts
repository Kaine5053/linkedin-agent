// POST /api/notifications/mark-read
// Body: { notification_id? } — omit to mark ALL as read

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const { notification_id } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  let query = supabase
    .from('in_app_notifications')
    .update({ read: true })
    .eq('user_id', user.id)

  if (notification_id) {
    query = query.eq('id', notification_id)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
