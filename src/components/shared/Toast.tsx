'use client'
// ============================================================
// Toast notification system
//
// Usage anywhere in the app:
//   import { toast } from '@/components/shared/Toast'
//   toast.success('Lead imported')
//   toast.error('Something went wrong')
//   toast.info('Scheduled for 9am')
//   toast.warning('Daily cap reached')
//
// The <Toaster /> component must be mounted once in the layout.
// ============================================================

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id:      string
  type:    ToastType
  title:   string
  body?:   string
  duration: number
}

// ── Event bus (no context provider needed) ─────────────────

type Listener = (item: ToastItem) => void
const listeners: Listener[] = []

function emit(item: ToastItem) {
  listeners.forEach(l => l(item))
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

// ── Public API ─────────────────────────────────────────────

export const toast = {
  success: (title: string, body?: string, duration = 3500) =>
    emit({ id: uid(), type: 'success', title, body, duration }),

  error: (title: string, body?: string, duration = 5000) =>
    emit({ id: uid(), type: 'error', title, body, duration }),

  info: (title: string, body?: string, duration = 3000) =>
    emit({ id: uid(), type: 'info', title, body, duration }),

  warning: (title: string, body?: string, duration = 4000) =>
    emit({ id: uid(), type: 'warning', title, body, duration }),
}

// ── Config ─────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, {
  icon:       React.ReactNode
  bg:         string
  border:     string
  title:      string
  body:       string
}> = {
  success: {
    icon:   <CheckCircle2 size={15} className="text-green-500" />,
    bg:     'bg-white dark:bg-gray-900',
    border: 'border-green-200 dark:border-green-800',
    title:  'text-green-800 dark:text-green-300',
    body:   'text-green-600 dark:text-green-400',
  },
  error: {
    icon:   <XCircle size={15} className="text-red-500" />,
    bg:     'bg-white dark:bg-gray-900',
    border: 'border-red-200 dark:border-red-800',
    title:  'text-red-800 dark:text-red-300',
    body:   'text-red-600 dark:text-red-400',
  },
  info: {
    icon:   <Info size={15} className="text-blue-500" />,
    bg:     'bg-white dark:bg-gray-900',
    border: 'border-blue-200 dark:border-blue-800',
    title:  'text-blue-800 dark:text-blue-300',
    body:   'text-blue-600 dark:text-blue-400',
  },
  warning: {
    icon:   <AlertTriangle size={15} className="text-amber-500" />,
    bg:     'bg-white dark:bg-gray-900',
    border: 'border-amber-200 dark:border-amber-800',
    title:  'text-amber-800 dark:text-amber-300',
    body:   'text-amber-600 dark:text-amber-400',
  },
}

// ── Toaster component ──────────────────────────────────────
// Mount once in your layout.

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler: Listener = (item) => {
      setItems(prev => [...prev.slice(-4), item]) // max 5 toasts
    }
    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  function dismiss(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (items.length === 0) return null

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {items.map(item => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  )
}

// ── Single toast card ──────────────────────────────────────

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const cfg = TOAST_CONFIG[item.type]

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10)

    // Auto-dismiss
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 250)
    }, item.duration)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [item.duration, onDismiss])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-panel',
        'min-w-[280px] max-w-sm',
        'transition-all duration-250',
        cfg.bg, cfg.border,
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2',
      )}
    >
      <span className="flex-shrink-0 mt-0.5">{cfg.icon}</span>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold leading-tight', cfg.title)}>
          {item.title}
        </p>
        {item.body && (
          <p className={cn('text-xs mt-0.5 leading-relaxed', cfg.body)}>
            {item.body}
          </p>
        )}
      </div>

      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 250) }}
        className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
      >
        <X size={12} />
      </button>
    </div>
  )
}
