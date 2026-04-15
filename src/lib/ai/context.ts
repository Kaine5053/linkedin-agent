// ============================================================
// Context Builder
// Fetches everything the AI needs about a lead from Supabase
// and assembles it into the LeadContext shape used by prompts.
// ============================================================

import { createServerClient } from '../supabase/client'
import type { LeadContext, SenderContext, GenerationConfig, AiSettings } from '../../types/ai'
import type { ToneProfile } from '../../types/ai'

/**
 * Build the complete LeadContext for a given lead ID.
 * Pulls: lead row, enrichment_data, comment history.
 */
export async function buildLeadContext(leadId: string): Promise<LeadContext> {
  const supabase = createServerClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      comments (
        post_url,
        post_snippet,
        comment_text,
        posted_at,
        status
      )
    `)
    .eq('id', leadId)
    .single()

  if (error || !lead) {
    throw new Error(`Lead ${leadId} not found: ${error?.message}`)
  }

  const enrichment = (lead.enrichment_data ?? {}) as Record<string, unknown>

  // Pull from enrichment_data fields set by dataset-parser.ts
  const getString = (key: string): string =>
    typeof enrichment[key] === 'string' ? (enrichment[key] as string) : ''

  // Comment history — only posted ones, most recent first
  const commentHistory = (lead.comments ?? [])
    .filter((c: { status: string }) => c.status === 'posted')
    .sort((a: { posted_at: string }, b: { posted_at: string }) =>
      new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
    )
    .slice(0, 5)
    .map((c: { post_snippet: string | null; comment_text: string; posted_at: string }) => ({
      post_snippet: c.post_snippet ?? '',
      comment_text: c.comment_text,
      posted_at:    c.posted_at,
    }))

  return {
    full_name:         lead.full_name,
    first_name:        lead.first_name || lead.full_name.split(' ')[0] || 'there',
    job_title:         lead.job_title         ?? getString('prospect_job_title') ?? '',
    company:           lead.company           ?? getString('prospect_company_name') ?? '',
    industry:          lead.industry          ?? 'civil engineering',
    city:              getString('city')       || getString('prospect_city') || '',
    region:            getString('region')     || getString('prospect_region_name') || '',
    seniority_level:   getString('seniority_level') || 'senior',
    top_skills:        getString('top_skills') || '',
    recent_experience: getString('recent_experience') || '',
    notes:             lead.notes             ?? '',
    comment_history:   commentHistory,
  }
}

/**
 * Build the SenderContext from ai_settings.
 */
export function buildSenderContext(settings: AiSettings): SenderContext {
  return {
    name:    settings.sender_name    || 'your colleague',
    role:    settings.sender_role    || 'industry professional',
    company: settings.sender_company || 'our company',
  }
}

/**
 * Build the GenerationConfig from ai_settings.
 */
export function buildGenerationConfig(settings: AiSettings): GenerationConfig {
  return {
    tone:                  settings.tone as ToneProfile,
    personalisation_depth: settings.personalisation_depth as 1 | 2 | 3,
    temperature:           settings.temperature,
    custom_instructions:   settings.custom_instructions ?? null,
    banned_phrases:        settings.banned_phrases ?? [],
    target_industry:       settings.target_industry,
  }
}

/**
 * Fetch ai_settings for a user.
 * Creates a default row if none exists.
 */
export async function getOrCreateAiSettings(userId: string): Promise<AiSettings> {
  const supabase = createServerClient()

  const { data: existing, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existing && !error) return existing as AiSettings

  // Create default settings for this user
  const { data: created, error: createErr } = await supabase
    .from('ai_settings')
    .insert({ user_id: userId })
    .select()
    .single()

  if (createErr || !created) {
    throw new Error(`Failed to create AI settings for user ${userId}: ${createErr?.message}`)
  }

  return created as AiSettings
}

/**
 * Fetch the best available connection note template for a campaign.
 * Priority: campaign template → user default template → built-in default.
 */
export async function getCampaignTemplate(
  campaignId: string,
  type: 'connection_note' | 'dm'
): Promise<string | null> {
  const supabase = createServerClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('template_connection_note, template_dm, user_id')
    .eq('id', campaignId)
    .single()

  if (!campaign) return null

  if (type === 'connection_note' && campaign.template_connection_note) {
    return campaign.template_connection_note
  }
  if (type === 'dm' && campaign.template_dm) {
    return campaign.template_dm
  }

  // Fall back to user's named templates
  const { data: templates } = await supabase
    .from('templates')
    .select('content')
    .eq('user_id', campaign.user_id)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)

  return templates?.[0]?.content ?? null
}
