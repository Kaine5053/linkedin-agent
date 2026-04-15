// ============================================================
// PATCH  /api/campaigns/[id] — update campaign settings
// DELETE /api/campaigns/[id] — archive campaign
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { audit } from '@/lib/utils/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = createServerClient()

  // Whitelist updatable fields
  const allowed = [
    'name', 'description', 'status',
    'dm_trigger_comments', 'dm_trigger_days',
    'template_connection_note', 'template_dm',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', authedUser.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  await audit({
    user_id:    authedUser.id,
    event_type: 'campaign.updated',
    payload:    { campaign_id: params.id, updates },
  })

  return NextResponse.json({ campaign: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'archived' })
    .eq('id', params.id)
    .eq('user_id', authedUser.id)

  if (error) {
    return NextResponse.json({ error: 'Archive failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
