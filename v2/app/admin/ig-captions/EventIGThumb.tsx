'use client'

/**
 * EventIGThumb — shows a proxied event image thumbnail
 * with quick-access links to all three card designer formats.
 */

import { ExternalLink } from 'lucide-react'

interface Props {
  eventId: string
  title: string
  imageUrl: string | null
}

export function EventIGThumb({ eventId, title, imageUrl }: Props) {
  const proxied = imageUrl?.startsWith('http')
    ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl ?? null

  const formats = [
    { label: '1:1', href: `/events/${eventId}/ig`,  title: 'Square (1:1)' },
    { label: '4:5', href: `/events/${eventId}/ig2`, title: 'Portrait (4:5)' },
    { label: '9:16',href: `/events/${eventId}/ig3`, title: 'Story (9:16)' },
  ]

  return (
    <div className="flex items-start gap-4 mb-4">
      {/* Thumbnail */}
      <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.07]">
        {proxied ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxied}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🌵</div>
        )}
      </div>

      {/* Format links */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/40 mb-0.5">Open in Card Designer to download:</p>
        {formats.map(({ label, href, title: fmt }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-[#9a442d]/20 text-[#e8a898] hover:bg-[#9a442d] hover:text-white
              border border-[#9a442d]/30 hover:border-[#9a442d]
              transition-all active:scale-95"
          >
            <ExternalLink size={11} />
            {fmt}
            <span className="text-[10px] opacity-60">({label})</span>
          </a>
        ))}
      </div>
    </div>
  )
}
