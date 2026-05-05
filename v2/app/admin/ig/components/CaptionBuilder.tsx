'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Send, Loader2, ExternalLink, Sparkles, Calendar, Clock, MapPin, Search, X } from 'lucide-react'
import { useEditor } from '../store'
import type { NormalizedEvent } from '@/lib/events'
import type { PostCanvasHandle } from './PostCanvas'

// ── Caption generation ────────────────────────────────────────────────────

const BASE_TAGS = '#ABQUnplugged #Albuquerque #ABQ #NewMexico #505'
const CAT_TAGS: Record<string, string> = {
  'Music': '#ABQMusic #LiveMusicABQ',
  'Arts & Theater': '#ABQArts #AlbuquerqueArts',
  'Sports': '#ABQSports #AlbuquerqueSports',
  'Food & Drink': '#ABQFood #AlbuquerqueEats',
  'Family': '#ABQKids #AlbuquerqueFamilies',
  'Outdoor': '#ABQOutdoors #NewMexicoOutdoors',
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
  const tags = catTag ? `${catTag} ${BASE_TAGS}` : BASE_TAGS
  const venue = event.venue ?? 'Albuquerque, NM'
  const priceStr = event.price ? ` · ${event.price}` : ''
  const timeStr = event.time ? ` · ${event.time}` : ''
  const dateLabel = formatDate(event.date)

  const standard = `${emoji} ${event.title}\n\n📅 ${dateLabel}${timeStr}\n📍 ${venue}${priceStr}\n\nFind tickets and full details at abqunplugged.com ↗\n\n${tags}`
  const hype = `🔥 DON'T MISS THIS ${(event.category ?? 'EVENT').toUpperCase()} 🔥\n\n${event.title.toUpperCase()}\n\n${dateLabel}${timeStr}\n${venue}${priceStr}\n\nGet your tickets NOW → abqunplugged.com\n\n${tags}`
  const spotlight = `✨ Event Spotlight\n\n${event.title}\n\n${emoji} ${event.category ?? 'Local Event'}\n📅 ${dateLabel}${timeStr}\n📍 ${venue}${priceStr}\n\nTap the link in bio for tickets and details.\n\n${tags}`
  const minimal = `${event.title}\n${dateLabel} · ${venue}\nabqunplugged.com\n\n${tags}`

  return [
    { id: 'standard',  label: 'Standard',  sublabel: 'Clean & informative', text: standard },
    { id: 'hype',      label: 'Hype',      sublabel: 'High energy, FOMO',   text: hype },
    { id: 'spotlight', label: 'Spotlight', sublabel: 'Editorial tone',      text: spotlight },
    { id: 'minimal',   label: 'Minimal',   sublabel: 'Short & punchy',      text: minimal },
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
  const [scheduleDateTime, setScheduleDateTime] = useState('')
  const [scheduleState, setScheduleState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [scheduleError, setScheduleError] = useState<string | null>(null)

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

    try {
      let payload: Record<string, unknown>

      if (isCarousel) {
        const pngs = await canvasRef.current.exportAllSlides()
        const jpegs = await Promise.all(pngs.map(p => pngToJpeg(p)))
        payload = { imageDataUrls: jpegs, caption: text, mediaType: 'CAROUSEL', eventId: event.id }
      } else {
        const png = await canvasRef.current.exportPng()
        const jpeg = await pngToJpeg(png)
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
      let imageDataUrls: string[]
      if (isCarousel) {
        const pngs = await canvasRef.current.exportAllSlides()
        imageDataUrls = await Promise.all(pngs.map(p => pngToJpeg(p)))
      } else {
        const png = await canvasRef.current.exportPng()
        imageDataUrls = [await pngToJpeg(png)]
      }

      const res = await fetch('/api/admin/ig/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrls,
          caption: text,
          mediaType: effectiveMediaType,
          scheduledFor: new Date(scheduleDateTime).toISOString(),
          eventId: event.id,
          ...(venueId && effectiveMediaType === 'FEED' ? { location_id: venueId } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setScheduleError(data.error ?? 'Schedule failed')
        setScheduleState('error')
        return
      }
      setScheduleState('done')
      setShowSchedule(false)
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

      {/* Char count */}
      <p className={`text-[10px] text-right -mt-1 ${text.length > 2200 ? 'text-red-400' : 'text-white/30'}`}>
        {text.length} / 2,200 chars
      </p>

      {/* Schedule panel */}
      {showSchedule && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Schedule Post</p>
          <input
            type="datetime-local"
            value={scheduleDateTime}
            onChange={e => setScheduleDateTime(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white/90 focus:outline-none focus:border-[#9a442d]"
          />
          <div className="flex gap-2">
            <button
              onClick={schedulePost}
              disabled={!scheduleDateTime || isScheduling}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9a442d] hover:opacity-90 disabled:opacity-40 rounded text-xs font-bold text-white transition-opacity"
            >
              {isScheduling ? <><Loader2 size={12} className="animate-spin" /> Scheduling…</> : <><Clock size={12} /> Confirm Schedule</>}
            </button>
            <button onClick={() => { setShowSchedule(false); setScheduleState('idle'); setScheduleError(null) }}
              className="text-xs text-white/40 hover:text-white/60">Cancel</button>
          </div>
          {scheduleState === 'error' && scheduleError && (
            <p className="text-[11px] text-red-300">{scheduleError}</p>
          )}
        </div>
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
            <Check size={12} /> Scheduled!
            <button onClick={() => setScheduleState('idle')} className="text-white/40 hover:text-white/60 ml-1">×</button>
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
