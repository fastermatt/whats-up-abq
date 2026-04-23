'use client'

import { useState, useTransition } from 'react'
import { Check, Music, Users, Palette, Mic, Film, Heart, UtensilsCrossed, MapPin, Trees, Sparkles } from 'lucide-react'

const CATEGORIES: Array<{ slug: string; label: string; icon: React.ReactNode; hint: string }> = [
  { slug: 'Music',          label: 'Music',           icon: <Music className="w-4 h-4" />,            hint: 'Concerts, festivals, open mic' },
  { slug: 'Comedy',         label: 'Comedy',          icon: <Mic className="w-4 h-4" />,              hint: 'Stand-up, improv, live shows' },
  { slug: 'Arts & Theater', label: 'Arts & Theater',  icon: <Palette className="w-4 h-4" />,          hint: 'Gallery, theater, ballet, dance' },
  { slug: 'Family',         label: 'Family',          icon: <Heart className="w-4 h-4" />,            hint: 'Kid-friendly, storytime, crafts' },
  { slug: 'Food & Drink',   label: 'Food & Drink',    icon: <UtensilsCrossed className="w-4 h-4" />,  hint: 'Tastings, brewery tours, markets' },
  { slug: 'Sports',         label: 'Sports',          icon: <Users className="w-4 h-4" />,            hint: 'Isotopes, NM United, Lobos' },
  { slug: 'Film',           label: 'Film',            icon: <Film className="w-4 h-4" />,             hint: 'Screenings, film festivals' },
  { slug: 'Outdoor',        label: 'Outdoor',         icon: <Trees className="w-4 h-4" />,            hint: 'Hikes, balloon, open spaces' },
  { slug: 'Community',      label: 'Community',       icon: <MapPin className="w-4 h-4" />,           hint: 'Volunteer, workshops, civic' },
  { slug: 'Festivals',      label: 'Festivals',       icon: <Sparkles className="w-4 h-4" />,         hint: 'Large public celebrations' },
]

// Subcategory tags — the classifier uses these as keyword matches
const SUBCATEGORY_TAGS = [
  'rock', 'hip-hop', 'country', 'electronic', 'jazz', 'blues', 'folk', 'classical', 'metal', 'latin',
  'standup', 'improv', 'open mic',
  'ballet', 'theater', 'opera', 'dance',
  'storytime', 'kids crafts', 'lego',
  'pottery', 'painting', 'crafts',
  'brewery', 'wine', 'farmers market',
  'hiking', 'cycling', 'balloon',
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Props = {
  userEmail: string
  initial: {
    categories: string[]
    subcategory_tags: string[]
    keywords: string[]
    venues: string[]
    neighborhoods: string[]
    moods: string[]
    include_free: boolean
    include_paid: boolean
    price_max_cents: number | null
    family_friendly: boolean
    channels: string[]
    digest_day: number
    digest_hour: number
    days_ahead: number
    enabled: boolean
    email_opted_in: boolean
    email_frequency: string
  }
  topVenues: Array<{ name: string; count: number }>
  neighborhoods: Array<{ slug: string; label: string }>
}

export function NotificationPrefsForm({ userEmail, initial, topVenues, neighborhoods }: Props) {
  const [state, setState] = useState(initial)
  const [keywordInput, setKeywordInput] = useState('')
  const [venueInput, setVenueInput] = useState('')
  const [saving, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleArr(key: keyof typeof state, value: string) {
    setState(s => {
      const arr = (s[key] as string[]).slice()
      const i = arr.indexOf(value)
      if (i >= 0) arr.splice(i, 1)
      else arr.push(value)
      return { ...s, [key]: arr }
    })
  }

  function addKeyword() {
    const k = keywordInput.trim().toLowerCase()
    if (!k || state.keywords.includes(k)) { setKeywordInput(''); return }
    setState(s => ({ ...s, keywords: [...s.keywords, k] }))
    setKeywordInput('')
  }

  function addVenue() {
    const v = venueInput.trim()
    if (!v || state.venues.includes(v)) { setVenueInput(''); return }
    setState(s => ({ ...s, venues: [...s.venues, v] }))
    setVenueInput('')
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaved(false)
    startTransition(async () => {
      try {
        const res = await fetch('/api/notification-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        })
        if (!res.ok) {
          const t = await res.text().catch(() => '')
          throw new Error(t || `HTTP ${res.status}`)
        }
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  const priceMaxDollars = state.price_max_cents == null ? '' : String(Math.round(state.price_max_cents / 100))

  return (
    <form onSubmit={onSave} className="space-y-6">

      {/* ENABLE SWITCH */}
      <div className="bg-white rounded-2xl p-4 border border-[#f0e4cc] flex items-center gap-3">
        <input
          id="enabled"
          type="checkbox"
          checked={state.enabled}
          onChange={e => setState(s => ({ ...s, enabled: e.target.checked }))}
          className="w-5 h-5 accent-[#9a442d]"
        />
        <label htmlFor="enabled" className="text-sm font-semibold text-[#1a1614] select-none">
          Send me notifications about matching events
        </label>
      </div>

      {/* CATEGORIES */}
      <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc]">
        <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Categories you love
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map(c => {
            const on = state.categories.includes(c.slug)
            return (
              <button
                type="button"
                key={c.slug}
                onClick={() => toggleArr('categories', c.slug)}
                className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                  on ? 'bg-[#9a442d] text-white border-[#9a442d]' : 'bg-white text-[#1a1614] border-[#f0e4cc] hover:border-[#9a442d]/40'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">{c.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{c.label}</div>
                  <div className={`text-[10px] leading-snug mt-0.5 ${on ? 'text-white/70' : 'text-[#8a7a74]'}`}>{c.hint}</div>
                </div>
                {on && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </section>

      {/* SUBCATEGORY TAGS */}
      <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc]">
        <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Specific sub-genres / styles
        </h3>
        <p className="text-xs text-[#8a7a74] mb-3">Pick anything. We match these against event titles + descriptions.</p>
        <div className="flex flex-wrap gap-2">
          {SUBCATEGORY_TAGS.map(t => {
            const on = state.subcategory_tags.includes(t)
            return (
              <button
                type="button"
                key={t}
                onClick={() => toggleArr('subcategory_tags', t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  on ? 'bg-[#006a62] text-white border-[#006a62]' : 'bg-white text-[#1a1614] border-[#f0e4cc] hover:border-[#006a62]/40'
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </section>

      {/* KEYWORDS */}
      <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc]">
        <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Artists, teams, or keywords
        </h3>
        <p className="text-xs text-[#8a7a74] mb-3">e.g. &ldquo;john mulaney&rdquo;, &ldquo;nm united&rdquo;, &ldquo;balloon fiesta&rdquo;. Case-insensitive.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
            placeholder="Add a keyword and press Enter"
            className="flex-1 px-3 py-2 rounded-lg border border-[#f0e4cc] text-sm text-[#1a1614] bg-[#fbf7f1] focus:outline-none focus:border-[#9a442d]"
          />
          <button type="button" onClick={addKeyword} className="px-4 py-2 rounded-lg bg-[#1a1614] text-white text-sm font-semibold hover:bg-[#4a3f3a]">
            Add
          </button>
        </div>
        {state.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {state.keywords.map(k => (
              <span key={k} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#9a442d]/10 text-[#9a442d] text-xs font-semibold">
                {k}
                <button type="button" onClick={() => toggleArr('keywords', k)} aria-label={`Remove ${k}`} className="hover:text-[#7d3725]">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* VENUES */}
      <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc]">
        <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Favorite venues
        </h3>
        <p className="text-xs text-[#8a7a74] mb-3">Tap a venue to favorite it, or type a custom one.</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topVenues.slice(0, 20).map(v => {
            const on = state.venues.includes(v.name)
            return (
              <button
                type="button"
                key={v.name}
                onClick={() => toggleArr('venues', v.name)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  on ? 'bg-[#4f6249] text-white border-[#4f6249]' : 'bg-white text-[#1a1614] border-[#f0e4cc] hover:border-[#4f6249]/40'
                }`}
              >
                {v.name} <span className={on ? 'text-white/70' : 'text-[#8a7a74]'}>· {v.count}</span>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={venueInput}
            onChange={e => setVenueInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVenue() } }}
            placeholder="Add a venue not listed above"
            className="flex-1 px-3 py-2 rounded-lg border border-[#f0e4cc] text-sm text-[#1a1614] bg-[#fbf7f1] focus:outline-none focus:border-[#4f6249]"
          />
          <button type="button" onClick={addVenue} className="px-4 py-2 rounded-lg bg-[#1a1614] text-white text-sm font-semibold hover:bg-[#4a3f3a]">
            Add
          </button>
        </div>
        {state.venues.filter(v => !topVenues.find(tv => tv.name === v)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {state.venues.filter(v => !topVenues.find(tv => tv.name === v)).map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#4f6249]/10 text-[#4f6249] text-xs font-semibold">
                {v}
                <button type="button" onClick={() => toggleArr('venues', v)} aria-label={`Remove ${v}`} className="hover:opacity-70">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* NEIGHBORHOODS */}
      {neighborhoods.length > 0 && (
        <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc]">
          <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Neighborhoods
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {neighborhoods.map(nb => {
              const on = state.neighborhoods.includes(nb.slug)
              return (
                <button
                  type="button"
                  key={nb.slug}
                  onClick={() => toggleArr('neighborhoods', nb.slug)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    on ? 'bg-[#006a62] text-white border-[#006a62]' : 'bg-white text-[#1a1614] border-[#f0e4cc] hover:border-[#006a62]/40'
                  }`}
                >
                  {nb.label}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* PRICE & FAMILY */}
      <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc] space-y-3">
        <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Filters
        </h3>
        <label className="flex items-center gap-2 text-sm text-[#1a1614]">
          <input type="checkbox" checked={state.include_free} onChange={e => setState(s => ({ ...s, include_free: e.target.checked }))} className="w-4 h-4 accent-[#9a442d]" />
          Include free events
        </label>
        <label className="flex items-center gap-2 text-sm text-[#1a1614]">
          <input type="checkbox" checked={state.include_paid} onChange={e => setState(s => ({ ...s, include_paid: e.target.checked }))} className="w-4 h-4 accent-[#9a442d]" />
          Include paid events
        </label>
        <label className="flex items-center gap-2 text-sm text-[#1a1614]">
          <input type="checkbox" checked={state.family_friendly} onChange={e => setState(s => ({ ...s, family_friendly: e.target.checked }))} className="w-4 h-4 accent-[#9a442d]" />
          Only family-friendly events
        </label>
        <div className="flex items-center gap-2 text-sm text-[#1a1614]">
          <span>Max ticket price $</span>
          <input
            type="number"
            min="0"
            step="5"
            value={priceMaxDollars}
            onChange={e => {
              const v = e.target.value
              setState(s => ({ ...s, price_max_cents: v === '' ? null : Math.max(0, parseInt(v, 10)) * 100 }))
            }}
            placeholder="Any"
            className="w-24 px-2 py-1 rounded-lg border border-[#f0e4cc] bg-[#fbf7f1] focus:outline-none focus:border-[#9a442d]"
          />
          <span className="text-xs text-[#8a7a74]">(leave blank for any)</span>
        </div>
      </section>

      {/* DELIVERY */}
      <section className="bg-white rounded-2xl p-5 border border-[#f0e4cc] space-y-4">
        <h3 className="text-sm font-black text-[#1a1614] uppercase tracking-wide" style={{ fontFamily: 'var(--font-epilogue)' }}>
          How and when
        </h3>

        <div>
          <p className="text-xs text-[#4a3f3a] mb-2 font-semibold">Channels</p>
          <div className="flex flex-wrap gap-2">
            {(['in_app','email','push'] as const).map(ch => {
              const on = state.channels.includes(ch)
              const label = ch === 'in_app' ? 'In-app' : ch === 'email' ? 'Email' : 'Push notifications'
              return (
                <button
                  type="button"
                  key={ch}
                  onClick={() => toggleArr('channels', ch)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    on ? 'bg-[#9a442d] text-white border-[#9a442d]' : 'bg-white text-[#1a1614] border-[#f0e4cc] hover:border-[#9a442d]/40'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {state.channels.includes('email') && !state.email_opted_in && (
            <p className="text-[11px] text-[#9a442d] mt-2">
              Email will be sent to <strong>{userEmail}</strong>. Saving will opt you into the weekly digest.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#4a3f3a] mb-1.5 font-semibold">Digest day</p>
            <select
              value={state.digest_day}
              onChange={e => setState(s => ({ ...s, digest_day: parseInt(e.target.value, 10) }))}
              className="w-full px-3 py-2 rounded-lg border border-[#f0e4cc] bg-[#fbf7f1] text-sm focus:outline-none focus:border-[#9a442d]"
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-[#4a3f3a] mb-1.5 font-semibold">Digest hour</p>
            <select
              value={state.digest_hour}
              onChange={e => setState(s => ({ ...s, digest_hour: parseInt(e.target.value, 10) }))}
              className="w-full px-3 py-2 rounded-lg border border-[#f0e4cc] bg-[#fbf7f1] text-sm focus:outline-none focus:border-[#9a442d]"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs text-[#4a3f3a] mb-1.5 font-semibold">Look ahead</p>
          <input
            type="range"
            min="3"
            max="60"
            value={state.days_ahead}
            onChange={e => setState(s => ({ ...s, days_ahead: parseInt(e.target.value, 10) }))}
            className="w-full accent-[#9a442d]"
          />
          <p className="text-[11px] text-[#8a7a74] text-center">Notify me about events happening in the next <strong>{state.days_ahead}</strong> days</p>
        </div>
      </section>

      {/* ACTIONS */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-white rounded-2xl p-4 border border-[#f0e4cc] shadow-lg flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl bg-[#9a442d] text-white text-sm font-black uppercase tracking-wide hover:bg-[#7d3725] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
          {saved && <span className="text-sm text-[#4f6249] font-semibold">✓ Saved</span>}
          {error && <span className="text-sm text-[#9a442d] font-semibold">{error}</span>}
        </div>
      </div>
    </form>
  )
}
