'use client'
import { useState, useEffect } from 'react'
import { Settings, User, Shield, Bell, Save, Eye, EyeOff } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useApiCall } from '@/hooks'
import { WorkerControls } from '@/components/shared/WorkerStatusBar'
import { Card, Spinner, SectionHeader } from '@/components/shared/primitives'
import { toast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const sb       = createBrowserClient()
  const call     = useApiCall()
  const [user, setUser]           = useState<any>(null)
  const [timezone, setTimezone]   = useState('Europe/London')
  const [liSession, setLiSession] = useState('')
  const [showSession, setShowSession] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [prefs, setPrefs]         = useState<any>(null)
  const [prefSaving, setPrefSaving] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => { setUser(data.user) })
    call('/api/notifications/prefs').then(d => setPrefs(d.prefs)).catch(() => {})
  }, [sb, call])

  async function saveProfile() {
    setSaving(true)
    try {
      await call('/api/user/settings', { method: 'PATCH', body: JSON.stringify({ timezone, ...(liSession.trim() ? { li_session: liSession } : {}) }) })
      toast.success('Profile saved')
      setLiSession('')
    } catch (e: any) { toast.error('Save failed', e.message) }
    finally { setSaving(false) }
  }

  async function savePrefs() {
    if (!prefs) return
    setPrefSaving(true)
    try {
      const d = await call('/api/notifications/prefs', { method: 'PUT', body: JSON.stringify(prefs) })
      setPrefs(d.prefs)
      toast.success('Notification preferences saved')
    } catch (e: any) { toast.error('Save failed', e.message) }
    finally { setPrefSaving(false) }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center gap-3 px-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0" style={{ height: 'var(--topbar-h)' }}>
        <Settings size={15} className="text-brand-500" />
        <h1 className="text-base font-bold text-gray-900 dark:text-white">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-5 py-6 space-y-5">

          {/* Account */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800">
              <User size={14} className="text-brand-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1">Account</p>
              <button onClick={saveProfile} disabled={saving} className="btn btn-primary btn-sm gap-1.5">
                {saving ? <Spinner size={12} /> : <Save size={12} />} Save
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                <p className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 font-mono text-xs">{user?.email ?? '…'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Timezone</label>
                <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {['Europe/London','Europe/Dublin','Europe/Paris','Europe/Berlin','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Singapore','Australia/Sydney'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                <p className="text-2xs text-gray-400 mt-1">Used by the pacing engine for working hours.</p>
              </div>
            </div>
          </Card>

          {/* LinkedIn Session */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800">
              <Shield size={14} className="text-amber-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1">LinkedIn Session</p>
              <span className="text-2xs bg-amber-50 text-amber-600 dark:bg-amber-900/20 px-2 py-0.5 rounded-full font-medium">Sensitive</span>
              <button onClick={saveProfile} disabled={saving} className="btn btn-primary btn-sm gap-1.5 ml-2">
                {saving ? <Spinner size={12} /> : <Save size={12} />} Save
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                <p className="font-semibold mb-1">How to get your li_at cookie:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
                  <li>Open LinkedIn in Chrome and sign in</li>
                  <li>Press F12 → Application → Cookies → www.linkedin.com</li>
                  <li>Copy the <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">li_at</code> cookie value</li>
                  <li>Paste below — only stored encrypted on your VPS</li>
                </ol>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">li_at session cookie</label>
                <div className="relative">
                  <input className="input pr-10" type={showSession ? 'text' : 'password'} value={liSession} onChange={e => setLiSession(e.target.value)} placeholder="AQEDATs… (paste full value)" />
                  <button onClick={() => setShowSession(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSession ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <p className="text-2xs text-gray-400 mt-1">Cleared from this form after saving. Never logged on Vercel.</p>
              </div>
            </div>
          </Card>

          {/* Worker Controls */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800">
              <Shield size={14} className="text-brand-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Worker Controls</p>
            </div>
            <div className="px-5 py-4"><WorkerControls /></div>
          </Card>

          {/* Notifications */}
          {prefs && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800">
                <Bell size={14} className="text-brand-500" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1">Notifications</p>
                <button onClick={savePrefs} disabled={prefSaving} className="btn btn-primary btn-sm gap-1.5">
                  {prefSaving ? <Spinner size={12} /> : <Save size={12} />} Save
                </button>
              </div>
              <div className="px-5 py-4 space-y-1">
                <SectionHeader>In-app</SectionHeader>
                {[
                  { key: 'notify_dm_ready',     label: 'DM Ready',      desc: 'Lead is ready for a personalised DM' },
                  { key: 'notify_connected',    label: 'Connected',     desc: 'Connection request accepted' },
                  { key: 'notify_daily_cap',    label: 'Daily cap hit', desc: 'Worker reached daily action limit' },
                  { key: 'notify_worker_error', label: 'Worker error',  desc: 'An action fails after 3 retries' },
                  { key: 'notify_reply',        label: 'Reply received', desc: 'Lead replied to a DM' },
                ].map(({ key, label, desc }) => (
                  <Toggle key={key} label={label} desc={desc} value={prefs[key]} onChange={v => setPrefs((p: any) => ({ ...p, [key]: v }))} />
                ))}
                <div className="pt-3">
                  <SectionHeader>Email</SectionHeader>
                  <Toggle label="Email notifications" desc="Requires RESEND_API_KEY in Vercel env" value={prefs.email_enabled} onChange={v => setPrefs((p: any) => ({ ...p, email_enabled: v }))} />
                  {prefs.email_enabled && (
                    <div className="mt-3 animate-fade-in">
                      <input className="input text-sm" type="email" placeholder="your@email.com" value={prefs.email_address ?? ''} onChange={e => setPrefs((p: any) => ({ ...p, email_address: e.target.value }))} />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Sign out */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Sign out</p>
                <p className="text-xs text-gray-400">You'll need your email to sign back in</p>
              </div>
              <button onClick={async () => { await sb.auth.signOut(); window.location.href = '/login' }} className="btn btn-danger btn-sm">Sign out</button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className="flex-shrink-0 ml-4" style={{ height: 22, width: 40, borderRadius: 11, border: 'none', cursor: 'pointer', background: value ? '#0073ea' : '#e5e7eb', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, width: 16, height: 16, left: value ? 21 : 3, background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,.15)', transition: 'left .2s' }} />
      </button>
    </div>
  )
}
