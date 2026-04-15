// POST /api/auth/session
// Saves the LinkedIn session cookie (li_at) to the user's profile.
// Stored encrypted at rest via Supabase column-level encryption.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { audit } from '@/lib/utils/audit'

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { li_session } = body

  if (!li_session?.trim()) {
    return NextResponse.json({ error: 'li_session is required' }, { status: 400 })
  }

  // Basic validation — li_at tokens typically start with AQE
  if (!li_session.trim().match(/^[A-Za-z0-9_\-\.+/=]{20,}/)) {
    return NextResponse.json(
      { error: 'Invalid session cookie format — should be the value of the li_at cookie from linkedin.com' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('users')
    .update({ li_session: li_session.trim() })
    .eq('id', authedUser.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }

  await audit({
    user_id:    authedUser.id,
    event_type: 'user.session_updated',
    payload:    { updated_at: new Date().toISOString() },
  })

  return NextResponse.json({ success: true })
}
