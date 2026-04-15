'use client'
import { useEffect, useState, useRef } from 'react'
import { X, Activity, CheckCircle2, XCircle, Clock, Zap, Send, Link2, AlertTriangle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Spinner } from '@/components/shared/primitives'

// ── Event icon / colour config ─────────────────────────────

const EV: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  'action.completed':   { icon: <CheckCircle2 size={11} />, color: 'text-green-500',  label: 'Done' },
  'action.failed':      { icon: <XCircle size={11} />,      color: 'text-red-400',    label: 'Failed' },
  'action.created':     { icon: <Clock size={11} />,        color: 'text-blue-400',   label: 'Scheduled' },
  'lead.stage_changed': { icon: <Zap size={11} />,          color: 'text-purple-500', label: 'Stage moved' },
  'dm.drafted':         { icon: <Zap size={11} />,          color: 'text-purple-400', label: 'DM drafted' },
  'dm.approved':        { icon: <CheckCircle2 size={11} />, color: 'text-green-500',  label: 'Approved' },
  'dm.sent':            { icon: <Send size={11} />,          color: 'text-pink-500',   label: 'DM sent' },
  'lead.imported':      { icon: <Link2 size={11} />,         color: 'text-indigo-400', label: 'Imported' },
  'pacing.daily_cap_reached': { icon: <AlertTriangle size={11} />, color: 'text-amber-400', label: 'Cap reached' },
}

const DEFAULT_EV = { icon: <Activity size={11} />, color: 'text-gray-400', label: 'Event' }

interface AuditRow {
  id: string
  event_type: string
  payload: Record<string, unknown>
  lead_id: string | null
  occurred_at: string
}

interface ActivityFeedProps {
  campaignId: string | null
  onClose: () => void
}

export function ActivityFeed({ campaignId, onClose }: ActivityFeedProps) {
  const sb            = createBrowserClient()
  const [rows, setRows]     = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef     = useRef<HTMLDivElement>(null)

  // Initial load
  useEffect(() => {
    sb.from('audit_log')
      .select('id, event_type, payload, lead_id, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (data) setRows(data.reverse() as AuditRow[])
        setLoading(false)
        setTimeout(() => bottomRef.current?.scrollIntoView(), 80)
      })
  }, [sb])

  // Realtime — new rows from VPS worker arrive within 1–2s
  useEffect(() => {
    const ch = sb.channel('audit-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_log' },
        ({ new: row }) => {
          setRows(prev => [...prev.slice(-99), row as AuditRow])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      )
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-brand-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Live Activity</span>
          <span className="flex items-center gap-1 text-2xs text-green-500 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-soft" />
            live
          </span>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-icon text-gray-400">
          <X size={13} />
        </button>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size={20} /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Activity size={20} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No activity yet</p>
            <p className="text-2xs text-gray-300 mt-1">Worker events appear here in real time</p>
          </div>
        ) : (
          <>
            {rows.map(row => <FeedRow key={row.id} row={row} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-50 dark:border-gray-800 flex-shrink-0">
        <p className="text-2xs text-gray-300 text-center">
          {rows.length} events · updates via Supabase Realtime
        </p>
      </div>
    </div>
  )
}

function FeedRow({ row }: { row: AuditRow }) {
  const cfg  = EV[row.event_type] ?? DEFAULT_EV
  const desc = describeEvent(row.event_type, row.payload)

  return (
    <div className="flex gap-2.5 px-4 py-2.5 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 border-b border-gray-50 dark:border-gray-800/50 transition-colors">
      <div className={cn('flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800', cfg.color)}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
          <span className="text-2xs text-gray-300 flex-shrink-0 tabular-nums">
            {new Date(row.occurred_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        {desc && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
            {desc}
          </p>
        )}
      </div>
    </div>
  )
}

function describeEvent(type: string, p: Record<string, unknown>): string {
  switch (type) {
    case 'action.completed': return `${String(p.action_type ?? '').replace(/_/g, ' ')} completed`
    case 'action.failed':    return p.error ? `Failed: ${String(p.error).slice(0, 55)}` : 'Action failed'
    case 'action.created':   return `${String(p.action_type ?? '').replace(/_/g, ' ')} → ${p.execute_after ? formatRelativeTime(String(p.execute_after)) : 'scheduled'}`
    case 'lead.stage_changed': return `${String(p.from ?? '')} → ${String(p.to ?? '')}`
    case 'dm.drafted':       return 'New DM draft waiting for approval'
    case 'dm.approved':      return 'DM scheduled for delivery'
    case 'dm.sent':          return 'DM sent successfully'
    case 'lead.imported':    return `${p.count ?? 0} leads added to campaign`
    case 'pacing.daily_cap_reached': return String(p.reason ?? 'Daily action limit reached')
    default:                 return ''
  }
}
