// ============================================================
// Template Renderer
// Replaces merge tags in templates with lead data.
// Available tags: {{first_name}}, {{full_name}}, {{company}},
//                 {{job_title}}, {{industry}}, {{notes}}
// ============================================================

import type { Lead } from '../../types'

type MergeContext = {
  first_name:  string
  full_name:   string
  company:     string
  job_title:   string
  industry:    string
  notes:       string
  [key: string]: string  // allow custom enrichment fields
}

/**
 * Build a merge context from a Lead row.
 */
export function buildMergeContext(lead: Lead): MergeContext {
  const enrichment = lead.enrichment_data as Record<string, unknown>

  return {
    first_name: lead.first_name || lead.full_name.split(' ')[0] || 'there',
    full_name:  lead.full_name || '',
    company:    lead.company || 'your company',
    job_title:  lead.job_title || 'your role',
    industry:   lead.industry || 'your industry',
    notes:      lead.notes || '',
    // Flatten any string enrichment fields too
    ...Object.fromEntries(
      Object.entries(enrichment)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, v as string])
    ),
  }
}

/**
 * Render a template string by substituting all {{tag}} placeholders.
 * Unknown tags are left as-is so they're visible for debugging.
 */
export function renderTemplate(template: string, context: MergeContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, tag) => {
    return context[tag] !== undefined ? context[tag] : match
  })
}

/**
 * Validate a connection note fits within LinkedIn's 300-char limit.
 * Returns { valid, length, error? }
 */
export function validateConnectionNote(text: string): {
  valid: boolean
  length: number
  error?: string
} {
  const length = text.trim().length
  if (length > 300) {
    return {
      valid: false,
      length,
      error: `Connection note is ${length} chars — LinkedIn limit is 300.`,
    }
  }
  return { valid: true, length }
}
