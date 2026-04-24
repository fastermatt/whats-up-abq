'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { NormalizedEvent } from '@/lib/events'

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
    { id: 'standard',  label: 'Standard',  sublabel: 'Clean and informative', text: standard },
    { id: 'hype',      label: 'Hype',      sublabel: 'High energy, FOMO-driving', text: hype },
    { id: 'spotlight', label: 'Spotlight', sublabel: 'Curated editorial tone', text: spotlight },
    { id: 'minimal',   label: 'Minimal',   sublabel: 'Short and punchy', text: minimal },
  ]
}

export function CaptionCard({ label, sublabel, text }: { label: string; sublabel: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  return (
    <div className="bg-white/[0.05] rounded-xl p-4 space-y-2.5 border border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{sublabel}</p>
        </div>
        <button onClick={copy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
            copied ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.07] text-white/60 hover:bg-white/[0.12] hover:text-white'
          }`}>
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <textarea readOnly value={text} rows={5}
        className="w-full bg-black/30 border border-white/[0.07] rounded px-2.5 py-2 text-white/70 text-[11px] font-mono leading-relaxed resize-none focus:outline-none" />
    </div>
  )
}

export function CaptionBuilder({ event }: { event: NormalizedEvent }) {
  const captions = buildCaptions(event)
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl p-4">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Captions</p>
        <p className="text-[10px] text-white/30 mt-0.5">Paste into Instagram after downloading your design.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {captions.map(c => <CaptionCard key={c.id} {...c} />)}
      </div>
    </div>
  )
}
