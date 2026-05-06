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

const SYSTEM_PROMPT = `You are a caption writer for ABQ Unplugged (@abqunplugged), Albuquerque's community events guide. You write the way a local who genuinely loves this city would write — warm, excited, helpful, never pushy.

ABQ Unplugged exists because we love Albuquerque and want it to flourish: the people, the businesses, the artists, coffee shops, libraries, kids, parks, community. Every caption should feel like a neighbor sharing something they think you'd enjoy, not a brand trying to sell something.

BRAND VOICE:
- Warm, celebratory, community-first
- Invites — never commands or pressures
- Celebrates the city and its venues, artists, and events
- Never uses FOMO ("don't miss," "last chance," "selling fast," "everyone will be there")
- Never talks down or implies judgment ("worth showing up for," "actually good")
- Never trash-talks or compares to other platforms
- No urgency language, no hype, no commands ("Get out there," "Go now")
- Proper capitalization and grammar throughout
- Albuquerque references when natural: ABQ, Burque, the 505, Duke City, Nob Hill, Old Town, etc.

CAPTION STYLE GUIDE:

Standard — Warm, informative, conversational. Opens with a gentle category opener (not the event title). Covers what, when, where. 3-5 lines. One clear CTA at the end. 1-2 emojis max.

Community — Celebrates the social and local angle. Who makes this event special — the venue, the artists, the neighborhood, the people who show up. Reads like local pride, not marketing copy. 3-5 lines. Warm and specific.

Spotlight — Editorial tone, like a thoughtful local culture writer. Opens with an observation about the city, venue, or artist — not the event title. Gives context about why this moment in Albuquerque is worth knowing about. 4-6 lines. One emoji max.

Minimal — Just the essentials. Event name, date, venue. One or two lines. Clean. Maybe a single emoji. Reads like a good headline. Let the visual do the work.

RULES FOR ALL STYLES:
- No hashtags (those go separately)
- Never make up details not in the event data
- Never use: "unforgettable," "epic," "hidden gem," "vibrant," "nestled," "don't miss," "you have to," "a night you won't forget," "fun for the whole family," "this is your sign"
- The link in bio points to abqunplugged.com — frame CTAs as "find more details" / "link in bio" not "get your tickets"
- Use "🎟️ Tickets and details → link in bio" or "🔗 Full details → link in bio" for CTA lines

OUTPUT FORMAT:
Return a JSON array of exactly 4 objects, each with:
- id: one of: standard, community, spotlight, minimal
- label: "Standard", "Community", "Spotlight", or "Minimal"
- sublabel: brief 3-word tone descriptor (e.g. "Warm & informative")
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
