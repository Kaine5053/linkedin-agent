'use client'
import { useState, useEffect } from 'react'
import { Plus, FileText, Edit2, Trash2, Copy, Check, ChevronDown } from 'lucide-react'
import { useApiCall } from '@/hooks'
import { Card, EmptyState, Spinner, SectionHeader } from '@/components/shared/primitives'
import { cn, formatDate } from '@/lib/utils'

const MERGE_TAGS = [
  { tag: '{{first_name}}',        desc: 'First name' },
  { tag: '{{full_name}}',         desc: 'Full name' },
  { tag: '{{company}}',           desc: 'Company name' },
  { tag: '{{job_title}}',         desc: 'Job title' },
  { tag: '{{top_skills}}',        desc: 'Top 5 skills' },
  { tag: '{{recent_experience}}', desc: 'Recent roles' },
  { tag: '{{city}}',              desc: 'City' },
  { tag: '{{industry}}',          desc: 'Industry' },
]

type TemplateType = 'connection_note' | 'dm'

interface Template {
  id: string; name: string; type: TemplateType; content: string; created_at: string
}

export default function TemplatesPage() {
  const call = useApiCall()
  const [templates, setTemplates]  = useState<Template[]>([])
  const [loading, setLoading]      = useState(true)
  const [activeTab, setActiveTab]  = useState<TemplateType>('connection_note')
  const [creating, setCreating]    = useState(false)
  const [editing, setEditing]      = useState<Template | null>(null)
  const [copied, setCopied]        = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await call('/api/templates')
      setTemplates(data.templates ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function save(form: { name: string; type: TemplateType; content: string }, id?: string) {
    if (id) {
      await call(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(form) })
    } else {
      await call('/api/templates', { method: 'POST', body: JSON.stringify(form) })
    }
    setCreating(false); setEditing(null)
    await load()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    await call(`/api/templates/${id}`, { method: 'DELETE' })
    await load()
  }

  function copyTag(tag: string) {
    navigator.clipboard.writeText(tag)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1500)
  }

  const filtered = templates.filter(t => t.type === activeTab)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header
        className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <FileText size={15} className="text-brand-500" />
        <h1 className="text-base font-bold text-gray-900 dark:text-white">Templates</h1>
        <div className="flex-1" />
        <button onClick={() => setCreating(true)} className="btn btn-primary gap-1.5">
          <Plus size={12} /> New template
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto">

            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
              {([['connection_note', 'Connection Notes'], ['dm', 'DM Templates']] as const).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={cn(
                    'px-4 py-1.5 rounded text-xs font-medium transition-all duration-150',
                    activeTab === type
                      ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Create/Edit form */}
            {(creating || editing) && (
              <TemplateForm
                initial={editing ?? { name: '', type: activeTab, content: '' }}
                onSave={form => save(form as any, editing?.id)}
                onCancel={() => { setCreating(false); setEditing(null) }}
              />
            )}

            {/* Template list */}
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={activeTab === 'connection_note' ? '🔗' : '✉️'}
                title={`No ${activeTab === 'connection_note' ? 'connection note' : 'DM'} templates`}
                body="Create reusable templates with merge tags. Claude uses these as the starting point for AI personalisation."
                action={<button onClick={() => setCreating(true)} className="btn btn-primary">Create template</button>}
              />
            ) : (
              <div className="space-y-3">
                {filtered.map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onEdit={() => { setEditing(t); setCreating(false) }}
                    onDelete={() => deleteTemplate(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Merge tag sidebar */}
        <div className="w-52 flex-shrink-0 border-l border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900 overflow-y-auto">
          <SectionHeader>Merge tags</SectionHeader>
          <p className="text-2xs text-gray-400 mb-3 leading-relaxed">Click to copy. Tags are replaced with real lead data when generating.</p>
          <div className="space-y-1.5">
            {MERGE_TAGS.map(({ tag, desc }) => (
              <button
                key={tag}
                onClick={() => copyTag(tag)}
                className="w-full text-left group"
              >
                <div className={cn(
                  'flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors',
                  copied === tag ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                )}>
                  <div>
                    <p className="text-xs font-mono text-brand-600 dark:text-brand-400">{tag}</p>
                    <p className="text-2xs text-gray-400">{desc}</p>
                  </div>
                  {copied === tag ? <Check size={10} className="text-green-500 flex-shrink-0" /> : <Copy size={9} className="text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, onEdit, onDelete }: { template: Template; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{template.name}</p>
          <p className="text-xs text-gray-400">{template.content.length} chars · {formatDate(template.created_at)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="btn btn-ghost btn-icon btn-sm text-gray-400 hover:text-brand-500">
            <Edit2 size={12} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="btn btn-ghost btn-icon btn-sm text-gray-400 hover:text-red-500">
            <Trash2 size={12} />
          </button>
          <ChevronDown size={13} className={cn('text-gray-300 transition-transform ml-1', expanded && 'rotate-180')} />
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-800 pt-3 animate-fade-in">
          <pre className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">{template.content}</pre>
        </div>
      )}
    </Card>
  )
}

function TemplateForm({ initial, onSave, onCancel }: {
  initial: any; onSave: (f: any) => void; onCancel: () => void
}) {
  const [form, setForm]     = useState({ name: initial.name, type: initial.type, content: initial.content })
  const [saving, setSaving] = useState(false)
  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }
  async function submit() { setSaving(true); await onSave(form); setSaving(false) }

  return (
    <Card className="p-5 mb-5 border-brand-200 dark:border-brand-800 animate-fade-in">
      <p className="text-sm font-semibold mb-4">{initial.id ? 'Edit template' : 'New template'}</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Template name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select className="input" value={form.type} onChange={e => update('type', e.target.value)}>
              <option value="connection_note">Connection note</option>
              <option value="dm">DM</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Content *</label>
          <textarea className="input" value={form.content} onChange={e => update('content', e.target.value)} placeholder="Hi {{first_name}}, I noticed your work at {{company}}…" style={{ minHeight: 120 }} />
          {form.type === 'connection_note' && (
            <p className="text-2xs text-gray-400 mt-1">{form.content.length} / 300 chars (LinkedIn limit after merge tags resolve)</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving || !form.name || !form.content} className="btn btn-primary gap-2">
          {saving && <Spinner size={13} />}
          {initial.id ? 'Save changes' : 'Create template'}
        </button>
      </div>
    </Card>
  )
}
