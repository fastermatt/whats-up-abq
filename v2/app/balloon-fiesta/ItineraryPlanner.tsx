'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BusFront,
  CalendarDays,
  Check,
  Clock3,
  CloudRain,
  MapPin,
  Navigation,
  Route,
  Share2,
  Sparkles,
} from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'
import { FIESTA_DAYS, GLOWDEO_DATES, ITINERARIES, NO_PARK_AND_RIDE_DATES } from './itineraries'

export type PlannerEvent = {
  id: string
  title: string
  date: string
  time: string | null
  venue: string | null
  category: string | null
  href: string
}

const ACCENTS = {
  terra: { tab: 'border-terra bg-terra text-white', dot: 'bg-terra', wash: 'bg-terra/8', text: 'text-terra' },
  turq: { tab: 'border-turq bg-turq text-white', dot: 'bg-turq', wash: 'bg-turq/8', text: 'text-turq' },
  sage: { tab: 'border-sage bg-sage text-white', dot: 'bg-sage', wash: 'bg-sage/8', text: 'text-sage' },
  gold: { tab: 'border-sky-gold bg-sky-gold text-ink', dot: 'bg-sky-gold', wash: 'bg-sky-gold/10', text: 'text-[#87651f]' },
} as const

function safeSource(source: string): string {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(source) ? source : 'direct'
}

function eventDateLabel(date: string, time: string | null): string {
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  return time ? `${label} · ${time}` : label
}

export function ItineraryPlanner({
  source,
  localEvents,
  initialPlan,
  initialDate,
}: {
  source: string
  localEvents: PlannerEvent[]
  initialPlan: string
  initialDate: string
}) {
  const cleanSource = safeSource(source)
  const validInitialPlan = ITINERARIES.some((item) => item.id === initialPlan) ? initialPlan : ITINERARIES[0].id
  const validInitialDate = FIESTA_DAYS.some((day) => day.date === initialDate) ? initialDate : FIESTA_DAYS[0].date
  const [selectedId, setSelectedId] = useState(validInitialPlan)
  const [selectedDate, setSelectedDate] = useState(validInitialDate)
  const [copied, setCopied] = useState(false)
  const selected = ITINERARIES.find((item) => item.id === selectedId) ?? ITINERARIES[0]
  const accent = ACCENTS[selected.accent]
  const noParkAndRide = NO_PARK_AND_RIDE_DATES.has(selectedDate)
  const isGlowdeo = GLOWDEO_DATES.has(selectedDate)
  const selectedWeekday = new Date(`${selectedDate}T12:00:00`).getDay()
  const displayStops = selected.stops.map((stop) =>
    stop.closedWeekdays?.includes(selectedWeekday) && stop.alternate ? stop.alternate : stop
  )
  const dayEvents = useMemo(
    () => localEvents.filter((event) => event.date === selectedDate).slice(0, 4),
    [localEvents, selectedDate],
  )

  function selectItinerary(id: string) {
    setSelectedId(id)
    trackEvent('itinerary_select', { itinerary_id: id, source: cleanSource, date: selectedDate })
  }

  function selectDate(date: string) {
    setSelectedDate(date)
    trackEvent('itinerary_date_select', { itinerary_id: selectedId, source: cleanSource, date })
  }

  function trackStop(stopId: string, eventIdOrVenue: string) {
    trackEvent('itinerary_stop_click', {
      itinerary_id: selectedId,
      stop_id: stopId,
      event_id_or_venue: eventIdOrVenue,
      source: cleanSource,
      date: selectedDate,
    })
  }

  async function sharePlan() {
    const url = new URL(window.location.href)
    url.searchParams.set('plan', selectedId)
    url.searchParams.set('date', selectedDate)
    if (cleanSource !== 'direct') url.searchParams.set('src', cleanSource)
    const shareData = {
      title: `${selected.label} — Balloon Fiesta day plan`,
      text: `Here’s our Albuquerque plan for Balloon Fiesta week: ${selected.label}.`,
      url: url.toString(),
    }
    let method = 'clipboard'
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        method = 'native'
      } else {
        await navigator.clipboard.writeText(url.toString())
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2400)
      }
      trackEvent('share_click', { source: cleanSource, itinerary_id: selectedId, date: selectedDate, method })
    } catch {
      // A dismissed native share sheet is not an error and should not be tracked.
    }
  }

  return (
    <section id="day-planner" aria-labelledby="planner-heading" className="relative scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-sand-mid bg-card shadow-[0_24px_70px_rgba(74,63,58,0.10)]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#9a442d_0_26%,#c99b3b_26%_48%,#006a62_48%_74%,#4f6249_74%)]" />

      <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
        <div className="relative border-b border-sand-mid bg-[#211c19] p-5 text-cream sm:p-7 lg:border-b-0 lg:border-r">
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.09] [background-image:radial-gradient(circle_at_center,#fff_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-terra-light">
              <Route className="h-4 w-4" /> ABQ field guide · 2026
            </p>
            <h2 id="planner-heading" className="max-w-md text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Plan the rest of your Balloon Fiesta day.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/72">
              The official Fiesta has the live balloon schedule. This planner handles the hours around it: where to eat, what to see, where to shop, and how far each stop is from the field.
            </p>

            <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-4">
              <div className="flex items-start gap-3">
                <BusFront className="mt-0.5 h-5 w-5 shrink-0 text-sky-gold" />
                <div>
                  <p className="text-sm font-extrabold">Park & Ride matters</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/70">
                    It runs Oct 3–4 and 8–11 from Cottonwood Mall, Coronado Center, Hoffmantown Church, and Intel on weekends. It does <strong className="text-white">not</strong> run Mon–Wed, Oct 5–7.
                  </p>
                  <a href="https://www.balloonfiesta.com/Park-Ride" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-terra-light hover:text-white" onClick={() => trackStop('park-and-ride', 'official-park-and-ride')}>
                    Official times + tickets <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[#72b5e8]/25 bg-[#72b5e8]/10 p-4">
              <div className="flex items-start gap-3">
                <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-[#72b5e8]" />
                <div>
                  <p className="text-sm font-extrabold">Driving? Use Waze during Fiesta.</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/70">
                    Temporary closures and traffic-control patterns can make ordinary map routes rough. Waze is usually the better live-navigation choice—but police directions and event signs always outrank the app.
                  </p>
                  <a href="https://www.waze.com/ul?q=Balloon%20Fiesta%20Park%2C%20Albuquerque%2C%20NM&navigate=yes" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#92ccf5] hover:text-white" onClick={() => trackStop('waze-navigation', 'Balloon Fiesta Park via Waze')}>
                    Open the park in Waze <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-[11px] leading-relaxed text-cream/55">
              <MapPin className="h-4 w-4 shrink-0" />
              Distances are rounded driving miles from 4401 Alameda Blvd NE. Fiesta traffic can add serious time.
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="mb-6">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-light">Step 1</p>
                <h3 className="mt-0.5 text-lg font-black text-ink" style={{ fontFamily: 'var(--font-epilogue)' }}>Pick your Fiesta day</h3>
              </div>
              <a href="https://www.balloonfiesta.com/plan-your-visit/event-schedule/" target="_blank" rel="noopener noreferrer" className="hidden text-xs font-bold text-terra hover:underline sm:inline">Official schedule ↗</a>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2" role="group" aria-label="Choose a Balloon Fiesta date">
              {FIESTA_DAYS.map((day) => (
                <button key={day.date} type="button" onClick={() => selectDate(day.date)} aria-pressed={selectedDate === day.date} className={`min-w-[58px] rounded-xl border px-2.5 py-2 text-xs font-bold transition ${selectedDate === day.date ? 'border-ink bg-ink text-white' : 'border-sand-mid bg-cream text-ink-mid hover:border-terra'}`}>
                  {day.short}
                </button>
              ))}
            </div>
            <div className={`mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${noParkAndRide ? 'bg-terra/10 text-terra-hover' : 'bg-sage/10 text-sage'}`}>
              {noParkAndRide ? <BusFront className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
              <span>{noParkAndRide ? 'No Park & Ride this day. Drive, rideshare, or choose another Fiesta date—and leave a large traffic buffer.' : 'Park & Ride is scheduled this day. Buy ahead and choose your departure lot and time on the official site.'}</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-light">Step 2</p>
            <h3 className="mb-3 mt-0.5 text-lg font-black text-ink" style={{ fontFamily: 'var(--font-epilogue)' }}>Choose the day you want</h3>
            <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Balloon Fiesta itineraries">
              {ITINERARIES.map((itinerary, index) => {
                const active = itinerary.id === selectedId
                return (
                  <button key={itinerary.id} type="button" role="tab" aria-selected={active} aria-controls="selected-itinerary" onClick={() => selectItinerary(itinerary.id)} className={`group min-h-[112px] rounded-2xl border p-4 text-left transition-all ${active ? `${ACCENTS[itinerary.accent].tab} shadow-md` : 'border-sand-mid bg-cream-raised text-ink hover:-translate-y-0.5 hover:border-terra/50 hover:shadow-sm'} ${index === ITINERARIES.length - 1 ? 'sm:col-span-2' : ''}`}>
                    <span className={`text-[9px] font-extrabold uppercase tracking-[0.17em] ${active ? 'text-white/70' : ACCENTS[itinerary.accent].text}`}>{itinerary.eyebrow}</span>
                    <span className="mt-1 block text-base font-black leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>{itinerary.label}</span>
                    <span className={`mt-1.5 block text-xs leading-snug ${active ? 'text-white/80' : 'text-ink-light'}`}>{itinerary.hook}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div id="selected-itinerary" role="tabpanel" className="border-t border-sand-mid bg-[#f8f0e4] p-5 sm:p-7 lg:p-9">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={`text-[10px] font-extrabold uppercase tracking-[0.2em] ${accent.text}`}>{selected.eyebrow}</p>
            <h3 className="mt-1 text-2xl font-black text-ink sm:text-3xl" style={{ fontFamily: 'var(--font-epilogue)' }}>{selected.label}</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-light">
              <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {selected.timing}</span>
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {selected.bestFor}</span>
            </div>
          </div>
          <button type="button" onClick={sharePlan} className="inline-flex w-fit items-center gap-2 rounded-full border border-sand-dark bg-card px-4 py-2.5 text-xs font-bold text-ink transition hover:border-terra hover:text-terra">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? 'Plan link copied' : 'Share this plan'}
          </button>
        </div>

        {selected.id === 'weather-backup' && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-turq/20 bg-turq/8 p-4 text-sm text-ink-mid">
            <CloudRain className="mt-0.5 h-5 w-5 shrink-0 text-turq" />
            <p><strong className="text-ink">A cancelled ascension is disappointing, not a ruined trip.</strong> Every main stop below works indoors. Always check the official app before leaving your lodging; only Fiesta officials make weather calls.</p>
          </div>
        )}

        {selected.id === 'evening-glow' && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-gold/30 bg-sky-gold/10 p-4 text-sm text-ink-mid">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#87651f]" />
            <p>{isGlowdeo ? <><strong className="text-ink">You picked a Special Shape Glowdeo day.</strong> Oct 8–9 are the verified 2026 dates; still check live weather and program status.</> : <><strong className="text-ink">Not every evening is a Glowdeo.</strong> Oct 8–9 are the Special Shape Glowdeo dates. Use the official schedule for the named program on your selected night.</>}</p>
          </div>
        )}

        <ol className="relative grid gap-3 lg:grid-cols-2">
          {displayStops.map((stop, index) => (
            <li key={stop.id} className="relative overflow-hidden rounded-2xl border border-sand-mid bg-card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accent.dot} text-sm font-black text-white`}>{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`text-[10px] font-extrabold uppercase tracking-[0.16em] ${accent.text}`}>{stop.time}</span>
                    <span className="text-[10px] font-semibold text-ink-light">{stop.distance}</span>
                  </div>
                  <h4 className="mt-1 text-base font-black leading-tight text-ink" style={{ fontFamily: 'var(--font-epilogue)' }}>{stop.name}</h4>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-ink-light"><MapPin className="h-3 w-3" /> {stop.area}</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink-mid">{stop.why}</p>
                  {stop.note && <p className={`mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed text-ink-mid ${accent.wash}`}>{stop.note}</p>}
                  <a href={stop.href} target="_blank" rel="noopener noreferrer" onClick={() => trackStop(stop.id, stop.name)} className={`mt-3 inline-flex items-center gap-1 text-xs font-extrabold ${accent.text} hover:underline`}>
                    {stop.linkLabel} <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 border-t border-sand-mid pt-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-terra"><CalendarDays className="h-4 w-4" /> Live from ABQ Unplugged</p>
              <h4 className="mt-1 text-lg font-black text-ink" style={{ fontFamily: 'var(--font-epilogue)' }}>Also happening on {FIESTA_DAYS.find((day) => day.date === selectedDate)?.short}</h4>
            </div>
            <a href={`/events?date=${selectedDate}`} className="text-xs font-bold text-terra hover:underline">See every event that day →</a>
          </div>
          {dayEvents.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {dayEvents.map((event) => (
                <a key={event.id} href={event.href} onClick={() => trackStop(`event-${event.id}`, event.id)} className="rounded-xl border border-sand-mid bg-card p-3 transition hover:-translate-y-0.5 hover:border-terra/50">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-terra">{event.category ?? 'Local event'}</span>
                  <span className="mt-1 block text-sm font-extrabold leading-snug text-ink">{event.title}</span>
                  <span className="mt-2 block text-[10px] text-ink-light">{eventDateLabel(event.date, event.time)}{event.venue ? ` · ${event.venue}` : ''}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-sand-dark bg-card/60 p-4 text-sm text-ink-light">Nothing in our live feed fits this date yet. The evergreen route above is complete on its own; check again closer to October as local calendars fill in.</p>
          )}
        </div>
      </div>
    </section>
  )
}
