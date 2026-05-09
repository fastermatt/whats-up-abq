import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { NotificationPrefsForm } from './NotificationPrefsForm'

export const metadata: Metadata = {
  title: 'Notification Preferences | ABQ Unplugged',
  description: 'Tell us what you want to hear about. We will only notify you about events that match.',
}

export const revalidate = 0

export default async function NotificationsPrefsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/profile/notifications')

  // Load current prefs, email prefs, and any existing push subscription
  const [{ data: prefs }, { data: emailPref }] = await Promise.all([
    supabase.from('user_event_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_email_prefs').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  // Load top venues + neighborhoods to offer as chip selections
  const [{ data: venueRows }, { data: neighborhoodRows }] = await Promise.all([
    supabase
      .schema('public')
      .from('events')
      .select('venue_name')
      .eq('hidden', false)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .not('venue_name', 'is', null)
      .limit(2000),
    supabase
      .schema('public')
      .from('events')
      .select('neighborhood_slug, neighborhood')
      .eq('hidden', false)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .not('neighborhood_slug', 'is', null)
      .limit(2000),
  ])

  // Build venue list, top 30 by frequency
  const venueCounts = new Map<string, number>()
  for (const r of (venueRows ?? []) as Array<{ venue_name: string | null }>) {
    const v = (r.venue_name || '').trim()
    if (!v || v.length < 3) continue
    venueCounts.set(v, (venueCounts.get(v) ?? 0) + 1)
  }
  const topVenues = Array.from(venueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name, count]) => ({ name, count }))

  // Build neighborhood list (dedup by slug)
  const nhMap = new Map<string, string>() // slug -> label
  for (const r of (neighborhoodRows ?? []) as Array<{ neighborhood_slug: string; neighborhood: string | null }>) {
    if (!r.neighborhood_slug) continue
    if (!nhMap.has(r.neighborhood_slug)) {
      nhMap.set(r.neighborhood_slug, r.neighborhood || r.neighborhood_slug)
    }
  }
  const neighborhoods = Array.from(nhMap.entries())
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1]">
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Notification Preferences
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl p-5 border border-[#f0e4cc]">
          <h2 className="text-base font-black text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Tell us what you love
          </h2>
          <p className="text-sm text-[#4a3f3a] leading-relaxed">
            We will only reach out about events that match your picks: concerts, comedy, arts &amp; crafts, family days, whatever you want. Nothing generic, nothing you did not ask for.
          </p>
        </div>

        <NotificationPrefsForm
          userEmail={user.email || ''}
          initial={{
            categories:       prefs?.categories       ?? [],
            subcategory_tags: prefs?.subcategory_tags ?? [],
            keywords:         prefs?.keywords         ?? [],
            venues:           prefs?.venues           ?? [],
            neighborhoods:    prefs?.neighborhoods    ?? [],
            moods:            prefs?.moods            ?? [],
            include_free:     prefs?.include_free ?? true,
            include_paid:     prefs?.include_paid ?? true,
            price_max_cents:  prefs?.price_max_cents ?? null,
            family_friendly:  prefs?.family_friendly ?? false,
            channels:         prefs?.channels ?? ['in_app'],
            digest_day:       prefs?.digest_day ?? 4,
            digest_hour:      prefs?.digest_hour ?? 9,
            days_ahead:       prefs?.days_ahead ?? 14,
            enabled:          prefs?.enabled ?? true,
            email_opted_in:   emailPref?.opted_in ?? false,
            email_frequency:  emailPref?.frequency ?? 'weekly',
          }}
          topVenues={topVenues}
          neighborhoods={neighborhoods}
        />
      </div>
    </main>
  )
}
