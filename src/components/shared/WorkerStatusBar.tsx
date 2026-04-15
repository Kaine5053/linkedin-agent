'use client'
// ============================================================
// WorkerStatusBar
// Shown at the top of every dashboard page when the worker is
// paused or in safe mode. Zero visual footprint when all-clear.
// ============================================================

import { useState } from 'react'
import { Pause, Play, Shield, ChevronDown, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkerConfig } from '@/hooks/useWorkerConfig'
import { Spinner } from '@/components/shared/primitives'
import { toast } from '@/components/shared/Toast'

export function WorkerStatusBar() {
  const { config, saving, pause, resume, setSafe } = useWorkerConfig()
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false)
  const [customReason, setCustomReason]   = useState('')

  if (!config) return null
  if (!config.paused && !config.safe_mode) return null

  return (
    <div className={cn(
      'flex items-center gap-3 px-5 py-2 text-sm font-medium border-b flex-shrink-0 animate-slide-up',
      config.paused
        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    )}>
      {config.paused
        ? <Pause size={14} className="flex-shrink-0" />
        : <Shield size={14} className="flex-shrink-0" />}

      <span className="flex-1 text-xs">
        {config.paused
          ? <>Worker paused{config.paused_reason ? ` — ${config.paused_reason}` : ''}. No actions will execute.</>
          : <>Safe mode active — only profile views will execute. Connections, comments, and DMs are queued.</>}
      </span>

      {saving && <Spinner size={12} />}

      {config.paused ? (
        <button
          onClick={async () => {
            await resume()
            toast.success('Worker resumed', 'Actions will execute on their scheduled times.')
          }}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-1.5 hover:bg-amber-50 transition-colors"
        >
          <Play size={11} /> Resume
        </button>
      ) : (
        <button
          onClick={async () => {
            await setSafe(false)
            toast.success('Safe mode disabled', 'Full automation resumed.')
          }}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
        >
          <X size={11} /> Disable
        </button>
      )}
    </div>
  )
}

// ── Worker controls in Settings (standalone component) ────

export function WorkerControls() {
  const { config, saving, pause, resume, setSafe, update } = useWorkerConfig()
  const [reason, setReason]   = useState('')
  const [showReason, setShowReason] = useState(false)

  if (!config) return null

  async function handlePause() {
    await pause(reason || 'Manual pause')
    setReason('')
    setShowReason(false)
    toast.success('Worker paused', reason || 'All actions will stop until you resume.')
  }

  return (
    <div className="space-y-4">

      {/* Current status */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium',
        config.paused
          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
          : config.safe_mode
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      )}>
        <span className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          config.paused    ? 'bg-amber-400 animate-pulse' :
          config.safe_mode ? 'bg-blue-400' :
          'bg-green-400',
        )} />
        {config.paused    ? 'Paused' :
         config.safe_mode ? 'Safe Mode' :
         'Active — all systems normal'}
      </div>

      {/* Pause All */}
      <div className="flex items-start justify-between py-3 border-b border-gray-50 dark:border-gray-800">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Pause All Actions</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Worker immediately stops claiming new jobs. Already-claimed actions finish, then halt.
          </p>
          {config.paused && config.paused_at && (
            <p className="text-xs text-amber-500 mt-1 font-medium">
              Paused {new Date(config.paused_at).toLocaleString('en-GB')}
              {config.paused_reason ? ` · ${config.paused_reason}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
          <button
            onClick={() => config.paused ? resume() : setShowReason(r => !r)}
            disabled={saving}
            className={cn(
              'btn btn-sm gap-1.5',
              config.paused ? 'btn-primary' : 'btn-danger',
            )}
          >
            {saving ? <Spinner size={11} /> : config.paused ? <Play size={11} /> : <Pause size={11} />}
            {config.paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {showReason && !config.paused && (
        <div className="flex gap-2 animate-fade-in">
          <input
            className="input flex-1 text-sm"
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePause()}
            autoFocus
          />
          <button onClick={handlePause} disabled={saving} className="btn btn-danger btn-sm">
            {saving ? <Spinner size={11} /> : 'Pause now'}
          </button>
        </div>
      )}

      {/* Safe Mode */}
      <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Safe Mode</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Worker runs but only executes profile views. All other actions are queued until you disable it.
            Use when LinkedIn has flagged your account or during high-risk periods.
          </p>
        </div>
        <button
          onClick={async () => {
            await setSafe(!config.safe_mode)
            toast.info(
              config.safe_mode ? 'Safe mode disabled' : 'Safe mode enabled',
              config.safe_mode ? 'Full automation resumed.' : 'Only profile views will execute.',
            )
          }}
          disabled={saving}
          className="flex-shrink-0 ml-4"
          style={{ height: 24, width: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: config.safe_mode ? '#3b82f6' : '#e5e7eb', position: 'relative',
            transition: 'background .2s' }}
        >
          <span style={{
            position: 'absolute', top: 3, width: 18, height: 18,
            left: config.safe_mode ? 23 : 3,
            background: 'white', borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(0,0,0,.15)',
            transition: 'left .2s',
          }} />
        </button>
      </div>

      {/* Daily override sliders */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Daily Limits Override</p>
        <DailySlider
          label="Connections / day"
          value={config.daily_connection_override}
          max={30}
          defaultValue={15}
          onChange={v => update({ daily_connection_override: v })}
          saving={saving}
        />
        <DailySlider
          label="Comments / day"
          value={config.daily_comment_override}
          max={40}
          defaultValue={20}
          onChange={v => update({ daily_comment_override: v })}
          saving={saving}
        />
      </div>
    </div>
  )
}

function DailySlider({ label, value, max, defaultValue, onChange, saving }: {
  label: string; value: number | null; max: number; defaultValue: number
  onChange: (v: number | null) => void; saving: boolean
}) {
  const current = value ?? defaultValue
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums w-4 text-right">{current}</span>
          {value !== null && (
            <button onClick={() => onChange(null)} className="text-gray-300 hover:text-gray-500 text-2xs">
              reset
            </button>
          )}
        </div>
      </div>
      <input
        type="range" min={1} max={max} value={current}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
        disabled={saving}
      />
      <div className="flex justify-between text-2xs text-gray-300 mt-0.5">
        <span>1</span>
        <span className="text-gray-400">Default: {defaultValue}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
