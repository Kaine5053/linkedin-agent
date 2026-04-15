// ============================================================
// Anthropic Client
// Central Claude API wrapper used by all AI service functions.
//
// Handles:
//   - SDK initialisation (singleton)
//   - Structured JSON response parsing
//   - Retry with exponential backoff on rate limits / 529s
//   - Token usage logging
//   - Error normalisation so callers always get a clean throw
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { TokenUsage } from '../../types/ai'

// ── Singleton client ───────────────────────────────────────

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to Vercel environment variables.')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

// Model to use across all generations — Sonnet 4 hits the cost/quality sweet spot
export const AI_MODEL = 'claude-sonnet-4-20250514'

// ── Core generation function ───────────────────────────────

interface CallClaudeParams {
  systemPrompt:  string
  userPrompt:    string
  temperature?:  number   // default 0.7
  maxTokens?:    number   // default 1000
  // If true, parse response as JSON and return the object
  jsonMode?:     boolean
}

interface CallClaudeResult {
  text:       string
  usage:      TokenUsage
  stopReason: string
}

/**
 * Call the Claude API with automatic retry on transient errors.
 * Always returns the raw text content of the first content block.
 */
export async function callClaude(params: CallClaudeParams): Promise<CallClaudeResult> {
  const client = getAnthropicClient()
  const {
    systemPrompt,
    userPrompt,
    temperature = 0.7,
    maxTokens   = 1000,
    jsonMode    = false,
  } = params

  const MAX_RETRIES = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model:      AI_MODEL,
        max_tokens: maxTokens,
        temperature,
        system:     systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      })

      // Extract text from first content block
      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Claude returned no text content block')
      }

      let text = textBlock.text.trim()

      // If JSON mode: strip markdown code fences if present
      if (jsonMode) {
        text = text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()
      }

      const usage: TokenUsage = {
        input_tokens:       response.usage.input_tokens,
        output_tokens:      response.usage.output_tokens,
        // claude-sonnet-4: $3/M input, $15/M output
        estimated_cost_usd:
          (response.usage.input_tokens  / 1_000_000) * 3.0 +
          (response.usage.output_tokens / 1_000_000) * 15.0,
      }

      return {
        text,
        usage,
        stopReason: response.stop_reason ?? 'end_turn',
      }

    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Retry on rate limit (429) or overload (529)
      const status = (err as { status?: number })?.status
      if ((status === 429 || status === 529) && attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 1500  // 3s, 6s
        console.warn(`[claude] Rate limited (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms`)
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }

      // Don't retry on other errors
      break
    }
  }

  throw new AiError(
    `Claude API call failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    lastError
  )
}

/**
 * Call Claude expecting a JSON response.
 * Parses and returns the object, throws AiError if unparseable.
 */
export async function callClaudeJson<T>(params: Omit<CallClaudeParams, 'jsonMode'>): Promise<{ data: T; usage: TokenUsage }> {
  const result = await callClaude({ ...params, jsonMode: true })

  try {
    const data = JSON.parse(result.text) as T
    return { data, usage: result.usage }
  } catch {
    throw new AiError(
      `Claude returned invalid JSON. Raw response: ${result.text.slice(0, 200)}`,
      null
    )
  }
}

// ── Custom error class ─────────────────────────────────────

export class AiError extends Error {
  public readonly cause: Error | null

  constructor(message: string, cause: Error | null) {
    super(message)
    this.name    = 'AiError'
    this.cause   = cause
  }
}
