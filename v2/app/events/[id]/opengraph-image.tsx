import { ImageResponse } from 'next/og'
import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'

// Next.js auto-discovers this file and uses its output as the OG image for
// /events/[id]. Replaces the previous "raw event photo" OG image — now every
// shared link gets a branded card with title, date, venue, and ABQ Unplugged
// chrome. This is the single biggest viral-loop lever for the site.

export const runtime = 'edge'
export const alt = 'ABQ Unplugged event'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props { params: Promise<{ id: string }> }

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  // Strip any timezone — render in MT regardless
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Denver',
  })
}

export default async function OG({ params }: Props) {
  const { id } = await params
  const event = await fetchEventById(id).catch(() => null)

  const title = event?.title ?? 'ABQ Unplugged'
  const venue = event?.venue ?? 'Albuquerque, NM'
  const dateLabel = formatDate(event?.date ?? null)
  const time = event?.time ?? ''
  const category = event?.category ?? ''
  const bg = event?.imageUrl ?? getCategoryFallback(event?.category ?? undefined, id)

  // Brand tokens (cream / terra / sage / dark)
  const TERRA = '#9a442d'
  const CREAM = '#fbf7f1'
  const DARK  = '#1a1614'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'sans-serif',
          background: DARK,
        }}
      >
        {/* Hero image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bg}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {/* Dark gradient overlay for text legibility */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 50%, rgba(26,22,20,0.92) 100%)',
          }}
        />

        {/* Top strip — brand chip */}
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
            background: CREAM,
            color: TERRA,
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          ABQ Unplugged
        </div>

        {category ? (
          <div
            style={{
              position: 'absolute',
              top: 36,
              right: 36,
              padding: '10px 18px',
              background: TERRA,
              color: 'white',
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {category}
          </div>
        ) : null}

        {/* Bottom content */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '0 56px 50px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {dateLabel ? (
            <div
              style={{
                color: '#ffd9c8',
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {dateLabel}{time ? ` · ${time}` : ''}
            </div>
          ) : null}
          <div
            style={{
              color: 'white',
              fontSize: title.length > 60 ? 60 : 76,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 1080,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            {title.length > 110 ? `${title.slice(0, 110)}…` : title}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: 30,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: TERRA,
                display: 'flex',
              }}
            />
            {venue}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
