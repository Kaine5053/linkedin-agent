'use client'
import { useState, useRef, useEffect } from 'react'
import { Bell, X, Check, ExternalLink } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useNotifications } from '@/hooks/useWorkerConfig'
import { Spinner } from '@/components/shared/primitives'
import { useRouter } from 'next/navigation'

const TYPE_ICONS: Record<string, string> = {
  dm_ready:             '✨',
  dm_approved:          '✓',
  connection_accepted:  '🤝',
  daily_cap:            '📊',
  worker_error:         '⚠️',
  import_complete:      '📥',
  reply_detected:       '💬',
  safe_mode_on:         '🛡',
  safe_mode_off:        '🛡',
  pause_on:             '⏸',
  pause_off:            '▶',
}

export function NotificationCenter() {
  const { items, unreadCount, loading, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref    = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleOpen() {
    setOpen(o => !o)
  }

  async function handleClick(n: any) {
    if (!n.read) await markRead(n.id)
    if (n.action_url) {
      router.push(n.action_url)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
          open
            ? 'bg-white/15 text-white'
            : 'text-gray-400 hover:bg-white/8 hover:text-white',
        )}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-brand-500 text-white text-2xs font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-2 z-50',
          'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
          'rounded-xl shadow-panel overflow-hidden w-80 animate-scale-in',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-brand-500 text-white text-2xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markRead()}
                className="text-2xs text-brand-500 hover:text-brand-700 font-medium flex items-center gap-1"
              >
                <Check size={10} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6"><Spinner size={20} /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <Bell size={20} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No notifications yet</p>
              </div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800',
                    !n.read ? 'bg-brand-50/50 dark:bg-brand-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  )}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] ?? '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={cn(
                        'text-sm leading-tight',
                        !n.read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200',
                      )}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-2xs text-gray-300 mt-1">{formatRelativeTime(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { router.push('/audit'); setOpen(false) }}
                className="text-xs text-brand-500 hover:text-brand-700 font-medium flex items-center gap-1 w-full justify-center"
              >
                View full audit log <ExternalLink size={10} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
