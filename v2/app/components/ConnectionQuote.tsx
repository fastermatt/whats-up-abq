import { getDailyQuote } from '@/lib/connection-quotes'

type Size = 'sm' | 'md'

/**
 * Ambient, low-pressure line of wisdom about human connection.
 * Deterministic per day \u2014 every visitor sees the same quote on the same day.
 * No citation shown. No preaching. Just a small reminder.
 */
export function ConnectionQuote({
  size = 'md',
  className = '',
}: {
  size?: Size
  className?: string
}) {
  const q = getDailyQuote()
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs'

  return (
    <p
      className={`${textSize} italic text-[#6b5d57] leading-relaxed ${className}`}
    >
      &ldquo;{q.text}&rdquo;
    </p>
  )
}
