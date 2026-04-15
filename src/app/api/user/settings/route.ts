// ============================================================
// PATCH /api/user/settings
// Updates the user's timezone and (optionally) their LinkedIn
// session cookie (li_at). The session cookie is written to the
// users.li_session column — it is used only by the VPS worker,
// never by Vercel-side code.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { audit } from '@/lib/utils/audit'

const VALID_TIMEZONES = new Set([
  'UTC', 'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Rome', 'Europe/Stockholm',
  'Europe/Warsaw', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
])

export async function PATCH(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: {
    timezone?:    string
    li_session?:  string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  // Validate timezone
  if (body.timezone !== undefined) {
    if (!VALID_TIMEZONES.has(body.timezone)) {
      return NextResponse.json({ error: `Invalid timezone: ${body.timezone}` }, { status: 400 })
    }
    updates.timezone = body.timezone
  }

  // LinkedIn session cookie — accept any non-empty string
  // (format validation is done by the VPS worker on first use)
  if (body.li_session !== undefined) {
    if (body.li_session.trim().length > 0) {
      // Basic sanity check — li_at cookies are typically very long base64-like strings
      if (body.li_session.trim().length < 20) {
        return NextResponse.json({ error: 'Session cookie looks too short — paste the full li_at value' }, { status: 400 })
      }
      updates.li_session = body.li_session.trim()
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', authedUser.id)
    .select('id, email, timezone, full_name')
    .single()

  if (error) {
    console.error('[user/settings] Update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  await audit({
    user_id:    authedUser.id,
    event_type: 'user.session_updated',
    payload: {
      updated_fields: Object.keys(updates),
      // Never log the session value itself
      li_session_set: !!updates.li_session,
    },
  })

  return NextResponse.json({ user: data })
}

// GET — fetch current user profile
export async function GET(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, timezone, settings, created_at')
    .eq('id', authedUser.id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Never return li_session to the client
  return NextResponse.json({ user: data })
}
