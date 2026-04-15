'use client'
// ============================================================
// useWorkerConfig — fetch/update pause + safe mode
// useNotifications — realtime unread count + list
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useApiCall } from './index'

// ── useWorkerConfig ────────────────────────────────────────

interface WorkerConfig {
  id:                         string
  user_id:                    string
  paused:                     boolean
  paused_at:                  string | null
  paused_reason:              string | null
  safe_mode:                  boolean
  daily_connection_override:  number | null
  daily_comment_override:     number | null
  updated_at:                 string
}

export function useWorkerConfig() {
  const call    = useApiCall()
  const sb      = createBrowserClient()
  const [config, setConfig]   = useState<WorkerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await call('/api/worker/config')
      setConfig(data.config)
    } catch {}
    finally { setLoading(false) }
  }, [call])

  useEffect(() => { load() }, [load])

  // Realtime — config changes propagate immediately across tabs
  useEffect(() => {
    const ch = sb.channel('worker-config-live')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'worker_config',
      }, payload => {
        setConfig(prev => prev ? { ...prev, ...(payload.new as any) } : prev)
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb])

  const update = useCallback(async (updates: Partial<WorkerConfig> & { reason?: string }) => {
    setSaving(true)
    try {
      const data = await call('/api/worker/config', {
        method: 'PATCH',
        body:   JSON.stringify(updates),
      })
      setConfig(data.config)
      return data.config as WorkerConfig
    } finally { setSaving(false) }
  }, [call])

  const pause   = (reason?: string) => update({ paused: true, reason })
  const resume  = ()                 => update({ paused: false })
  const setSafe = (on: boolean)      => update({ safe_mode: on })

  return { config, loading, saving, update, pause, resume, setSafe }
}

// ── useNotifications ──────────────────────────────────────

interface AppNotification {
  id:         string
  type:       string
  title:      string
  body:       string | null
  lead_id:    string | null
  action_url: string | null
  read:       boolean
  created_at: string
}

export function useNotifications() {
  const call    = useApiCall()
  const sb      = createBrowserClient()
  const [items, setItems]         = useState<AppNotification[]>([])
  const [unreadCount, setUnread]  = useState(0)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await call('/api/notifications?limit=30')
      setItems(data.notifications ?? [])
      setUnread(data.unread_count ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [call])

  useEffect(() => { load() }, [load])

  // Realtime — new notifications appear instantly
  useEffect(() => {
    const ch = sb.channel('notif-live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'in_app_notifications',
      }, payload => {
        const n = payload.new as AppNotification
        setItems(prev => [n, ...prev.slice(0, 29)])
        setUnread(c => c + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'in_app_notifications',
      }, payload => {
        const updated = payload.new as AppNotification
        setItems(prev => prev.map(n => n.id === updated.id ? updated : n))
        if (updated.read) setUnread(c => Math.max(0, c - 1))
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb])

  const markRead = useCallback(async (id?: string) => {
    try {
      await call('/api/notifications/mark-read', {
        method: 'POST',
        body:   JSON.stringify(id ? { notification_id: id } : {}),
      })
      if (id) {
        setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        setUnread(c => Math.max(0, c - 1))
      } else {
        setItems(prev => prev.map(n => ({ ...n, read: true })))
        setUnread(0)
      }
    } catch {}
  }, [call])

  return { items, unreadCount, loading, markRead, reload: load }
}
