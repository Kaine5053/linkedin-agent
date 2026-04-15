'use client'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://linkedin-agent-rho.vercel.app/board',
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#1f2d3d' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-purple-500" />
          <div className="px-8 py-8">

            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
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

            <div>
              <p className="font-bold text-gray-900 text-2xl mb-1">Sign in</p>
              <p className="text-gray-400 text-sm mb-6">Continue with your Google account</p>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Redirecting...</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
                    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

          </div>
          <div className="px-8 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-center text-gray-400 text-xs">
              Your session stays private and secure.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
