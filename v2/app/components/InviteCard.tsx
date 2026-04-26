'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, Share2 } from 'lucide-react'

interface Props {
  eventId:    string
  eventTitle: string
  eventDate:  string | null
  venue:      string | null
}

/**
 * "Who would love this?" — the invite card.
 *
 * Research backbone: implementation intentions (Gollwitzer, 1999) roughly
 * double follow-through on plans when people specify when / where / with whom.
 * We can't ask "with whom," but we can remove all friction from the social
 * version of the action — so the card sits below the core CTAs, never
 * blocks anything, and offers a prewritten invite one tap away.
 *
 * Language is deliberate: "Who would love this?" (an affirming nudge)
 * instead of "Invite someone" (an instruction).
 */
export function InviteCard({ eventId, eventTitle, eventDate, venue }: Props) {
  const [copied, setCopied] = useState(false)

  // Build a clean, natural invite message
  const url     = `https://abqunplugged.com/events/${eventId}`
  const whenStr = eventDate ? formatDate(eventDate) : null
  const venueStr = venue ? ` at ${venue}` : ''
  const whenPiece = whenStr ? ` ${whenStr}` : ''
  const message = `Want to come to ${eventTitle} with me?${whenPiece}${venueStr}.\n${url}`

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // fall back: select a hidden textarea (not strictly needed on modern browsers)
    }
  }

  async function nativeShare() {
    if (!navigator.share) { copyInvite(); return }
    try {
      await navigator.share({
        title: eventTitle,
        text: message,
        url,
      })
    } catch {
      // user cancelled — no-op
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="mb-6 rounded-2xl border border-[#f0e4cc] bg-gradient-to-br from-white to-[#faf4eb] px-4 py-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#006a62]/10 text-[#006a62] flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-bold text-sm text-[#1a1614] leading-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Who would love this?
          </p>
          <p className="text-[11px] text-[#6b5d57] mt-0.5 leading-relaxed">
            More fun with someone else. Take 10 seconds to invite them.
          </p>
          <div className="flex flex-wrap gap-2 mt-2.5">
            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#006a62] text-white text-xs font-semibold hover:bg-[#005249] transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            )}
            <button
              onClick={copyInvite}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                copied
                  ? 'bg-green-100 text-green-800'
                  : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
              }`}
            >
              {copied
                ? <><Check className="w-3.5 h-3.5" /> Copied — paste it in a text</>
                : <><Copy className="w-3.5 h-3.5" /> Copy invite message</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(s: string): string {
  // s can be "YYYY-MM-DD" or ISO with time
  const hasTime = /T\d/.test(s)
  const d = new Date(hasTime ? s : `${s}T12:00:00`)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
