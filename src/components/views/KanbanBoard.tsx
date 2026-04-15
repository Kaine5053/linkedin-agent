'use client'
import React, { useMemo, useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, MoreHorizontal, MessageSquare, Zap } from 'lucide-react'
import { cn, STAGES, KANBAN_STAGES, formatRelativeTime, type LeadStage } from '@/lib/utils'
import { Avatar, StageBadge, Spinner } from '@/components/shared/primitives'
import { useDashStore } from '@/store/dashboard'
import { useApiCall } from '@/hooks'

interface Lead {
  id: string
  full_name: string
  first_name: string
  linkedin_url: string
  company: string | null
  job_title: string | null
  stage: LeadStage
  comment_count: number
  last_activity_at: string | null
  imported_at: string
  enrichment_data: Record<string, unknown>
}

interface KanbanBoardProps {
  leads: Lead[]
  loading: boolean
  onLeadUpdated: (lead: Lead) => void
}

export function KanbanBoard({ leads, loading, onLeadUpdated }: KanbanBoardProps) {
  const { filters, openPanel, selectedIds, toggleSelect } = useDashStore()
  const call = useApiCall()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // Filter leads
  const filtered = useMemo(() => {
    let list = leads
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.job_title?.toLowerCase().includes(q)
      )
    }
    if (filters.stages.length > 0) {
      list = list.filter(l => filters.stages.includes(l.stage))
    }
    return list
  }, [leads, filters])

  const byStage = useMemo(() => {
    const map = {} as Record<LeadStage, Lead[]>
    KANBAN_STAGES.forEach(s => { map[s] = [] })
    filtered.forEach(l => { if (map[l.stage]) map[l.stage].push(l) })
    return map
  }, [filtered])

  const activeCard = activeId ? leads.find(l => l.id === activeId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    // over.id is either a lead id or a stage id (column drop zone)
    const targetStage = KANBAN_STAGES.includes(String(over.id) as LeadStage)
      ? (String(over.id) as LeadStage)
      : leads.find(l => l.id === over.id)?.stage

    if (!targetStage) return
    const lead = leads.find(l => l.id === active.id)
    if (!lead || lead.stage === targetStage) return

    setMovingId(lead.id)

    // Optimistic update
    onLeadUpdated({ ...lead, stage: targetStage })

    try {
      const token = document.cookie.match(/sb-.*-auth-token/)?.[0]
      await call(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: targetStage }),
      })
    } catch {
      // Revert on error
      onLeadUpdated(lead)
    } finally {
      setMovingId(null)
    }
  }

  if (loading) return <KanbanSkeleton />

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 h-full overflow-x-auto px-5 pb-6 pt-2 items-start">
        {KANBAN_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={byStage[stage]}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onOpenPanel={openPanel}
            movingId={movingId}
          />
        ))}
      </div>

      {/* Drag overlay — what the user sees while dragging */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(.2,.6,.4,1)' }}>
        {activeCard && (
          <div className="rotate-1 opacity-95 scale-102 shadow-modal">
            <KanbanCard lead={activeCard} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ── Column ────────────────────────────────────────────────

function KanbanColumn({
  stage, leads, selectedIds, onToggleSelect, onOpenPanel, movingId,
}: {
  stage: LeadStage
  leads: Lead[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onOpenPanel: (id: string) => void
  movingId: string | null
}) {
  const cfg = STAGES[stage]
  const ids = leads.map(l => l.id)

  return (
    <div
      className="flex flex-col flex-shrink-0 rounded-xl bg-gray-50 dark:bg-gray-800/50"
      style={{ width: 240, minHeight: 100 }}
      id={stage}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex-1 truncate">
          {cfg.label}
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {leads.length}
        </span>
      </div>

      {/* Drop zone + sortable list */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          className="flex flex-col gap-2 px-2 pb-3 min-h-[80px]"
          id={stage}
        >
          {leads.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400">{cfg.description}</p>
            </div>
          ) : (
            leads.map((lead, i) => (
              <SortableCard
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onToggleSelect={onToggleSelect}
                onOpen={onOpenPanel}
                moving={movingId === lead.id}
                delay={i * 25}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Sortable wrapper ──────────────────────────────────────

function SortableCard({ lead, selected, onToggleSelect, onOpen, moving, delay }: {
  lead: Lead
  selected: boolean
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
  moving: boolean
  delay: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    animationDelay: `${delay}ms`,
  }

  return (
    <div ref={setNodeRef} style={style} className="animate-fade-in opacity-0 [animation-fill-mode:forwards]">
      <KanbanCard
        lead={lead}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onOpen={onOpen}
        dragProps={{ ...attributes, ...listeners }}
        moving={moving}
      />
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────

function KanbanCard({ lead, selected, onToggleSelect, onOpen, dragProps, moving, isDragging }: {
  lead: Lead
  selected?: boolean
  onToggleSelect?: (id: string) => void
  onOpen?: (id: string) => void
  dragProps?: Record<string, unknown>
  moving?: boolean
  isDragging?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const cfg = STAGES[lead.stage]
  const enrichment = lead.enrichment_data as Record<string, unknown>

  return (
    <div
      className={cn(
        'group relative card bg-white dark:bg-surface-dark-card rounded-lg cursor-pointer',
        'border-l-[3px] transition-all duration-150',
        selected && 'ring-2 ring-brand-500/40 ring-offset-1',
        moving && 'opacity-60',
        isDragging && 'shadow-modal',
      )}
      style={{
        borderLeftColor: cfg.border,
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,.10)' : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen?.(lead.id)}
    >
      {/* Checkbox — shows on hover or when selected */}
      <div
        className={cn(
          'absolute top-2.5 left-2 transition-opacity duration-100 z-10',
          selected || hovered ? 'opacity-100' : 'opacity-0',
        )}
        onClick={e => { e.stopPropagation(); onToggleSelect?.(lead.id) }}
      >
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={() => onToggleSelect?.(lead.id)}
          className="w-3 h-3 rounded border-gray-300 accent-brand-500 cursor-pointer"
        />
      </div>

      {/* Drag handle */}
      <div
        {...(dragProps as any)}
        className="drag-handle absolute top-2.5 right-2 cursor-grab active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </div>

      <div className="p-3 pl-3.5">
        {/* Avatar + name */}
        <div className="flex items-start gap-2 mb-2">
          <Avatar name={lead.full_name} size={28} className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
              {lead.full_name}
            </p>
            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
              {lead.company ?? '—'}
            </p>
          </div>
        </div>

        {/* Job title */}
        {lead.job_title && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2 leading-tight">
            {lead.job_title}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-1">
          {/* Comment count for engaging stage */}
          {(lead.stage === 'engaging' || lead.stage === 'dm_ready') && (
            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
              <MessageSquare size={9} />
              {lead.comment_count}
            </span>
          )}

          {/* DM ready badge */}
          {lead.stage === 'dm_ready' && (
            <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
              <Zap size={9} />
              Draft ready
            </span>
          )}

          <span className="flex-1" />

          {/* Spinner if moving */}
          {moving && <Spinner size={12} />}

          {/* Time */}
          <span className="text-2xs text-gray-300 dark:text-gray-600 flex-shrink-0">
            {formatRelativeTime(lead.last_activity_at ?? lead.imported_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex gap-3 px-5 py-2 overflow-x-hidden">
      {KANBAN_STAGES.slice(0, 6).map(stage => (
        <div key={stage} className="flex-shrink-0 w-60">
          <div className="skeleton h-7 w-28 mb-3" />
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-24 mb-2 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}
