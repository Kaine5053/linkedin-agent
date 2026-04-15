// ============================================================
// Dataset Parser — uk_groundworks_civil_eng_merged.csv
//
// Maps the exact column names from this dataset to our
// internal Lead schema. Handles:
//   - Bare LinkedIn URLs (adds https://)
//   - JSON-stringified experience/skills arrays → clean strings
//   - Email extraction from contact_emails JSON blob
//   - Seniority level parsing from JSON array strings
//   - All 25 source columns preserved in enrichment_data
// ============================================================

import type { RawLeadRow } from '../types'

// The exact shape of one row from uk_groundworks_civil_eng_merged.csv
export interface GroundworksRow {
  row_num:                        string
  prospect_first_name:            string
  prospect_last_name:             string
  prospect_full_name:             string
  prospect_job_title:             string
  prospect_linkedin:              string
  prospect_job_seniority_level:   string  // JSON array e.g. '["senior"]' or ''
  prospect_job_department:        string
  prospect_country_name:          string
  prospect_region_name:           string
  prospect_city:                  string
  prospect_experience:            string  // JSON array of past role strings
  prospect_skills:                string  // JSON array of skill strings
  prospect_interests:             string
  prospect_company_name:          string
  prospect_company_website:       string
  prospect_company_linkedin:      string
  contact_professions_email:      string
  contact_professional_email_status: string  // 'valid' | 'invalid' | ''
  contact_emails:                 string  // JSON array of email objects
  contact_mobile_phone:           string
  contact_phone_numbers:          string
  created_at:                     string
  business_id:                    string
  prospect_id:                    string
}

/**
 * Parse a raw CSV row (already converted to object by Papa/csv-parse)
 * into our RawLeadRow format, ready for the import API.
 *
 * Normalises all the messy source formats.
 */
export function parseGroundworksRow(row: GroundworksRow): RawLeadRow {
  return {
    // ── Core required fields ───────────────────────────
    full_name:    cleanString(row.prospect_full_name),
    linkedin_url: normaliseLinkedInUrl(row.prospect_linkedin),

    // ── Standard lead fields ───────────────────────────
    company:   cleanString(row.prospect_company_name) || undefined,
    job_title: cleanString(row.prospect_job_title) || undefined,
    industry:  'Civil Engineering / Groundworks',  // inferred from dataset name
    notes:     buildNotes(row),

    // ── Enrichment: everything else stored in jsonb ────
    // These flow into leads.enrichment_data and are
    // available as merge tags in templates.
    first_name:          cleanString(row.prospect_first_name),
    last_name:           cleanString(row.prospect_last_name),
    seniority_level:     parseSeniorityLevel(row.prospect_job_seniority_level),
    department:          cleanString(row.prospect_job_department) || undefined,
    country:             cleanString(row.prospect_country_name),
    region:              cleanString(row.prospect_region_name) || undefined,
    city:                cleanString(row.prospect_city) || undefined,
    experience_roles:    parseJsonArray(row.prospect_experience),
    skills:              parseJsonArray(row.prospect_skills),
    company_website:     cleanString(row.prospect_company_website) || undefined,
    company_linkedin:    normaliseLinkedInUrl(row.prospect_company_linkedin) || undefined,
    email:               getBestEmail(row),
    email_status:        cleanString(row.contact_professional_email_status) || undefined,
    phone:               cleanString(row.contact_phone_numbers) || undefined,
    prospect_id:         cleanString(row.prospect_id),
    business_id:         cleanString(row.business_id),
    // Recent experience summary for personalisation (first 3 roles)
    recent_experience:   getRecentExperience(row.prospect_experience),
    // Top skills for personalisation (first 5)
    top_skills:          getTopSkills(row.prospect_skills),
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Normalise LinkedIn URL to full https:// format.
 * Source data has bare 'linkedin.com/in/...' format.
 */
export function normaliseLinkedInUrl(url: string): string {
  if (!url?.trim()) return ''
  const clean = url.trim()
  if (clean.startsWith('https://')) return clean
  if (clean.startsWith('http://'))  return clean.replace('http://', 'https://')
  if (clean.startsWith('linkedin.com')) return `https://www.${clean}`
  return clean
}

/**
 * Parse a JSON-stringified array from the CSV.
 * Returns a clean string array, or [] on parse failure.
 * Handles the double-escaped quotes from the CSV export.
 */
function parseJsonArray(raw: string): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((s: unknown) => String(s).trim()).filter(Boolean)
    }
  } catch {
    // Fallback: try splitting on common delimiters
    return raw.replace(/["\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

/**
 * Parse seniority level from '["senior"]' format.
 * Returns the first value as a clean string.
 */
function parseSeniorityLevel(raw: string): string {
  const arr = parseJsonArray(raw)
  return arr[0] ?? 'unknown'
}

/**
 * Get the best available email address.
 * Priority: contact_professions_email (if valid) → first valid in contact_emails JSON
 */
function getBestEmail(row: GroundworksRow): string | undefined {
  // Primary: the deduplicated professional email
  const primary = cleanString(row.contact_professions_email)
  if (primary && row.contact_professional_email_status === 'valid') {
    return primary
  }

  // Fallback: parse the contact_emails JSON array
  if (row.contact_emails?.trim()) {
    try {
      const emails = JSON.parse(row.contact_emails) as Array<{
        address: string
        type: string | null
      }>
      const professional = emails.find(e => e.type === 'current_professional')
      if (professional?.address) return professional.address

      const anyValid = emails.find(e => e.address?.includes('@'))
      if (anyValid?.address) return anyValid.address
    } catch {
      // ignore
    }
  }

  return undefined
}

/**
 * Build a notes string summarising what we know about this lead.
 * This appears in the lead card and can be used in DM personalisation.
 */
function buildNotes(row: GroundworksRow): string {
  const parts: string[] = []
  if (row.prospect_city)   parts.push(`Based in ${cleanString(row.prospect_city)}`)
  if (row.prospect_region_name) parts.push(cleanString(row.prospect_region_name))
  const seniority = parseSeniorityLevel(row.prospect_job_seniority_level)
  if (seniority && seniority !== 'unknown') parts.push(`${seniority}-level`)
  return parts.join(', ') || ''
}

/**
 * Get the 3 most recent experience roles as a readable string.
 * Used for DM personalisation merge tag {{recent_experience}}.
 */
function getRecentExperience(raw: string): string {
  const roles = parseJsonArray(raw)
  return roles.slice(0, 3).join(', ')
}

/**
 * Get the top 5 skills as a readable string.
 * Used for DM personalisation merge tag {{top_skills}}.
 */
function getTopSkills(raw: string): string {
  const skills = parseJsonArray(raw)
  return skills.slice(0, 5).join(', ')
}

function cleanString(s: string): string {
  return (s ?? '').trim()
}

// ── Validation ─────────────────────────────────────────────

export interface ParsedDatasetStats {
  total:           number
  valid:           number
  invalid:         number
  withEmail:       number
  withoutEmail:    number
  byRegion:        Record<string, number>
  bySeniority:     Record<string, number>
  errors:          string[]
}

/**
 * Validate and summarise the full dataset.
 * Call this before bulk import to surface any data issues.
 */
export function validateGroundworksDataset(rows: GroundworksRow[]): ParsedDatasetStats {
  const stats: ParsedDatasetStats = {
    total:        rows.length,
    valid:        0,
    invalid:      0,
    withEmail:    0,
    withoutEmail: 0,
    byRegion:     {},
    bySeniority:  {},
    errors:       [],
  }

  for (const row of rows) {
    const isValid =
      !!row.prospect_full_name?.trim() &&
      !!row.prospect_linkedin?.trim() &&
      row.prospect_linkedin.includes('linkedin.com')

    if (isValid) {
      stats.valid++
    } else {
      stats.invalid++
      stats.errors.push(
        `Row ${row.row_num}: missing name or invalid LinkedIn URL`
      )
    }

    if (getBestEmail(row)) {
      stats.withEmail++
    } else {
      stats.withoutEmail++
    }

    const region   = cleanString(row.prospect_region_name) || 'unknown'
    const seniority = parseSeniorityLevel(row.prospect_job_seniority_level)

    stats.byRegion[region]       = (stats.byRegion[region] ?? 0) + 1
    stats.bySeniority[seniority] = (stats.bySeniority[seniority] ?? 0) + 1
  }

  return stats
}
