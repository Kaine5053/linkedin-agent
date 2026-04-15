// ============================================================
// GET  /api/campaigns     — list campaigns for authed user
// POST /api/campaigns     — create campaign
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { audit } from '@/lib/utils/audit'

export async function GET(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      leads ( count )
    `)
    .eq('user_id', authedUser.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }

  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()

  const {
    name,
    description,
    dm_trigger_comments = 3,
    dm_trigger_days = 7,
    template_connection_note,
    template_dm,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      user_id:                  authedUser.id,
      name:                     name.trim(),
      description:              description ?? null,
      status:                   'active',
      dm_trigger_comments,
      dm_trigger_days,
      template_connection_note: template_connection_note ?? null,
      template_dm:              template_dm ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }

  await audit({
    user_id:    authedUser.id,
    event_type: 'campaign.created',
    payload:    { campaign_id: campaign.id, name: campaign.name },
  })

  return NextResponse.json({ campaign }, { status: 201 })
}
