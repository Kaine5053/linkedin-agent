// ============================================================
// GET  /api/templates   — list user's templates
// POST /api/templates   — create a template
// ============================================================

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
  const type = searchParams.get('type') // 'connection_note' | 'dm'

  const supabase = createServerClient()

  let query = supabase
    .from('templates')
    .select('*')
    .eq('user_id', authedUser.id)
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })

  return NextResponse.json({ templates: data })
}

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { name, type, content } = body

  if (!name || !type || !content) {
    return NextResponse.json({ error: 'name, type, and content required' }, { status: 400 })
  }

  if (!['connection_note', 'dm'].includes(type)) {
    return NextResponse.json({ error: 'type must be connection_note or dm' }, { status: 400 })
  }

  // Validate connection note length (before merge tags are substituted)
  if (type === 'connection_note' && content.length > 350) {
    return NextResponse.json(
      { error: 'Connection note template too long (rendered output may exceed LinkedIn 300 char limit)' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('templates')
    .insert({ user_id: authedUser.id, name, type, content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  return NextResponse.json({ template: data }, { status: 201 })
}
