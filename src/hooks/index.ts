'use client'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createBrowserClient()
  return _sb
}

export function useApiCall() {
  return useCallback(async (url: string, options: RequestInit = {}) => {
    const sb = getSupabase()
    const session = await sb.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    return data
  }, [])
}

export function useUser() {
  const sb = getSupabase()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    sb.auth.getUser().then(({ data }: any) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null)
      setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_: any, session: any) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => subscription.unsubscribe()
  }, [sb])
  return { user, loading }
}

export function useLeads(campaignId: string | null) {
  const sb = getSupabase()
  const call = useApiCall()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    if (!campaignId) { setLeads([]); setLoading(false); return }
    try {
      const data = await call(`/api/leads?campaign_id=${campaignId}&limit=500`)
      setLeads(data.leads ?? [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [campaignId, call])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  useEffect(() => {
    if (!campaignId) return
    const ch = sb.channel(`leads-${campaignId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'leads', filter: `campaign_id=eq.${campaignId}` }, (payload: any) => {
        if (payload.eventType === 'UPDATE') setLeads(prev => prev.map((l: any) => l.id === payload.new.id ? { ...l, ...payload.new } : l))
        if (payload.eventType === 'INSERT') setLeads(prev => [payload.new, ...prev])
        if (payload.eventType === 'DELETE') setLeads(prev => prev.filter((l: any) => l.id !== payload.old.id))
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [campaignId, sb])

  const updateLocal = useCallback((updated: any) => {
    setLeads(prev => prev.map((l: any) => l.id === updated.id ? updated : l))
  }, [])

  return { leads, loading, error, refetch: fetchLeads, updateLocal }
}

export function useCampaigns() {
  const call = useApiCall()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    call('/api/campaigns').then((d: any) => setCampaigns(d.campaigns ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [call])
  return { campaigns, loading }
}

export function useDmQueue() {
  const sb = getSupabase()
  const call = useApiCall()
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchDrafts = useCallback(async () => {
    try { const d = await call('/api/actions/dm-queue'); setDrafts(d.drafts ?? []) } catch {} finally { setLoading(false) }
  }, [call])
  useEffect(() => { fetchDrafts() }, [fetchDrafts])
  useEffect(() => {
    const ch = sb.channel(`dm-drafts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'dm_drafts' }, () => fetchDrafts())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchDrafts])
  return { drafts, loading, refetch: fetchDrafts }
}

export function useAiSettings() {
  const call = useApiCall()
  const [settings, setSettings] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    call('/api/ai/settings').then((d: any) => { setSettings(d.settings); setUsage(d.usage_last_30_days) }).catch(() => {}).finally(() => setLoading(false))
  }, [call])
  const save = useCallback(async (updates: any) => {
    setSaving(true)
    try { const d = await call('/api/ai/settings', { method: 'PUT', body: JSON.stringify(updates) }); setSettings(d.settings) } finally { setSaving(false) }
  }, [call])
  return { settings, usage, loading, saving, save }
}
