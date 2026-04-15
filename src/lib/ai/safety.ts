// ============================================================
// AI Safety Guardrails
//
// Every piece of AI-generated content passes through this
// module before being stored or used. It checks for:
//
//   HARD blocks (content is rejected outright):
//     - Spam signals (bulk/mass messaging language)
//     - LinkedIn ToS violations (guaranteed results, fake claims)
//     - Aggressive sales language ("limited time", "act now")
//     - Misleading identity claims
//     - Profanity or offensive language
//     - Excessive length violations
//
//   SOFT flags (noted in logs but content still used):
//     - High exclamation mark density
//     - Too many emojis
//     - Overly formal language for the chosen tone
//
//   User-defined bans:
//     - Any phrase in ai_settings.banned_phrases
//
// Returns { passed, flags, cleaned } where cleaned is the
// output with soft issues lightly corrected.
// ============================================================

import type { SafetyCheckResult } from '../../types/ai'

// ── Hard-block patterns ────────────────────────────────────
// If ANY of these match, the content is rejected entirely.

const HARD_BLOCK_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  // Spam / bulk messaging language
  { pattern: /\bi(?:'m| am) reaching out to (?:everyone|all|hundreds|thousands)\b/i,       flag: 'spam:bulk_outreach' },
  { pattern: /\bdon't miss (?:out|this)\b/i,                                               flag: 'spam:fomo' },
  { pattern: /\blimited time offer\b/i,                                                    flag: 'spam:limited_time' },
  { pattern: /\bact now\b/i,                                                               flag: 'spam:act_now' },
  { pattern: /\bbuy now\b/i,                                                               flag: 'spam:buy_now' },
  { pattern: /\b(?:click here|tap here)\b/i,                                               flag: 'spam:click_here' },
  { pattern: /\bunsubscribe\b/i,                                                           flag: 'spam:unsubscribe' },

  // LinkedIn ToS violations
  { pattern: /\bguaranteed? (?:results?|roi|revenue|leads?|sales?)\b/i,                    flag: 'tos:guarantee' },
  { pattern: /\b(?:100|100%) (?:guaranteed?|certain|sure)\b/i,                            flag: 'tos:guarantee' },
  { pattern: /\bI (?:work(?:ed)?|am) (?:at|for|with) (?:LinkedIn|Meta|Google|Microsoft)\b/i, flag: 'tos:identity_claim' },
  { pattern: /\bLinkedIn (?:partner|approved|certified|official)\b/i,                     flag: 'tos:linkedin_misuse' },

  // Aggressive / manipulative language
  { pattern: /\byou (?:must|need to|have to|should) (?:buy|purchase|sign up|subscribe)\b/i, flag: 'aggressive:pressure' },
  { pattern: /\bwhat are you waiting for\b/i,                                             flag: 'aggressive:pressure' },
  { pattern: /\bstop (?:wasting|losing)\b/i,                                              flag: 'aggressive:negative_framing' },
  { pattern: /\byour competitors? (?:are|will be|already)\b/i,                            flag: 'aggressive:competitor_fear' },

  // Fake familiarity
  { pattern: /\bas (?:we|I) (?:discussed|agreed|talked about)\b/i,                        flag: 'deceptive:false_prior_contact' },
  { pattern: /\bfollow(?:ing)? up (?:on|from) (?:our|my) (?:previous|last|recent) (?:email|message|call|conversation)\b/i, flag: 'deceptive:false_prior_contact' },

  // Profanity (basic set — extend as needed)
  { pattern: /\b(fuck|shit|bastard|asshole|cunt)\b/i,                                     flag: 'profanity' },
]

// ── Soft-flag patterns ─────────────────────────────────────
// Noted in logs and lightly cleaned, but don't block the content.

const SOFT_FLAG_CHECKS: Array<{
  check: (text: string) => boolean
  flag:  string
  fix?:  (text: string) => string
}> = [
  {
    // More than 3 exclamation marks = over-eager
    check: text => (text.match(/!/g) ?? []).length > 3,
    flag:  'style:excessive_exclamation',
    fix:   text => {
      let count = 0
      return text.replace(/!/g, match => { count++; return count > 2 ? '.' : match })
    },
  },
  {
    // More than 2 emojis
    check: text => (text.match(/\p{Emoji}/gu) ?? []).length > 2,
    flag:  'style:excessive_emoji',
    // No auto-fix — emojis are contextual
  },
  {
    // "Dear [Name]" — too formal for LinkedIn
    check: text => /^dear \w/i.test(text.trim()),
    flag:  'style:overly_formal_salutation',
    fix:   text => text.replace(/^dear (\w)/i, (_, first) => `Hi ${first.toUpperCase()}`),
  },
  {
    // Ends with no call to action — soft flag on DMs
    check: text => text.length > 200 && !/\?/.test(text),
    flag:  'style:no_question_or_cta',
  },
]

// ── Length limits ──────────────────────────────────────────

const LENGTH_LIMITS: Record<string, number> = {
  connection_note: 300,
  comment:         1250,  // LinkedIn comment limit
  dm:              1900,  // LinkedIn DM limit (soft — shorter is better)
}

// ── Main safety check ──────────────────────────────────────

/**
 * Run all safety checks on a piece of generated content.
 *
 * @param text         — the raw AI output
 * @param contentType  — 'connection_note' | 'comment' | 'dm'
 * @param bannedPhrases — user-defined list from ai_settings
 */
export function runSafetyChecks(
  text: string,
  contentType: 'connection_note' | 'comment' | 'dm',
  bannedPhrases: string[] = []
): SafetyCheckResult {
  const flags: string[] = []
  let cleaned = text

  // 1. Hard blocks
  for (const { pattern, flag } of HARD_BLOCK_PATTERNS) {
    if (pattern.test(cleaned)) {
      flags.push(flag)
    }
  }

  // 2. User-defined banned phrases
  for (const phrase of bannedPhrases) {
    if (phrase && cleaned.toLowerCase().includes(phrase.toLowerCase())) {
      flags.push(`banned_phrase:${phrase}`)
    }
  }

  // If any hard block triggered, fail immediately
  if (flags.length > 0) {
    return { passed: false, flags, cleaned: '' }
  }

  // 3. Length check
  const limit = LENGTH_LIMITS[contentType]
  if (limit && cleaned.length > limit) {
    flags.push(`length:exceeds_${limit}_chars`)
    // Soft truncation — hard fail only if massively over
    if (cleaned.length > limit * 1.5) {
      return { passed: false, flags, cleaned: '' }
    }
    // Otherwise truncate at last sentence boundary
    cleaned = truncateAtSentence(cleaned, limit)
    flags.push('length:auto_truncated')
  }

  // 4. Soft flags — apply fixes where available
  for (const { check, flag, fix } of SOFT_FLAG_CHECKS) {
    if (check(cleaned)) {
      flags.push(flag)
      if (fix) cleaned = fix(cleaned)
    }
  }

  return { passed: true, flags, cleaned }
}

/**
 * Truncate text at the last sentence boundary before maxChars.
 */
function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  const truncated = text.slice(0, maxChars)
  // Find last sentence-ending punctuation
  const lastEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.\n'),
  )

  if (lastEnd > maxChars * 0.6) {
    return truncated.slice(0, lastEnd + 1).trim()
  }

  // No good sentence boundary — hard truncate with ellipsis
  return truncated.slice(0, maxChars - 3).trim() + '…'
}

/**
 * Quick check: does this text look like a valid personalised message
 * (i.e. is it not a generic placeholder or error message)?
 */
export function looksPersonalised(text: string, firstName: string): boolean {
  const lower = text.toLowerCase()
  // Should reference the person's name or something specific
  const hasName    = lower.includes(firstName.toLowerCase())
  const hasGeneric = /\[name\]|\[first_name\]|\[company\]|\[insert\]|placeholder/i.test(text)
  return hasName && !hasGeneric
}
