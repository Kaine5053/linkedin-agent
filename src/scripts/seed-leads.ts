// ============================================================
// Seed Script — Import uk_groundworks_civil_eng_merged.csv
//
// Run once during setup to load all 331 leads into Supabase.
//
// Usage (from vercel/ directory):
//   npx ts-node src/scripts/seed-leads.ts
//
// Prerequisites:
//   - .env.local must have SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   - A campaign must already exist (or pass --create-campaign)
//   - The CSV must be at src/data/uk_groundworks_civil_eng_merged.csv
// ============================================================

import 'dotenv/config'
import fs   from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import {
  parseGroundworksRow,
  validateGroundworksDataset,
  normaliseLinkedInUrl,
  type GroundworksRow,
} from '../lib/utils/dataset-parser'

// ── Config ─────────────────────────────────────────────────

const SUPABASE_URL     = process.env.SUPABASE_URL     || process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CSV_PATH         = path.resolve(__dirname, '../data/uk_groundworks_civil_eng_merged.csv')
const CAMPAIGN_NAME    = 'UK Groundworks & Civil Engineering — Initial Outreach'
const USER_EMAIL       = process.env.SEED_USER_EMAIL!  // the user to assign leads to

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}
if (!USER_EMAIL) {
  console.error('ERROR: SEED_USER_EMAIL must be set (the user account to assign leads to)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Main ───────────────────────────────────────────────────

async function main() {
  console.log('============================================================')
  console.log(' LinkedIn Agent — Seeding uk_groundworks_civil_eng_merged')
  console.log('============================================================')

  // 1. Read and parse CSV
  console.log(`\n[1/5] Reading CSV: ${CSV_PATH}`)
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const rawRows = parse(csvContent, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
  }) as GroundworksRow[]

  console.log(`      Read ${rawRows.length} rows`)

  // 2. Validate dataset
  console.log('\n[2/5] Validating dataset...')
  const stats = validateGroundworksDataset(rawRows)
  console.log(`      Total:       ${stats.total}`)
  console.log(`      Valid:       ${stats.valid}`)
  console.log(`      Invalid:     ${stats.invalid}`)
  console.log(`      With email:  ${stats.withEmail}`)
  console.log(`      No email:    ${stats.withoutEmail}`)
  console.log(`      By region:`, stats.byRegion)
  console.log(`      By seniority:`, stats.bySeniority)

  if (stats.errors.length > 0) {
    console.warn(`\n      Validation warnings (${stats.errors.length}):`)
    stats.errors.slice(0, 10).forEach(e => console.warn(`        ${e}`))
    if (stats.errors.length > 10) console.warn(`        ... and ${stats.errors.length - 10} more`)
  }

  // 3. Get or create user
  console.log(`\n[3/5] Looking up user: ${USER_EMAIL}`)
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', USER_EMAIL)
    .single()

  if (userErr || !user) {
    console.error(`ERROR: User with email "${USER_EMAIL}" not found in database.`)
    console.error('       Sign up first via the app, then run this seed script.')
    process.exit(1)
  }
  console.log(`      Found user: ${user.id}`)

  // 4. Get or create campaign
  console.log(`\n[4/5] Setting up campaign: "${CAMPAIGN_NAME}"`)
  let campaignId: string

  const { data: existing } = await supabase
    .from('campaigns')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', CAMPAIGN_NAME)
    .single()

  if (existing) {
    campaignId = existing.id
    console.log(`      Using existing campaign: ${campaignId}`)
  } else {
    const { data: newCampaign, error: createErr } = await supabase
      .from('campaigns')
      .insert({
        user_id:     user.id,
        name:        CAMPAIGN_NAME,
        description: 'Auto-seeded from uk_groundworks_civil_eng_merged.csv — 331 civil engineering and groundworks professionals across the UK.',
        status:      'active',
        dm_trigger_comments: 3,
        dm_trigger_days:     7,
        // Connection note template — uses merge tags matched to this dataset
        template_connection_note:
          `Hi {{first_name}}, I came across your profile and noticed your work in {{job_title}} at {{company}}. I'm building connections in the UK civil engineering space — would be great to connect.`,
        // DM template — filled in by AI layer later; this is the base
        template_dm:
          `Hi {{first_name}},\n\nReally enjoyed your recent posts — great perspective on the industry.\n\nI wanted to reach out because {{notes}}. Given your background in {{top_skills}}, I think there could be something worth exploring together.\n\nWould you be open to a quick call?\n\nBest,\n{{sender_name}}`,
      })
      .select()
      .single()

    if (createErr || !newCampaign) {
      console.error('ERROR: Failed to create campaign:', createErr?.message)
      process.exit(1)
    }
    campaignId = newCampaign.id
    console.log(`      Created campaign: ${campaignId}`)
  }

  // 5. Import leads in batches of 50
  console.log(`\n[5/5] Importing ${stats.valid} leads (batch size 50)...`)

  const validRows = rawRows.filter(r =>
    r.prospect_full_name?.trim() && r.prospect_linkedin?.includes('linkedin.com')
  )

  // Check for existing leads to avoid duplicates on re-run
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('linkedin_url')
    .eq('campaign_id', campaignId)

  const existingUrls = new Set(
    (existingLeads ?? []).map((l: { linkedin_url: string }) => l.linkedin_url)
  )

  let imported  = 0
  let skipped   = 0
  let failed    = 0
  const BATCH   = 50

  for (let i = 0; i < validRows.length; i += BATCH) {
    const batch = validRows.slice(i, i + BATCH)

    const toInsert = batch
      .map(row => parseGroundworksRow(row))
      .filter(lead => {
        const url = normaliseLinkedInUrl(lead.linkedin_url)
        if (existingUrls.has(url)) { skipped++; return false }
        existingUrls.add(url)
        return true
      })
      .map(lead => ({
        campaign_id:      campaignId,
        user_id:          user.id,
        full_name:        lead.full_name,
        linkedin_url:     normaliseLinkedInUrl(lead.linkedin_url),
        company:          lead.company   ?? null,
        job_title:        lead.job_title ?? null,
        industry:         lead.industry  ?? null,
        notes:            lead.notes     ?? null,
        stage:            'imported' as const,
        enrichment_data:  buildEnrichmentData(lead),
        imported_at:      new Date().toISOString(),
        connection_sent_at: null,
        connected_at:     null,
        dm_ready_at:      null,
        dm_sent_at:       null,
        last_activity_at: null,
        comment_count:    0,
      }))

    if (toInsert.length === 0) continue

    const { error: insertErr, data: inserted } = await supabase
      .from('leads')
      .insert(toInsert)
      .select('id')

    if (insertErr) {
      console.error(`  Batch ${i}–${i + BATCH} error:`, insertErr.message)
      failed += toInsert.length
    } else {
      imported += inserted?.length ?? toInsert.length
      process.stdout.write(`\r      Progress: ${imported + skipped}/${validRows.length}`)
    }
  }

  console.log('\n')
  console.log('============================================================')
  console.log(' Seed complete!')
  console.log(`  Imported:   ${imported} leads`)
  console.log(`  Skipped:    ${skipped} (already existed)`)
  console.log(`  Failed:     ${failed}`)
  console.log(`  Campaign:   ${CAMPAIGN_NAME}`)
  console.log(`  Campaign ID: ${campaignId}`)
  console.log('')
  console.log(' Next step: connection_request actions will be scheduled')
  console.log(' automatically when you activate the worker.')
  console.log('============================================================')
}

// ── Build enrichment_data object ──────────────────────────
// Everything from the dataset that isn't a core Lead field
// gets stored here for template personalisation.

function buildEnrichmentData(lead: Record<string, unknown>): Record<string, unknown> {
  const coreFields = new Set([
    'full_name', 'linkedin_url', 'company', 'job_title', 'industry', 'notes'
  ])
  const enrichment: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(lead)) {
    if (!coreFields.has(key) && value !== undefined && value !== '') {
      enrichment[key] = value
    }
  }
  return enrichment
}

main().catch(err => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
