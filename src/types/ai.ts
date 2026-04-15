// ============================================================
// AI Layer Types — appended to existing types/index.ts
// Import from '@/types/ai' in AI-specific files
// ============================================================

// ── AI Settings ────────────────────────────────────────────

export type ToneProfile = 'professional' | 'conversational' | 'direct' | 'warm'

export interface AiSettings {
  id:                   string
  user_id:              string
  tone:                 ToneProfile
  personalisation_depth: 1 | 2 | 3
  temperature:          number
  sender_name:          string
  sender_role:          string
  sender_company:       string
  target_industry:      string
  custom_instructions:  string | null
  banned_phrases:       string[]
  allow_connection_notes: boolean
  allow_comments:       boolean
  allow_dms:            boolean
  created_at:           string
  updated_at:           string
}

// ── AI Generation Log ──────────────────────────────────────

export type GenerationType = 'connection_note' | 'comment' | 'dm_draft' | 'dm_regen'

export interface AiGeneration {
  id:              string
  user_id:         string
  lead_id:         string | null
  action_id:       string | null
  dm_draft_id:     string | null
  generation_type: GenerationType
  prompt_snapshot: string
  raw_response:    string
  final_output:    string | null
  safety_passed:   boolean
  safety_flags:    string[]
  model:           string
  input_tokens:    number | null
  output_tokens:   number | null
  temperature:     number | null
  was_used:        boolean | null
  occurred_at:     string
}

// ── Generation Request shapes (used by API routes) ─────────

export interface GenerateConnectionNoteRequest {
  lead_id:     string
  campaign_id: string
  // Optional: regenerate with a specific instruction
  regenerate_hint?: string
}

export interface GenerateConnectionNoteResponse {
  note:           string    // final, safe, ready-to-use
  char_count:     number
  generation_id:  string    // ai_generations.id — for "was_used" tracking
  safety_passed:  boolean
  safety_flags:   string[]
}

export interface GenerateCommentRequest {
  lead_id:      string
  post_url:     string
  post_content: string       // text of the post being commented on
  post_author:  string       // lead's name (for reference)
  // Optional tone override for this specific comment
  tone_override?: 'funny' | 'serious' | 'congratulatory' | 'insightful' | 'questioning'
}

export interface GenerateCommentResponse {
  comment:        string
  tone_used:      string
  generation_id:  string
  safety_passed:  boolean
  safety_flags:   string[]
}

export interface GenerateDmRequest {
  lead_id:     string
  campaign_id: string
  // Optional: if regenerating an existing draft
  dm_draft_id?:    string
  regen_instruction?: string  // e.g. "make it shorter and more casual"
}

export interface GenerateDmResponse {
  message:        string
  generation_id:  string
  dm_draft_id:    string  // the dm_drafts.id that was created
  safety_passed:  boolean
  safety_flags:   string[]
}

// ── Internal AI service types (not exposed to API consumers) ─

export interface LeadContext {
  full_name:          string
  first_name:         string
  job_title:          string
  company:            string
  industry:           string
  city:               string
  region:             string
  seniority_level:    string
  top_skills:         string
  recent_experience:  string
  notes:              string
  comment_history:    CommentSummary[]
}

export interface CommentSummary {
  post_snippet:   string
  comment_text:   string
  posted_at:      string
}

export interface SenderContext {
  name:     string
  role:     string
  company:  string
}

export interface GenerationConfig {
  tone:                 ToneProfile
  personalisation_depth: 1 | 2 | 3
  temperature:          number
  custom_instructions:  string | null
  banned_phrases:       string[]
  target_industry:      string
}

export interface SafetyCheckResult {
  passed:   boolean
  flags:    string[]
  cleaned:  string   // the output with any flagged content removed/replaced
}

// ── Cost tracking ──────────────────────────────────────────

export interface TokenUsage {
  input_tokens:  number
  output_tokens: number
  // Sonnet pricing as of 2025: $3/M input, $15/M output
  estimated_cost_usd: number
}
