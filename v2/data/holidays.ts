/**
 * Holiday calendar — drives the contextual banner + featured rail
 * around culturally-relevant days. Surfaces Mother's Day brunches,
 * Cinco de Mayo events, etc., a few days before the day so people
 * can actually plan.
 *
 * To add a holiday:
 *   1. Add an entry to HOLIDAYS below (in chronological order)
 *   2. Set `date(year)` to compute the date for that year
 *   3. Tune `preDays` / `postDays` for the visibility window
 *   4. Pick keywords that match real event titles in our DB —
 *      under-match is better than over-match (a Mother's Day pin
 *      on a generic brunch is wrong; missing a brunch is forgivable)
 *
 * Holidays are returned in priority order — when two windows overlap
 * (e.g. Cinco de Mayo and Mother's Day in early May), the FIRST one
 * in the array whose window is currently active wins.
 *
 * Date helpers:
 *   - fixedDate(month, day) — Jan 1 = fixedDate(1, 1)
 *   - nthWeekdayOfMonth(year, month, dow, n) — 2nd Sunday = dow=0, n=2
 *   - lastWeekdayOfMonth(year, month, dow) — last Monday of May (Memorial Day)
 *
 * Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
 */

// ─── Date helpers ─────────────────────────────────────────────────

/** Fixed-date holidays (e.g., July 4). Returns YYYY-MM-DD. */
function fixedDate(month: number, day: number) {
  return (year: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Nth occurrence of a weekday in a month, e.g., 2nd Sunday of May. */
function nthWeekdayOfMonth(month: number, dow: number, n: number) {
  return (year: number) => {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
    const firstDow = firstOfMonth.getUTCDay()
    const offsetToFirst = (dow - firstDow + 7) % 7
    const day = 1 + offsetToFirst + (n - 1) * 7
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
}

/** Last occurrence of a weekday in a month (Memorial Day = last Monday May). */
function lastWeekdayOfMonth(month: number, dow: number) {
  return (year: number) => {
    const lastOfMonth = new Date(Date.UTC(year, month, 0))
    const lastDow = lastOfMonth.getUTCDay()
    const offsetBack = (lastDow - dow + 7) % 7
    const day = lastOfMonth.getUTCDate() - offsetBack
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
}

// ─── Holiday definitions ──────────────────────────────────────────

export interface Holiday {
  /** Stable URL-safe key (used in localStorage dismiss + Umami events) */
  key: string
  /** Display name, used in copy and aria labels */
  name: string
  /** Compute the date for the given year (returns 'YYYY-MM-DD') */
  date: (year: number) => string
  /** Days BEFORE the holiday to start showing the banner (5–7 typical) */
  preDays: number
  /** Days AFTER to keep showing (0 = banner gone after the day, 1 = +1 day) */
  postDays: number
  /** Banner headline copy. No em-dashes — use commas/periods. */
  tagline: string
  /** Smaller subtitle line, optional */
  subtitle?: string
  /** Single emoji to prefix the banner */
  emoji: string
  /** Tailwind background color class for the banner. Defaults to terra.
      Ignored when bgImage is set (image takes over). */
  bgClass?: string
  /** Tailwind text color class. Defaults to cream. */
  textClass?: string
  /**
   * Banner background image URL. When set, renders as a 21:9-ish photo
   * strip with a dark terra gradient overlay for text legibility.
   * Source these from Midjourney using the prompts in `holiday-prompts.md`,
   * upload to Supabase Storage `holiday-images/` bucket, paste URL here.
   * Recommended size: 2400x600 (banner) — Netlify Image CDN will resize.
   */
  bgImage?: string
  /**
   * Hero image for the homepage holiday rail header card. Rendered as a
   * compact 16:10 thumbnail next to the section title. Recommended size:
   * 1200x750. Same source flow as bgImage.
   */
  heroImage?: string
  /**
   * 1200x630 OG image for when the day's landing page (or homepage on the
   * day-of) gets shared. Optional — falls back to default OG_IMAGE.
   */
  ogImage?: string
  /**
   * Keywords for SQL ILIKE matching against title + description.
   * OR'd together. Be specific — "mother" matches "Motherboard Repair Class".
   * Use phrase-y keywords like "mother's day", "mom and ".
   */
  keywords: string[]
  /**
   * Categories to boost in the holiday rail. Events in these categories
   * sort to the top within the holiday window.
   */
  preferredCategories?: string[]
  /**
   * How many days before/after the holiday date count as "for that holiday"
   * when ranking events. 3 = events Fri–Tue count for a Sunday holiday.
   */
  eventWindow?: number
}

export const HOLIDAYS: Holiday[] = [
  // ── January ────────────────────────────────────────────────────
  {
    key: 'new-years-eve',
    name: "New Year's Eve",
    date: fixedDate(12, 31),
    preDays: 7,
    postDays: 0,
    tagline: "Ring in 2026 with Burque",
    subtitle: "Parties, countdowns, and live music for tonight.",
    emoji: '🎉',
    keywords: ["new year's eve", 'new years eve', 'nye ', 'countdown', 'midnight'],
    preferredCategories: ['Music', 'Comedy', 'Food & Drink'],
  },

  // ── February ───────────────────────────────────────────────────
  {
    key: 'valentines-day',
    name: "Valentine's Day",
    date: fixedDate(2, 14),
    preDays: 7,
    postDays: 0,
    tagline: "Plans for Valentine's, Burque?",
    subtitle: "Date nights, dinners, and shows worth showing up for.",
    emoji: '🌹',
    keywords: ["valentine", "v-day", "vday ", "sweetheart", "couples"],
    preferredCategories: ['Food & Drink', 'Music', 'Arts & Theater'],
  },

  // ── March ──────────────────────────────────────────────────────
  {
    key: 'st-patricks-day',
    name: "St. Patrick's Day",
    date: fixedDate(3, 17),
    preDays: 5,
    postDays: 0,
    tagline: "St. Paddy's, Burque style",
    subtitle: "Pub crawls, live Celtic music, and green beer.",
    emoji: '🍀',
    keywords: ["st. patrick", "st patrick", "saint patrick", "irish", "paddy", "celtic"],
    preferredCategories: ['Food & Drink', 'Music'],
  },

  // ── May ────────────────────────────────────────────────────────
  {
    key: 'cinco-de-mayo',
    name: 'Cinco de Mayo',
    date: fixedDate(5, 5),
    preDays: 5,
    postDays: 0,
    tagline: "Cinco de Mayo, Burque",
    subtitle: "Mariachi, margaritas, and mole. Find your spot.",
    emoji: '🪅',
    keywords: ["cinco de mayo", "cinco", "mariachi", "mexican fiesta", "mexican night"],
    preferredCategories: ['Food & Drink', 'Music'],
  },
  {
    key: 'mothers-day',
    name: "Mother's Day",
    // 2nd Sunday of May
    date: nthWeekdayOfMonth(5, 0, 2),
    preDays: 7,
    postDays: 0,
    tagline: "Happy Mother's Day weekend, Burque",
    subtitle: "Brunches, flowers, and family events to make her morning.",
    emoji: '💐',
    bgImage:   'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/mothers-day-bg.webp',
    heroImage: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/mothers-day-hero.webp',
    keywords: ["mother's day", "mothers day", "mom and me", "moms ", "mama and ", "matriarch"],
    preferredCategories: ['Food & Drink', 'Family'],
    eventWindow: 2,
  },
  {
    key: 'memorial-day',
    name: 'Memorial Day',
    // Last Monday of May
    date: lastWeekdayOfMonth(5, 1),
    preDays: 4,
    postDays: 1,
    tagline: "Memorial Day weekend in ABQ",
    subtitle: "Long-weekend cookouts, music, and outdoor everything.",
    emoji: '🇺🇸',
    bgImage:   'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/memorial-day-bg.webp',
    heroImage: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/memorial-day-hero.webp',
    keywords: ["memorial day", "memorial weekend"],
    preferredCategories: ['Food & Drink', 'Music', 'Family'],
    eventWindow: 4,
  },

  // ── June ───────────────────────────────────────────────────────
  {
    key: 'fathers-day',
    name: "Father's Day",
    // 3rd Sunday of June
    date: nthWeekdayOfMonth(6, 0, 3),
    preDays: 7,
    postDays: 0,
    tagline: "Happy Father's Day weekend, Burque",
    subtitle: "BBQ, breweries, and ballgames worth getting Dad out for.",
    emoji: '🍻',
    bgImage:   'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/fathers-day-bg.webp',
    heroImage: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/fathers-day-hero.webp',
    keywords: ["father's day", "fathers day", "dad ", "father and ", "papa "],
    preferredCategories: ['Food & Drink', 'Sports', 'Music'],
    eventWindow: 2,
  },
  {
    key: 'juneteenth',
    name: 'Juneteenth',
    date: fixedDate(6, 19),
    preDays: 4,
    postDays: 0,
    tagline: "Juneteenth in ABQ",
    subtitle: "Music, art, food, and freedom. Find the gatherings.",
    emoji: '✊🏾',
    keywords: ["juneteenth", "freedom day"],
    preferredCategories: ['Music', 'Community', 'Arts & Theater'],
  },

  // ── July ───────────────────────────────────────────────────────
  {
    key: 'fourth-of-july',
    name: '4th of July',
    date: fixedDate(7, 4),
    preDays: 5,
    postDays: 0,
    tagline: "4th of July in ABQ",
    subtitle: "Fireworks, parades, and patio nights worth showing up for.",
    emoji: '🎆',
    keywords: ["4th of july", "fourth of july", "independence day", "fireworks"],
    preferredCategories: ['Music', 'Family', 'Food & Drink'],
  },

  // ── September ──────────────────────────────────────────────────
  {
    key: 'labor-day',
    name: 'Labor Day',
    // 1st Monday of September
    date: nthWeekdayOfMonth(9, 1, 1),
    preDays: 4,
    postDays: 1,
    tagline: "Labor Day weekend, Burque",
    subtitle: "Three-day weekend energy. Cookouts, shows, festivals.",
    emoji: '🛠️',
    keywords: ["labor day", "labor day weekend"],
    preferredCategories: ['Music', 'Food & Drink', 'Family'],
    eventWindow: 4,
  },

  // ── October ────────────────────────────────────────────────────
  {
    key: 'balloon-fiesta',
    name: 'Balloon Fiesta',
    // ABQ-specific — Oct 4 is the typical opening; pre-window covers warm-up
    date: fixedDate(10, 4),
    preDays: 14,
    postDays: 9, // Fiesta runs ~9 days
    tagline: "Balloon Fiesta is happening",
    subtitle: "Mass ascensions, glowdeos, and the city in the air.",
    emoji: '🎈',
    keywords: ["balloon fiesta", "albuquerque international balloon fiesta", "aibf"],
    preferredCategories: ['Festivals', 'Family'],
    eventWindow: 9,
  },
  {
    key: 'halloween',
    name: 'Halloween',
    date: fixedDate(10, 31),
    preDays: 7,
    postDays: 0,
    tagline: "Halloween in ABQ",
    subtitle: "Costume parties, haunted houses, and spooky live shows.",
    emoji: '🎃',
    keywords: ["halloween", "haunted", "costume", "spooky", "horror"],
    preferredCategories: ['Music', 'Comedy', 'Family'],
  },

  // ── November ───────────────────────────────────────────────────
  {
    key: 'dia-de-los-muertos',
    name: 'Día de los Muertos',
    date: fixedDate(11, 2),
    preDays: 5,
    postDays: 0,
    tagline: "Día de los Muertos, Burque",
    subtitle: "Ofrendas, processions, and family memory in every plaza.",
    emoji: '💀',
    keywords: ["día de los muertos", "dia de los muertos", "day of the dead"],
    preferredCategories: ['Festivals', 'Community', 'Arts & Theater'],
    eventWindow: 3,
  },
  {
    key: 'thanksgiving',
    name: 'Thanksgiving',
    // 4th Thursday of November
    date: nthWeekdayOfMonth(11, 4, 4),
    preDays: 5,
    postDays: 1,
    tagline: "Thanksgiving in ABQ",
    subtitle: "Turkey trots, pre-feast pints, and Black Friday shows.",
    emoji: '🦃',
    keywords: ["thanksgiving", "turkey trot", "friendsgiving"],
    preferredCategories: ['Family', 'Food & Drink'],
    eventWindow: 4,
  },

  // ── December ───────────────────────────────────────────────────
  {
    key: 'christmas',
    name: 'Christmas',
    date: fixedDate(12, 25),
    preDays: 14,
    postDays: 0,
    tagline: "Christmas in ABQ",
    subtitle: "Luminarias, Nutcrackers, and holiday markets all month.",
    emoji: '🎄',
    keywords: ["christmas", "holiday market", "luminaria", "nutcracker", "santa"],
    preferredCategories: ['Family', 'Festivals', 'Arts & Theater'],
    eventWindow: 7,
  },
]

// ─── Active holiday detection ─────────────────────────────────────

/** Compute the absolute day delta between two YYYY-MM-DD dates. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')
  return Math.round(ms / 86_400_000)
}

/** Today's date in YYYY-MM-DD (server-side, UTC). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Returns the active holiday for `today`, or null if none. When two windows
 * overlap, the holiday CLOSEST to today (smallest |delta|) wins. Ties broken
 * by HOLIDAYS array order.
 */
export function getActiveHoliday(today: string = todayIso()): {
  holiday: Holiday
  date: string
  daysUntil: number
} | null {
  const year = parseInt(today.slice(0, 4), 10)
  const candidates: { holiday: Holiday; date: string; daysUntil: number; absDelta: number }[] = []
  for (const h of HOLIDAYS) {
    // Try this year + next year (handles late-Dec → early-Jan windows)
    for (const candYear of [year, year + 1]) {
      const date = h.date(candYear)
      const delta = daysBetween(date, today)
      // delta > 0 = future, delta < 0 = past. preDays/postDays are positive ints.
      if (delta >= -h.postDays && delta <= h.preDays) {
        candidates.push({ holiday: h, date, daysUntil: delta, absDelta: Math.abs(delta) })
      }
    }
  }
  if (candidates.length === 0) return null
  // Sort: smallest abs delta first, then array order
  candidates.sort((a, b) => a.absDelta - b.absDelta)
  const best = candidates[0]
  return { holiday: best.holiday, date: best.date, daysUntil: best.daysUntil }
}
