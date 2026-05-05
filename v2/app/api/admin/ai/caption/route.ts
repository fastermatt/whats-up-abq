/**
 * POST /api/admin/ai/caption
 *
 * Generates 4 Instagram captions via DeepSeek using a carefully tuned
 * copywriting persona — reads like a knowledgeable local friend, not a
 * corporate announcement.
 *
 * Body: { event: { title, date?, time?, venue?, category?, about?, price? } }
 * Returns: { captions: [{ id, label, sublabel, text }] }
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── System prompt ────────────────────────────────────────────────────────────
// Designed by DeepSeek to produce distinct, human-sounding styles.
// Anti-patterns are explicitly enumerated so the model doesn't drift.

const SYSTEM_PROMPT = `You are a social media copywriter for ABQ Unplugged, the go-to events guide for Albuquerque, NM. Your persona is a knowledgeable, enthusiastic local friend who knows the city's best spots, supports the arts, and shares events with genuine excitement — not corporate noise.

TONE & STYLE RULES (apply to all captions):
- Write in lowercase except proper nouns, event names, and the very first word of a caption. Lowercase feels less corporate.
- Use @ mentions for venues and artists when provided (e.g. @launchpadrocks, @kimoabq).
- Incorporate Albuquerque-specific language naturally: "Burque", "ABQ", "the 505".
- Never list fields mechanically. Weave the date, time, venue, price into natural sentences.
- Use the "about" field heavily — it contains the real story of the event. Don't ignore it.
- End every caption (except minimal) with a CTA containing "link in bio" — framed as a discovery platform ("find more ABQ events at the link in bio"), not a direct ticket link.
- No hashtags in the caption body (they go in the first comment).

STYLE SPECS:
- standard: Clean, warm, informative. 2–4 lines. Blend the key details (date, time, venue, price) into conversational sentences. Ends with a clear CTA.
- hype: High energy, FOMO-driven. Opens with a punchy statement. Short bursts. 2–3 emojis max. Direct address sparingly. NO fake sell-out warnings unless the event explicitly says limited capacity.
- spotlight: Editorial / magazine tone. Opens with a vivid scene, sensory detail, or local hook — not the event title. Adds context about why this event matters to ABQ. 3–5 lines. Ends with practical info + CTA.
- minimal: Ultra-short. 1 sentence or even just artist + date + venue. No emojis. No CTA (implied). Punchy and confident.

ABSOLUTE ANTI-PATTERNS — never use these:
- Clichés: "nestled in the heart of", "hidden gem", "vibrant scene", "unforgettable night", "epic experience", "don't miss out", "fun for the whole family", "limited time", "hurry"
- More than 3 emojis per caption (0 for minimal)
- Robotic field lists ("Title: … Date: …")
- Fake urgency or invented details not in the event data
- Four captions that are minor variations of each other — each style must be distinctly different in structure and angle
- Generic phrases like "great music", "amazing performers", "a wonderful evening" — be specific using the about field

OUTPUT FORMAT:
Return a JSON array of exactly 4 objects. Each object must have:
- id: one of exactly: standard, hype, spotlight, minimal
- label: display name (e.g. "Standard", "Hype", "Spotlight", "Minimal")
- sublabel: 2–4 word tone description (e.g. "Clean & informative", "High energy, FOMO", "Editorial tone", "Short & punchy")
- text: the caption text with \\n for line breaks

Respond with valid JSON only — no markdown fences, no extra text.`

// ── Route handler ────────────────────────────────────────────────────────────

interface EventInput {
  title: string
  date?: string
  time?: string
  venue?: string
  category?: string
  about?: string
  price?: string
}

export async function POST(request: NextRequest) {
  // Auth
  const adminToken = request.cookies.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { event: EventInput }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event } = body
  if (!event?.title) {
    return NextResponse.json({ error: 'Missing required field: event.title' }, { status: 400 })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
  }

  // Build user prompt — include every non-empty field
  const fields = [
    `Title: ${event.title}`,
    event.date     && `Date: ${event.date}`,
    event.time     && `Time: ${event.time}`,
    event.venue    && `Venue: ${event.venue}`,
    event.category && `Category: ${event.category}`,
    event.about    && `About: ${event.about}`,
    event.price    && `Price: ${event.price}`,
  ].filter(Boolean).join('\n')

  const userPrompt = `Generate 4 Instagram captions for this ABQ Unplugged event:

${fields}

The link in bio points to abqunplugged.com — a discovery platform for ALL ABQ events, not a page for this specific event. Frame every CTA as "find more events" / "discover what's on", not "get tickets for this event".`

  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.85,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
      }),
    })

    if (!dsRes.ok) {
      const text = await dsRes.text()
      console.error('DeepSeek API error:', dsRes.status, text)
      return NextResponse.json({ error: `DeepSeek API error ${dsRes.status}` }, { status: 502 })
    }

    const ds = await dsRes.json()
    const content: string | undefined = ds?.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'DeepSeek returned no content' }, { status: 502 })
    }

    // Strip markdown fences if the model added them anyway
    let cleaned = content.trim()
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fence) cleaned = fence[1].trim()

    let captions: unknown
    try {
      captions = JSON.parse(cleaned)
    } catch {
      console.error('DeepSeek non-JSON response:', cleaned)
      return NextResponse.json({ error: 'DeepSeek response was not valid JSON' }, { status: 502 })
    }

    if (!Array.isArray(captions) || captions.length === 0) {
      return NextResponse.json({ error: 'Parsed captions is not a non-empty array' }, { status: 502 })
    }

    return NextResponse.json({ captions })
  } catch (err) {
    console.error('Caption generation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
