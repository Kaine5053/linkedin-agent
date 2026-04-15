'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, MessageSquare, Sparkles, FolderOpen,
  FileText, BarChart2, Settings, ChevronDown, Users,
  ClipboardList, Pause, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDmQueue } from '@/hooks'
import { useWorkerConfig } from '@/hooks/useWorkerConfig'
import { NotificationCenter } from '@/components/shared/NotificationCenter'

const NAV_ITEMS = [
  { href: '/board',     label: 'Board',       icon: LayoutGrid,    badge: 'dm' as const },
  { href: '/dm-queue',  label: 'DM Queue',    icon: MessageSquare, badge: 'dm' as const },
  { href: '/ai',        label: 'AI Settings', icon: Sparkles,      badge: null },
  { href: '/campaigns', label: 'Campaigns',   icon: FolderOpen,    badge: null },
  { href: '/templates', label: 'Templates',   icon: FileText,      badge: null },
  { href: '/analytics', label: 'Analytics',   icon: BarChart2,     badge: null },
  { href: '/audit',     label: 'Audit Log',   icon: ClipboardList, badge: null },
]

export function AppSidebar() {
  const path    = usePathname()
  const { drafts } = useDmQueue()
  const { config } = useWorkerConfig()
  const dmCount = drafts.length

  const workerPaused   = config?.paused ?? false
  const workerSafe     = config?.safe_mode ?? false

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col z-30"
      style={{ width: 'var(--sidebar-w)', background: '#1f2d3d' }}
    >
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10 cursor-pointer group">
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0 shadow-md">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7a4.5 4.5 0 019 0 4.5 4.5 0 01-9 0z" stroke="white" strokeWidth="1.5"/>
            <path d="M5 7h4M7 5v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-tight truncate">LinkedIn Agent</p>
          <p className="text-2xs text-gray-400 leading-tight truncate">UK Civil Engineering</p>
        </div>
        {/* Notification bell — top-right of header */}
        <NotificationCenter />
      </div>

      {/* Worker status pill */}
      <div className="px-4 py-2.5">
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          workerPaused ? 'bg-amber-500/15' : workerSafe ? 'bg-blue-500/15' : 'bg-white/5',
        )}>
          <Users size={11} className="text-gray-400" />
          <span className="text-xs text-gray-300 flex-1">331 leads</span>
          {workerPaused ? (
            <span className="flex items-center gap-1 text-2xs text-amber-400 font-medium">
              <Pause size={9} /> Paused
            </span>
          ) : workerSafe ? (
            <span className="flex items-center gap-1 text-2xs text-blue-400 font-medium">
              <Shield size={9} /> Safe
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-soft" />
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const active = path === href || path.startsWith(href + '/')
          const showBadge = badge === 'dm' && href === '/dm-queue' && dmCount > 0
          return (
            <Link key={href} href={href} className="no-underline">
              <div className={cn('sidebar-item group', active && 'active')}>
                <Icon
                  size={15}
                  className={cn(
                    'flex-shrink-0',
                    active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200',
                  )}
                />
                <span className="flex-1 text-sm">{label}</span>
                {showBadge && (
                  <span className="bg-brand-500 text-white text-2xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {dmCount}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/10">
        <Link href="/settings" className="no-underline">
          <div className={cn('sidebar-item', path === '/settings' && 'active')}>
            <Settings size={15} className="text-gray-400" />
            <span className="text-sm">Settings</span>
          </div>
        </Link>
      </div>
    </aside>
  )
}
