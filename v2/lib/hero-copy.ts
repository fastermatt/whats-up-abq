/**
 * Dynamic hero copy — rotates daily, seeded by day-of-year.
 * Anchored to launch day (2026-04-17 = day 107) so index 0 = the classic
 * "What's Happening Tonight" on launch day, then count-driven copy starts
 * the following day. Consistent across all users on the same calendar day.
 */

export interface HeroCopy {
  eyebrow: string
  lines: string[] // Each string renders as one visual line in the h2
}

// Day 107 = 2026-04-17 (same anchor as hero image rotation)
const COPY_LAUNCH_DAY = 107

export function getHeroCopy(totalEvents: number): HeroCopy {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
  const offset = dayOfYear - COPY_LAUNCH_DAY

  const n = totalEvents.toLocaleString()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Denver' })
  const isWeekend = dayName === 'Saturday' || dayName === 'Sunday' || dayName === 'Friday'

  const patterns: HeroCopy[] = [
    // Index 0 — launch day: the classic (safe, familiar)
    {
      eyebrow: 'Tonight in the 505',
      lines: ["What's", 'Happening', 'Tonight'],
    },
    // Index 1 — the "reasons" hook (the one Matt remembered)
    {
      eyebrow: 'Get off the couch',
      lines: ['You have', n, 'reasons.'],
    },
    // Index 2 — direct, punchy
    {
      eyebrow: 'Albuquerque right now',
      lines: [n, 'things to do.', 'Pick one.'],
    },
    // Index 3 — no-excuses
    {
      eyebrow: 'This is your city',
      lines: [n, 'events.', 'Zero excuses.'],
    },
    // Index 4 — observational
    {
      eyebrow: 'Still inside?',
      lines: ['The city has', n, 'things going on.'],
    },
    // Index 5 — "leave the house" framing
    {
      eyebrow: 'Tonight in the 505',
      lines: [n, 'reasons to', 'leave the house.'],
    },
    // Index 6 — weekend-aware
    {
      eyebrow: isWeekend ? 'This weekend in ABQ' : 'This week in ABQ',
      lines: ['Somewhere in', `these ${n}`, 'events is yours.'],
    },
    // Index 7 — question-form
    {
      eyebrow: 'ABQ is alive',
      lines: [n, "events.", "What's your excuse?"],
    },
    // Index 8 — back to classic but with count sub-hook
    {
      eyebrow: 'Tonight in the 505',
      lines: ["What's", 'Happening', 'in ABQ'],
    },
    // Index 9 — short and commanding
    {
      eyebrow: 'Duke City tonight',
      lines: ['Go do', 'something.', `${n} options.`],
    },
  ]

  const idx = ((offset % patterns.length) + patterns.length) % patterns.length
  return patterns[idx]
}
