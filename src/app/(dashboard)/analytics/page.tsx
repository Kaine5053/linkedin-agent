'use client'
import { useEffect } from 'react'
import { BarChart2, ChevronDown } from 'lucide-react'
import { useLeads, useCampaigns } from '@/hooks'
import { useDashStore } from '@/store/dashboard'
import { DashboardView } from '@/components/views/DashboardView'

export default function AnalyticsPage() {
  const { activeCampaignId, setActiveCampaignId } = useDashStore()
  const { campaigns } = useCampaigns()
  const { leads, loading } = useLeads(activeCampaignId)

  useEffect(() => {
    if (campaigns.length > 0 && !activeCampaignId) {
      setActiveCampaignId(campaigns[0].id)
    }
  }, [campaigns, activeCampaignId, setActiveCampaignId])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <BarChart2 size={15} className="text-brand-500" />
        <h1 className="text-base font-bold text-gray-900 dark:text-white">Analytics</h1>
        <div className="flex-1" />
        {campaigns.length > 0 && (
          <div className="relative">
            <select
              value={activeCampaignId ?? ''}
              onChange={e => setActiveCampaignId(e.target.value)}
              className="appearance-none border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 pr-7 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
            >
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
      </header>

      <DashboardView leads={leads} loading={loading} />
    </div>
  )
}
