'use client'
import React from 'react'
import { cn, avatarColour, getInitials, STAGES, stagePillStyle, type LeadStage } from '@/lib/utils'

// ── Avatar ────────────────────────────────────────────────

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  className?: string
}

export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  const { bg, fg } = avatarColour(name)
  return (
    <div
      className={cn('rounded-full flex-shrink-0 flex items-center justify-center font-semibold overflow-hidden select-none', className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.375 }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}

// ── Stage Badge ───────────────────────────────────────────

export function StageBadge({ stage }: { stage: LeadStage }) {
  const cfg = STAGES[stage]
  return (
    <span className="stage-pill" style={stagePillStyle(stage)}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn('animate-spin-fast', className)}
      width={size} height={size}
      viewBox="0 0 16 16" fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="#e5e7eb" strokeWidth="2.5"/>
      <path d="M8 2a6 6 0 016 6" stroke="#0073ea" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

// ── Empty State ───────────────────────────────────────────

export function EmptyState({ icon, title, body, action }: {
  icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3">
      {icon && <div className="text-4xl mb-1 opacity-50">{icon}</div>}
      <p className="font-semibold text-md text-gray-700 dark:text-gray-200">{title}</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">{body}</p>
      {action}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-gray-100 dark:bg-gray-700', className)} />
}

// ── Tag ───────────────────────────────────────────────────

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', className)}>
      {children}
    </span>
  )
}

// ── Section Header ────────────────────────────────────────

export function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-2xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2', className)}>
      {children}
    </p>
  )
}

// ── Stat Card (for dashboard widgets) ────────────────────

export function StatCard({ label, value, delta, color = '#0073ea' }: {
  label: string; value: string | number; delta?: string; color?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {delta && (
        <p className={cn('text-xs mt-1 font-medium', delta.startsWith('+') ? 'text-green-600' : 'text-red-500')}>
          {delta}
        </p>
      )}
    </Card>
  )
}

// ── Progress Bar ─────────────────────────────────────────

export function ProgressBar({ value, max, color = '#0073ea', className }: {
  value: number; max: number; color?: string; className?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={cn('relative h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden', className)}>
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Checkbox ─────────────────────────────────────────────

export function Checkbox({ checked, onChange, indeterminate }: {
  checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={el => { if (el) el.indeterminate = indeterminate ?? false }}
      onChange={e => onChange(e.target.checked)}
      className="w-3.5 h-3.5 rounded border-gray-300 accent-brand-500 cursor-pointer"
      onClick={e => e.stopPropagation()}
    />
  )
}
