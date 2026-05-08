import { createServerClient } from '@supabase/ssr'

/**
 * ISR-compatible Supabase client — no cookies(), no dynamic rendering.
 *
 * Use this for all public read-only data fetching in Server Components
 * (homepage, events listing, categories, venues, neighborhoods, etc.).
 * It uses the anon key and empty cookie handlers so Next.js static analysis
 * never sees a `cookies()` call in the import chain, keeping pages eligible
 * for ISR / CDN caching.
 *
 * DO NOT use this for anything that requires the user's auth session.
 * Use createClient() from ./server.ts for authenticated operations.
 */
export function createStaticClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {/* no-op — static client never writes cookies */},
      },
    }
  )
}
