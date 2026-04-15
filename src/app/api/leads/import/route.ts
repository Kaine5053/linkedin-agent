// ============================================================
// POST /api/leads/import
//
// Accepts two input formats:
//   1. Generic JSON array (original format)
//   2. Groundworks dataset format — auto-detected by presence
//      of 'prospect_linkedin' column name
//
// Auto-detects the groundworks format and applies the dataset
// parser to normalise all 25 columns before import.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'
import { calculateExecuteAfter } from '@/lib/utils/pacing'
import { renderTemplate, buildMergeContext, validateConnectionNote } from '@/lib/utils/templates'
import { audit } from '@/lib/utils/audit'
import {
  parseGroundworksRow,
  validateGroundworksDataset,
  normaliseLinkedInUrl,
  type GroundworksRow,
} from '@/lib/utils/dataset-parser'
import type {
  ImportLeadsRequest,
  ImportLeadsResponse,
  RawLeadRow,
  Lead,
  UserSettings,
} from '@/types'

export async function POST(req: NextRequest) {
  let authedUser: { id: string }
  try {
    authedUser = await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: ImportLeadsRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { campaign_id, leads: rawLeads } = body

  if (!campaign_id || !Array.isArray(rawLeads) || rawLeads.length === 0) {
    return NextResponse.json(
      { error: 'campaign_id and a non-empty leads array are required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data: campaign, error: campaignErr } = await supabase
    .from('campaigns')
    .select('*, users!inner(id, timezone, settings, li_session)')
    .eq('id', campaign_id)
    .eq('user_id', authedUser.id)
    .single()

  if (campaignErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 })
  }

  const userSettings = campaign.users.settings as UserSettings
  const userTimezone = campaign.users.timezone as string

  // Auto-detect groundworks format by column name
  const isGroundworksFormat = 'prospect_linkedin' in (rawLeads[0] ?? {})
  let normalisedLeads: RawLeadRow[]

  if (isGroundworksFormat) {
    const gwRows = rawLeads as unknown as GroundworksRow[]
    const validation = validateGroundworksDataset(gwRows)
    if (validation.invalid > 0) {
      console.warn(`[import] ${validation.invalid} invalid rows will be skipped`)
    }
    normalisedLeads = gwRows
      .filter(r => r.prospect_full_name?.trim() && r.prospect_linkedin?.includes('linkedin.com'))
      .map(parseGroundworksRow)
    console.log(`[import] Groundworks format: ${normalisedLeads.length}/${rawLeads.length} valid rows`)
  } else {
    normalisedLeads = rawLeads as RawLeadRow[]
  }

  const { data: existingLeads } = await supabase
    .from('leads')
    .select('linkedin_url')
    .eq('campaign_id', campaign_id)

  const existingUrls = new Set(
    (existingLeads ?? []).map((l: { linkedin_url: string }) => normaliseLinkedInUrl(l.linkedin_url))
  )

  const toInsert: Omit<Lead, 'id' | 'first_name' | 'created_at' | 'updated_at'>[] = []
  const errors: string[] = []
  let duplicateCount = 0

  for (const lead of normalisedLeads) {
    if (!lead.full_name?.trim()) { errors.push('Skipped: missing full_name'); continue }
    if (!lead.linkedin_url?.trim()) { errors.push(`"${lead.full_name}": missing linkedin_url`); continue }

    const normUrl = normaliseLinkedInUrl(lead.linkedin_url)
    if (existingUrls.has(normUrl)) { duplicateCount++; continue }
    existingUrls.add(normUrl)

    const { full_name, linkedin_url, company, job_title, industry, notes, ...rest } = lead

    toInsert.push({
      campaign_id,
      user_id:            authedUser.id,
      full_name:          full_name.trim(),
      linkedin_url:       normUrl,
      company:            company?.trim() ?? null,
      job_title:          job_title?.trim() ?? null,
      industry:           industry?.trim() ?? null,
      notes:              notes?.trim() ?? null,
      stage:              'imported',
      enrichment_data:    rest as Record<string, unknown>,
      imported_at:        new Date().toISOString(),
      connection_sent_at: null,
      connected_at:       null,
      dm_ready_at:        null,
      dm_sent_at:         null,
      last_activity_at:   null,
      comment_count:      0,
    })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'No valid leads to import', duplicates: duplicateCount, details: errors }, { status: 422 })
  }

  const { data: insertedLeads, error: insertErr } = await supabase
    .from('leads')
    .insert(toInsert)
    .select()

  if (insertErr) {
    console.error('[leads/import] Insert error:', insertErr)
    return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
  }

  scheduleConnectionActions(insertedLeads as Lead[], campaign, authedUser.id, userSettings, userTimezone)
    .catch(err => console.error('[leads/import] Scheduling error:', err))

  await audit({
    user_id:    authedUser.id,
    event_type: 'lead.imported',
    payload: {
      campaign_id,
      format:     isGroundworksFormat ? 'groundworks_dataset' : 'generic',
      count:      insertedLeads.length,
      duplicates: duplicateCount,
    },
  })

  const response: ImportLeadsResponse = {
    imported:   insertedLeads.length,
    duplicates: duplicateCount,
    errors,
  }

  return NextResponse.json(response, { status: 201 })
}

async function scheduleConnectionActions(
  leads: Lead[],
  campaign: { id: string; template_connection_note: string | null },
  userId: string,
  settings: UserSettings,
  timezone: string
) {
  const supabase = createServerClient()

  for (const lead of leads) {
    const pacing = await calculateExecuteAfter({ userId, actionType: 'connection_request', settings, timezone })

    if (!pacing.allowed) {
      await audit({ user_id: userId, lead_id: lead.id, event_type: 'pacing.daily_cap_reached', payload: { reason: pacing.reason } })
      continue
    }

    const context = buildMergeContext(lead)
    const rawNote = campaign.template_connection_note
      ?? `Hi {{first_name}}, I came across your profile and noticed your work as {{job_title}} at {{company}} — would love to connect.`
    const note = renderTemplate(rawNote, context)
    const { valid } = validateConnectionNote(note)

    const { data: action } = await supabase
      .from('pending_actions')
      .insert({
        lead_id: lead.id, user_id: userId, campaign_id: campaign.id,
        action_type: 'connection_request', status: 'scheduled',
        execute_after: pacing.execute_after.toISOString(),
        payload: { note: valid ? note : note.slice(0, 297) + '…' },
      })
      .select().single()

    if (action) {
      await audit({ user_id: userId, lead_id: lead.id, action_id: action.id, event_type: 'action.created', payload: { action_type: 'connection_request' } })
    }
  }
}
