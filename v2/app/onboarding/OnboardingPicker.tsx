'use client'

/**
 * OnboardingPicker — wraps PreferencesPicker for the post-signup onboarding page.
 *
 * After saving, redirects to the homepage. Also offers a "Skip for now" escape.
 * Uses PreferencesPicker in compact mode (no email digest toggle — that lives on
 * the profile page instead, which the user will find naturally).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PreferencesPicker, type UserPreferences } from '@/app/components/PreferencesPicker'
import { ArrowRight } from 'lucide-react'

interface Props {
  userId: string
  initial: UserPreferences
}

export function OnboardingPicker({ userId, initial }: Props) {
  const router = useRouter()
  const [done, setDone] = useState(false)

  function handleSaved() {
    setDone(true)
    // Small delay so the "Saved ✓" state is visible before navigating
    setTimeout(() => router.push('/'), 800)
  }

  return (
    <div>
      <PreferencesPicker
        userId={userId}
        initial={initial}
        onSaved={handleSaved}
        compact
      />

      {!done && (
        <div className="mt-8 pt-6 border-t border-[#eee0cc]">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-sm text-[#6b5d57] hover:text-[#4a3f3a] transition-colors"
          >
            Skip for now — I&apos;ll set this later
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <p className="text-[10px] text-[#6b5d57] mt-1.5">
            You can always update this in your profile under &ldquo;What are you into?&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}
