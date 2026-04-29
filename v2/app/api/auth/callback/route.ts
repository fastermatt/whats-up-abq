import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? null // null means "no explicit destination"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // If the user had a specific destination, honour it
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Otherwise check if they've set preferences yet.
      // New signups → empty preferences → send to onboarding.
      // Returning users → send to homepage.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single()

        const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
        const hasPrefs = !!(
          prefs.who ||
          (Array.isArray(prefs.categories) && prefs.categories.length > 0) ||
          prefs.when ||
          prefs.budget
        )

        if (!hasPrefs) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
