'use client'
import { useState, useEffect } from 'react'
import { useLeads, useCampaigns } from '@/hooks'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { LeadPanel } from '@/components/leads/LeadPanel'
import { Topbar } from '@/components/layout/Topbar'
import type { Lead } from '@/types'

export default function DashboardPage() {
  const { campaigns, loading: campaignsLoading } = useCampaigns()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Auto-select first campaign
  useEffect(() => {
    if (campaigns.length > 0 && !campaignId) {
      setCampaignId(campaigns[0].id)
    }
  }, [campaigns, campaignId])

  const { leads, loading: leadsLoading, refetch } = useLeads(campaignId)

  function handleLeadUpdate(updated: Lead) {
    setSelectedLead(updated)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Topbar
        title="Outreach Board"
        subtitle={campaignId
          ? `${leads.length} leads across ${[...new Set(leads.map(l => l.stage))].length} stages`
          : 'Select a campaign to start'}
        campaigns={campaigns}
        campaignId={campaignId ?? ''}
        onCampaignChange={setCampaignId}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!campaignId && !campaignsLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32 }}>🗂</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>No campaign selected</div>
            <div style={{ fontSize: 13 }}>Select a campaign from the dropdown above to view your board</div>
          </div>
        ) : (
          <KanbanBoard
            leads={leads}
            loading={leadsLoading || campaignsLoading}
            onLeadClick={setSelectedLead}
          />
        )}
      </div>

      {/* Lead detail slide-in panel */}
      <LeadPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={handleLeadUpdate}
      />
    </div>
  )
}
