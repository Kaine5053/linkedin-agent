// ============================================================
// lib/utils.ts — shared utilities
// ============================================================
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)    return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)    return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)    return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)     return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

// Deterministic avatar colour — stable per name
const AVATAR_PALETTES = [
  { bg: '#e0f0ff', fg: '#0060cc' },
  { bg: '#e8f8f1', fg: '#0b7a51' },
  { bg: '#fff3e0', fg: '#b85c00' },
  { bg: '#f3e8ff', fg: '#6d28d9' },
  { bg: '#ffe8f0', fg: '#be185d' },
  { bg: '#e0fdf9', fg: '#0d7377' },
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#ffe4e6', fg: '#b91c1c' },
]
export function avatarColour(name: string) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTES.length
  return AVATAR_PALETTES[idx]
}

// ── Stage config ──────────────────────────────────────────

export type LeadStage =
  | 'imported'
  | 'connection_sent'
  | 'connected'
  | 'engaging'
  | 'dm_ready'
  | 'dm_sent'
  | 'replied'
  | 'won'
  | 'lost'
  | 'archived'

export interface StageConfig {
  label:       string
  color:       string   // text / dot colour
  bg:          string   // pill bg
  border:      string   // card left-border
  description: string
  order:       number
}

export const STAGES: Record<LeadStage, StageConfig> = {
  imported:         { label: 'Imported',            color: '#7c3aed', bg: '#ede9fe', border: '#7c3aed', description: 'Ready for connection request', order: 0 },
  connection_sent:  { label: 'Req. Sent',           color: '#b45309', bg: '#fef3c7', border: '#f59e0b', description: 'Awaiting acceptance',           order: 1 },
  connected:        { label: 'Connected',           color: '#047857', bg: '#d1fae5', border: '#10b981', description: 'Start engaging on posts',        order: 2 },
  engaging:         { label: 'Engaging',            color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6', description: 'Building the relationship',      order: 3 },
  dm_ready:         { label: 'DM Ready',            color: '#6d28d9', bg: '#f5f3ff', border: '#8b5cf6', description: 'Ready for DM draft',             order: 4 },
  dm_sent:          { label: 'DM Sent',             color: '#9d174d', bg: '#fce7f3', border: '#ec4899', description: 'Awaiting reply',                  order: 5 },
  replied:          { label: 'Replied',             color: '#0e7490', bg: '#cffafe', border: '#06b6d4', description: 'Response received',               order: 6 },
  won:              { label: 'Closed / Won',        color: '#15803d', bg: '#dcfce7', border: '#22c55e', description: 'Converted',                       order: 7 },
  lost:             { label: 'Closed / Lost',       color: '#b91c1c', bg: '#fee2e2', border: '#ef4444', description: 'Not converted',                   order: 8 },
  archived:         { label: 'Archived',            color: '#6b7280', bg: '#f3f4f6', border: '#9ca3af', description: 'Inactive',                        order: 9 },
}

export const KANBAN_STAGES: LeadStage[] = [
  'imported', 'connection_sent', 'connected', 'engaging',
  'dm_ready', 'dm_sent', 'replied', 'won',
]

export function stagePillStyle(stage: LeadStage) {
  const s = STAGES[stage]
  return { backgroundColor: s.bg, color: s.color }
}
