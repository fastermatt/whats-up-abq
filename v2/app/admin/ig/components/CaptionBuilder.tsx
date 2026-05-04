'use client'

import { useRef, useState } from 'react'
import { Copy, Check, Send, Loader2, ExternalLink } from 'lucide-react'
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

// ── PNG → JPEG conversion (client-side, no server dep) ───────────────────

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

interface Props {
  event: NormalizedEvent
  canvasRef: React.MutableRefObject<PostCanvasHandle | null>
}

export function CaptionBuilder({ event, canvasRef }: Props) {
  const captions = buildCaptions(event)
  const [activeId, setActiveId] = useState('standard')
  const [text, setText] = useState(captions[0].text)
  const [copied, setCopied] = useState(false)
  const [postState, setPostState] = useState<PostState>('idle')
  const [postId, setPostId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const postToInstagram = async () => {
    if (!canvasRef.current) {
      setErrorMsg('Canvas not ready — wait for it to load.')
      setPostState('error')
      return
    }
    if (!text.trim()) {
      setErrorMsg('Caption is empty.')
      setPostState('error')
      return
    }

    setPostState('exporting')
    setErrorMsg(null)
    setPostId(null)

    try {
      // 1. Export canvas as PNG (2× resolution from Konva)
      const pngDataUrl = await canvasRef.current.exportPng()

      // 2. Convert PNG → JPEG client-side (Instagram requires JPEG)
      const jpegDataUrl = await pngToJpeg(pngDataUrl)

      // 3. Send to server API route
      setPostState('posting')
      const res = await fetch('/api/admin/ig/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: jpegDataUrl, caption: text }),
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

  const isPosting = postState === 'exporting' || postState === 'posting'

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Caption & Post</p>
        <p className="text-[10px] text-white/30 mt-0.5">Edit your caption, then post directly to @abqunplugged.</p>
      </div>

      {/* Style picker */}
      <div className="flex gap-1.5 flex-wrap">
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
      </div>

      {/* Editable caption textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={10}
        className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2.5 text-white/85 text-[12px] leading-relaxed font-mono resize-y focus:outline-none focus:border-[#9a442d]/60 transition-colors"
        placeholder="Your caption…"
        disabled={isPosting}
      />

      {/* Char count */}
      <p className={`text-[10px] text-right -mt-1 ${text.length > 2200 ? 'text-red-400' : 'text-white/30'}`}>
        {text.length} / 2,200 chars
      </p>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Copy */}
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            copied
              ? 'bg-green-500/20 text-green-400'
              : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white'
          }`}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>

        <div className="flex-1" />

        {/* Post to Instagram */}
        {postState !== 'done' && (
          <button
            onClick={postToInstagram}
            disabled={isPosting || !text.trim()}
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
                Post to Instagram
              </>
            )}
          </button>
        )}

        {/* Success state */}
        {postState === 'done' && postId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400 font-semibold">✓ Posted!</span>
            <a
              href={`https://www.instagram.com/p/${postId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.07] hover:bg-white/[0.12] rounded text-xs text-white/70 hover:text-white transition-colors"
            >
              <ExternalLink size={11} /> View on IG
            </a>
            <button
              onClick={() => { setPostState('idle'); setPostId(null) }}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
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
