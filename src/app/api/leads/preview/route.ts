// ============================================================
// POST /api/leads/preview
//
// Send the raw rows (from CSV parse on the client) and get back
// a validation summary + first 10 normalised leads to review
// before committing to a full import.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/client'
import {
  parseGroundworksRow,
  validateGroundworksDataset,
  normaliseLinkedInUrl,
  type GroundworksRow,
} from '@/lib/utils/dataset-parser'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req.headers.get('Authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { leads: rawLeads } = body

  if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
    return NextResponse.json({ error: 'leads array required' }, { status: 400 })
  }

  const isGroundworksFormat = 'prospect_linkedin' in (rawLeads[0] ?? {})

  if (!isGroundworksFormat) {
    return NextResponse.json({ error: 'Generic format preview not supported yet' }, { status: 400 })
  }

  const gwRows = rawLeads as GroundworksRow[]
  const stats  = validateGroundworksDataset(gwRows)

  // Normalise first 10 valid rows for preview
  const preview = gwRows
    .filter(r => r.prospect_full_name?.trim() && r.prospect_linkedin?.includes('linkedin.com'))
    .slice(0, 10)
    .map(row => {
      const parsed = parseGroundworksRow(row)
      return {
        full_name:    parsed.full_name,
        linkedin_url: normaliseLinkedInUrl(parsed.linkedin_url),
        company:      parsed.company,
        job_title:    parsed.job_title,
        city:         parsed.city,
        region:       parsed.region,
        seniority:    parsed.seniority_level,
        email:        parsed.email ?? null,
        top_skills:   parsed.top_skills,
      }
    })

  return NextResponse.json({
    format:  'groundworks_dataset',
    stats,
    preview,
  })
}
