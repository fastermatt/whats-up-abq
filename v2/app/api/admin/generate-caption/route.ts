/**
 * POST /api/admin/generate-caption
 *
 * Generates 3 on-brand Instagram caption variants for an event using DeepSeek.
 * Returns: { hook, local, informational } — each is a complete caption string
 * ready to paste into Instagram.
 *
 * Called client-side from AICaptionGenerator.tsx.
 */
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are the caption writer for ABQ Unplugged, an events aggregator for Albuquerque, NM. You write Instagram captions as a Burqueño who has been to the shows — someone who knows the city, loves its culture, and speaks plainly about what is worth your Friday night.

VOICE RULES:
- Speak declaratively. Not "Don't miss this!" but "This is the show."
- Use "Burque" and "the 505" naturally, not performatively
- Name real venues and neighborhoods when you have them
- Don't pitch. Inform. Let the event sell itself.
- Short sentences. No padding. Every word earns its place.
- Maximum one exclamation point per caption — earn it

FORBIDDEN WORDS AND PHRASES — never use any of these:
- Discover, Unleash, Elevate, Amazing, Epic, Incredible, Stunning, Vibrant, Thriving
- "Let's [verb]", "Join us", "Don't miss out", "You won't want to miss", "Experience the magic"
- "World-class", "State-of-the-art", "Game-changer", "Next level"
- Hype marketing filler — assume the reader is smart and local

PREFERRED LANGUAGE:
- "Burque" for casual references to the city
- "the 505" as identity shorthand
- Real venue names, real neighborhoods (Nob Hill, Downtown, Old Town, Barelas, Nob Hill, the South Valley, UNM area, etc.)
- "show", "set", "night", "run" — not "event" or "experience" when avoidable
- Concrete details beat adjectives every time

HASHTAG SYSTEM:
Base always: #ABQUnplugged #Albuquerque #ABQ #NewMexico #505
Category additions:
  Music → #ABQMusic #LiveMusicABQ #AlbuquerqueMusic
  Arts & Theater → #ABQArts #AlbuquerqueArts #NMArts
  Food & Drink → #ABQFood #AlbuquerqueEats #NMFood
  Family → #ABQKids #AlbuquerqueFamilies #NMFamily
  Outdoor → #ABQOutdoors #NewMexicoOutdoors #NMOutdoors
  Sports → #ABQSports #AlbuquerqueSports #NMSports
  Comedy → #ABQComedy #505Comedy
  Festivals → #ABQFestivals #NMFestivals
  Community → #ABQCommunity #NMCommunity
Every caption ends with a blank line then: → abqunplugged.com
Then a blank line then the hashtags.

CAPTION STYLES — generate all three:

hook: Opens with a specific, punchy statement about this event, this artist, this venue, or the feeling of the night. No generic openers ("Big news!" or "Exciting announcement!"). Draw from something real about the event. Body is 2–4 short paragraphs. 150–220 words total before hashtags.

local: Written from the Burque-native perspective. Reference the venue's role in the city, the neighborhood, the local fanbase, the ABQ arts/music scene context. More personal and community-oriented. 150–220 words total before hashtags.

informational: Clean and practical. All the need-to-know: what, where, when, price if known, where to get tickets. Someone should be able to decide whether to go purely from this caption. Tighter — 100–160 words before hashtags.

CRITICAL OUTPUT FORMAT:
Return ONLY a valid JSON object with exactly three string keys: hook, local, informational.
Each value is the complete caption string including the emoji opener, body paragraphs separated by blank lines, a blank line, the arrow CTA (→ abqunplugged.com), a blank line, and the hashtags.
No markdown, no code fences, no explanation — just the raw JSON object.`

function buildHashtags(category: string | null): string {
  const base = '#ABQUnplugged #Albuquerque #ABQ #NewMexico #505'
  const catTags: Record<string, string> = {
    'Music':          '#ABQMusic #LiveMusicABQ #AlbuquerqueMusic',
    'Arts & Theater': '#ABQArts #AlbuquerqueArts #NMArts',
    'Food & Drink':   '#ABQFood #AlbuquerqueEats #NMFood',
    'Family':         '#ABQKids #AlbuquerqueFamilies #NMFamily',
    'Outdoor':        '#ABQOutdoors #NewMexicoOutdoors #NMOutdoors',
    'Sports':         '#ABQSports #AlbuquerqueSports #NMSports',
    'Comedy':         '#ABQComedy #505Comedy',
    'Festivals':      '#ABQFestivals #NMFestivals',
    'Community':      '#ABQCommunity #NMCommunity',
  }
  const extra = category ? (catTags[category] ?? '') : ''
  return [base, extra].filter(Boolean).join('\n')
}

function buildUserPrompt(data: {
  title: string
  category: string | null
  dateLabel: string | null
  time: string | null
  venue: string | null
  price: string | null
  description: string | null
  emoji: string
}): string {
  const lines = [
    `Generate 3 Instagram captions for this event.`,
    ``,
    `Title: ${data.title}`,
    `Category: ${data.category ?? 'General'}`,
    data.dateLabel ? `Date: ${data.dateLabel}` : null,
    data.time      ? `Time: ${data.time}` : null,
    data.venue     ? `Venue: ${data.venue}` : null,
    data.price     ? `Price: ${data.price}` : null,
    data.description ? `Description: ${data.description}` : null,
    ``,
    `Category emoji to use: ${data.emoji}`,
    `Hashtags to append (paste verbatim at the end of each caption):`,
    buildHashtags(data.category),
  ].filter(s => s !== null).join('\n')
  return lines
}

export async function POST(request: Request) {
  // Admin-only: this endpoint spends DeepSeek quota, so it must not be callable
  // by anonymous traffic. Middleware only checks cookie presence, not validity.
  const adminToken = (await cookies()).get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'DEEPSEEK_API_KEY not configured' },
      { status: 500 }
    )
  }

  let body: {
    title: string
    category?: string | null
    dateLabel?: string | null
    time?: string | null
    venue?: string | null
    price?: string | null
    description?: string | null
    emoji?: string
  }

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.title) {
    return Response.json({ error: 'title is required' }, { status: 400 })
  }

  const userPrompt = buildUserPrompt({
    title:       body.title,
    category:    body.category ?? null,
    dateLabel:   body.dateLabel ?? null,
    time:        body.time ?? null,
    venue:       body.venue ?? null,
    price:       body.price ?? null,
    description: body.description ? body.description.slice(0, 400) : null,
    emoji:       body.emoji ?? '📍',
  })

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[generate-caption] DeepSeek error:', res.status, text)
      return Response.json(
        { error: `DeepSeek API error: ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return Response.json({ error: 'Empty response from DeepSeek' }, { status: 502 })
    }

    // Parse the JSON from DeepSeek (response_format: json_object guarantees valid JSON)
    let captions: { hook?: string; local?: string; informational?: string }
    try {
      captions = JSON.parse(content)
    } catch {
      console.error('[generate-caption] Failed to parse DeepSeek JSON:', content)
      return Response.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    if (!captions.hook || !captions.local || !captions.informational) {
      return Response.json(
        { error: 'AI response missing one or more caption variants' },
        { status: 502 }
      )
    }

    return Response.json({
      hook:          captions.hook,
      local:         captions.local,
      informational: captions.informational,
    })

  } catch (err) {
    console.error('[generate-caption] fetch failed:', err)
    return Response.json({ error: 'Request to DeepSeek timed out or failed' }, { status: 502 })
  }
}
