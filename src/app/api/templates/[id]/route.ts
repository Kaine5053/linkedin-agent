// ============================================================
// PATCH /api/templates/[id] — update a template
// DELETE /api/templates/[id] — delete a template
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createServerClient } from '@/lib/supabase/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = createServerClient()

  const updates: Record<string, unknown> = {}
  if (body.name    !== undefined) updates.name    = String(body.name).trim()
  if (body.content !== undefined) updates.content = String(body.content).trim()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Connection note length guard
  if (updates.content && body.type === 'connection_note' && (updates.content as string).length > 350) {
    return NextResponse.json(
      { error: 'Connection note template too long (may exceed 300 chars after rendering)' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', id)
    .eq('user_id', authedUser.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ template: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('user_id', authedUser.id)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}
