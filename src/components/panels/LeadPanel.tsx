'use client'
import React, { useEffect, useState } from 'react'
import {
  X, ExternalLink, Linkedin, Mail, MapPin, Briefcase,
  MessageSquare, Send, Zap, Copy, Check, Activity,
  Clock, ChevronRight,
} from 'lucide-react'
import { cn, STAGES, formatRelativeTime, formatDate, type LeadStage } from '@/lib/utils'
import {
  Avatar, StageBadge, Spinner, Card, SectionHeader, Tag as TagBadge,
} from '@/components/shared/primitives'
import { useDashStore } from '@/store/dashboard'
import { useApiCall } from '@/hooks'
import { useLeadDetail } from '@/hooks/useLeadDetail'
import { toast } from '@/components/shared/Toast'
import { ManualOverridePanel } from '@/components/shared/ManualOverridePanel'

type PanelTab = 'profile' | 'activity' | 'ai'

// ── Types ──────────────────────────────────────────────────

interface LeadDetail {
  id: string
  full_name: string
  first_name: string
  linkedin_url: string
  company: string | null
  job_title: string | null
  industry: string | null
  notes: string | null
  stage: LeadStage
  comment_count: number
  last_activity_at: string | null
  imported_at: string
  connected_at: string | null
  connection_sent_at: string | null
  dm_ready_at: string | null
  dm_sent_at: string | null
  campaign_id: string
  enrichment_data: Record<string, unknown>
  comments?: Array<{
    id: string
    post_url: string
    post_snippet: string | null
    comment_text: string
    posted_at: string
  }>
  dm_drafts?: Array<{
    id: string
    status: string
    draft_text: string
    edited_text?: string | null
    drafted_at: string
    approved_at: string | null
  }>
  pending_actions?: Array<{
    id: string
    action_type: string
    status: string
    execute_after: string
    created_at: string
    completed_at: string | null
  }>
}

interface LeadPanelProps {
  lead:     LeadDetail | null
  loading?: boolean
  onUpdate: (updated: Partial<LeadDetail> & { id: string }) => void
}

// ── LeadPanel ──────────────────────────────────────────────

export function LeadPanel({ lead, loading = false, onUpdate }: LeadPanelProps) {
  const { closePanel } = useDashStore()
  const [tab, setTab]  = useState<PanelTab>('profile')

  useEffect(() => { setTab('profile') }, [lead?.id])

  if (!lead && !loading) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 dark:bg-black/50 z-40 animate-fade-in"
        onClick={closePanel}
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full z-50 flex flex-col',
          'bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700',
          'shadow-panel animate-slide-right',
        )}
        style={{ width: 'var(--panel-w, 520px)' }}
      >
        {loading && !lead ? (
          <PanelSkeleton onClose={closePanel} />
        ) : lead ? (
          <>
            <PanelHeader lead={lead} onClose={closePanel} onUpdate={onUpdate} />

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 px-5 flex-shrink-0">
              {([
                { id: 'profile',  label: 'Profile' },
                { id: 'activity', label: `Activity${(lead.comments?.length ?? 0) > 0 ? ` (${lead.comments!.length})` : ''}` },
                { id: 'ai',       label: '✨ AI Actions' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'py-3 px-1 mr-5 text-sm border-b-2 transition-all duration-150',
                    tab === t.id
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {tab === 'profile'  && <ProfileTab lead={lead} />}
              {tab === 'activity' && <ActivityTab lead={lead} />}
              {tab === 'ai'       && <AiActionsTab lead={lead} onUpdate={onUpdate} />}
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}

// ── Skeleton ───────────────────────────────────────────────

function PanelSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex justify-between">
        <div className="flex gap-3">
          <div className="skeleton w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-3 w-28 rounded" />
          </div>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-icon text-gray-400">
          <X size={15} />
        </button>
      </div>
      {[80, 60, 100, 70].map((w, i) => (
        <div key={i} className="skeleton rounded" style={{ height: 12, width: `${w}%` }} />
      ))}
    </div>
  )
}

// ── Panel Header ───────────────────────────────────────────

function PanelHeader({ lead, onClose, onUpdate }: {
  lead: LeadDetail
  onClose: () => void
  onUpdate: (u: Partial<LeadDetail> & { id: string }) => void
}) {
  const call  = useApiCall()
  const enr   = lead.enrichment_data as Record<string, unknown>
  const [stageMenuOpen, setStageMenuOpen] = useState(false)

  async function moveStage(newStage: LeadStage) {
    setStageMenuOpen(false)
    const prev = lead.stage
    onUpdate({ id: lead.id, stage: newStage })
    try {
      await call(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage }),
      })
      toast.success(`Moved to ${STAGES[newStage]?.label ?? newStage}`)
    } catch (err: any) {
      onUpdate({ id: lead.id, stage: prev })
      toast.error('Stage update failed', err.message)
    }
  }

  return (
    <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={lead.full_name} size={44} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight truncate">
                {lead.full_name}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5 leading-tight truncate">
                {[lead.job_title, lead.company].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-icon flex-shrink-0 text-gray-400">
              <X size={15} />
            </button>
          </div>

          {/* Badges row */}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            {/* Stage badge — clickable to change */}
            <div className="relative">
              <button
                onClick={() => setStageMenuOpen(o => !o)}
                className="hover:opacity-80 transition-opacity"
              >
                <StageBadge stage={lead.stage} />
              </button>

              {stageMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setStageMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-panel py-1 w-44 animate-scale-in">
                    <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-1.5">
                      Move to stage
                    </p>
                    {(Object.keys(STAGES) as LeadStage[]).filter(s => s !== 'archived').map(s => {
                      const cfg = STAGES[s]
                      return (
                        <button
                          key={s}
                          onClick={() => moveStage(s)}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors',
                            s === lead.stage
                              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300',
                          )}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          {cfg.label}
                          {s === lead.stage && <Check size={10} className="ml-auto text-brand-500" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {enr.city && (
              <span className="flex items-center gap-1 text-2xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                <MapPin size={8} />
                {String(enr.city)}{enr.region ? `, ${String(enr.region)}` : ''}
              </span>
            )}
            {enr.email && (
              <span className="flex items-center gap-1 text-2xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                <Mail size={8} /> email verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* LinkedIn link */}
      <a
        href={lead.linkedin_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-700 transition-colors font-medium"
      >
        <Linkedin size={11} />
        View on LinkedIn
        <ExternalLink size={9} className="opacity-60" />
      </a>
    </div>
  )
}

// ── Profile Tab ────────────────────────────────────────────

function ProfileTab({ lead }: { lead: LeadDetail }) {
  const enr  = lead.enrichment_data as Record<string, unknown>
  const skills = parseList(String(enr.top_skills ?? ''))
  const exp    = parseList(String(enr.recent_experience ?? ''))

  return (
    <div className="p-5 space-y-5">

      {/* Funnel progress */}
      <FunnelProgress stage={lead.stage} />

      {/* Core details */}
      <section>
        <SectionHeader>Profile</SectionHeader>
        <Card className="divide-y divide-gray-50 dark:divide-gray-800 overflow-hidden">
          {[
            { label: 'Company',   value: lead.company,   icon: <Briefcase size={11} className="text-gray-300" /> },
            { label: 'Title',     value: lead.job_title  },
            { label: 'Industry',  value: lead.industry   },
            { label: 'Seniority', value: String(enr.seniority_level ?? '') },
            { label: 'Email',     value: String(enr.email ?? ''), mono: true },
          ].filter(r => r.value).map(({ label, value, icon, mono }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-3 flex-shrink-0 flex items-center">{icon ?? null}</span>
              <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
              <span className={cn(
                'text-sm text-gray-700 dark:text-gray-200 flex-1 truncate',
                mono && 'font-mono text-xs',
              )}>
                {String(value)}
              </span>
            </div>
          ))}
        </Card>
      </section>

      {/* Skills */}
      {skills.length > 0 && (
        <section>
          <SectionHeader>Skills</SectionHeader>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 10).map(s => <TagBadge key={s}>{s}</TagBadge>)}
          </div>
        </section>
      )}

      {/* Experience */}
      {exp.length > 0 && (
        <section>
          <SectionHeader>Recent experience</SectionHeader>
          <div className="space-y-1.5">
            {exp.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0 mt-2" />
                {r}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Engagement metrics */}
      {lead.stage !== 'imported' && (
        <section>
          <SectionHeader>Engagement</SectionHeader>
          <Card className="grid grid-cols-3 divide-x divide-gray-50 dark:divide-gray-800">
            {[
              { label: 'Comments',    value: lead.comment_count },
              { label: 'Connected',   value: lead.connected_at ? formatRelativeTime(lead.connected_at) : '—' },
              { label: 'Last active', value: formatRelativeTime(lead.last_activity_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center py-3">
                <span className="font-bold text-base text-gray-800 dark:text-gray-100">{value}</span>
                <span className="text-2xs text-gray-400 mt-0.5">{label}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Notes */}
      {lead.notes && (
        <section>
          <SectionHeader>Notes</SectionHeader>
          <p className="text-sm text-gray-600 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl p-3 leading-relaxed">
            {lead.notes}
          </p>
        </section>
      )}
    </div>
  )
}

// ── Activity Tab ───────────────────────────────────────────

function ActivityTab({ lead }: { lead: LeadDetail }) {
  const comments = lead.comments ?? []
  const actions  = (lead.pending_actions ?? []).filter(a => a.status === 'completed').slice(0, 10)

  const timeline = [
    lead.dm_sent_at          && { label: 'DM sent',         time: lead.dm_sent_at,          color: '#ec4899', icon: '📨' },
    lead.dm_ready_at         && { label: 'DM ready',        time: lead.dm_ready_at,         color: '#8b5cf6', icon: '✨' },
    lead.connected_at        && { label: 'Connected',       time: lead.connected_at,        color: '#10b981', icon: '🤝' },
    lead.connection_sent_at  && { label: 'Request sent',    time: lead.connection_sent_at,  color: '#f59e0b', icon: '📤' },
    lead.imported_at         && { label: 'Imported',        time: lead.imported_at,         color: '#6366f1', icon: '📥' },
  ].filter(Boolean) as { label: string; time: string; color: string; icon: string }[]

  return (
    <div className="p-5 space-y-5">

      {/* Comment history */}
      {comments.length > 0 && (
        <section>
          <SectionHeader>Comment history ({comments.length})</SectionHeader>
          <div className="space-y-2">
            {comments.map((c, i) => (
              <Card key={i} className="p-3">
                {c.post_snippet && (
                  <p className="text-xs text-gray-400 italic leading-relaxed mb-2 pl-2 border-l-2 border-gray-200 dark:border-gray-600 line-clamp-2">
                    "{c.post_snippet}…"
                  </p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                  {c.comment_text}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-2xs text-gray-300">{formatRelativeTime(c.posted_at)}</span>
                  <a
                    href={c.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-brand-400 hover:text-brand-600 flex items-center gap-1"
                  >
                    Post <ExternalLink size={8} />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* DM drafts */}
      {(lead.dm_drafts?.length ?? 0) > 0 && (
        <section>
          <SectionHeader>DM drafts</SectionHeader>
          <div className="space-y-2">
            {lead.dm_drafts!.map((d, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    'text-2xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                    d.status === 'pending_review' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400' :
                    d.status === 'approved'       ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                    d.status === 'sent'           ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400' :
                    'bg-gray-50 text-gray-500',
                  )}>
                    {d.status.replace('_', ' ')}
                  </span>
                  <span className="text-2xs text-gray-300">{formatRelativeTime(d.drafted_at)}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4">
                  {d.edited_text ?? d.draft_text}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Stage timeline */}
      <section>
        <SectionHeader>Stage history</SectionHeader>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No stage history yet</p>
        ) : (
          <div className="relative pl-3">
            <div className="absolute left-2 top-2 bottom-0 w-px bg-gray-100 dark:bg-gray-800" />
            {timeline.map((ev, i) => (
              <div key={i} className="relative flex items-start gap-3 pb-4">
                <div
                  className="absolute -left-1 top-1 w-4 h-4 rounded-full flex items-center justify-center z-10 bg-white dark:bg-gray-900 border-2 text-xs"
                  style={{ borderColor: ev.color }}
                >
                  <span style={{ fontSize: 8 }}>{ev.icon}</span>
                </div>
                <div className="pl-5">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{ev.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(ev.time)} · {formatRelativeTime(ev.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}

// ── AI Actions Tab ─────────────────────────────────────────

function AiActionsTab({ lead, onUpdate }: {
  lead: LeadDetail
  onUpdate: (u: Partial<LeadDetail> & { id: string }) => void
}) {
  const call    = useApiCall()
  const [busy, setBusy]       = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, any>>({})
  const [postUrl, setPostUrl]         = useState('')
  const [postContent, setPostContent] = useState('')
  const [tone, setTone]               = useState('insightful')
  const [regenHint, setRegenHint]     = useState('')
  const [copied, setCopied]           = useState<string | null>(null)

  const canConnect = lead.stage === 'imported'
  const canComment = ['connected', 'engaging', 'commenting', 'dm_ready'].includes(lead.stage)
  const canDm      = ['engaging', 'commenting', 'dm_ready', 'connected'].includes(lead.stage)

  async function generate(type: string, body: object) {
    setBusy(type)
    try {
      const data = await call(`/api/ai/generate/${type}`, {
        method: 'POST',
        body:   JSON.stringify(body),
      })
      setResults(r => ({ ...r, [type]: data }))

      if (type === 'connection-note') toast.success('Connection note generated', `${data.char_count} chars · scheduled`)
      if (type === 'comment')         toast.success('Comment generated', `${data.tone_used} tone · scheduled`)
      if (type === 'dm')              toast.success('DM draft created', 'Saved to approval queue')
    } catch (err: any) {
      toast.error('Generation failed', err.message)
    } finally { setBusy(null) }
  }

  function copyResult(key: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    toast.info('Copied to clipboard')
  }

  return (
    <div className="p-5 space-y-4">

      {/* Saved DM drafts quick access */}
      {(lead.dm_drafts ?? []).filter(d => d.status === 'pending_review').length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
          <Zap size={13} className="text-purple-500 flex-shrink-0" />
          <div className="flex-1 text-xs text-purple-700 dark:text-purple-300">
            <span className="font-semibold">1 DM draft</span> is waiting for your approval
          </div>
          <a href="/dm-queue" className="text-2xs text-purple-500 font-medium hover:underline">
            Review →
          </a>
        </div>
      )}

      {/* Connection note */}
      <AiCard
        title="Connection Request"
        emoji="🔗"
        desc="AI-personalised note — max 300 chars"
        disabled={!canConnect}
        disabledReason="Only for leads in 'Imported' stage"
        busy={busy === 'connection-note'}
        onGenerate={() => generate('connection-note', { lead_id: lead.id, campaign_id: lead.campaign_id, regenerate_hint: regenHint || undefined })}
        result={results['connection-note']}
        resultKey="note"
        metaText={r => `${r.char_count} chars · ${r.execute_after ? formatRelativeTime(r.execute_after) : 'scheduled'}`}
        onCopy={text => copyResult('conn', text)}
        copied={copied === 'conn'}
      />

      {/* Comment */}
      <AiCard
        title="Post Comment"
        emoji="💬"
        desc="Vibe-matched comment on a specific post"
        disabled={!canComment}
        disabledReason="Available once connected"
        busy={busy === 'comment'}
        onGenerate={() => generate('comment', {
          lead_id:      lead.id,
          post_url:     postUrl,
          post_content: postContent,
          post_author:  lead.full_name,
          tone_override: tone,
        })}
        result={results['comment']}
        resultKey="comment"
        metaText={r => `${r.tone_used} tone · scheduled`}
        onCopy={text => copyResult('comment', text)}
        copied={copied === 'comment'}
      >
        {canComment && (
          <div className="space-y-2 mb-3">
            <input
              className="input text-sm"
              placeholder="LinkedIn post URL"
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
            />
            <textarea
              className="input text-sm"
              placeholder="Paste the post text here…"
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              style={{ minHeight: 64 }}
            />
            <select className="input text-sm" value={tone} onChange={e => setTone(e.target.value)}>
              {['insightful', 'questioning', 'congratulatory', 'serious', 'funny'].map(t => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
      </AiCard>

      {/* DM */}
      <AiCard
        title="DM Draft"
        emoji="✉️"
        desc="Full personalised DM → approval queue before sending"
        disabled={!canDm}
        disabledReason="Available once connected"
        busy={busy === 'dm'}
        onGenerate={() => generate('dm', {
          lead_id:            lead.id,
          campaign_id:        lead.campaign_id,
          regen_instruction:  regenHint || undefined,
        })}
        result={results['dm']}
        resultKey="message"
        metaText={() => '→ Saved to DM approval queue'}
        onCopy={text => copyResult('dm', text)}
        copied={copied === 'dm'}
      >
        {canDm && (
          <div className="mb-3">
            <input
              className="input text-sm"
              placeholder="Optional regeneration instruction (e.g. 'make it shorter')"
              value={regenHint}
              onChange={e => setRegenHint(e.target.value)}
            />
          </div>
        )}
      </AiCard>

      {/* Manual override section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">⚙ Pending Actions</p>
          <span className="text-2xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">manual override</span>
        </div>
        <ManualOverridePanel leadId={lead.id} onActionChanged={() => {}} />
      </div>

    </div>
  )
}

// ── AI Action Card ─────────────────────────────────────────

function AiCard({
  title, emoji, desc, disabled, disabledReason,
  busy, onGenerate, result, resultKey, metaText, onCopy, copied,
  children,
}: {
  title: string; emoji: string; desc: string
  disabled?: boolean; disabledReason?: string
  busy: boolean; onGenerate: () => void
  result?: any; resultKey: string
  metaText: (r: any) => string
  onCopy: (t: string) => void; copied: boolean
  children?: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{emoji}</span>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">{desc}</p>

      {children}

      <button
        onClick={onGenerate}
        disabled={disabled || busy}
        className={cn(
          'btn btn-primary btn-sm w-full justify-center gap-2',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {busy ? <><Spinner size={12} /> Generating…</> : '✨ Generate'}
      </button>

      {disabled && disabledReason && (
        <p className="text-2xs text-gray-400 text-center mt-2">{disabledReason}</p>
      )}

      {result && (
        <div className="mt-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-700 animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-2xs text-gray-400">{metaText(result)}</p>
            <button
              onClick={() => onCopy(result[resultKey] ?? '')}
              className="flex items-center gap-1 text-2xs text-brand-500 hover:text-brand-700 flex-shrink-0"
            >
              {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {result[resultKey]}
          </p>
        </div>
      )}
    </Card>
  )
}

// ── Funnel progress bar ────────────────────────────────────

const FUNNEL: LeadStage[] = [
  'imported', 'connection_sent', 'connected', 'engaging',
  'dm_ready', 'dm_sent', 'replied', 'won',
]

function FunnelProgress({ stage }: { stage: LeadStage }) {
  const idx = FUNNEL.indexOf(stage)
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
      <div className="flex gap-1 mb-1.5">
        {FUNNEL.map((s, i) => {
          const cfg  = STAGES[s]
          const done = i <= idx
          return (
            <div
              key={s}
              title={cfg?.label}
              className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{
                background: done ? cfg?.border : '#e5e7eb',
                opacity:    i === idx ? 1 : done ? 0.6 : 0.3,
              }}
            />
          )
        })}
      </div>
      <p className="text-xs text-gray-400">
        <span className="font-medium text-gray-600 dark:text-gray-300">
          {STAGES[stage]?.label ?? stage}
        </span>
        {' '}· step {Math.max(1, idx + 1)} of {FUNNEL.length}
      </p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function parseList(raw: string): string[] {
  if (!raw || raw === 'undefined' || raw === 'null') return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function Check({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="1.5,5 4,7.5 8.5,2" />
    </svg>
  )
}
