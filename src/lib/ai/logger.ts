// ============================================================
// AI Generation Logger
// Writes every Claude API call to the ai_generations table.
// Also handles marking generations as used/unused.
// ============================================================

import { createServerClient } from '../supabase/client'
import type { GenerationType, TokenUsage, SafetyCheckResult } from '../../types/ai'

interface LogGenerationParams {
  userId:         string
  leadId?:        string
  actionId?:      string
  dmDraftId?:     string
  generationType: GenerationType
  promptSnapshot: string   // system + "\n\n---\n\n" + user
  rawResponse:    string
  finalOutput:    string | null
  safety:         SafetyCheckResult
  model:          string
  usage:          TokenUsage
  temperature:    number
}

/**
 * Log a completed AI generation. Never throws — logging failures
 * must not block the main generation flow.
 * Returns the generation ID for tracking.
 */
export async function logGeneration(params: LogGenerationParams): Promise<string | null> {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('ai_generations')
      .insert({
        user_id:         params.userId,
        lead_id:         params.leadId         ?? null,
        action_id:       params.actionId       ?? null,
        dm_draft_id:     params.dmDraftId      ?? null,
        generation_type: params.generationType,
        prompt_snapshot: params.promptSnapshot,
        raw_response:    params.rawResponse,
        final_output:    params.finalOutput,
        safety_passed:   params.safety.passed,
        safety_flags:    params.safety.flags,
        model:           params.model,
        input_tokens:    params.usage.input_tokens,
        output_tokens:   params.usage.output_tokens,
        temperature:     params.temperature,
        was_used:        null, // set later when user accepts/rejects
        occurred_at:     new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ai-logger] Failed to write generation log:', error.message)
      return null
    }

    return data.id

  } catch (err) {
    console.error('[ai-logger] Unexpected logging error:', err)
    return null
  }
}

/**
 * Mark a generation as used (true) or discarded (false).
 * Called when the user approves / regenerates.
 */
export async function markGenerationUsed(
  generationId: string,
  wasUsed: boolean
): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase
      .from('ai_generations')
      .update({ was_used: wasUsed })
      .eq('id', generationId)
  } catch (err) {
    console.error('[ai-logger] Failed to mark generation used:', err)
  }
}

/**
 * Get total token usage and estimated cost for a user
 * (useful for the AI settings panel cost display).
 */
export async function getUsageSummary(userId: string, days = 30): Promise<{
  total_generations: number
  total_input_tokens: number
  total_output_tokens: number
  estimated_cost_usd: number
  by_type: Record<string, number>
}> {
  const supabase = createServerClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('ai_generations')
    .select('generation_type, input_tokens, output_tokens')
    .eq('user_id', userId)
    .gte('occurred_at', since)

  if (error || !data) {
    return { total_generations: 0, total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0, by_type: {} }
  }

  const summary = data.reduce((acc, row) => {
    acc.total_generations++
    acc.total_input_tokens  += row.input_tokens  ?? 0
    acc.total_output_tokens += row.output_tokens ?? 0
    acc.by_type[row.generation_type] = (acc.by_type[row.generation_type] ?? 0) + 1
    return acc
  }, {
    total_generations:   0,
    total_input_tokens:  0,
    total_output_tokens: 0,
    by_type:             {} as Record<string, number>,
  })

  const estimated_cost_usd =
    (summary.total_input_tokens  / 1_000_000) * 3.0 +
    (summary.total_output_tokens / 1_000_000) * 15.0

  return { ...summary, estimated_cost_usd }
}
