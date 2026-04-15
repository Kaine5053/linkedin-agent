// ============================================================
// AI Service — Core Generation Functions
//
// Three public functions, each:
//   1. Fetches lead context + AI settings from Supabase
//   2. Builds the prompt via prompts.ts
//   3. Calls Claude via client.ts
//   4. Runs safety checks via safety.ts
//   5. Logs the generation via logger.ts
//   6. Returns the final output or throws AiError
//
// These are called by the API routes before writing to
// pending_actions or dm_drafts.
// ============================================================

import { callClaude, AI_MODEL, AiError } from './client'
import {
  buildConnectionNotePrompts,
  buildCommentPrompts,
  buildDmPrompts,
  type CommentTone,
} from './prompts'
import { runSafetyChecks, looksPersonalised } from './safety'
import { logGeneration } from './logger'
import {
  buildLeadContext,
  buildSenderContext,
  buildGenerationConfig,
  getOrCreateAiSettings,
  getCampaignTemplate,
} from './context'
import { createServerClient } from '../supabase/client'
import type {
  GenerateConnectionNoteResponse,
  GenerateCommentResponse,
  GenerateDmResponse,
} from '../../types/ai'

// ── Generate Connection Note ───────────────────────────────

/**
 * Generate a personalised LinkedIn connection note for a lead.
 * Called by POST /api/ai/generate/connection-note
 */
export async function generateConnectionNote(params: {
  userId:     string
  leadId:     string
  campaignId: string
  hint?:      string
}): Promise<GenerateConnectionNoteResponse> {
  const { userId, leadId, campaignId, hint } = params

  // 1. Fetch context
  const [aiSettings, leadContext, template] = await Promise.all([
    getOrCreateAiSettings(userId),
    buildLeadContext(leadId),
    getCampaignTemplate(campaignId, 'connection_note'),
  ])

  if (!aiSettings.allow_connection_notes) {
    throw new AiError('Connection note generation is disabled in your AI settings', null)
  }

  const sender = buildSenderContext(aiSettings)
  const config = buildGenerationConfig(aiSettings)

  // 2. Build prompts
  const { system, user } = buildConnectionNotePrompts({
    lead:     leadContext,
    sender,
    config,
    template: template ?? undefined,
    hint,
  })

  // 3. Call Claude
  const { text: rawResponse, usage } = await callClaude({
    systemPrompt: system,
    userPrompt:   user,
    temperature:  config.temperature,
    maxTokens:    150,  // connection notes are short — cap tokens for cost efficiency
  })

  // 4. Safety checks
  const safety = runSafetyChecks(rawResponse, 'connection_note', config.banned_phrases)

  if (!safety.passed) {
    console.warn(`[ai] Connection note safety FAILED for lead ${leadId}:`, safety.flags)
    // Log the failed generation for debugging
    await logGeneration({
      userId, leadId, generationType: 'connection_note',
      promptSnapshot: `${system}\n\n---\n\n${user}`,
      rawResponse, finalOutput: null, safety,
      model: AI_MODEL, usage, temperature: config.temperature,
    })
    throw new AiError(
      `Generated connection note failed safety checks: ${safety.flags.join(', ')}`,
      null
    )
  }

  // Verify it's actually personalised (has the person's name)
  if (!looksPersonalised(safety.cleaned, leadContext.first_name)) {
    console.warn(`[ai] Connection note doesn't appear personalised for ${leadContext.first_name}`)
    // Don't throw — it may still be good — but flag it
    safety.flags.push('personalisation:name_not_found')
  }

  // 5. Log
  const generationId = await logGeneration({
    userId, leadId, generationType: 'connection_note',
    promptSnapshot: `${system}\n\n---\n\n${user}`,
    rawResponse, finalOutput: safety.cleaned, safety,
    model: AI_MODEL, usage, temperature: config.temperature,
  })

  console.log(`[ai] Connection note generated for ${leadContext.full_name} (${safety.cleaned.length} chars)`)

  return {
    note:          safety.cleaned,
    char_count:    safety.cleaned.length,
    generation_id: generationId ?? '',
    safety_passed: safety.passed,
    safety_flags:  safety.flags,
  }
}

// ── Generate Post Comment ──────────────────────────────────

/**
 * Generate a vibe-matched comment for a specific LinkedIn post.
 * Called by POST /api/ai/generate/comment
 */
export async function generateComment(params: {
  userId:       string
  leadId:       string
  postUrl:      string
  postContent:  string
  postAuthor:   string
  toneOverride?: CommentTone
}): Promise<GenerateCommentResponse> {
  const { userId, leadId, postUrl, postContent, postAuthor, toneOverride } = params

  if (!postContent?.trim()) {
    throw new AiError('Post content is required to generate a contextual comment', null)
  }
  if (postContent.trim().length < 20) {
    throw new AiError('Post content is too short to generate a meaningful comment', null)
  }

  const [aiSettings, leadContext] = await Promise.all([
    getOrCreateAiSettings(userId),
    buildLeadContext(leadId),
  ])

  if (!aiSettings.allow_comments) {
    throw new AiError('Comment generation is disabled in your AI settings', null)
  }

  const sender = buildSenderContext(aiSettings)
  const config = buildGenerationConfig(aiSettings)

  const { system, user } = buildCommentPrompts({
    lead:         leadContext,
    sender,
    config,
    postContent,
    postAuthor,
    toneOverride,
  })

  const { text: rawResponse, usage } = await callClaude({
    systemPrompt: system,
    userPrompt:   user,
    temperature:  Math.min(config.temperature + 0.1, 1.0), // slightly higher temp for comments = more natural variation
    maxTokens:    400,
  })

  const safety = runSafetyChecks(rawResponse, 'comment', config.banned_phrases)

  const generationId = await logGeneration({
    userId, leadId, generationType: 'comment',
    promptSnapshot: `${system}\n\n---\n\n${user}`,
    rawResponse, finalOutput: safety.passed ? safety.cleaned : null, safety,
    model: AI_MODEL, usage, temperature: config.temperature,
  })

  if (!safety.passed) {
    throw new AiError(
      `Generated comment failed safety checks: ${safety.flags.join(', ')}`,
      null
    )
  }

  // Determine the effective tone used
  const { CommentTone: _, ...toneInfo } = { CommentTone: null }
  const effectiveTone = toneOverride ?? mapConfigToneToCommentTone(config.tone)

  console.log(`[ai] Comment generated for ${leadContext.full_name} (${effectiveTone} tone, ${safety.cleaned.length} chars)`)

  return {
    comment:       safety.cleaned,
    tone_used:     effectiveTone,
    generation_id: generationId ?? '',
    safety_passed: safety.passed,
    safety_flags:  safety.flags,
  }
}

// ── Generate DM Draft ──────────────────────────────────────

/**
 * Generate a personalised DM draft based on the full engagement history.
 * Creates a dm_drafts row (status: pending_review) and returns it.
 * Called by POST /api/ai/generate/dm
 */
export async function generateDmDraft(params: {
  userId:            string
  leadId:            string
  campaignId:        string
  existingDraftId?:  string
  regenInstruction?: string
}): Promise<GenerateDmResponse> {
  const { userId, leadId, campaignId, existingDraftId, regenInstruction } = params

  const [aiSettings, leadContext, template] = await Promise.all([
    getOrCreateAiSettings(userId),
    buildLeadContext(leadId),
    getCampaignTemplate(campaignId, 'dm'),
  ])

  if (!aiSettings.allow_dms) {
    throw new AiError('DM generation is disabled in your AI settings', null)
  }

  // Verify the lead is at an appropriate stage for a DM
  const supabase = createServerClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('stage')
    .eq('id', leadId)
    .single()

  if (lead && !['dm_ready', 'commenting', 'connected'].includes(lead.stage)) {
    console.warn(`[ai] DM generated for lead in stage "${lead.stage}" — unusual but allowed`)
  }

  const sender = buildSenderContext(aiSettings)
  const config = buildGenerationConfig(aiSettings)

  const { system, user } = buildDmPrompts({
    lead:               leadContext,
    sender,
    config,
    template:           template ?? undefined,
    commentHistory:     leadContext.comment_history,
    regenInstruction,
  })

  const { text: rawResponse, usage } = await callClaude({
    systemPrompt: system,
    userPrompt:   user,
    temperature:  config.temperature,
    maxTokens:    600,
  })

  const safety = runSafetyChecks(rawResponse, 'dm', config.banned_phrases)

  // If this is a regeneration, mark the old generation as not used
  const generationType = existingDraftId ? 'dm_regen' : 'dm_draft'

  const generationId = await logGeneration({
    userId, leadId,
    dmDraftId:      existingDraftId ?? undefined,
    generationType,
    promptSnapshot: `${system}\n\n---\n\n${user}`,
    rawResponse, finalOutput: safety.passed ? safety.cleaned : null, safety,
    model: AI_MODEL, usage, temperature: config.temperature,
  })

  if (!safety.passed) {
    throw new AiError(
      `Generated DM failed safety checks: ${safety.flags.join(', ')}`,
      null
    )
  }

  // Write to dm_drafts table (status: pending_review — waits for user approval)
  const dmDraftId = await saveDmDraft({
    userId,
    leadId,
    campaignId,
    draftText:       safety.cleaned,
    existingDraftId, // if regenerating, update the existing row
  })

  // Update the generation log with the dm_draft_id
  if (generationId) {
    await supabase
      .from('ai_generations')
      .update({ dm_draft_id: dmDraftId })
      .eq('id', generationId)
  }

  console.log(`[ai] DM draft created for ${leadContext.full_name} (${safety.cleaned.length} chars, draft ID: ${dmDraftId})`)

  return {
    message:        safety.cleaned,
    generation_id:  generationId ?? '',
    dm_draft_id:    dmDraftId,
    safety_passed:  safety.passed,
    safety_flags:   safety.flags,
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Save or update a DM draft row.
 */
async function saveDmDraft(params: {
  userId:          string
  leadId:          string
  campaignId:      string
  draftText:       string
  existingDraftId?: string
}): Promise<string> {
  const supabase = createServerClient()

  if (params.existingDraftId) {
    // Regeneration — update existing draft back to pending_review
    const { data, error } = await supabase
      .from('dm_drafts')
      .update({
        draft_text:  params.draftText,
        status:      'pending_review',
        approved_by: null,
        approved_at: null,
        drafted_at:  new Date().toISOString(),
      })
      .eq('id', params.existingDraftId)
      .select('id')
      .single()

    if (error) throw new Error(`Failed to update DM draft: ${error.message}`)
    return data.id
  }

  // New draft
  const { data, error } = await supabase
    .from('dm_drafts')
    .insert({
      lead_id:     params.leadId,
      campaign_id: params.campaignId,
      draft_text:  params.draftText,
      status:      'pending_review',
      drafted_at:  new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create DM draft: ${error.message}`)
  return data.id
}

function mapConfigToneToCommentTone(tone: string): string {
  const map: Record<string, string> = {
    professional:   'insightful',
    conversational: 'questioning',
    direct:         'insightful',
    warm:           'congratulatory',
  }
  return map[tone] ?? 'insightful'
}
