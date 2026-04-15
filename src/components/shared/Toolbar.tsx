'use client'
import { useState } from 'react'
import { LayoutGrid, Table2, BarChart2, Search, Filter, X, Sun, Moon, ChevronDown } from 'lucide-react'
import { cn, STAGES, type LeadStage } from '@/lib/utils'
import { useDashStore, type ViewMode } from '@/store/dashboard'

export function Toolbar({ totalLeads, filteredCount }: { totalLeads: number; filteredCount: number }) {
  const { viewMode, setViewMode, filters, setSearch, setStageFilter, resetFilters, dark, toggleDark } = useDashStore()
  const [filterOpen, setFilterOpen] = useState(false)

  const hasFilters = filters.stages.length > 0 || !!filters.search

  const VIEWS: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'kanban',    icon: <LayoutGrid size={14} />,  label: 'Board' },
    { mode: 'table',     icon: <Table2 size={14} />,      label: 'Table' },
    { mode: 'dashboard', icon: <BarChart2 size={14} />,   label: 'Analytics' },
  ]

  return (
    <div className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-surface-dark-card border-b border-gray-100 dark:border-gray-700 flex-shrink-0">

      {/* View switcher */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
        {VIEWS.map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
              viewMode === mode
                ? 'bg-white dark:bg-surface-dark-card text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        <input
          className="input text-xs pl-7 h-8"
          placeholder="Search leads…"
          value={filters.search}
          onChange={e => setSearch(e.target.value)}
        />
        {filters.search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Filter button */}
      <div className="relative">
        <button
          onClick={() => setFilterOpen(o => !o)}
          className={cn(
            'btn btn-secondary btn-sm gap-1.5',
            hasFilters && 'border-brand-400 text-brand-600 bg-brand-50 dark:bg-brand-900/20',
          )}
        >
          <Filter size={12} />
          Filters
          {filters.stages.length > 0 && (
            <span className="bg-brand-500 text-white text-2xs px-1.5 py-0.5 rounded-full">
              {filters.stages.length}
            </span>
          )}
          <ChevronDown size={10} className={cn('transition-transform duration-150', filterOpen && 'rotate-180')} />
        </button>

        {filterOpen && (
          <StageFilterDropdown
            selected={filters.stages}
            onChange={setStageFilter}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <button onClick={resetFilters} className="btn btn-ghost btn-sm gap-1 text-brand-500">
          <X size={11} /> Clear
        </button>
      )}

      <div className="flex-1" />

      {/* Lead count */}
      <span className="text-xs text-gray-400 tabular-nums hidden md:block">
        {filteredCount !== totalLeads ? (
          <><span className="font-semibold text-gray-600 dark:text-gray-300">{filteredCount}</span> / {totalLeads}</>
        ) : (
          <><span className="font-semibold text-gray-600 dark:text-gray-300">{totalLeads}</span> leads</>
        )}
      </span>

      {/* Dark mode */}
      <button onClick={toggleDark} className="btn btn-ghost btn-icon text-gray-400 hover:text-gray-600">
        {dark ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </div>
  )
}

function StageFilterDropdown({
  selected, onChange, onClose,
}: {
  selected: LeadStage[]
  onChange: (stages: LeadStage[]) => void
  onClose: () => void
}) {
  function toggle(stage: LeadStage) {
    const next = selected.includes(stage)
      ? selected.filter(s => s !== stage)
      : [...selected, stage]
    onChange(next)
  }

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className={cn(
        'absolute top-full right-0 mt-1 z-30',
        'bg-white dark:bg-surface-dark-card border border-gray-200 dark:border-gray-700',
        'rounded-xl shadow-panel p-2 w-52 animate-scale-in',
      )}>
        <p className="text-2xs font-semibold text-gray-400 uppercase tracking-widest px-2 py-1.5">
          Filter by stage
        </p>
        {(Object.keys(STAGES) as LeadStage[]).map(stage => {
          const cfg = STAGES[stage]
          const active = selected.includes(stage)
          return (
            <button
              key={stage}
              onClick={() => toggle(stage)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors duration-100',
                active ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
              <span className={cn('flex-1 text-left text-xs', active ? 'font-medium text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300')}>
                {cfg.label}
              </span>
              {active && <span className="text-brand-500 text-xs">✓</span>}
            </button>
          )
        })}
        {selected.length > 0 && (
          <>
            <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2 my-1.5" />
            <button
              onClick={() => onChange([])}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1"
            >
              Clear filter
            </button>
          </>
        )}
      </div>
    </>
  )
}
