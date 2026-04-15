// ============================================================
// GET  /api/ai/settings  — fetch user's AI settings + usage summary
// PUT  /api/ai/settings  — update AI settings (full replace of mutable fields)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createServerClient } from '@/lib/supabase/client'
import { getOrCreateAiSettings } from '@/lib/ai/context'
import { getUsageSummary } from '@/lib/ai/logger'
import type { AiSettings, ToneProfile } from '@/types/ai'

const VALID_TONES: ToneProfile[] = ['professional', 'conversational', 'direct', 'warm']

export async function GET(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const [settings, usage] = await Promise.all([
    getOrCreateAiSettings(authedUser.id),
    getUsageSummary(authedUser.id, 30),
  ])

  return NextResponse.json({
    settings,
    usage_last_30_days: usage,
  })
}

export async function PUT(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: Partial<AiSettings>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate each field before touching the DB
  const errors: string[] = []
  const updates: Partial<AiSettings> = {}

  if (body.tone !== undefined) {
    if (!VALID_TONES.includes(body.tone)) {
      errors.push(`tone must be one of: ${VALID_TONES.join(', ')}`)
    } else {
      updates.tone = body.tone
    }
  }

  if (body.personalisation_depth !== undefined) {
    const d = Number(body.personalisation_depth)
    if (![1, 2, 3].includes(d)) {
      errors.push('personalisation_depth must be 1, 2, or 3')
    } else {
      updates.personalisation_depth = d as 1 | 2 | 3
    }
  }

  if (body.temperature !== undefined) {
    const t = Number(body.temperature)
    if (isNaN(t) || t < 0 || t > 1) {
      errors.push('temperature must be a number between 0.0 and 1.0')
    } else {
      updates.temperature = Math.round(t * 100) / 100
    }
  }

  if (body.sender_name !== undefined) {
    updates.sender_name = String(body.sender_name).slice(0, 100).trim()
  }
  if (body.sender_role !== undefined) {
    updates.sender_role = String(body.sender_role).slice(0, 150).trim()
  }
  if (body.sender_company !== undefined) {
    updates.sender_company = String(body.sender_company).slice(0, 150).trim()
  }
  if (body.target_industry !== undefined) {
    updates.target_industry = String(body.target_industry).slice(0, 100).trim()
  }

  if (body.custom_instructions !== undefined) {
    const instructions = String(body.custom_instructions).slice(0, 500)
    // Quick safety check on custom instructions themselves
    if (/ignore (all |previous |above |prior )?(instructions?|rules?|constraints?)/i.test(instructions)) {
      errors.push('custom_instructions contains disallowed content (prompt injection attempt detected)')
    } else {
      updates.custom_instructions = instructions.trim() || null
    }
  }

  if (body.banned_phrases !== undefined) {
    if (!Array.isArray(body.banned_phrases)) {
      errors.push('banned_phrases must be an array of strings')
    } else {
      updates.banned_phrases = body.banned_phrases
        .map(p => String(p).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 50) // max 50 banned phrases
    }
  }

  if (body.allow_connection_notes !== undefined) {
    updates.allow_connection_notes = Boolean(body.allow_connection_notes)
  }
  if (body.allow_comments !== undefined) {
    updates.allow_comments = Boolean(body.allow_comments)
  }
  if (body.allow_dms !== undefined) {
    updates.allow_dms = Boolean(body.allow_dms)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Upsert — create if doesn't exist, update if it does
  const { data, error } = await supabase
    .from('ai_settings')
    .upsert({ user_id: authedUser.id, ...updates }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('[ai/settings] Upsert error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
