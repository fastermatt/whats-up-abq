'use client'

/**
 * SurpriseButton — terra-colored pill that sends the user to a random event.
 * Client component because it uses window.location for the redirect.
 */
import { Shuffle } from 'lucide-react'
import { useState } from 'react'

export default function SurpriseButton() {
  const [loading, setLoading] = useState(false)

  function handleClick() {
    setLoading(true)
    window.location.href = '/api/surprise'
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label="Show me a random event"
      className={[
        'flex items-center gap-2 px-5 py-2.5 rounded-full',
        'bg-[#9a442d] text-white font-semibold text-sm',
        'hover:bg-[#7d3725] active:scale-95',
        'transition-all duration-200',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
        'disabled:opacity-70 disabled:cursor-wait',
        'shadow-sm hover:shadow-md hover:shadow-[#9a442d]/25',
        loading ? '' : 'animate-pulse-glow',
      ].join(' ')}
    >
      <Shuffle
        className={['w-4 h-4 flex-shrink-0', loading ? 'animate-spin' : ''].join(' ')}
        aria-hidden
      />
      {loading ? 'Finding one…' : 'Surprise Me'}
    </button>
  )
}
