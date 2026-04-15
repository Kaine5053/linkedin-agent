// ============================================================
// Global dashboard store — Zustand
// Holds UI state that needs to be shared across components:
//   - active campaign
//   - view mode (kanban / table / dashboard)
//   - selected lead IDs (for bulk actions)
//   - search & filter state
//   - side panel open/closed
//   - dark mode
// ============================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LeadStage } from '@/lib/utils'

export type ViewMode = 'kanban' | 'table' | 'dashboard'

export interface FilterState {
  search:      string
  stages:      LeadStage[]
  seniority:   string[]
  company:     string[]
  hasEmail:    boolean | null
}

interface DashboardStore {
  // Campaign
  activeCampaignId: string | null
  setActiveCampaignId: (id: string | null) => void

  // View
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // Filters
  filters: FilterState
  setSearch: (q: string) => void
  setStageFilter: (stages: LeadStage[]) => void
  setFilter: (key: keyof FilterState, value: any) => void
  resetFilters: () => void

  // Selection (bulk actions)
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void

  // Side panel
  panelLeadId: string | null
  openPanel: (id: string) => void
  closePanel: () => void

  // Dark mode
  dark: boolean
  toggleDark: () => void
}

const DEFAULT_FILTERS: FilterState = {
  search:    '',
  stages:    [],
  seniority: [],
  company:   [],
  hasEmail:  null,
}

export const useDashStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      activeCampaignId: null,
      setActiveCampaignId: id => set({ activeCampaignId: id, selectedIds: new Set() }),

      viewMode: 'kanban',
      setViewMode: mode => set({ viewMode: mode }),

      filters: DEFAULT_FILTERS,
      setSearch: q => set(s => ({ filters: { ...s.filters, search: q } })),
      setStageFilter: stages => set(s => ({ filters: { ...s.filters, stages } })),
      setFilter: (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      selectedIds: new Set(),
      toggleSelect: id => set(s => {
        const next = new Set(s.selectedIds)
        next.has(id) ? next.delete(id) : next.add(id)
        return { selectedIds: next }
      }),
      selectAll: ids => set({ selectedIds: new Set(ids) }),
      clearSelection: () => set({ selectedIds: new Set() }),

      panelLeadId: null,
      openPanel: id => set({ panelLeadId: id }),
      closePanel: () => set({ panelLeadId: null }),

      dark: false,
      toggleDark: () => set(s => {
        const dark = !s.dark
        document.documentElement.classList.toggle('dark', dark)
        return { dark }
      }),
    }),
    {
      name: 'linkedin-agent-dashboard',
      partialize: s => ({ activeCampaignId: s.activeCampaignId, viewMode: s.viewMode, dark: s.dark }),
    }
  )
)
