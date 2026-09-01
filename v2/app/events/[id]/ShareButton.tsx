'use client'

import { Share2, Check } from 'lucide-react'
import { useState, useCallback } from 'react'
import { trackEvent } from '@/lib/analytics/track'

export default function ShareButton({ title, eventId }: { title: string; eventId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = window.location.href

    // Use native share on mobile if available
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        trackEvent('share_click', { event_id: eventId, method: 'native' })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      trackEvent('share_click', { event_id: eventId, method: 'clipboard' })
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [eventId, title])

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand-mid text-sm font-medium text-ink-mid hover:border-terra hover:text-terra transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share
        </>
      )}
    </button>
  )
}
