// ============================================================
// Supabase client setup
// Two variants:
//   createServerClient()  — used in API routes (service role, bypasses RLS)
//   createBrowserClient() — used in frontend (anon key, respects RLS)
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')

/**
 * Server-side admin client.
 * Uses service role key — bypasses Row Level Security.
 * ONLY use in API routes, never expose to client.
 */
export function createServerClient() {
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — required for server client')
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Browser-side client.
 * Uses anon key — Row Level Security is enforced.
 * Safe to use in React components and client-side code.
 */
export function createBrowserClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Verify a user's JWT from an API route request.
 * Returns the user object or throws if invalid.
 */
export async function requireAuth(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServerClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid or expired token')
  }

  return user
}
