'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Send, Loader2, ExternalLink, Sparkles, Calendar, Clock, MapPin, Search, X } from 'lucide-react'
import { useEditor } from '../store'
import type { NormalizedEvent } from '@/lib/events'
import type { PostCanvasHandle } from './PostCanvas'

// ── Caption generation ────────────────────────────────────────────────────
//
// Brand voice: warm, encouraging, community-first. ABQ Unplugged exists to
// make it easy to find something great happening in Albuquerque and go enjoy
// it with your fellow Albuquerqueans. Captions celebrate events and invite
// people in — no pressure, no judgment, no FOMO framing.
//
// Hashtag strategy (3-tier):
//   Local discovery  → #ABQEvents #ABQWeekend #ThingsToDo505 #BurqueLife #DukeCity
//   Category         → varies by event type (music, food, arts, etc.)
//   Brand anchors    → #ABQUnplugged #Albuquerque #ABQ #NewMexico #505

const BASE_TAGS = '#ABQUnplugged #Albuquerque #ABQ #NewMexico #505'
const DISCOVERY_TAGS = '#ABQEvents #ABQWeekend #ThingsToDo505 #BurqueLife #DukeCity'

const CAT_TAGS: Record<string, string> = {
  'Music':         '#ABQMusic #LiveMusicABQ #505Insta',
  'Arts & Theater':'#ABQArts #AlbuquerqueArts #SupportLocalABQ',
  'Sports':        '#ABQSports #AlbuquerqueSports #505Insta',
  'Food & Drink':  '#ABQFood #ABQFoodie #SupportLocalABQ',
  'Family':        '#ABQKids #AlbuquerqueFamilies #505Insta',
  'Outdoor':       '#ABQOutdoors #NewMexicoOutdoors #NewMexicoTrue',
  'Comedy':        '#ABQComedy #LiveComedy #505Insta',
  'Film':          '#ABQFilm #IndieFilm #505Insta',
  'Festivals':     '#ABQFestivals #BurqueLife #505Insta',
  'Community':     '#SupportLocalABQ #ABQCommunity #BurqueLife',
}

// Warm openers by category — a gentle invitation, not a command or sales pitch.
// Celebrates what's happening in Albuquerque and makes it easy to say yes.
const CAT_OPENERS: Record<string, string> = {
  'Music':         'Live music in Albuquerque this week.',
  'Sports':        'Game day in the Duke City.',
  'Arts & Theater':'Great arts happening in the 505.',
  'Food & Drink':  'Something delicious coming to Albuquerque.',
  'Comedy':        'A wonderful night of laughs in the 505.',
  'Community':     'Your Albuquerque community coming together.',
  'Family':        'A great family outing in the 505.',
  'Outdoor':       'A wonderful chance to get outside in New Mexico.',
  'Film':          'Good cinema in Albuquerque.',
  'Festivals':     'A wonderful event coming to ABQ.',
}

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T12:00:00' : dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' })
  } catch { return dateStr }
}

export function buildCaptions(event: NormalizedEvent) {
  const emoji = CAT_EMOJI[event.category ?? ''] ?? '📍'
  const catTag = CAT_TAGS[event.category ?? ''] ?? ''
  const opener = CAT_OPENERS[event.category ?? ''] ?? 'Something great happening in Albuquerque.'
  // Full tag block: category → discovery → brand anchors
  const tags = [catTag, DISCOVERY_TAGS, BASE_TAGS].filter(Boolean).join(' ')
  const venue = event.venue ?? 'Albuquerque, NM'
  const priceStr = event.price ? ` · ${event.price}` : ''
  const timeStr = event.time ? ` · ${event.time}` : ''
  const dateLabel = formatDate(event.date)
  const dayOfWeek = dateLabel.split(',')[0]

  // Standard: warm opener → event + venue → date/time → friendly CTA
  const standard = `${opener}\n\n${event.title}\n${venue}\n\n📅 ${dateLabel}${timeStr}${priceStr}\n\n🎟️ Tickets and details → link in bio\n\n${tags}`

  // Friendly: leads with the event name, clean and easy to read
  const friendly = `${emoji} ${event.title}\n\n📅 ${dateLabel}${timeStr}\n📍 ${venue}${priceStr}\n\nFind tickets and details → link in bio\n\n${tags}`

  // Spotlight: a warm weekly pick — celebrates the event without pressure
  const spotlight = `${dayOfWeek}'s pick for Albuquerque.\n\n${event.title} at ${venue} — a lovely way to spend time in the 505.\n\n📅 ${dateLabel}${timeStr}${priceStr}\n🔗 Full details and tickets → link in bio\n\n${tags}`

  // Minimal: just the essentials, clean under a strong visual
  const minimal = `${event.title}\n${dateLabel}${timeStr} · ${venue}${priceStr}\n\n🔗 link in bio\n\n${BASE_TAGS}`

  return [
    { id: 'standard',  label: 'Standard',  sublabel: 'Warm opener + details', text: standard },
    { id: 'friendly',  label: 'Friendly',  sublabel: 'Clean & easy to read',  text: friendly },
    { id: 'spotlight', label: 'Spotlight', sublabel: 'Weekly pick tone',       text: spotlight },
    { id: 'minimal',   label: 'Minimal',   sublabel: 'Caption under visuals',  text: minimal },
  ]
}

// ── PNG → JPEG conversion ─────────────────────────────────────────────────

async function pngToJpeg(pngDataUrl: string, quality = 0.93): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = pngDataUrl
  })
}

// ── Schedule helpers ──────────────────────────────────────────────────────

/** Pad a number to two digits */
function pad2(n: number) { return String(n).padStart(2, '0') }

/** Format a local YYYY-MM-DD to a date object at noon Mountain time */
function localDateAtTime(dateStr: string, hour: number, minute = 0) {
  const d = new Date(`${dateStr}T${pad2(hour)}:${pad2(minute)}:00`)
  return isNaN(d.getTime()) ? null : d
}

/** Produce YYYY-MM-DD from a Date */
function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Produce HH:MM from a Date */
function toTimeInput(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

interface SchedulePreset { label: string; date: string; time: string }

function getSchedulePresets(event: NormalizedEvent): SchedulePreset[] {
  const now     = new Date()
  const today   = toDateInput(now)
  const presets: SchedulePreset[] = []

  // Tomorrow shortcuts
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = toDateInput(tomorrow)
  presets.push({ label: 'Tomorrow 9am',  date: tomorrowStr, time: '09:00' })
  presets.push({ label: 'Tomorrow noon', date: tomorrowStr, time: '12:00' })
  presets.push({ label: 'Tomorrow 6pm',  date: tomorrowStr, time: '18:00' })

  // Day before the event (if event is in the future)
  const eventDateStr = /^\d{4}-\d{2}-\d{2}/.test(event.date ?? '')
    ? event.date!.slice(0, 10)
    : null
  if (eventDateStr && eventDateStr > today) {
    const eventDate = new Date(eventDateStr + 'T12:00:00')
    const dayBefore = new Date(eventDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const dayBeforeStr = toDateInput(dayBefore)
    if (dayBeforeStr > today) {
      presets.push({ label: 'Day before · noon', date: dayBeforeStr, time: '12:00' })
      presets.push({ label: 'Day before · 6pm',  date: dayBeforeStr, time: '18:00' })
    }
    // Event day morning
    if (eventDateStr > tomorrowStr) {
      presets.push({ label: 'Event day · 9am', date: eventDateStr, time: '09:00' })
    }
  }

  // Upcoming Friday / Saturday (skip if already today or tomorrow)
  for (let offset = 2; offset <= 8; offset++) {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    const dow = d.getDay()
    if (dow === 5) {
      presets.push({ label: 'Fri 6pm', date: toDateInput(d), time: '18:00' })
      break
    }
  }
  for (let offset = 2; offset <= 9; offset++) {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    if (d.getDay() === 6) {
      presets.push({ label: 'Sat noon', date: toDateInput(d), time: '12:00' })
      break
    }
  }

  // Deduplicate by date+time, remove past presets
  const now16 = `${today}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  return presets.filter((p, i, arr) => {
    const val = `${p.date}T${p.time}`
    return val > now16 && arr.findIndex(q => q.date === p.date && q.time === p.time) === i
  })
}

function formatScheduledFor(dateStr: string, timeStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(`${dateStr}T${timeStr}:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch { return '' }
}

// ── SchedulePanel component ──────────────────────────────────────────────────

interface SchedulePanelProps {
  event: NormalizedEvent
  scheduleDate: string
  scheduleTime: string
  scheduleDateTime: string
  scheduleState: 'idle' | 'submitting' | 'done' | 'error'
  scheduleError: string | null
  isScheduling: boolean
  onDateChange: (v: string) => void
  onTimeChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function SchedulePanel({
  event, scheduleDate, scheduleTime, scheduleDateTime,
  scheduleState, scheduleError, isScheduling,
  onDateChange, onTimeChange, onConfirm, onCancel,
}: SchedulePanelProps) {
  const presets       = getSchedulePresets(event)
  const todayStr      = toDateInput(new Date())
  const humanReadable = formatScheduledFor(scheduleDate, scheduleTime)

  const applyPreset = (p: SchedulePreset) => {
    onDateChange(p.date)
    onTimeChange(p.time)
  }

  const isPresetActive = (p: SchedulePreset) => scheduleDate === p.date && scheduleTime === p.time

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Schedule Post</p>
        <button
          onClick={onCancel}
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Quick presets */}
      {presets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Quick pick</p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button
                key={`${p.date}-${p.time}`}
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                  isPresetActive(p)
                    ? 'bg-[#9a442d] text-white'
                    : 'bg-white/[0.07] text-white/60 hover:bg-white/[0.12] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date + time inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Date</label>
          <input
            type="date"
            value={scheduleDate}
            onChange={e => onDateChange(e.target.value)}
            min={todayStr}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/90
              focus:outline-none focus:border-[#9a442d]/60 transition-colors
              [color-scheme:dark]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Time</label>
          <input
            type="time"
            value={scheduleTime}
            onChange={e => onTimeChange(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/90
              focus:outline-none focus:border-[#9a442d]/60 transition-colors
              [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Human-readable preview */}
      {humanReadable && (
        <p className="text-[11px] text-[#9a442d]/80 font-semibold flex items-center gap-1.5">
          <Calendar size={11} />
          {humanReadable}
        </p>
      )}

      {/* Confirm + error */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={onConfirm}
          disabled={!scheduleDateTime || isScheduling}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#9a442d] hover:opacity-90 disabled:opacity-40 rounded-lg text-xs font-bold text-white transition-opacity"
        >
          {isScheduling
            ? <><Loader2 size={12} className="animate-spin" /> Scheduling…</>
            : <><Clock size={12} /> Confirm Schedule</>}
        </button>
      </div>

      {scheduleState === 'error' && scheduleError && (
        <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">{scheduleError}</p>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────

type PostState = 'idle' | 'exporting' | 'posting' | 'done' | 'error'
type MediaType = 'FEED' | 'STORIES' | 'CAROUSEL'

interface Caption { id: string; label: string; sublabel: string; text: string }
interface VenueResult { id: string; name: string; address: string }

interface Props {
  event: NormalizedEvent
  canvasRef: React.MutableRefObject<PostCanvasHandle | null>
}

export function CaptionBuilder({ event, canvasRef }: Props) {
  const { design } = useEditor()
  const isCarousel = design.slides.length > 1

  const staticCaptions = buildCaptions(event)
  const [captions, setCaptions] = useState<Caption[]>(staticCaptions)
  const [activeId, setActiveId] = useState('standard')
  const [text, setText] = useState(staticCaptions[0].text)

  // Reset captions + text whenever a new event is picked
  useEffect(() => {
    const fresh = buildCaptions(event)
    setCaptions(fresh)
    setActiveId('standard')
    setText(fresh[0].text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])
  const [copied, setCopied] = useState(false)
  const [postState, setPostState] = useState<PostState>('idle')
  const [postId, setPostId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>('FEED')

  // AI caption state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Venue / location-tag state
  const [venueQuery, setVenueQuery]     = useState('')
  const [venueResults, setVenueResults] = useState<VenueResult[]>([])
  const [venueLoading, setVenueLoading] = useState(false)
  const [venueId, setVenueId]           = useState<string | null>(null)
  const [venueName, setVenueName]       = useState('')
  const venueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (venueTimerRef.current) clearTimeout(venueTimerRef.current)
    const q = venueQuery.trim()
    if (!q || q.length < 2) { setVenueResults([]); return }
    venueTimerRef.current = setTimeout(async () => {
      setVenueLoading(true)
      try {
        const res = await fetch(`/api/admin/ig/venues?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setVenueResults(Array.isArray(data) ? data : [])
      } catch { setVenueResults([]) }
      finally { setVenueLoading(false) }
    }, 400)
    return () => { if (venueTimerRef.current) clearTimeout(venueTimerRef.current) }
  }, [venueQuery])

  const clearVenue = () => { setVenueId(null); setVenueName(''); setVenueQuery(''); setVenueResults([]) }
  const selectVenue = (v: VenueResult) => {
    setVenueId(v.id); setVenueName(v.name)
    setVenueQuery(''); setVenueResults([])
  }

  // Schedule state
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('12:00')
  const [scheduleState, setScheduleState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Combined ISO string from separate date + time inputs
  const scheduleDateTime = scheduleDate ? `${scheduleDate}T${scheduleTime}` : ''

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const effectiveMediaType: MediaType = isCarousel ? 'CAROUSEL' : mediaType

  const selectStyle = (id: string) => {
    const c = captions.find(c => c.id === id)
    if (!c) return
    setActiveId(id)
    setText(c.text)
    setPostState('idle')
    setErrorMsg(null)
    setPostId(null)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // ── AI caption generation ──────────────────────────────────────────
  const generateAICaptions = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/admin/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            title: event.title,
            date: event.date ? formatDate(event.date) : undefined,
            time: event.time,
            venue: event.venue,
            category: event.category,
            about: event.about ?? undefined,
            price: event.price,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAiError(data.error ?? 'AI generation failed')
        return
      }
      const newCaptions: Caption[] = data.captions
      setCaptions(newCaptions)
      const first = newCaptions[0]
      if (first) {
        setActiveId(first.id)
        setText(first.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Publish to Instagram ───────────────────────────────────────────
  const postToInstagram = async () => {
    if (!canvasRef.current) {
      setErrorMsg('Canvas not ready.')
      setPostState('error')
      return
    }
    if (effectiveMediaType === 'FEED' && !text.trim()) {
      setErrorMsg('Caption is empty.')
      setPostState('error')
      return
    }

    setPostState('exporting')
    setErrorMsg(null)
    setPostId(null)

    let capturedJpeg: string | null = null

    try {
      let payload: Record<string, unknown>

      if (isCarousel) {
        const pngs = await canvasRef.current.exportAllSlides()
        const jpegs = await Promise.all(pngs.map(p => pngToJpeg(p)))
        payload = { imageDataUrls: jpegs, caption: text, mediaType: 'CAROUSEL', eventId: event.id }
      } else {
        const png = await canvasRef.current.exportPng()
        const jpeg = await pngToJpeg(png)
        capturedJpeg = jpeg
        payload = {
          imageDataUrl: jpeg, caption: text, mediaType, eventId: event.id,
          ...(venueId ? { location_id: venueId } : {}),
        }
      }

      setPostState('posting')
      const res = await fetch('/api/admin/ig/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? `Server error ${res.status}`)
        setPostState('error')
        return
      }

      setPostId(data.postId)
      setPostState('done')

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPostState('error')
    }
  }

  // ── Schedule post ──────────────────────────────────────────────────
  const schedulePost = async () => {
    if (!canvasRef.current || !scheduleDateTime) return
    setScheduleState('submitting')
    setScheduleError(null)
    try {
      const scheduledFor = new Date(scheduleDateTime).toISOString()
      let schedulePayload: Record<string, unknown>

      if (isCarousel) {
        const pngs = await canvasRef.current.exportAllSlides()
        const jpegs = await Promise.all(pngs.map(p => pngToJpeg(p)))
        schedulePayload = {
          imageDataUrls: jpegs, caption: text, mediaType: 'CAROUSEL',
          scheduledFor, eventId: event.id,
        }
      } else {
        const png  = await canvasRef.current.exportPng()
        const jpeg = await pngToJpeg(png)
        schedulePayload = {
          imageDataUrl: jpeg, caption: text, mediaType: 'FEED',
          scheduledFor, eventId: event.id,
          ...(venueId ? { location_id: venueId } : {}),
        }
      }

      const res = await fetch('/api/admin/ig/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulePayload),
        // Safety timeout — prevents infinite spinner if Supabase upload hangs
        signal: AbortSignal.timeout(90_000),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setScheduleError(data.error ?? 'Schedule failed')
        setScheduleState('error')
        return
      }
      setScheduleState('done')
      setShowSchedule(false)
      // Auto-clear the success badge after 4s so the Schedule button comes back
      setTimeout(() => setScheduleState('idle'), 4000)
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unknown error')
      setScheduleState('error')
    }
  }

  const isPosting = postState === 'exporting' || postState === 'posting'
  const isScheduling = scheduleState === 'submitting'

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Caption & Post</p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {isCarousel
              ? `${design.slides.length} slides → carousel post`
              : 'Edit your caption, then post directly to @abqunplugged.'}
          </p>
        </div>

        {/* Feed / Story toggle (hidden for carousel) */}
        {!isCarousel && (
          <div className="flex rounded-lg overflow-hidden border border-white/[0.1] flex-shrink-0">
            {(['FEED', 'STORIES'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setMediaType(type); setPostState('idle'); setErrorMsg(null); setPostId(null) }}
                className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  mediaType === type
                    ? 'bg-white/[0.12] text-white'
                    : 'bg-transparent text-white/40 hover:text-white/70'
                }`}
              >
                {type === 'FEED' ? 'Feed' : 'Story'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carousel notice */}
      {isCarousel && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-[11px] text-purple-300">
          Multi-slide design detected — will publish as a Carousel post ({design.slides.length} images).
        </div>
      )}

      {/* Story notice */}
      {!isCarousel && mediaType === 'STORIES' && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/50">
          Stories don&apos;t show captions — use the 9:16 canvas format for best results.
        </div>
      )}

      {/* Venue / location tag — feed posts only */}
      {!isCarousel && mediaType !== 'STORIES' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <MapPin size={10} />Location Tag <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span>
            </p>
            {venueId && (
              <button onClick={clearVenue} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">Clear</button>
            )}
          </div>
          {venueId ? (
            <div className="flex items-center gap-2 bg-white/[0.06] border border-[#9a442d]/25 rounded-lg px-3 py-2">
              <MapPin size={11} className="text-[#9a442d] shrink-0" />
              <span className="text-xs text-white/80 flex-1 truncate">{venueName}</span>
              <button onClick={clearVenue} className="text-white/30 hover:text-white/70 transition-colors ml-1">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                {venueLoading ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
              </div>
              <input
                value={venueQuery}
                onChange={e => setVenueQuery(e.target.value)}
                placeholder="Search venues to tag…"
                disabled={isPosting || isScheduling}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-8 pr-3 py-2 text-xs text-white
                  placeholder:text-white/25 focus:outline-none focus:border-[#9a442d]/50 focus:bg-white/[0.07]
                  transition-all disabled:opacity-40"
              />
              {venueResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1614] border border-white/[0.1] rounded-lg overflow-hidden z-20 shadow-2xl">
                  {venueResults.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => selectVenue(v)}
                      className={`w-full flex flex-col text-left px-3 py-2.5 hover:bg-white/[0.06] active:bg-[#9a442d]/10 transition-colors ${
                        i > 0 ? 'border-t border-white/[0.04]' : ''
                      }`}
                    >
                      <span className="text-xs font-semibold text-white/85">{v.name}</span>
                      {v.address && <span className="text-[10px] text-white/40 mt-0.5">{v.address}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Style picker + AI button */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {captions.map(c => (
          <button
            key={c.id}
            onClick={() => selectStyle(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors touch-manipulation ${
              activeId === c.id
                ? 'bg-[#9a442d] text-white'
                : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white'
            }`}
          >
            {c.label}
            <span className="hidden sm:inline text-[10px] font-normal opacity-60 ml-1">· {c.sublabel}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={generateAICaptions}
          disabled={aiLoading}
          title="Generate captions with AI"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40 transition-colors touch-manipulation"
        >
          {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {aiLoading ? 'Generating…' : 'AI'}
        </button>
      </div>

      {aiError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5 text-[11px] text-red-300">{aiError}</div>
      )}

      {/* Editable caption textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={10}
        className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2.5 text-white/85 text-[12px] leading-relaxed font-mono resize-y focus:outline-none focus:border-[#9a442d]/60 transition-colors"
        placeholder="Your caption…"
        disabled={isPosting || isScheduling}
      />

      {/* Char count + @mention tip */}
      <div className="flex items-center justify-between -mt-1">
        <p className="text-[10px] text-white/25">
          Tip: use <span className="font-mono">@username</span> to tag accounts · <span className="font-mono">#hashtag</span> to add topics
        </p>
        <p className={`text-[10px] ${text.length > 2200 ? 'text-red-400' : 'text-white/30'}`}>
          {text.length} / 2,200
        </p>
      </div>

      {/* Schedule panel */}
      {showSchedule && (
        <SchedulePanel
          event={event}
          scheduleDate={scheduleDate}
          scheduleTime={scheduleTime}
          scheduleDateTime={scheduleDateTime}
          scheduleState={scheduleState}
          scheduleError={scheduleError}
          isScheduling={isScheduling}
          onDateChange={setScheduleDate}
          onTimeChange={setScheduleTime}
          onConfirm={schedulePost}
          onCancel={() => { setShowSchedule(false); setScheduleState('idle'); setScheduleError(null) }}
        />
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            copied ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white'
          }`}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>

        {/* Schedule toggle */}
        {!showSchedule && scheduleState !== 'done' && (
          <button
            onClick={() => setShowSchedule(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            <Calendar size={12} /> Schedule
          </button>
        )}

        {scheduleState === 'done' && (
          <span className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
            <Check size={12} /> Queued!
          </span>
        )}

        <div className="flex-1" />

        {/* Post to Instagram */}
        {postState !== 'done' && (
          <button
            onClick={postToInstagram}
            disabled={isPosting || (effectiveMediaType === 'FEED' && !text.trim())}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 active:opacity-75 disabled:opacity-40 rounded-lg text-xs font-bold text-white transition-opacity touch-manipulation"
          >
            {isPosting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {postState === 'exporting' ? 'Exporting…' : 'Posting…'}
              </>
            ) : (
              <>
                <Send size={13} />
                {effectiveMediaType === 'CAROUSEL' ? 'Post Carousel'
                  : effectiveMediaType === 'STORIES' ? 'Post Story'
                  : 'Post to Instagram'}
              </>
            )}
          </button>
        )}

        {/* Success state */}
        {postState === 'done' && postId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400 font-semibold">
              {effectiveMediaType === 'STORIES' ? '✓ Story posted!'
                : effectiveMediaType === 'CAROUSEL' ? '✓ Carousel posted!'
                : '✓ Posted!'}
            </span>
            {effectiveMediaType === 'STORIES' ? (
              <a href="https://www.instagram.com/stories/abqunplugged/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.07] hover:bg-white/[0.12] rounded text-xs text-white/70 hover:text-white transition-colors">
                <ExternalLink size={11} /> View Stories
              </a>
            ) : (
              <a href={`https://www.instagram.com/p/${postId}/`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.07] hover:bg-white/[0.12] rounded text-xs text-white/70 hover:text-white transition-colors">
                <ExternalLink size={11} /> View on IG
              </a>
            )}
            <button onClick={() => { setPostState('idle'); setPostId(null) }}
              className="text-xs text-white/40 hover:text-white/60 transition-colors">
              Post another
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {postState === 'error' && errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

    </div>
  )
}
