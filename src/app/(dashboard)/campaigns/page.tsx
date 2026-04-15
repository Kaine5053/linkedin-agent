'use client'
import { useState } from 'react'
import { Plus, MoreHorizontal, Folder, Users, MessageSquare, Settings, Pause, Play, Archive } from 'lucide-react'
import { useCampaigns, useApiCall } from '@/hooks'
import { useDashStore } from '@/store/dashboard'
import { Card, Avatar, Spinner, EmptyState, SectionHeader } from '@/components/shared/primitives'
import { cn, formatDate } from '@/lib/utils'

export default function CampaignsPage() {
  const { campaigns, loading } = useCampaigns()
  const { setActiveCampaignId } = useDashStore()
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const call = useApiCall()

  async function createCampaign() {
    if (!newName.trim()) return
    setSubmitting(true)
    try {
      await call('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      })
      setCreating(false)
      setNewName('')
      setNewDesc('')
      window.location.reload()
    } catch {}
    finally { setSubmitting(false) }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <Folder size={16} className="text-brand-500" />
        <h1 className="text-base font-bold text-gray-900 dark:text-white">Campaigns</h1>
        <div className="flex-1" />
        <button onClick={() => setCreating(true)} className="btn btn-primary gap-1.5">
          <Plus size={12} /> New campaign
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-3xl mx-auto space-y-3">

          {/* Create form */}
          {creating && (
            <Card className="p-5 border-brand-200 dark:border-brand-800 animate-fade-in">
              <p className="text-sm font-semibold mb-4">New campaign</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Campaign name *</label>
                  <input
                    className="input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="UK Groundworks Q3 Outreach"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea
                    className="input"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Target audience, goals, notes…"
                    style={{ minHeight: 64 }}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setCreating(false)} className="btn btn-secondary">Cancel</button>
                <button onClick={createCampaign} disabled={submitting || !newName.trim()} className="btn btn-primary gap-2">
                  {submitting && <Spinner size={13} />}
                  Create campaign
                </button>
              </div>
            </Card>
          )}

          {/* Campaign list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon="📁"
              title="No campaigns yet"
              body="Create your first campaign to start importing leads and running outreach."
              action={<button onClick={() => setCreating(true)} className="btn btn-primary">Create campaign</button>}
            />
          ) : (
            campaigns.map((c: any) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onSelect={() => { setActiveCampaignId(c.id); window.location.href = '/board' }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CampaignCard({ campaign, onSelect }: { campaign: any; onSelect: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const leadCount = campaign.leads?.[0]?.count ?? 0

  return (
    <Card className={cn('p-5 cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 transition-colors', campaign.status === 'paused' && 'opacity-70')}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
          <Folder size={16} className="text-brand-500" />
        </div>
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900 dark:text-white text-md">{campaign.name}</p>
            <span className={cn(
              'text-2xs font-semibold px-2 py-0.5 rounded-full',
              campaign.status === 'active' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
              campaign.status === 'paused' ? 'bg-yellow-50 text-yellow-600' :
              'bg-gray-100 text-gray-500',
            )}>
              {campaign.status}
            </span>
          </div>
          {campaign.description && (
            <p className="text-sm text-gray-400 mb-3 leading-relaxed">{campaign.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Users size={11} className="text-brand-400" />
              {leadCount} lead{leadCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={11} className="text-green-400" />
              {campaign.dm_trigger_comments} comments → DM
            </span>
            <span>Created {formatDate(campaign.created_at)}</span>
          </div>
        </div>

        {/* Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            className="btn btn-ghost btn-icon"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-panel py-1 w-40 animate-scale-in">
                <button onClick={() => { onSelect(); setMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                  <Settings size={12} /> Open board
                </button>
                <button className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {campaign.status === 'active' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Activate</>}
                </button>
                <button className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                  <Archive size={12} /> Archive
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
