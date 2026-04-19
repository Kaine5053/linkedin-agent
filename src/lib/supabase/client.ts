// ============================================================
// Supabase client setup
//   createServerClient()  — API routes (service role, bypasses RLS)
//   createBrowserClient() — frontend (anon key, cookie-based session)
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-side admin client — bypasses RLS. Only use in API routes.
 */
export function createServerClient() {
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Browser-side client using @supabase/ssr.
 * Stores session in cookies so middleware can read it.
 */
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Verify a user's JWT from an API request.
 */
export async function requireAuth(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header')
  }
  const token = authHeader.replace('Bearer ', '')
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('Invalid or expired token')
  return user
}
