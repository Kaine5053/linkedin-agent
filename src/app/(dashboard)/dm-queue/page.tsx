'use client'
import { useState } from 'react'
import { Check, X, RefreshCw, ExternalLink, ChevronRight, MessageSquare, Clock, Send, Linkedin } from 'lucide-react'
import { useDmQueue, useApiCall } from '@/hooks'
import { Avatar, StageBadge, Spinner, Card, EmptyState, SectionHeader } from '@/components/shared/primitives'
import { cn, formatRelativeTime } from '@/lib/utils'

export default function DmQueuePage() {
  const { drafts, loading, refetch } = useDmQueue()
  const [selected, setSelected]     = useState<string | null>(null)
  const [editTexts, setEditTexts]   = useState<Record<string, string>>({})
  const [busy, setBusy]             = useState<string | null>(null)
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const call = useApiCall()

  const selectedDraft = drafts.find((d: any) => d.id === selected)

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleApprove(draftId: string) {
    setBusy(draftId)
    try {
      const text = editTexts[draftId]
      await call('/api/actions/dm-queue', {
        method: 'POST',
        body: JSON.stringify({ dm_draft_id: draftId, action: 'approve', edited_text: text || undefined }),
      })
      showToast('success', 'DM approved and scheduled ✓')
      setSelected(null)
      await refetch()
    } catch (e: any) { showToast('error', `Approval failed: ${e.message}`) }
    finally { setBusy(null) }
  }

  async function handleReject(draftId: string) {
    if (!confirm('Reject this draft? The lead stays in DM Ready stage.')) return
    setBusy(draftId)
    try {
      await call('/api/actions/dm-queue', {
        method: 'POST',
        body: JSON.stringify({ dm_draft_id: draftId, action: 'reject' }),
      })
      showToast('success', 'Draft rejected')
      setSelected(null)
      await refetch()
    } catch (e: any) { showToast('error', `Rejection failed: ${e.message}`) }
    finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Topbar */}
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <h1 className="text-base font-bold text-gray-900 dark:text-white">DM Approval Queue</h1>
        <p className="text-xs text-gray-400 hidden md:block">No DM sends without your sign-off</p>
        <div className="flex-1" />
        <button onClick={refetch} className="btn btn-ghost btn-icon">
          <RefreshCw size={13} className={loading ? 'animate-spin-fast' : ''} />
        </button>
        {drafts.length > 0 && (
          <span className="bg-brand-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {drafts.length} pending
          </span>
        )}
      </header>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-panel text-sm font-medium animate-slide-right',
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
        )}>
          {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="📬"
            title="Queue is empty"
            body="When leads reach DM Ready stage and AI generates a draft, it will appear here for your review before sending."
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* List column */}
          <div className={cn(
            'flex-shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-900',
            selected ? 'w-72' : 'w-full',
          )}>
            {/* Column header */}
            <div className="px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {drafts.length} draft{drafts.length > 1 ? 's' : ''} awaiting review
              </p>
            </div>

            {drafts.map((draft: any) => (
              <DraftListItem
                key={draft.id}
                draft={draft}
                selected={selected === draft.id}
                onClick={() => setSelected(selected === draft.id ? null : draft.id)}
              />
            ))}
          </div>

          {/* Detail pane */}
          {selectedDraft && (
            <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950 animate-fade-in">
              <DraftDetail
                draft={selectedDraft}
                editText={editTexts[selectedDraft.id] ?? selectedDraft.draft_text}
                onEditChange={text => setEditTexts(prev => ({ ...prev, [selectedDraft.id]: text }))}
                onApprove={() => handleApprove(selectedDraft.id)}
                onReject={() => handleReject(selectedDraft.id)}
                busy={busy === selectedDraft.id}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── List Item ──────────────────────────────────────────────

function DraftListItem({ draft, selected, onClick }: any) {
  const lead = draft.leads
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-100 border-b border-gray-50 dark:border-gray-800 border-l-2',
        selected
          ? 'bg-brand-50 dark:bg-brand-900/20 border-l-brand-500'
          : 'bg-white dark:bg-gray-900 border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40',
      )}
    >
      <Avatar name={lead?.full_name ?? '?'} size={36} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{lead?.full_name}</p>
          <ChevronRight size={12} className={cn('text-gray-300 flex-shrink-0 mt-0.5 transition-transform', selected && 'rotate-90 text-brand-500')} />
        </div>
        <p className="text-xs text-gray-400 truncate mb-2">{lead?.job_title} · {lead?.company}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {draft.draft_text.slice(0, 110)}…
        </p>
        <div className="flex items-center gap-3 mt-2">
          {(lead?.comments?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-2xs text-blue-500">
              <MessageSquare size={9} />
              {lead.comments.length} comment{lead.comments.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="flex items-center gap-1 text-2xs text-gray-300">
            <Clock size={9} />
            {formatRelativeTime(draft.drafted_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Detail Pane ────────────────────────────────────────────

function DraftDetail({ draft, editText, onEditChange, onApprove, onReject, busy }: any) {
  const lead     = draft.leads
  const comments = (lead?.comments ?? []).slice(0, 5)
  const isEdited = editText !== draft.draft_text

  return (
    <div className="flex flex-col h-full">

      {/* Lead header */}
      <div className="px-6 pt-5 pb-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={lead?.full_name ?? ''} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-md text-gray-900 dark:text-white">{lead?.full_name}</p>
            <p className="text-xs text-gray-400">{lead?.job_title} · {lead?.company}</p>
          </div>
          {lead?.stage && <StageBadge stage={lead.stage} />}
        </div>
        {lead?.linkedin_url && (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-700 transition-colors"
          >
            <Linkedin size={11} />
            View LinkedIn profile
            <ExternalLink size={9} className="opacity-60" />
          </a>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Comment context */}
        {comments.length > 0 && (
          <section>
            <SectionHeader>Comment history with {lead?.first_name ?? 'this lead'}</SectionHeader>
            <div className="space-y-2">
              {comments.map((c: any, i: number) => (
                <Card key={i} className="p-3">
                  {c.post_snippet && (
                    <p className="text-xs text-gray-400 italic leading-relaxed mb-2 pl-2 border-l-2 border-gray-200 dark:border-gray-600 line-clamp-2">
                      "{c.post_snippet}…"
                    </p>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{c.comment_text}</p>
                  <p className="text-2xs text-gray-300 mt-1.5">{formatRelativeTime(c.posted_at)}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* DM editor */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <SectionHeader className="mb-0">Message</SectionHeader>
            <div className="flex items-center gap-2">
              {isEdited && (
                <span className="text-2xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  Edited
                </span>
              )}
              <span className="text-2xs text-gray-300">{editText.length} chars</span>
              <span className="text-2xs font-semibold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                AI generated
              </span>
            </div>
          </div>

          <textarea
            className="input text-sm leading-relaxed"
            value={editText}
            onChange={e => onEditChange(e.target.value)}
            style={{ minHeight: 240, resize: 'vertical' }}
          />

          <p className="text-2xs text-gray-300 text-right mt-1">
            LinkedIn DM limit: ~1,900 chars
          </p>
        </section>

      </div>

      {/* Action bar */}
      <div className="px-6 py-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex gap-3">
          <button
            onClick={onReject}
            disabled={busy}
            className="btn btn-danger flex-1 justify-center gap-2"
          >
            {busy ? <Spinner size={14} /> : <X size={14} />}
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={busy}
            className="btn btn-primary flex-[2] justify-center gap-2"
          >
            {busy ? <Spinner size={14} /> : <Send size={14} />}
            {isEdited ? 'Approve edited DM' : 'Approve & schedule'}
          </button>
        </div>
        <p className="text-2xs text-gray-400 text-center mt-2.5">
          Approved DMs are scheduled within working hours and sent automatically by the worker.
        </p>
      </div>
    </div>
  )
}
