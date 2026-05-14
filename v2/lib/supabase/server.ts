import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — cookies will be set in middleware
          }
        },
      },
    }
  )
}

/**
 * Service-role client — bypasses RLS entirely. Server-only.
 *
 * Uses @supabase/supabase-js createClient directly (NOT @supabase/ssr
 * createServerClient). The SSR variant reads auth session cookies and can
 * substitute a user JWT for the Authorization header, reducing the request
 * to regular user privileges and making RLS apply. The plain client sends
 * the service role key as both apikey and Authorization, which PostgREST
 * recognises as service_role and skips all RLS policies.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
