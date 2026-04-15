// ============================================================
// useLeadDetail — fetches the full lead object (with joined
// comments + dm_drafts) when a panel opens.
// Caches per lead_id so re-opening is instant.
// ============================================================

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useApiCall } from '@/hooks'

interface LeadDetail {
  id: string
  full_name: string
  first_name: string
  linkedin_url: string
  company: string | null
  job_title: string | null
  industry: string | null
  notes: string | null
  stage: string
  comment_count: number
  last_activity_at: string | null
  imported_at: string
  connected_at: string | null
  connection_sent_at: string | null
  dm_ready_at: string | null
  dm_sent_at: string | null
  campaign_id: string
  enrichment_data: Record<string, unknown>
  comments: Array<{
    id: string
    post_url: string
    post_snippet: string | null
    comment_text: string
    posted_at: string
    status: string
  }>
  dm_drafts: Array<{
    id: string
    status: string
    draft_text: string
    drafted_at: string
    approved_at: string | null
  }>
  pending_actions: Array<{
    id: string
    action_type: string
    status: string
    execute_after: string
    created_at: string
  }>
}

const cache = new Map<string, LeadDetail>()

export function useLeadDetail(leadId: string | null) {
  const call         = useApiCall()
  const [data, setData]       = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef<string | null>(null)

  const fetch = useCallback(async (id: string) => {
    // Serve from cache immediately, then refresh
    if (cache.has(id)) {
      setData(cache.get(id)!)
    }

    setLoading(true)
    try {
      // Fetch lead with all related data
      const result = await call(`/api/leads/${id}?include=comments,dm_drafts,actions`)
      const lead   = result.lead as LeadDetail
      cache.set(id, lead)
      setData(lead)
    } catch (err) {
      console.error('[useLeadDetail] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => {
    if (!leadId) { setData(null); return }
    if (fetchedRef.current !== leadId) {
      fetchedRef.current = leadId
      fetch(leadId)
    }
  }, [leadId, fetch])

  // Invalidate cache on external update
  function invalidate(id: string) {
    cache.delete(id)
    if (leadId === id) fetch(id)
  }

  function updateLocal(updated: Partial<LeadDetail>) {
    if (!data) return
    const next = { ...data, ...updated }
    cache.set(data.id, next)
    setData(next)
  }

  return { data, loading, invalidate, updateLocal }
}
