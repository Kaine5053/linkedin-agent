'use client'
import React, { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { cn, formatRelativeTime, STAGES, type LeadStage } from '@/lib/utils'
import { Avatar, StageBadge, Checkbox, Spinner } from '@/components/shared/primitives'
import { useDashStore } from '@/store/dashboard'

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

const col = createColumnHelper<Lead>()

interface TableViewProps {
  leads: Lead[]
  loading: boolean
}

export function TableView({ leads, loading }: TableViewProps) {
  const { filters, selectedIds, toggleSelect, selectAll, clearSelection, openPanel } = useDashStore()
  const [sorting, setSorting] = useState<SortingState>([])

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

  const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))
  const someSelected = filtered.some(l => selectedIds.has(l.id)) && !allSelected

  const columns = useMemo(() => [
    col.display({
      id: 'select',
      size: 40,
      header: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={v => v ? selectAll(filtered.map(l => l.id)) : clearSelection()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
        />
      ),
    }),
    col.accessor('full_name', {
      header: 'Name',
      size: 220,
      cell: ({ row }) => {
        const lead = row.original
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={lead.full_name} size={28} />
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate leading-tight">
                {lead.full_name}
              </p>
              <p className="text-2xs text-gray-400 truncate">{lead.first_name}</p>
            </div>
          </div>
        )
      },
    }),
    col.accessor('job_title', {
      header: 'Title',
      size: 200,
      cell: info => (
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate block">{info.getValue() ?? '—'}</span>
      ),
    }),
    col.accessor('company', {
      header: 'Company',
      size: 180,
      cell: info => (
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate block">{info.getValue() ?? '—'}</span>
      ),
    }),
    col.accessor('stage', {
      header: 'Stage',
      size: 140,
      cell: info => <StageBadge stage={info.getValue()} />,
    }),
    col.display({
      id: 'location',
      header: 'Location',
      size: 140,
      cell: ({ row }) => {
        const e = row.original.enrichment_data as Record<string, unknown>
        const loc = [e.city, e.region].filter(Boolean).join(', ')
        return <span className="text-sm text-gray-400 truncate block">{loc || '—'}</span>
      },
    }),
    col.accessor('comment_count', {
      header: 'Comments',
      size: 90,
      cell: info => (
        <span className={cn(
          'inline-flex items-center gap-1 text-xs font-medium',
          info.getValue() > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300',
        )}>
          {info.getValue() > 0 && '💬'} {info.getValue()}
        </span>
      ),
    }),
    col.display({
      id: 'email',
      header: 'Email',
      size: 70,
      cell: ({ row }) => {
        const e = row.original.enrichment_data as Record<string, unknown>
        return e.email ? (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Valid</span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )
      },
    }),
    col.accessor('last_activity_at', {
      header: 'Last Active',
      size: 110,
      cell: info => (
        <span className="text-xs text-gray-400">{formatRelativeTime(info.getValue())}</span>
      ),
    }),
    col.display({
      id: 'actions',
      size: 50,
      header: '',
      cell: ({ row }) => (
        <a
          href={row.original.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover/row:opacity-70 hover:!opacity-100 text-gray-400 hover:text-brand-500 transition-all"
        >
          <ExternalLink size={13} />
        </a>
      ),
    }),
  ], [allSelected, someSelected, selectedIds, filtered, selectAll, clearSelection, toggleSelect])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  if (loading) return <TableSkeleton />

  return (
    <div className="flex flex-col h-full">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800 animate-slide-up">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} selected
          </span>
          <button className="btn-ghost btn-sm text-brand-600 dark:text-brand-400">
            Move stage
          </button>
          <button className="btn-ghost btn-sm text-brand-600 dark:text-brand-400">
            Generate AI notes
          </button>
          <button className="btn-ghost btn-sm text-red-500">
            Archive
          </button>
          <button onClick={clearSelection} className="btn-ghost btn-sm ml-auto text-gray-500">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-surface-dark-card border-b border-gray-100 dark:border-gray-700">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="text-left px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn('flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 transition-colors')}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-300">
                            {header.column.getIsSorted() === 'asc'  ? <ChevronUp size={11} /> :
                             header.column.getIsSorted() === 'desc' ? <ChevronDown size={11} /> :
                             <ChevronsUpDown size={11} className="opacity-40" />}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={cn(
                  'group/row border-b border-gray-50 dark:border-gray-700/50 cursor-pointer transition-colors duration-75',
                  selectedIds.has(row.original.id)
                    ? 'bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100/60'
                    : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/50',
                )}
                onClick={() => openPanel(row.original.id)}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-1">🔍</p>
            <p className="text-sm font-medium text-gray-500">No leads match your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark-card text-xs text-gray-400">
        <span>
          {filtered.length.toLocaleString()} lead{filtered.length !== 1 ? 's' : ''}
          {leads.length !== filtered.length && ` (${leads.length.toLocaleString()} total)`}
        </span>
        <div className="flex items-center gap-2">
          <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-ghost btn-icon btn-sm disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-ghost btn-icon btn-sm disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="px-5 py-3 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-10 rounded" style={{ animationDelay: `${i * 50}ms` }} />
      ))}
    </div>
  )
}
