/**
 * Connection quotes — ambient wisdom shown in low-pressure spots across the site.
 *
 * All quotes are paraphrased or direct from verified research sources:
 *   - Harvard Study of Adult Development (Waldinger & Schulz, 2023)
 *   - US Surgeon General's Advisory on Loneliness & Isolation (Murthy, 2023)
 *   - Holt-Lunstad meta-analyses (2010, 2015)
 *   - Granovetter, "Strength of Weak Ties" (1973)
 *   - Sandstrom & Dunn (2014), Epley & Schroeder (2014)
 *   - Oldenburg, "The Great Good Place" (1989)
 *   - Cacioppo & Patrick, "Loneliness" (2008)
 *
 * No citations appear on-screen — the quotes are meant to feel like ambient
 * wisdom, not a PSA. The source notes here are for our own verification only.
 */

export interface ConnectionQuote {
  text: string
  /** For maintenance — not shown to users */
  source: string
}

export const CONNECTION_QUOTES: ConnectionQuote[] = [
  {
    text: 'The strongest predictor of happiness at 80 isn\u2019t wealth. It\u2019s the quality of your relationships at 50.',
    source: 'Harvard Study of Adult Development (Waldinger, 2023)',
  },
  {
    text: 'Twenty minutes. That\u2019s how long Americans spend with friends each day. Twenty years ago it was an hour.',
    source: 'US Surgeon General, 2023',
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
    text: 'The best stories start with \u201cwant to come?\u201d',
    source: 'Original',
  },
  {
    text: 'Strong relationships at 50 beat cholesterol as a predictor of health at 80.',
    source: 'Harvard Study of Adult Development',
  },
  {
    text: 'Put the phone down. The city\u2019s out there.',
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
]

/**
 * Returns the same quote for every visitor on a given day.
 * Deterministic across the whole city \u2014 so it becomes a tiny shared experience.
 */
export function getDailyQuote(now: Date = new Date()): ConnectionQuote {
  // Day of year (1-366), deterministic per calendar day in local time
  const start = new Date(now.getFullYear(), 0, 0)
  const diff  = now.getTime() - start.getTime()
  const day   = Math.floor(diff / (1000 * 60 * 60 * 24))
  return CONNECTION_QUOTES[day % CONNECTION_QUOTES.length]
}
