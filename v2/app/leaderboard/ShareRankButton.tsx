'use client'

export function ShareRankButton({ rank }: { rank: number }) {
  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'ABQ Unplugged',
        text: `I'm ranked #${rank} on ABQ Unplugged — Albuquerque's event guide. 🎯`,
        url: 'https://abqunplugged.com/leaderboard',
      })
    } else {
      await navigator.clipboard.writeText('https://abqunplugged.com/leaderboard')
      alert('Link copied!')
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
