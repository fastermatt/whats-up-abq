'use client'

import { trackEvent } from '@/lib/analytics/track'

export function ShareRankButton({ rank }: { rank: number }) {
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ABQ Unplugged',
          text: `I'm ranked #${rank} on ABQ Unplugged — Albuquerque's event guide. 🎯`,
          url: 'https://abqunplugged.com/leaderboard',
        })
        trackEvent('share_click', { source: 'leaderboard', rank, method: 'native' })
      } catch {
        // Native share cancellation is not a completed conversion.
      }
    } else {
      try {
        await navigator.clipboard.writeText('https://abqunplugged.com/leaderboard')
        trackEvent('share_click', { source: 'leaderboard', rank, method: 'clipboard' })
        alert('Link copied!')
      } catch {
        // Clipboard unavailable; do not report a conversion.
      }
    }
  }
  return (
    <button
      onClick={share}
      className="text-xs px-3 py-1 bg-terra/10 text-terra rounded-full hover:bg-terra/20 transition-colors font-semibold"
    >
      Share rank
    </button>
  )
}
