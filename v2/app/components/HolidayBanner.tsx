'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Holiday } from '@/data/holidays'

/**
 * Sliver banner shown at the top of every page during a holiday window.
 * Dismissible per-holiday — once dismissed, it stays gone until that
 * holiday's window closes (no nag).
 *
 * Server passes a serializable subset of Holiday + the resolved date
 * so we don't ship the entire HOLIDAYS array (with date function
 * closures) to the client. The function shape is stripped server-side.
 */
export interface HolidayBannerProps {
  holidayKey: string
  name: string
  tagline: string
  subtitle?: string
  emoji: string
  bgClass?: string
  textClass?: string
  bgImage?: string  // when set, photo background with terra gradient overlay
  date: string  // 'YYYY-MM-DD'
  daysUntil: number
}

export function HolidayBanner(props: HolidayBannerProps) {
  const [dismissed, setDismissed] = useState(true)  // start hidden to prevent CLS

  useEffect(() => {
    const key = `holiday-dismissed:${props.holidayKey}:${props.date}`
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return
    setDismissed(false)
  }, [props.holidayKey, props.date])

  if (dismissed) return null

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`holiday-dismissed:${props.holidayKey}:${props.date}`, '1')
    }
    setDismissed(true)
  }

  // Tone subtle — terra background by default, single line on mobile
  const bg = props.bgClass ?? 'bg-terra'
  const text = props.textClass ?? 'text-cream'
  const dayLabel =
    props.daysUntil === 0 ? 'Today'
    : props.daysUntil === 1 ? 'Tomorrow'
    : `In ${props.daysUntil} days`

  // Background style: photo with terra gradient overlay (when image set)
  // OR solid terra (default). The gradient ensures text stays legible
  // regardless of how busy the image is.
  const bgStyle: React.CSSProperties | undefined = props.bgImage
    ? {
        backgroundImage:
          'linear-gradient(to right, rgba(154,68,45,0.92), rgba(154,68,45,0.55), rgba(154,68,45,0.92)),' +
          ` url(${JSON.stringify(props.bgImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined

  return (
    <div
      role="region"
      aria-label={`${props.name} highlight`}
      className={`${props.bgImage ? '' : bg} ${text} text-center py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold tracking-tight relative`}
      style={bgStyle}
    >
      <a
        href="#holiday-rail"
        data-umami-event="holiday-banner-click"
        data-umami-event-holiday={props.holidayKey}
        className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 hover:underline pr-7"
      >
        <span aria-hidden="true">{props.emoji}</span>
        <span>{props.tagline}</span>
        <span className="opacity-70 font-normal hidden sm:inline">·</span>
        <span className="opacity-70 font-normal text-[11px] sm:text-xs">
          {dayLabel}
          {props.subtitle ? ` · ${props.subtitle}` : ''}
        </span>
      </a>
      <button
        onClick={handleDismiss}
        aria-label={`Dismiss ${props.name} banner`}
        data-umami-event="holiday-banner-dismiss"
        data-umami-event-holiday={props.holidayKey}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
