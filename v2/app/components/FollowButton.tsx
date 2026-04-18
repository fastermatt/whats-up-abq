'use client'

import { useState } from 'react'

interface Props {
  handle: string
  initialFollowing?: boolean
  className?: string
}

export function FollowButton({ handle, initialFollowing = false, className }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const optimistic = !following
    setFollowing(optimistic)

    try {
      const res = await fetch('/api/follow', {
        method: optimistic ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })

      if (!res.ok) {
        // Revert on error
        setFollowing(!optimistic)
      }
    } catch {
      // Revert on network error
      setFollowing(!optimistic)
    } finally {
      setLoading(false)
    }
  }

  const baseClass = className ?? ''
  const followingClass = `bg-[#f0e4cc] text-[#4a3f3a] text-xs font-semibold px-3 py-1 rounded-full hover:bg-[#e8d9bf] transition-all`
  const notFollowingClass = `border border-[#9a442d] text-[#9a442d] text-xs font-semibold px-3 py-1 rounded-full hover:bg-[#9a442d] hover:text-white transition-all`

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${following ? followingClass : notFollowingClass} ${baseClass} disabled:opacity-50`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
