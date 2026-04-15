'use client'
import { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useApiCall } from '@/hooks'
import { Spinner, Avatar, StageBadge, EmptyState } from '@/components/shared/primitives'
import { cn, formatDate } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'

// ── Event type colours ─────────────────────────────────────

const EVENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'action.completed':          { bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-700 dark:text-green-400',  label: 'Completed' },
  'action.failed':             { bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-600 dark:text-red-400',      label: 'Failed' },
  'action.created':            { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600 dark:text-blue-400',    label: 'Scheduled' },
  'action.skipped':            { bg: 'bg-gray-50 dark:bg-gray-800',        text: 'text-gray-500',                       label: 'Skipped' },
  'action.manual_trigger':     { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', label: 'Manual trigger' },
  'action.manual_skip':        { bg: 'bg-gray-50 dark:bg-gray-800',        text: 'text-gray-500',                       label: 'Manual skip' },
  'lead.stage_changed':        { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', label: 'Stage moved' },
  'lead.imported':             { bg: 'bg-teal-50 dark:bg-teal-900/20',     text: 'text-teal-600 dark:text-teal-400',   label: 'Imported' },
  'dm.drafted':                { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500 dark:text-purple-400', label: 'DM drafted' },
  'dm.approved':               { bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-600 dark:text-green-400', label: 'DM approved' },
  'dm.sent':                   { bg: 'bg-pink-50 dark:bg-pink-900/20',     text: 'text-pink-600 dark:text-pink-400',   label: 'DM sent' },
  'dm.rejected':               { bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-500',                       label: 'DM rejected' },
  'pacing.daily_cap_reached':  { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600 dark:text-amber-400', label: 'Daily cap' },
  'pause_on':                  { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600',                     label: 'Paused' },
  'pause_off':                 { bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-600',                     label: 'Resumed' },
  'safe_mode_on':              { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600',                      label: 'Safe mode on' },
  'safe_mode_off':             { bg: 'bg-gray-50 dark:bg-gray-800',        text: 'text-gray-500',                      label: 'Safe mode off' },
}

const DEFAULT_EVENT = { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500', label: 'Event' }

const ALL_EVENT_TYPES = Object.keys(EVENT_COLORS)
const PAGE_SIZE = 50

export default function AuditPage() {
  const call     = useApiCall()
  const [rows, setRows]           = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [offset, setOffset]       = useState(0)

  // Filters
  const [search, setSearch]       = useState('')
  const [eventFilter, setEventFilter] = useState<string[]>([])
  const [filterOpen, setFilterOpen]   = useState(false)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(offset),
      })
      if (eventFilter.length > 0) p.set('event_type', eventFilter.join(','))
      if (dateFrom) p.set('from', dateFrom)
      if (dateTo)   p.set('to', dateTo)

      const data = await call(`/api/audit?${p}`)
      setRows(data.rows ?? [])
      setTotal(data.total ?? 0)
    } catch (e: any) {
      toast.error('Failed to load audit log', e.message)
    } finally { setLoading(false) }
  }, [call, offset, eventFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  async function exportCsv() {
    setExporting(true)
    try {
      const sb  = (await import('@/lib/supabase/client')).createBrowserClient()
      const tok = (await sb.auth.getSession()).data.session?.access_token
      if (!tok) { toast.error('Not authenticated'); return }

      const p = new URLSearchParams({ format: 'csv', limit: '5000' })
      if (eventFilter.length > 0) p.set('event_type', eventFilter.join(','))
      if (dateFrom) p.set('from', dateFrom)
      if (dateTo)   p.set('to', dateTo)

      const res = await fetch(`/api/audit?${p}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })

      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (e: any) {
      toast.error('Export failed', e.message)
    } finally { setExporting(false) }
  }

  // Client-side search filter (on top of server filters)
  const visible = search.trim()
    ? rows.filter(r =>
        r.leads?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.event_type.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(r.payload).toLowerCase().includes(search.toLowerCase())
      )
    : rows

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <h1 className="text-base font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">
          {total.toLocaleString()} events
        </span>
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              className="input text-xs pl-7 h-8 w-44"
              placeholder="Search events…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className={cn(
                'btn btn-secondary btn-sm gap-1.5',
                (eventFilter.length > 0 || dateFrom || dateTo) &&
                  'border-brand-400 text-brand-600 bg-brand-50 dark:bg-brand-900/20',
              )}
            >
              <Filter size={11} /> Filter
              {(eventFilter.length > 0) && (
                <span className="bg-brand-500 text-white text-2xs px-1.5 rounded-full">{eventFilter.length}</span>
              )}
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-panel p-4 w-64 animate-scale-in space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date range</p>
                  <div className="flex gap-2">
                    <input type="date" className="input text-xs flex-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    <input type="date" className="input text-xs flex-1" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event types</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {ALL_EVENT_TYPES.map(et => {
                      const cfg = EVENT_COLORS[et]
                      return (
                        <label key={et} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={eventFilter.includes(et)}
                            onChange={e => setEventFilter(prev =>
                              e.target.checked ? [...prev, et] : prev.filter(x => x !== et)
                            )}
                            className="w-3 h-3 accent-brand-500"
                          />
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                            {cfg.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {(eventFilter.length > 0 || dateFrom || dateTo) && (
                    <button
                      onClick={() => { setEventFilter([]); setDateFrom(''); setDateTo('') }}
                      className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <button onClick={load} className="btn btn-ghost btn-icon" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin-fast' : ''} />
          </button>

          <button onClick={exportCsv} disabled={exporting} className="btn btn-secondary btn-sm gap-1.5">
            {exporting ? <Spinner size={12} /> : <Download size={12} />}
            Export CSV
          </button>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No audit events"
            body="Events will appear here as the worker executes actions and stages change."
          />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
              <tr>
                {['Date / Time', 'Event', 'Lead', 'Details', 'Worker IP'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-2xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const cfg  = EVENT_COLORS[row.event_type] ?? DEFAULT_EVENT
                const lead = row.leads
                const dt   = new Date(row.occurred_at)

                return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    {/* DateTime */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <p className="text-xs text-gray-700 dark:text-gray-200 font-medium tabular-nums">
                        {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-2xs text-gray-400 tabular-nums">
                        {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </td>

                    {/* Event badge */}
                    <td className="px-4 py-2.5">
                      <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* Lead */}
                    <td className="px-4 py-2.5">
                      {lead ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={lead.full_name} size={22} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">
                              {lead.full_name}
                            </p>
                            <p className="text-2xs text-gray-400 truncate max-w-[120px]">{lead.company}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Payload */}
                    <td className="px-4 py-2.5 max-w-xs">
                      <PayloadCell payload={row.payload} eventType={row.event_type} />
                    </td>

                    {/* Worker IP */}
                    <td className="px-4 py-2.5">
                      <span className="text-2xs text-gray-300 font-mono">{row.worker_ip ?? '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <span className="text-xs text-gray-400">
          {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()} events
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className="btn btn-ghost btn-icon btn-sm disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setOffset(o => o + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
            className="btn btn-ghost btn-icon btn-sm disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Payload cell ───────────────────────────────────────────

function PayloadCell({ payload, eventType }: { payload: any; eventType: string }) {
  const [expanded, setExpanded] = useState(false)

  if (!payload || Object.keys(payload).length === 0) {
    return <span className="text-gray-300 text-xs">—</span>
  }

  // Human-readable summary
  const summary = buildSummary(eventType, payload)

  return (
    <div>
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{summary}</p>
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-2xs text-gray-300 hover:text-gray-500 mt-0.5"
      >
        {expanded ? 'hide' : 'details'}
      </button>
      {expanded && (
        <pre className="text-2xs text-gray-400 mt-1 bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto max-w-xs">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

function buildSummary(eventType: string, payload: any): string {
  switch (eventType) {
    case 'lead.stage_changed':    return `${payload.from} → ${payload.to}${payload.reason ? ` (${payload.reason})` : ''}`
    case 'action.completed':      return `${String(payload.action_type ?? '').replace(/_/g, ' ')} succeeded`
    case 'action.failed':         return payload.error ? String(payload.error).slice(0, 80) : 'Action failed'
    case 'action.created':        return `${String(payload.action_type ?? '').replace(/_/g, ' ')} scheduled`
    case 'action.manual_trigger': return `Manually triggered ${String(payload.action_type ?? '').replace(/_/g, ' ')}`
    case 'action.manual_skip':    return `Skipped ${String(payload.action_type ?? '').replace(/_/g, ' ')}`
    case 'dm.drafted':            return `Draft ready (${payload.message_length ?? 0} chars)`
    case 'dm.approved':           return payload.was_edited ? 'Approved with edits' : 'Approved as-is'
    case 'lead.imported':         return `${payload.count ?? 0} leads (format: ${payload.format ?? 'generic'})`
    case 'pacing.daily_cap_reached': return String(payload.reason ?? 'Daily limit reached')
    default:                      return Object.entries(payload).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')
  }
}
