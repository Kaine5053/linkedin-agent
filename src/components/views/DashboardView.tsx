'use client'
import React, { useMemo } from 'react'
import {
  BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { TrendingUp, Users, MessageSquare, Mail, CheckCircle, Clock } from 'lucide-react'
import { cn, STAGES, type LeadStage } from '@/lib/utils'
import { Card, StatCard, StageBadge, Avatar } from '@/components/shared/primitives'
import { formatRelativeTime } from '@/lib/utils'

interface Lead {
  id: string
  full_name: string
  company: string | null
  stage: LeadStage
  comment_count: number
  last_activity_at: string | null
  imported_at: string
  enrichment_data: Record<string, unknown>
  connected_at?: string | null
  dm_sent_at?: string | null
}

interface DashboardViewProps {
  leads: Lead[]
  loading: boolean
}

const STAGE_COLORS: Partial<Record<LeadStage, string>> = {
  imported:        '#7c3aed',
  connection_sent: '#f59e0b',
  connected:       '#10b981',
  engaging:        '#3b82f6',
  dm_ready:        '#8b5cf6',
  dm_sent:         '#ec4899',
  replied:         '#06b6d4',
  won:             '#22c55e',
}

export function DashboardView({ leads, loading }: DashboardViewProps) {
  const stats = useMemo(() => {
    const total       = leads.length
    const connected   = leads.filter(l => ['connected', 'engaging', 'dm_ready', 'dm_sent', 'replied', 'won'].includes(l.stage)).length
    const dmReady     = leads.filter(l => l.stage === 'dm_ready').length
    const won         = leads.filter(l => l.stage === 'won').length
    const replied     = leads.filter(l => l.stage === 'replied').length
    const withEmail   = leads.filter(l => (l.enrichment_data as any)?.email).length
    const connRate    = total > 0 ? Math.round((connected / total) * 100) : 0
    const dmSentCount = leads.filter(l => ['dm_sent', 'replied', 'won'].includes(l.stage)).length
    const replyRate   = dmSentCount > 0 ? Math.round((replied / dmSentCount) * 100) : 0

    return { total, connected, dmReady, won, replied, withEmail, connRate, replyRate }
  }, [leads])

  const funnelData = useMemo(() => {
    return [
      { name: 'Imported', value: leads.length, fill: '#7c3aed' },
      { name: 'Connected', value: leads.filter(l => ['connected','engaging','dm_ready','dm_sent','replied','won'].includes(l.stage)).length, fill: '#10b981' },
      { name: 'Engaging', value: leads.filter(l => ['engaging','dm_ready','dm_sent','replied','won'].includes(l.stage)).length, fill: '#3b82f6' },
      { name: 'DM Sent', value: leads.filter(l => ['dm_sent','replied','won'].includes(l.stage)).length, fill: '#ec4899' },
      { name: 'Replied', value: leads.filter(l => ['replied','won'].includes(l.stage)).length, fill: '#06b6d4' },
      { name: 'Won', value: leads.filter(l => l.stage === 'won').length, fill: '#22c55e' },
    ].filter(d => d.value > 0)
  }, [leads])

  const stageDistribution = useMemo(() => {
    const counts = {} as Record<LeadStage, number>
    leads.forEach(l => { counts[l.stage] = (counts[l.stage] ?? 0) + 1 })
    return Object.entries(counts)
      .map(([stage, count]) => ({
        stage: stage as LeadStage,
        count,
        label: STAGES[stage as LeadStage]?.label ?? stage,
        color: STAGE_COLORS[stage as LeadStage] ?? '#9ca3af',
        pct: Math.round((count / leads.length) * 100),
      }))
      .sort((a, b) => STAGES[a.stage]?.order - STAGES[b.stage]?.order)
  }, [leads])

  // Region breakdown
  const topRegions = useMemo(() => {
    const counts = {} as Record<string, number>
    leads.forEach(l => {
      const region = String((l.enrichment_data as any)?.region || 'Unknown')
      counts[region] = (counts[region] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([region, count]) => ({ region, count, pct: Math.round((count / leads.length) * 100) }))
  }, [leads])

  // Recent activity (most recently updated leads)
  const recentActivity = useMemo(() =>
    [...leads]
      .filter(l => l.last_activity_at)
      .sort((a, b) => new Date(b.last_activity_at!).getTime() - new Date(a.last_activity_at!).getTime())
      .slice(0, 8)
  , [leads])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Leads"      value={stats.total}      color="#6366f1" />
          <StatCard label="Connected"        value={stats.connected}  color="#10b981" delta={`${stats.connRate}% rate`} />
          <StatCard label="DM Ready"         value={stats.dmReady}    color="#8b5cf6" />
          <StatCard label="Replied"          value={stats.replied}    color="#06b6d4" delta={stats.replyRate > 0 ? `${stats.replyRate}% reply rate` : undefined} />
          <StatCard label="Won"              value={stats.won}        color="#22c55e" />
          <StatCard label="With Email"       value={stats.withEmail}  color="#f59e0b" delta={`${Math.round((stats.withEmail / Math.max(stats.total, 1)) * 100)}% coverage`} />
        </div>

        {/* Funnel + Stage breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Funnel chart */}
          <Card className="p-4 lg:col-span-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-brand-500" />
              Outreach Funnel
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 60, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}
                  formatter={(v: number, _: string, entry: any) => {
                    const pct = funnelData[0]?.value > 0 ? Math.round((v / funnelData[0].value) * 100) : 0
                    return [`${v} leads (${pct}%)`, '']
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Stage breakdown */}
          <Card className="p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Users size={14} className="text-brand-500" />
              Stage Breakdown
            </p>
            <div className="space-y-2.5">
              {stageDistribution.map(({ stage, count, label, color, pct }) => (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {count} <span className="font-normal text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Region breakdown + Activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Top regions */}
          <Card className="p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Top Regions
            </p>
            <div className="space-y-3">
              {topRegions.map(({ region, count, pct }) => (
                <div key={region} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex-1 truncate capitalize">{region}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent activity */}
          <Card className="p-4 lg:col-span-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Clock size={14} className="text-brand-500" />
              Recent Activity
            </p>
            <div className="space-y-3">
              {recentActivity.map(lead => (
                <div key={lead.id} className="flex items-center gap-3">
                  <Avatar name={lead.full_name} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{lead.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{lead.company}</p>
                  </div>
                  <StageBadge stage={lead.stage} />
                  <span className="text-2xs text-gray-300 flex-shrink-0 w-14 text-right">
                    {formatRelativeTime(lead.last_activity_at)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Pie chart: seniority distribution */}
        <SeniorityChart leads={leads} />

      </div>
    </div>
  )
}

function SeniorityChart({ leads }: { leads: Lead[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    leads.forEach(l => {
      const s = String((l.enrichment_data as any)?.seniority_level || 'unknown')
      counts[s] = (counts[s] ?? 0) + 1
    })
    const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#9ca3af']
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: COLORS[i % COLORS.length],
      }))
  }, [leads])

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Seniority Breakdown
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%"
            innerRadius={55} outerRadius={85}
            paddingAngle={2} dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}
            formatter={(v: number) => [`${v} leads`, '']}
          />
          <Legend
            iconType="circle" iconSize={8}
            formatter={v => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto">
      <div className="grid grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-5 gap-5">
        <div className="skeleton h-80 rounded-xl col-span-3" />
        <div className="skeleton h-80 rounded-xl col-span-2" />
      </div>
    </div>
  )
}
