'use client'
// ============================================================
// Client-side OAuth callback handler
// Handles both PKCE (?code=) and implicit (#access_token=) flows
// ============================================================

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router   = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    // The Supabase JS client automatically detects tokens in the URL hash
    // and stores them. We just need to wait for it to finish.
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/board')
      } else {
        router.replace('/login?error=no_session')
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1f2d3d' }}>
      <div className="text-white text-center">
        <div className="mb-4">
          <div className="inline-block w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
        <p className="text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
