'use client'
// ============================================================
// ManualOverridePanel
// Used inside the LeadPanel AI Actions tab to show all
// pending/scheduled actions for a lead with manual controls.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Play, SkipForward, Clock, RotateCcw, ChevronDown } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useApiCall } from '@/hooks'
import { Spinner, Card, SectionHeader } from '@/components/shared/primitives'
import { toast } from '@/components/shared/Toast'

interface PendingAction {
  id:            string
  action_type:   string
  status:        string
  execute_after: string
  attempts:      number
  last_error:    string | null
  created_at:    string
  payload:       Record<string, unknown>
}

const ACTION_LABELS: Record<string, string> = {
  connection_request: '🔗 Connection request',
  post_comment:       '💬 Post comment',
  dm_send:            '✉️ Send DM',
  profile_view:       '👁 Profile view',
}

const STATUS_COLOURS: Record<string, string> = {
  pending:     'bg-gray-50 text-gray-500 dark:bg-gray-800',
  scheduled:   'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  failed:      'bg-red-50 text-red-500 dark:bg-red-900/20',
  in_progress: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20',
  skipped:     'bg-gray-50 text-gray-400 dark:bg-gray-800',
}

interface ManualOverridePanelProps {
  leadId: string
  onActionChanged?: () => void
}

export function ManualOverridePanel({ leadId, onActionChanged }: ManualOverridePanelProps) {
  const call = useApiCall()
  const [actions, setActions]   = useState<PendingAction[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [delayMins, setDelayMins]       = useState(60)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await call(`/api/worker/actions?lead_id=${leadId}&status=pending,scheduled,failed`)
      setActions(data.actions ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [call, leadId])

  useEffect(() => { load() }, [load])

  async function operate(actionId: string, operation: string, extra?: object) {
    setBusy(actionId)
    try {
      await call('/api/worker/actions', {
        method: 'POST',
        body: JSON.stringify({ action_id: actionId, operation, ...extra }),
      })
      const opLabels: Record<string, string> = {
        trigger_now:  'Action triggered — worker will execute on next poll',
        skip:         'Action skipped',
        reschedule:   `Action rescheduled by ${delayMins} minutes`,
      }
      toast.success(opLabels[operation] ?? 'Done')
      setRescheduleId(null)
      await load()
      onActionChanged?.()
    } catch (e: any) {
      toast.error('Override failed', e.message)
    } finally { setBusy(null) }
  }

  if (loading) return (
    <div className="flex justify-center py-4"><Spinner size={18} /></div>
  )

  if (actions.length === 0) return (
    <p className="text-xs text-gray-400 italic py-2">
      No pending or scheduled actions for this lead.
    </p>
  )

  return (
    <div className="space-y-2">
      {actions.map(action => (
        <Card key={action.id} className="p-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {ACTION_LABELS[action.action_type] ?? action.action_type}
            </p>
            <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLOURS[action.status] ?? 'bg-gray-50 text-gray-400')}>
              {action.status}
            </span>
          </div>

          {/* Schedule info */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {action.status === 'scheduled' || action.status === 'pending'
                ? `Due ${formatRelativeTime(action.execute_after)}`
                : formatRelativeTime(action.created_at)}
            </span>
            {action.attempts > 0 && (
              <span className="text-amber-500 font-medium">
                {action.attempts} attempt{action.attempts > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Error */}
          {action.last_error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2 mb-3 leading-relaxed">
              {action.last_error.slice(0, 120)}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => operate(action.id, 'trigger_now')}
              disabled={busy === action.id}
              className="btn btn-primary btn-sm gap-1.5 flex-1 justify-center"
              title="Execute immediately on next worker poll (~60s)"
            >
              {busy === action.id ? <Spinner size={11} /> : <Play size={11} />}
              Trigger now
            </button>

            <button
              onClick={() => setRescheduleId(rescheduleId === action.id ? null : action.id)}
              disabled={busy === action.id}
              className="btn btn-secondary btn-sm gap-1.5"
              title="Push execution back by N minutes"
            >
              <RotateCcw size={11} />
              Reschedule
            </button>

            <button
              onClick={() => operate(action.id, 'skip')}
              disabled={busy === action.id}
              className="btn btn-danger btn-sm gap-1.5"
              title="Skip this action entirely — it will not execute"
            >
              <SkipForward size={11} />
              Skip
            </button>
          </div>

          {/* Reschedule mini-form */}
          {rescheduleId === action.id && (
            <div className="mt-2 flex gap-2 animate-fade-in">
              <div className="flex-1">
                <label className="block text-2xs text-gray-400 mb-1">Delay (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={delayMins}
                  onChange={e => setDelayMins(Number(e.target.value))}
                  className="input text-xs"
                />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <button
                  onClick={() => operate(action.id, 'reschedule', { delay_minutes: delayMins })}
                  disabled={busy === action.id}
                  className="btn btn-primary btn-sm gap-1"
                >
                  {busy === action.id ? <Spinner size={11} /> : 'Set'}
                </button>
                <button
                  onClick={() => setRescheduleId(null)}
                  className="btn btn-ghost btn-sm text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
