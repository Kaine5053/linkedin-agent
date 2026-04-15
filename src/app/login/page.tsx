'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createBrowserClient()
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/board` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#1f2d3d' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-purple-500" />
          <div className="px-8 py-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                  <path d="M3 8.5a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0z" stroke="white" strokeWidth="1.7"/>
                  <path d="M6 8.5h5M8.5 6v5" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base">LinkedIn Agent</p>
                <p className="text-gray-400 text-xs">UK Civil Engineering Outreach</p>
              </div>
            </div>

            {sent ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">📬</div>
                <p className="font-bold text-gray-900 text-xl mb-2">Check your inbox</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We emailed a sign-in link to <span className="font-medium text-gray-700">{email}</span>
                </p>
                <button onClick={() => setSent(false)} className="mt-5 text-brand-500 hover:text-brand-700 font-medium text-sm">
                  ← Different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="font-bold text-gray-900 text-2xl mb-1">Sign in</p>
                  <p className="text-gray-400 text-sm">Enter your email for a magic sign-in link</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Email address</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg w-full justify-center gap-2 !mt-5"
                >
                  {loading ? 'Sending…' : 'Continue with email →'}
                </button>
              </form>
            )}
          </div>
          <div className="px-8 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-center text-gray-400 text-xs">
              Your session stays private and secure. LinkedIn cookie is stored only on your VPS.
            </p>
          </div>
        </div>
        <p className="text-center mt-5 text-gray-500 text-xs">
          331 UK civil engineering leads ready
        </p>
      </div>
    </div>
  )
}
