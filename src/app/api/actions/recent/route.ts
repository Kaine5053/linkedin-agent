// GET /api/actions/recent
// Returns the most recent pending/completed actions for the worker status panel

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('pending_actions')
    .select(`
      id, action_type, status, execute_after, completed_at, last_error, attempts,
      leads:lead_id ( full_name, company )
    `)
    .eq('user_id', authedUser.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 })
  }

  return NextResponse.json({ actions: data ?? [] })
}
