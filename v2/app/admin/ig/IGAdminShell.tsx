'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { NormalizedEvent } from '@/lib/events'
import { IGCardClient } from '@/app/components/IGCard'
import { QuickPostInput } from '@/app/admin/ig-captions/QuickPostInput'

// ── Caption helpers ────────────────────────────────────────────────────────

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

function buildCaptions(event: NormalizedEvent) {
  const emoji = CAT_EMOJI[event.category ?? ''] ?? '📍'
  const catTag = CAT_TAGS[event.category ?? ''] ?? ''
  const tags = catTag ? `${catTag} ${BASE_TAGS}` : BASE_TAGS
  const venue = event.venue ?? 'Albuquerque, NM'
  const priceStr = event.price ? ` · ${event.price}` : ''
  const timeStr = event.time ? ` · ${event.time}` : ''

  // Format date nicely
  let dateLabel = event.date
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date + 'T12:00:00' : event.date)
    dateLabel = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver',
    })
  } catch { /* leave as-is */ }

  const standard = `${emoji} ${event.title}

📅 ${dateLabel}${timeStr}
📍 ${venue}${priceStr}

Find tickets and full details at abqunplugged.com ↗

${tags}`

  const hype = `🔥 DON'T MISS THIS ${(event.category ?? 'EVENT').toUpperCase()} 🔥

${event.title.toUpperCase()}

${dateLabel}${timeStr}
${venue}${priceStr}

Get your tickets NOW → abqunplugged.com

${tags}`

  const spotlight = `✨ Event Spotlight

${event.title}

${emoji} ${event.category ?? 'Local Event'}
📅 ${dateLabel}${timeStr}
📍 ${venue}${priceStr}

Tap the link in bio for tickets and details.

${tags}`

  const minimal = `${event.title}
${dateLabel} · ${venue}
abqunplugged.com

${tags}`

  return [
    { id: 'standard',  label: 'Standard',  sublabel: 'Clean and informative', text: standard },
    { id: 'hype',      label: 'Hype',      sublabel: 'High energy, FOMO-driving', text: hype },
    { id: 'spotlight', label: 'Spotlight', sublabel: 'Curated editorial tone', text: spotlight },
    { id: 'minimal',   label: 'Minimal',   sublabel: 'Short and punchy', text: minimal },
  ]
}

// ── Source badge ──────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: 'Ticketmaster',
  seatgeek: 'SeatGeek',
  eventbrite: 'Eventbrite',
  local: 'Local',
  volunteer: 'Volunteer',
  nhcc: 'NHCC',
}

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/[0.08] text-white/50 border border-white/[0.1]">
      {label}
    </span>
  )
}

// ── CopyButton ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the text
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0
        ${copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-white/[0.07] text-white/50 hover:bg-white/[0.12] hover:text-white border border-white/[0.08]'
        }
      `}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ── CaptionCard ───────────────────────────────────────────────────────────

function CaptionCard({ label, sublabel, text }: { label: string; sublabel: string; text: string }) {
  return (
    <div className="bg-white/[0.05] rounded-xl p-4 space-y-3 border border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-[11px] text-white/35 mt-0.5">{sublabel}</p>
        </div>
        <CopyButton text={text} />
      </div>
      <textarea
        readOnly
        value={text}
        rows={6}
        className="w-full bg-black/20 border border-white/[0.07] rounded-lg px-3 py-2.5
          text-white/70 text-xs font-mono leading-relaxed resize-none focus:outline-none
          scrollbar-thin"
      />
    </div>
  )
}

// ── EventInfoBar ──────────────────────────────────────────────────────────

function EventInfoBar({ event }: { event: NormalizedEvent }) {
  const emoji = CAT_EMOJI[event.category ?? ''] ?? '📍'
  let dateLabel = event.date
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date + 'T12:00:00' : event.date)
    dateLabel = d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
    })
  } catch { /* leave as-is */ }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-lg">{emoji}</span>
      <span className="font-bold text-white text-sm truncate max-w-[280px]" title={event.title}>
        {event.title}
      </span>
      <span className="text-white/30 text-xs">·</span>
      <span className="text-white/50 text-xs">{dateLabel}</span>
      {event.time && (
        <>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/50 text-xs">{event.time}</span>
        </>
      )}
      {event.venue && (
        <>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/40 text-xs truncate max-w-[180px]">{event.venue}</span>
        </>
      )}
      <span className="text-white/30 text-xs">·</span>
      <SourceBadge source={event.source} />
    </div>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────

interface ShellProps {
  event: NormalizedEvent | null
  image: string
  eventId: string | null
}

export function IGAdminShell({ event, image, eventId: _eventId }: ShellProps) {
  const captions = event ? buildCaptions(event) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-black text-white"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Instagram Post Studio
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {event ? 'Design and download posts, then copy a caption below.' : 'Paste an event URL to load the designer.'}
        </p>
      </div>

      {/* Quick input — always visible so user can switch events */}
      <QuickPostInput />

      {/* No event loaded — empty state */}
      {!event && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="text-6xl opacity-30">📸</div>
          <div>
            <p className="text-white/40 text-sm font-medium">No event loaded yet</p>
            <p className="text-white/25 text-xs mt-1 max-w-xs">
              Paste an event URL or ID above — the card designer and caption panel will appear here.
            </p>
          </div>
          <div className="mt-4 bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-left space-y-1.5 w-full max-w-sm">
            <p className="text-white/30 text-[11px] uppercase tracking-widest font-semibold mb-2">Accepted formats</p>
            <p className="text-white/40 text-xs font-mono">https://abqunplugged.com/events/ticketmaster_G5vzZ_…</p>
            <p className="text-white/40 text-xs font-mono">/events/abqtodo-522369</p>
            <p className="text-white/40 text-xs font-mono">ticketmaster_G5vzZ_eJiK65t</p>
          </div>
        </div>
      )}

      {/* Event loaded — designer + captions */}
      {event && (
        <div className="space-y-5">
          {/* Event info bar */}
          <EventInfoBar event={event} />

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT — card designer (fixed width) */}
            <div
              className="w-full lg:w-[440px] shrink-0 bg-[#0d0d0d] rounded-2xl overflow-hidden border border-white/[0.07]"
            >
              <IGCardClient event={event} image={image} embedded={true} />
            </div>

            {/* RIGHT — caption panel */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Captions</p>
                <p className="text-[11px] text-white/30">
                  4 styles ready to copy. Paste into Instagram after downloading your card.
                </p>
              </div>
              {captions.map(c => (
                <CaptionCard key={c.id} label={c.label} sublabel={c.sublabel} text={c.text} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
