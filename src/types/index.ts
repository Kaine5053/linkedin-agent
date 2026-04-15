// ============================================================
// Shared TypeScript types — LinkedIn Agent Backend
// ============================================================

export type LeadStage =
  | 'imported'
  | 'connection_sent'
  | 'connected'
  | 'engaging'
  | 'commenting'
  | 'dm_ready'
  | 'dm_sent'
  | 'replied'
  | 'won'
  | 'lost'
  | 'nurturing'
  | 'archived'

export type ActionType =
  | 'connection_request'
  | 'post_comment'
  | 'dm_send'
  | 'profile_view'
  | 'post_like'

export type ActionStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped'

export type DmStatus =
  | 'pending_review'
  | 'approved'
  | 'edited'
  | 'rejected'
  | 'sent'

// ── Database row shapes ────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string | null
  li_session: string | null
  timezone: string
  settings: UserSettings
  created_at: string
  updated_at: string
}

export interface UserSettings {
  daily_connection_limit: number
  daily_comment_limit: number
  working_hours_start: number  // 0–23
  working_hours_end: number    // 0–23
  min_gap_minutes: number
  weekend_pause: boolean
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  description: string | null
  status: 'active' | 'paused' | 'archived'
  dm_trigger_comments: number
  dm_trigger_days: number
  template_connection_note: string | null
  template_dm: string | null
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  campaign_id: string
  user_id: string
  full_name: string
  first_name: string
  linkedin_url: string
  company: string | null
  job_title: string | null
  industry: string | null
  notes: string | null
  stage: LeadStage
  enrichment_data: Record<string, unknown>
  imported_at: string
  connection_sent_at: string | null
  connected_at: string | null
  dm_ready_at: string | null
  dm_sent_at: string | null
  last_activity_at: string | null
  comment_count: number
  created_at: string
  updated_at: string
}

export interface PendingAction {
  id: string
  lead_id: string
  user_id: string
  campaign_id: string
  action_type: ActionType
  status: ActionStatus
  execute_after: string
  payload: ActionPayload
  result: ActionResult | null
  attempts: number
  last_error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Comment {
  id: string
  lead_id: string
  action_id: string | null
  post_url: string
  post_snippet: string | null
  comment_text: string
  status: 'posted' | 'failed' | 'deleted'
  posted_at: string
}

export interface DmDraft {
  id: string
  lead_id: string
  campaign_id: string
  draft_text: string
  status: DmStatus
  edited_text: string | null
  approved_by: string | null
  drafted_at: string
  approved_at: string | null
  sent_at: string | null
  send_action_id: string | null
}

export interface AuditLog {
  id: string
  user_id: string
  lead_id: string | null
  action_id: string | null
  event_type: string
  payload: Record<string, unknown>
  worker_ip: string | null
  occurred_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  type: 'connection_note' | 'dm'
  content: string
  created_at: string
  updated_at: string
}

// ── Action payload types (stored in pending_actions.payload) ──

export type ActionPayload =
  | ConnectionRequestPayload
  | PostCommentPayload
  | DmSendPayload
  | ProfileViewPayload

export interface ConnectionRequestPayload {
  note: string  // personalised connection note (max 300 chars)
}

export interface PostCommentPayload {
  post_url: string
  comment_text: string
  post_snippet?: string  // for display in dashboard
}

export interface DmSendPayload {
  message_text: string  // only populated after user approval
  dm_draft_id: string
}

export interface ProfileViewPayload {
  // no extra fields needed
}

// ── Action result (written back by VPS worker) ────────────

export interface ActionResult {
  success: boolean
  li_response?: string    // any text LinkedIn returned
  screenshot_url?: string // optional — if worker captures proof
  error?: string
  executed_at: string
}

// ── API request/response shapes ───────────────────────────

export interface ImportLeadsRequest {
  campaign_id: string
  leads: RawLeadRow[]
}

export interface RawLeadRow {
  full_name: string
  linkedin_url: string
  company?: string
  job_title?: string
  industry?: string
  notes?: string
  [key: string]: unknown  // extra enrichment columns
}

export interface ImportLeadsResponse {
  imported: number
  duplicates: number
  errors: string[]
}

export interface CreateActionRequest {
  lead_id: string
  campaign_id: string
  action_type: ActionType
  payload: ActionPayload
  // Optional: if omitted, pacing engine calculates execute_after
  execute_after?: string
}

export interface ApproveDmRequest {
  dm_draft_id: string
  edited_text?: string  // if user edited the draft
}

export interface WorkerPollResult {
  action: PendingAction
  lead: Lead
  campaign: Campaign
  user: User
}
