/**
 * POST /api/admin/ai/caption
 *
 * Generates 4 Instagram captions via DeepSeek.
 * Optimized for @abqunplugged — local events guide for Albuquerque, NM.
 *
 * Body: { event: { title, date?, time?, venue?, category?, about?, price? } }
 * Returns: { captions: [{ id, label, sublabel, text }] }
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are an expert Instagram copywriter for ABQ Unplugged (@abqunplugged), Albuquerque's go-to local events guide. You write captions that feel like they came from a well-connected local who genuinely loves the city — not a marketing department.

Your captions perform well because they:
- Lead with something specific and interesting, never generic
- Use the event's actual description/about text to add real detail
- Sound like a person talking, not a press release
- Give people a concrete reason to care right now
- Include a clear next step (link in bio) without being pushy
- Tag venues with @ when the venue name is provided

CAPTION STYLE GUIDE:

Standard — Your workhorse caption. Conversational and informative. Covers what, when, where, and why it's worth going. 3-5 lines. Ends with "🔗 link in bio" CTA. No more than 2 emojis total. Normal capitalization and grammar.

Hype — Punchy. Energy. Makes people feel like they'll regret missing this. Short sentences. All caps for key details like the event name or date is fine. 2-3 emojis max. Ends with "link in bio." Should feel urgent without being fake.

Spotlight — Editorial tone, like a culture writer covering the scene. Opens with a hook or observation about the city/venue/artist — not the event title. Gives context about why this event matters locally. 4-6 lines. One emoji max. Ends with practical info + "link in bio."

Minimal — Just the essentials. One or two lines max. Date, event, venue. Maybe a single emoji. No hashtags, no CTA. Reads like a headline.

RULES FOR ALL STYLES:
- Proper capitalization and correct grammar throughout
- Albuquerque references when natural: ABQ, Burque, the 505, Old Town, Central Ave, etc.
- No hashtags in the caption (those go in the first comment)
- Never make up details not in the event data
- Never use: "unforgettable," "epic," "hidden gem," "vibrant," "nestled," "don't miss out," "fun for the whole family," "a night you won't forget"
- The link in bio points to abqunplugged.com — a discovery platform for ALL ABQ events, not a direct event page. Frame CTAs as "see what else is happening" / "find more events" not "get your tickets"

OUTPUT FORMAT:
Return a JSON array of exactly 4 objects, each with:
- id: one of: standard, hype, spotlight, minimal
- label: "Standard", "Hype", "Spotlight", or "Minimal"
- sublabel: brief 3-word tone descriptor (e.g. "Clean & informative")
- text: the caption with actual line breaks as \\n

Return only the JSON array. No markdown, no code fences, no explanation.`

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
  const adminToken = request.cookies.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Build the event brief — only include fields that actually have data
  const lines = [
    `Event: ${event.title}`,
    event.category && `Category: ${event.category}`,
    event.date     && `Date: ${event.date}`,
    event.time     && `Time: ${event.time}`,
    event.venue    && `Venue: ${event.venue}`,
    event.price    && `Price: ${event.price}`,
    event.about    && `Description: ${event.about}`,
  ].filter(Boolean)

  const userPrompt = `Write 4 Instagram captions for this ABQ Unplugged event:

${lines.join('\n')}

The link in bio goes to abqunplugged.com — an events discovery site for all of Albuquerque, not a page for this specific event. Frame any CTA around discovering more events, not getting tickets directly.`

  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.9,
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

    // Strip markdown fences if present
    let cleaned = content.trim()
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fence) cleaned = fence[1].trim()
    // Also strip a leading/trailing bare ``` if no language tag
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '').trim()

    let captions: unknown
    try {
      captions = JSON.parse(cleaned)
    } catch {
      console.error('DeepSeek non-JSON response:', cleaned)
      return NextResponse.json({ error: 'DeepSeek response was not valid JSON' }, { status: 502 })
    }

    if (!Array.isArray(captions) || captions.length === 0) {
      return NextResponse.json({ error: 'Captions is not a non-empty array' }, { status: 502 })
    }

    return NextResponse.json({ captions })
  } catch (err) {
    console.error('Caption generation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
