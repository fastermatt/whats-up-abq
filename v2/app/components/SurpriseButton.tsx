'use client'

/**
 * SurpriseButton — terra-colored icon square that sends the user to a random event.
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
      title="Surprise Me"
      className={[
        'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
        'bg-[#9a442d] text-white',
        'hover:bg-[#7d3725] active:scale-95',
        'transition-all duration-200',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
        'disabled:opacity-70 disabled:cursor-wait shadow-sm',
      ].join(' ')}
    >
      <Shuffle
        className={['w-3.5 h-3.5', loading ? 'animate-spin' : ''].join(' ')}
        aria-hidden
      />
    </button>
  )
}
