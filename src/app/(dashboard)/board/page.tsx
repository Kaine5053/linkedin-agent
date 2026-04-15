'use client'
import { useEffect, useState } from 'react'
import { useLeads, useCampaigns } from '@/hooks'
import { useLeadDetail } from '@/hooks/useLeadDetail'
import { useDashStore } from '@/store/dashboard'
import { KanbanBoard }   from '@/components/views/KanbanBoard'
import { TableView }     from '@/components/views/TableView'
import { DashboardView } from '@/components/views/DashboardView'
import { LeadPanel }     from '@/components/panels/LeadPanel'
import { Toolbar }       from '@/components/shared/Toolbar'
import { ActivityFeed }  from '@/components/shared/ActivityFeed'
import { ImportModal }   from '@/components/shared/ImportModal'
import { ChevronDown, Plus, Zap, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BoardPage() {
  const { activeCampaignId, setActiveCampaignId, viewMode, panelLeadId, closePanel, filters } = useDashStore()
  const { campaigns, loading: campaignsLoading } = useCampaigns()
  const [activityOpen, setActivityOpen] = useState(false)
  const [importOpen, setImportOpen]     = useState(false)

  useEffect(() => {
    if (campaigns.length > 0 && !activeCampaignId) {
      setActiveCampaignId(campaigns[0].id)
    }
  }, [campaigns, activeCampaignId, setActiveCampaignId])

  const { leads, loading: leadsLoading, updateLocal } = useLeads(activeCampaignId)

  // Full lead detail fetched when panel opens
  const { data: panelLead, loading: panelLoading, updateLocal: updatePanelLocal } = useLeadDetail(panelLeadId)

  // Filtered count for toolbar display
  const filteredCount = leads.filter(l => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!l.full_name.toLowerCase().includes(q) && !l.company?.toLowerCase().includes(q)) return false
    }
    if (filters.stages.length > 0 && !filters.stages.includes(l.stage)) return false
    return true
  }).length

  function handleLeadUpdate(updated: any) {
    updateLocal(updated)
    updatePanelLocal(updated)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Topbar */}
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: 15 }}>
            Outreach Board
          </h1>
          {campaigns.length > 0 && (
            <div className="relative flex items-center gap-0.5">
              <select
                value={activeCampaignId ?? ''}
                onChange={e => setActiveCampaignId(e.target.value)}
                className="appearance-none text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-transparent border-none outline-none cursor-pointer pr-4"
              >
                <option value="" disabled>Select campaign…</option>
                {campaigns.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-0 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivityOpen(o => !o)}
            className={cn(
              'btn btn-ghost btn-sm gap-1.5',
              activityOpen && 'bg-gray-100 dark:bg-gray-800 text-brand-500',
            )}
          >
            <Activity size={13} />
            <span className="hidden md:inline">Activity</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="btn btn-secondary btn-sm gap-1.5"
          >
            <Plus size={12} />
            Import leads
          </button>
          <button className="btn btn-primary btn-sm gap-1.5">
            <Zap size={12} />
            <span className="hidden md:inline">Generate all</span>
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar totalLeads={leads.length} filteredCount={filteredCount} />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Board / Table / Analytics */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'kanban' && (
            <KanbanBoard
              leads={leads}
              loading={leadsLoading || campaignsLoading}
              onLeadUpdated={handleLeadUpdate}
            />
          )}
          {viewMode === 'table' && (
            <TableView leads={leads} loading={leadsLoading || campaignsLoading} />
          )}
          {viewMode === 'dashboard' && (
            <DashboardView leads={leads} loading={leadsLoading || campaignsLoading} />
          )}
        </div>

        {/* Activity feed sidebar */}
        {activityOpen && (
          <div className="w-72 flex-shrink-0 border-l border-gray-100 dark:border-gray-800 overflow-hidden">
            <ActivityFeed campaignId={activeCampaignId} onClose={() => setActivityOpen(false)} />
          </div>
        )}
      </div>

      {/* Lead detail panel */}
      {panelLeadId && (
        <LeadPanel
          lead={panelLead}
          loading={panelLoading}
          onUpdate={handleLeadUpdate}
        />
      )}

      {/* Import modal */}
      {importOpen && activeCampaignId && (
        <ImportModal
          campaignId={activeCampaignId}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); window.location.reload() }}
        />
      )}
    </div>
  )
}
