import { Clock } from 'lucide-react'
import type { NormalizedEvent } from '@/lib/events'

/** Groups Balloon Fiesta ticket listings by date so visitors can scan
 *  "what's on which day" without scrolling through 20+ near-identical cards.
 *  Times come straight from our own ticket data (SeatGeek/Eventbrite) — we
 *  don't guess at official program names (Dawn Patrol, Mass Ascension, etc.)
 *  since we can't verify which listed time maps to which program each year. */
export function ScheduleTable({ events }: { events: NormalizedEvent[] }) {
  const byDate = new Map<string, Set<string>>()
  for (const e of events) {
    if (!e.date) continue
    const times = byDate.get(e.date) ?? new Set<string>()
    if (e.time) times.add(e.time)
    byDate.set(e.date, times)
  }
  const days = [...byDate.entries()]
    .filter(([, times]) => times.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  if (days.length === 0) return null

  return (
    <section>
      <div className="bg-white/60 border border-sand-border rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-black text-ink mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Day-by-day schedule
        </h2>
        <p className="text-sm text-ink/60 mb-4">
          Ticketed session times pulled straight from our event data, so you can plan which
          morning to go. For named programs (Dawn Patrol, Mass Ascension, Special Shapes Rodeo,
          Evening Glow), check the{' '}
          <a
            href="https://www.balloonfiesta.com/plan-your-visit/event-schedule/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-terra underline underline-offset-2"
          >
            official day-by-day schedule
          </a>{' '}
          — session names can shift year to year and we'd rather send you to the source than guess.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {days.map(([date, times]) => {
            const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
            const sortedTimes = [...times].sort((a, b) => {
              const toMinutes = (t: string) => {
                const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
                if (!m) return 0
                let h = parseInt(m[1], 10) % 12
                if (/PM/i.test(m[3])) h += 12
                return h * 60 + parseInt(m[2], 10)
              }
              return toMinutes(a) - toMinutes(b)
            })
            return (
              <div key={date} className="flex items-start gap-2 py-1.5 border-t border-sand-border/60 first:border-0 sm:[&:nth-child(2)]:border-0">
                <span className="font-bold text-ink text-sm w-24 shrink-0">{label}</span>
                <span className="flex items-center gap-1.5 flex-wrap text-sm text-ink/70">
                  <Clock className="w-3.5 h-3.5 text-terra shrink-0" />
                  {sortedTimes.join(' · ')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
