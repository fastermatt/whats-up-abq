'use client'

/**
 * PreferencesPicker — chip-based taste profile editor.
 *
 * Four quick signals:
 *   who:        household type (affects family/kids filtering)
 *   categories: event types the user wants to see
 *   when:       weekday vs weekend preference
 *   budget:     free-only vs any price
 *   digest:     weekly email summary opt-in
 *
 * Saves to profiles.preferences (JSONB) via Supabase.
 * Designed for the profile page and the post-login onboarding flow.
 */

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check } from 'lucide-react'

// ─── Preference shape ───────────────────────────────────────────────────────

export interface UserPreferences {
  who?: 'solo' | 'couple' | 'family_kids' | 'group'
  categories?: string[]
  when?: 'weekdays' | 'weekends' | 'any'
  budget?: 'free' | 'any'
  digest?: boolean
}

// ─── Option lists ───────────────────────────────────────────────────────────

const WHO_OPTIONS: { value: UserPreferences['who']; label: string; emoji: string }[] = [
  { value: 'solo',        label: 'Just me',        emoji: '🙋' },
  { value: 'couple',      label: 'Me + partner',   emoji: '👫' },
  { value: 'family_kids', label: 'Family with kids', emoji: '👨‍👩‍👧' },
  { value: 'group',       label: 'Group / friends', emoji: '👯' },
]

export const PREF_CATEGORIES = [
  'Music',
  'Comedy',
  'Food & Drink',
  'Arts & Theater',
  'Outdoors & Sports',
  'Family / Kids',
  'Film',
  'Nightlife',
  'Volunteering',
  'Free Events',
] as const

const WHEN_OPTIONS: { value: UserPreferences['when']; label: string }[] = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'any',      label: 'Either works' },
]

const BUDGET_OPTIONS: { value: UserPreferences['budget']; label: string }[] = [
  { value: 'free', label: 'Free events only' },
  { value: 'any',  label: 'Any price' },
]

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-ink-light mb-2.5">
      {children}
    </p>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold',
        'border transition-all duration-150 active:scale-95',
        active
          ? 'bg-terra border-terra text-white shadow-sm'
          : 'bg-cream-raised border-sand-mid text-ink-mid hover:border-terra/60 hover:bg-[#f9f3ec]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  userId: string
  initial: UserPreferences
  /** Called after a successful save so the parent can dismiss an onboarding prompt */
  onSaved?: () => void
  /** Compact mode — smaller heading, no digest toggle (used in onboarding) */
  compact?: boolean
}

export function PreferencesPicker({ userId, initial, onSaved, compact = false }: Props) {
  const supabase = createClient()
  const [prefs, setPrefs] = useState<UserPreferences>(initial)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggleWho(val: UserPreferences['who']) {
    setPrefs(p => ({ ...p, who: p.who === val ? undefined : val }))
    setSaved(false)
  }

  function toggleCategory(cat: string) {
    setPrefs(p => {
      const current = p.categories ?? []
      const next = current.includes(cat)
        ? current.filter(c => c !== cat)
        : [...current, cat]
      return { ...p, categories: next }
    })
    setSaved(false)
  }

  function setWhen(val: UserPreferences['when']) {
    setPrefs(p => ({ ...p, when: val }))
    setSaved(false)
  }

  function setBudget(val: UserPreferences['budget']) {
    setPrefs(p => ({ ...p, budget: val }))
    setSaved(false)
  }

  function toggleDigest() {
    setPrefs(p => ({ ...p, digest: !(p.digest ?? false) }))
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await supabase
        .from('profiles')
        .update({ preferences: prefs })
        .eq('id', userId)

      setSaved(true)
      onSaved?.()
    })
  }

  const hasAnyPref = !!(
    prefs.who ||
    (prefs.categories?.length ?? 0) > 0 ||
    prefs.when ||
    prefs.budget
  )

  return (
    <div className="space-y-6">

      {/* Who */}
      <div>
        <SectionLabel>Who's coming?</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {WHO_OPTIONS.map(o => (
            <Chip key={o.value} active={prefs.who === o.value} onClick={() => toggleWho(o.value)}>
              <span>{o.emoji}</span>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <SectionLabel>What are you into?</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {PREF_CATEGORIES.map(cat => (
            <Chip
              key={cat}
              active={(prefs.categories ?? []).includes(cat)}
              onClick={() => toggleCategory(cat)}
            >
              {cat}
            </Chip>
          ))}
        </div>
      </div>

      {/* When + Budget — side by side on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <SectionLabel>When do you usually go out?</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {WHEN_OPTIONS.map(o => (
              <Chip key={o.value} active={prefs.when === o.value} onClick={() => setWhen(o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Budget</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map(o => (
              <Chip key={o.value} active={prefs.budget === o.value} onClick={() => setBudget(o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Email digest — only on profile page, not compact/onboarding */}
      {!compact && (
        <div>
          <SectionLabel>Weekly email digest</SectionLabel>
          <button
            type="button"
            onClick={toggleDigest}
            className={[
              'inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all',
              prefs.digest
                ? 'bg-sage/10 border-sage/40 text-sage'
                : 'bg-cream-raised border-sand-mid text-ink-mid hover:border-sage/50',
            ].join(' ')}
          >
            <span className={[
              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
              prefs.digest ? 'bg-sage border-sage' : 'border-[#c4b9b0]',
            ].join(' ')}>
              {prefs.digest && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </span>
            Send me a weekly "what's on" email based on my picks
          </button>
          <p className="text-[10px] text-ink-light mt-1.5 ml-0.5">
            We send a maximum of one email per week. No ads, no spam.
          </p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasAnyPref}
          className={[
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all',
            saved
              ? 'bg-sage text-white'
              : 'bg-terra text-white hover:bg-terra-hover disabled:opacity-40 disabled:cursor-not-allowed',
          ].join(' ')}
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" strokeWidth={3} />
              Saved
            </>
          ) : isPending ? (
            'Saving…'
          ) : (
            'Save preferences'
          )}
        </button>
        {saved && (
          <p className="text-[11px] text-sage font-medium">
            Your For You feed will update on your next visit.
          </p>
        )}
      </div>
    </div>
  )
}
