// ============================================================
// GET  /api/leads         — list leads (filterable by campaign/stage)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { auditStageChange } from '@/lib/utils/audit'
import type { LeadStage } from '@/types'

export async function GET(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const campaign_id = searchParams.get('campaign_id')
  const stage       = searchParams.get('stage') as LeadStage | null
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset      = parseInt(searchParams.get('offset') ?? '0')

  const supabase = createServerClient()

  let query = supabase
    .from('leads')
    .select(`
      *,
      pending_actions ( id, action_type, status, execute_after, created_at ),
      comments ( id, post_url, post_snippet, comment_text, posted_at ),
      dm_drafts ( id, status, draft_text, drafted_at )
    `, { count: 'exact' })
    .eq('user_id', authedUser.id)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('imported_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (campaign_id) query = query.eq('campaign_id', campaign_id)
  if (stage)       query = query.eq('stage', stage)

  const { data, count, error } = await query

  if (error) {
    console.error('[leads] Query error:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  return NextResponse.json({ leads: data, total: count, limit, offset })
}
