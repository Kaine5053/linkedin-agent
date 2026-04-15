'use client'
import { useState, useEffect } from 'react'
import { Save, Sparkles, Zap, TrendingUp, MessageSquare, Shield, ChevronRight, Plus, X } from 'lucide-react'
import { useAiSettings } from '@/hooks'
import { Spinner, Card, SectionHeader, Divider } from '@/components/shared/primitives'
import { cn } from '@/lib/utils'

const TONE_OPTIONS = [
  { value: 'conversational', label: 'Conversational', emoji: '💬',
    desc: 'Natural peer-to-peer voice — sounds human and genuine, not corporate' },
  { value: 'professional',   label: 'Professional',   emoji: '🎯',
    desc: 'Polished and authoritative — ideal for director and C-suite contacts' },
  { value: 'direct',         label: 'Direct',         emoji: '⚡',
    desc: 'Concise and no-fluff — respects their time, gets to the point fast' },
  { value: 'warm',           label: 'Warm',           emoji: '🤝',
    desc: 'Relationship-first — builds rapport before any business discussion' },
]

const DEPTH_OPTIONS = [
  { value: 1, label: 'Basic',    desc: 'Name, title, company' },
  { value: 2, label: 'Standard', desc: 'Adds skills + location' },
  { value: 3, label: 'Deep',     desc: 'Full profile data' },
]

export default function AiSettingsPage() {
  const { settings, usage, loading, saving, save } = useAiSettings()
  const [form, setForm]           = useState<any>(null)
  const [newPhrase, setNewPhrase] = useState('')
  const [saved, setSaved]         = useState(false)

  useEffect(() => { if (settings) setForm({ ...settings }) }, [settings])

  if (loading || !form) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={28} />
      </div>
    )
  }

  function update(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    await save(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function addPhrase() {
    const p = newPhrase.trim().toLowerCase()
    if (!p || form.banned_phrases?.includes(p)) return
    update('banned_phrases', [...(form.banned_phrases ?? []), p])
    setNewPhrase('')
  }

  const costGbp = ((usage?.estimated_cost_usd ?? 0) * 0.79).toFixed(2)

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <Sparkles size={16} className="text-brand-500" />
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-white">AI Settings</h1>
          <p className="text-xs text-gray-400">Configure how Claude generates your outreach</p>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn('btn btn-primary gap-2', saved && 'bg-green-500 hover:bg-green-600')}
        >
          {saving ? <><Spinner size={13} /> Saving…</> :
           saved   ? <><Check size={13} /> Saved</> :
           <><Save size={13} /> Save settings</>}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">

          {/* Usage card */}
          {usage && (
            <Card className="p-4 bg-gradient-to-r from-brand-50 to-purple-50 dark:from-brand-900/20 dark:to-purple-900/20 border-brand-100 dark:border-brand-800">
              <div className="flex items-start justify-between">
                <div>
                  <SectionHeader>AI usage — last 30 days</SectionHeader>
                  <div className="flex gap-6 mt-1">
                    {[
                      { label: 'Generations', value: usage.total_generations ?? 0 },
                      { label: 'Input tokens',  value: (usage.total_input_tokens ?? 0).toLocaleString() },
                      { label: 'Output tokens', value: (usage.total_output_tokens ?? 0).toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                        <p className="text-xs text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-brand-600 dark:text-brand-400">£{costGbp}</p>
                  <p className="text-xs text-gray-400 mt-0.5">estimated cost</p>
                  <p className="text-2xs text-gray-300 mt-0.5">Claude Sonnet pricing</p>
                </div>
              </div>
            </Card>
          )}

          {/* Sender identity */}
          <SettingsSection title="Your Identity" description="Claude writes on your behalf — this is injected into every prompt." icon={<Zap size={14} className="text-brand-500" />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your name</label>
                <input className="input" value={form.sender_name ?? ''} onChange={e => update('sender_name', e.target.value)} placeholder="James Hartley" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your company</label>
                <input className="input" value={form.sender_company ?? ''} onChange={e => update('sender_company', e.target.value)} placeholder="Hartley Civil Supplies" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your role</label>
                <input className="input" value={form.sender_role ?? ''} onChange={e => update('sender_role', e.target.value)} placeholder="Business Development Director" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target industry</label>
                <input className="input" value={form.target_industry ?? ''} onChange={e => update('target_industry', e.target.value)} placeholder="civil engineering and groundworks" />
              </div>
            </div>
          </SettingsSection>

          {/* Tone */}
          <SettingsSection title="Writing Tone" description="Controls the voice of all generated content." icon={<MessageSquare size={14} className="text-brand-500" />}>
            <div className="grid grid-cols-2 gap-2.5">
              {TONE_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => update('tone', t.value)}
                  className={cn(
                    'text-left p-3.5 rounded-xl border-2 transition-all duration-150',
                    form.tone === t.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{t.emoji}</span>
                    <span className={cn('text-sm font-semibold', form.tone === t.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200')}>
                      {t.label}
                    </span>
                    {form.tone === t.value && <span className="ml-auto text-brand-500 text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{t.desc}</p>
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Personalisation depth */}
          <SettingsSection title="Personalisation Depth" description="How much profile data Claude incorporates." icon={<TrendingUp size={14} className="text-brand-500" />}>
            <div className="flex gap-3">
              {DEPTH_OPTIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => update('personalisation_depth', d.value)}
                  className={cn(
                    'flex-1 py-3 px-2 rounded-xl border-2 text-center transition-all duration-150',
                    form.personalisation_depth === d.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-900',
                  )}
                >
                  <p className={cn('text-xl font-black mb-1', form.personalisation_depth === d.value ? 'text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-200')}>
                    {d.value}
                  </p>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{d.label}</p>
                  <p className="text-2xs text-gray-400 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Temperature */}
          <SettingsSection title="Creativity" description="Higher = more varied output. Lower = more consistent. 0.70 recommended.">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 w-16 flex-shrink-0">Consistent</span>
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={form.temperature}
                onChange={e => update('temperature', parseFloat(e.target.value))}
                className="flex-1 accent-brand-500"
              />
              <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">Creative</span>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400 font-mono w-10 text-right flex-shrink-0">
                {parseFloat(form.temperature).toFixed(2)}
              </span>
            </div>
          </SettingsSection>

          {/* Custom instructions */}
          <SettingsSection title="Custom Instructions" description="Additional guidelines Claude follows in every generation. Max 500 chars.">
            <textarea
              className="input"
              value={form.custom_instructions ?? ''}
              onChange={e => update('custom_instructions', e.target.value.slice(0, 500))}
              placeholder="e.g. Always reference UK market context. Never mention competitor firms. Keep connection notes under 250 chars to maximise acceptance rates."
              style={{ minHeight: 84 }}
            />
            <p className="text-2xs text-gray-300 text-right mt-1">{(form.custom_instructions ?? '').length}/500</p>
          </SettingsSection>

          {/* Banned phrases */}
          <SettingsSection title="Banned Phrases" description="Claude will never use these in any generated content." icon={<Shield size={14} className="text-red-400" />}>
            <div className="flex gap-2 mb-3">
              <input
                className="input flex-1"
                value={newPhrase}
                onChange={e => setNewPhrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPhrase()}
                placeholder="Type a phrase and press Enter…"
              />
              <button onClick={addPhrase} className="btn btn-secondary gap-1.5 flex-shrink-0">
                <Plus size={12} /> Add
              </button>
            </div>
            {(form.banned_phrases ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {form.banned_phrases.map((p: string) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => update('banned_phrases', form.banned_phrases.filter((x: string) => x !== p))}
                  >
                    {p} <X size={9} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No banned phrases — Claude will follow its default safety rules</p>
            )}
          </SettingsSection>

          {/* Toggles */}
          <SettingsSection title="Generation Permissions" description="Enable or disable generation for specific content types.">
            {[
              { key: 'allow_connection_notes', label: 'Connection notes',   desc: 'Personalised intro for connection requests' },
              { key: 'allow_comments',         label: 'Post comments',      desc: 'Vibe-matched comments on posts' },
              { key: 'allow_dms',              label: 'DM drafts',          desc: 'Full DMs (always requires your approval)' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <button
                  onClick={() => update(key, !form[key])}
                  className={cn(
                    'relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200',
                    form[key] ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700',
                  )}
                  style={{ height: 22 }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200"
                    style={{ transform: form[key] ? 'translateX(18px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            ))}
          </SettingsSection>

          {/* Save button */}
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-lg w-full justify-center gap-2">
            {saving ? <><Spinner size={15} /> Saving…</> :
             saved   ? '✓ Settings saved' :
             <><Save size={15} /> Save all settings</>}
          </button>

        </div>
      </div>
    </div>
  )
}

// ── Check icon ─────────────────────────────────────────────

function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,7 6,11 12,3" />
    </svg>
  )
}

// ── Settings section wrapper ───────────────────────────────

function SettingsSection({ title, description, icon, children }: {
  title: string; description?: string; icon?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
        </div>
        {description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  )
}
