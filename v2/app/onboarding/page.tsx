/**
 * /onboarding — post-signup preference setup.
 *
 * New users land here after their first login (routed by the auth callback).
 * No site nav — just a focused preference picker with a single "I'm done" CTA.
 * After saving, the client-side component redirects to the homepage.
 *
 * Returning users who already have preferences are redirected to the homepage
 * by the auth callback, so they never see this page unless they navigate to it
 * directly.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OnboardingPicker } from './OnboardingPicker'
import type { UserPreferences } from '@/app/components/PreferencesPicker'

export const metadata: Metadata = {
  title: 'Personalize your feed | ABQ Unplugged',
  robots: { index: false }, // not a page we want search engines indexing
}

export const revalidate = 0

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const existing = (profile?.preferences ?? {}) as UserPreferences

  return (
    <main id="main" className="min-h-dvh bg-cream flex flex-col">
      {/* Minimal header — just the wordmark */}
      <header className="px-6 py-5 border-b border-sand-mid/40">
        <span
          className="font-black text-xl text-ink tracking-tight"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          ABQ Unplugged
        </span>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        {/* Heading */}
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-terra font-bold mb-2 flex items-center gap-2">
            <span>Quick setup</span>
            <span className="text-terra/50" aria-hidden="true">·</span>
            <span className="font-semibold text-terra/70">Almost done</span>
          </p>
          <h1
            className="text-3xl sm:text-4xl font-black text-ink leading-tight mb-3"
            style={{ fontFamily: 'var(--font-epilogue)', letterSpacing: '-0.5px' }}
          >
            What kind of nights<br />are you into?
          </h1>
          <p className="text-[15px] text-ink-mid leading-relaxed max-w-md">
            30 seconds. We&apos;ll use this to filter your For You feed and skip events
            that aren&apos;t for you (like showing kids&apos; events to someone without kids).
          </p>
        </div>

        {/* Picker */}
        <OnboardingPicker userId={user.id} initial={existing} />
      </div>
    </main>
  )
}
