/**
 * Connection quotes — ambient wisdom shown in low-pressure spots across the site.
 *
 * Mix of:
 *   (A) Research-backed universals (Harvard, Surgeon General, Granovetter, etc.)
 *   (B) ABQ / Southwest-rooted lines — place-specific so the site feels local
 *   (C) Original framings that inherit from the research without paraphrasing
 *
 * Sources used:
 *   - Harvard Study of Adult Development (Waldinger & Schulz, 2023)
 *   - US Surgeon General's Advisory on Loneliness & Isolation (Murthy, 2023)
 *   - Holt-Lunstad meta-analyses (2010, 2015)
 *   - Granovetter, "Strength of Weak Ties" (AJS, 1973)
 *   - Sandstrom & Dunn (2014), Epley & Schroeder (2014)
 *   - Oldenburg, "The Great Good Place" (1989)
 *   - Cacioppo & Patrick, "Loneliness" (2008)
 *   - Putnam, "Bowling Alone" (2000)
 *   - Cordell, "Ancient Pueblo Peoples" (1994)
 *   - NOAA climate data for Albuquerque (310+ sunny days/year)
 *
 * No citations appear on-screen — quotes are ambient wisdom, not a PSA.
 * Removed: preachy "put the phone down" command-style line (violated tone rules).
 * Removed: duplicate cholesterol framing (was same fact as opener, two entries).
 */

export interface ConnectionQuote {
  text: string
  /** For maintenance — not shown to users */
  source: string
}

export const CONNECTION_QUOTES: ConnectionQuote[] = [
  // ── Research-backed universals ───────────────────────────────────────────
  {
    text: 'The strongest predictor of happiness at 80 isn\u2019t wealth. It\u2019s the quality of your relationships at 50.',
    source: 'Harvard Study of Adult Development (Waldinger, 2023)',
  },
  {
    text: 'A chat with a stranger makes the train ride better \u2014 even though we\u2019re sure it won\u2019t.',
    source: 'Epley & Schroeder, 2014',
  },
  {
    text: 'Social fitness is like physical fitness. It only works if you practice.',
    source: 'Waldinger, 2023',
  },
  {
    text: 'Most of life\u2019s serendipity comes through people you barely know.',
    source: 'Granovetter, 1973 (weak ties)',
  },
  {
    text: 'The caf\u00e9, the park, the local bar \u2014 this is where community actually happens.',
    source: 'Oldenburg, 1989 (third places)',
  },
  {
    text: 'Loneliness is a signal \u2014 like hunger \u2014 telling you to reconnect.',
    source: 'Cacioppo, 2008',
  },
  {
    text: 'A brief, friendly word with the barista measurably lifts the day.',
    source: 'Sandstrom & Dunn, 2014',
  },
  {
    text: 'Good relationships don\u2019t just protect your body. They protect your brain.',
    source: 'Waldinger, 2023',
  },
  {
    text: 'Weak ties aren\u2019t weak. The neighbor you wave to, the regular at the counter \u2014 those connections carry information your close friends don\u2019t have.',
    source: 'Granovetter, 1973 (weak ties) \u2014 cleaner restatement',
  },
  {
    text: 'Civic participation \u2014 just showing up to things \u2014 is one of the strongest predictors of long-term neighborhood attachment.',
    source: 'Putnam, Bowling Alone (2000)',
  },
  {
    text: 'Americans are spending less time with friends than any generation before us. This evening could be different.',
    source: 'US Surgeon General, 2023 (reframed forward-looking)',
  },
  {
    text: 'Lacking strong social ties carries the same mortality risk as smoking fifteen cigarettes a day.',
    source: 'Holt-Lunstad meta-analysis, 2010',
  },
  {
    text: 'We consistently underestimate how much strangers enjoy being talked to.',
    source: 'Epley & Schroeder, 2014 (Chicago commuter study)',
  },
  {
    text: 'The cure for loneliness is almost never more information. It\u2019s usually just a room with other people in it.',
    source: 'Cacioppo, 2008 (framing)',
  },

  // ── ABQ / Southwest-rooted ───────────────────────────────────────────────
  {
    text: 'The Rio Grande has been running through this valley for twelve thousand years. People have been gathering beside it the whole time.',
    source: 'Cordell, Ancient Pueblo Peoples (1994)',
  },
  {
    text: 'Albuquerque is still small enough that you can walk into a room and know someone. That\u2019s a rare thing.',
    source: 'Original (Oldenburg applied to mid-size cities)',
  },
  {
    text: 'New Mexico gets three hundred and twenty days of sun a year. Some of those should happen outside your house.',
    source: 'NOAA climate data for ABQ',
  },
  {
    text: 'The best neighborhood in ABQ is the one you actually show up in.',
    source: 'Original (grounded in Putnam)',
  },
  {
    text: 'The 505 is a small town pretending to be a city. Use that.',
    source: 'Original (local observation)',
  },
  {
    text: 'Every Pueblo in the Rio Grande valley built plazas first, houses second. They knew what mattered.',
    source: 'Original (grounded in Cordell, 1994)',
  },
  {
    text: 'When the Sandias turn pink, go outside. Watch them with someone.',
    source: 'Original (local ritual)',
  },
  {
    text: 'Balloons rise at dawn. Green chile roasts in October. The city keeps inviting you \u2014 most of us keep meaning to go.',
    source: 'Original (ABQ calendar cues)',
  },
  {
    text: 'Old Town has been the same plaza since 1706. It\u2019s still waiting for you to sit down.',
    source: 'Original (ABQ history as invitation)',
  },
  {
    text: 'The best Burque stories always start \u201cI didn\u2019t think I\u2019d go, but\u2026\u201d',
    source: 'Original',
  },

  // ── Original framings (invitational tone) ────────────────────────────────
  {
    text: 'The best stories start with \u201cwant to come?\u201d',
    source: 'Original',
  },
  {
    text: 'Showing up is half of belonging.',
    source: 'Original (inspired by Oldenburg)',
  },
  {
    text: 'We\u2019re wired for faces. The screen is a workaround.',
    source: 'Original (grounded in Cacioppo)',
  },
  {
    text: 'The room only becomes a room because you walked in.',
    source: 'Original',
  },
  {
    text: 'Nobody texts \u201cthat was amazing\u201d from the couch.',
    source: 'Original',
  },
  {
    text: 'A plan and a person beats a feed and a phone. Every time.',
    source: 'Original',
  },
  {
    text: 'You don\u2019t have to feel like going to have a good time.',
    source: 'Original (counter to the \u201cI\u2019m tired\u201d excuse)',
  },
  {
    text: 'Invite someone. Even if they say no, the asking is the thing.',
    source: 'Original',
  },
  {
    text: 'Serendipity requires proximity. Proximity requires leaving the house.',
    source: 'Original (restates weak ties)',
  },
  {
    text: 'The calendar remembers what the feed forgets.',
    source: 'Original',
  },
]

/**
 * Returns the same quote for every visitor on a given day.
 * Deterministic across the whole city — so it becomes a tiny shared experience.
 *
 * With 34 quotes, daily rotation repeats every ~34 days — long enough that even
 * a daily visitor goes five weeks before seeing the same line twice.
 */
export function getDailyQuote(now: Date = new Date()): ConnectionQuote {
  // Day of year (1-366), deterministic per calendar day in local time
  const start = new Date(now.getFullYear(), 0, 0)
  const diff  = now.getTime() - start.getTime()
  const day   = Math.floor(diff / (1000 * 60 * 60 * 24))
  return CONNECTION_QUOTES[day % CONNECTION_QUOTES.length]
}
