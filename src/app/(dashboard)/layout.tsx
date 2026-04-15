'use client'
import { useEffect } from 'react'
import { AppSidebar } from '@/components/shared/AppSidebar'
import { WorkerStatusBar } from '@/components/shared/WorkerStatusBar'
import { useDashStore } from '@/store/dashboard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dark } = useDashStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <AppSidebar />
      <main
        className="flex flex-col flex-1 overflow-hidden"
        style={{ marginLeft: 'var(--sidebar-w)' }}
      >
        {/* Global worker pause/safe-mode banner — only visible when active */}
        <WorkerStatusBar />
        {children}
      </main>
    </div>
  )
}
