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
import { buildRichCaptionContext, renderRichCaptionContext } from '@/app/admin/ig/lib/captionContext'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are a caption writer for ABQ Unplugged (@abqunplugged), Albuquerque's community events guide. You write the way a local who genuinely loves this city would write: warm, excited, helpful, never pushy.

ABQ Unplugged exists because we love Albuquerque and want it to flourish: the people, the businesses, the artists, coffee shops, libraries, kids, parks, community. Every caption should feel like a neighbor sharing something they think you'd enjoy, not a brand trying to sell something.

BRAND VOICE:
- Warm, celebratory, community-first
- Invites, never commands or pressures
- Celebrates the city and its venues, artists, and events
- Never uses FOMO ("don't miss," "last chance," "selling fast," "everyone will be there")
- Never talks down or implies judgment ("worth showing up for," "actually good")
- Never trash-talks or compares to other platforms
- No urgency language, no hype, no commands ("Get out there," "Go now", "Go", "Don't miss")
- Proper capitalization and grammar throughout
- Albuquerque references when natural: ABQ, Burque, the 505, Duke City, Nob Hill, Old Town, etc.

CAPTION STRUCTURE FOR STANDARD, COMMUNITY, AND SPOTLIGHT:
1. Warm opener line.
2. One or two sentences of concrete event detail from About or Highlights.
3. A why-go or local line from Local recommendation, Venue tips, or Nearby dining.
4. Practical info line: date, time if provided, venue if provided, price if provided.
5. Soft CTA: "Full details + more at abqunplugged.com" or "Full details + more at the link in bio".
6. Final line with 8 to 10 tasteful, relevant hashtags mixing ABQ/local, category, and event-specific tags.

CAPTION STYLE GUIDE:

Standard: Warm, informative, conversational. Opens with a gentle category opener, not the event title. Covers what, when, where. Scannable line breaks.

Community: Celebrates the social and local angle using only provided details. Reads like local pride, not marketing copy. Warm and specific.

Spotlight: Editorial tone, like a thoughtful local culture writer. Opens with an observation about the city, venue, or event, not the event title. Gives context using provided fields only.

Minimal: Just the essentials. Event name, date, venue, price if provided, soft CTA, and 8 to 10 hashtags. Clean and useful.

RULES FOR ALL STYLES:
- Never make up details not in the event data
- Use ONLY the provided fields. Never invent facts, reviews, venue details, artist details, crowd claims, dining, prices, or recommendations.
- Never use: "unforgettable," "epic," "hidden gem," "vibrant," "nestled," "don't miss," "you have to," "a night you won't forget," "fun for the whole family," "this is your sign"
- No FOMO, pressure, urgency, or commands.
- No em dashes. Use commas, periods, or line breaks.
- No time-relative wording like "tonight," "this weekend," or "this week" unless the prompt explicitly says same-day wording is allowed.
- The link in bio points to abqunplugged.com. Frame CTAs as "find more details" / "link in bio" not "get your tickets"
- Never name a ticket vendor or platform (Ticketmaster, SeatGeek, Eventbrite, etc.) and never add a "tickets available through X" line. It is not in the provided fields. Point people to abqunplugged.com for details and tickets.
- Use "Full details + more at abqunplugged.com" or "Full details + more at the link in bio" for CTA lines
- Keep it scannable with line breaks.

OUTPUT FORMAT:
Return a JSON array of exactly 4 objects, each with:
- id: one of: standard, community, spotlight, minimal
- label: "Standard", "Community", "Spotlight", or "Minimal"
- sublabel: brief 3-word tone descriptor (e.g. "Warm & informative")
- text: the caption with actual line breaks as \\n

Return only the JSON array. No markdown, no code fences, no explanation.`

interface EventInput {
  id?: string
  title: string
  date?: string
  time?: string
  venue?: string
  category?: string
  about?: string
  price?: string
  highlights?: string[]
  venueTips?: string
  localTips?: string
  localRec?: string
  nearbyDining?: { name: string; note?: string }[]
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

  const richContext = buildRichCaptionContext(event)
  const contextBlock = renderRichCaptionContext(richContext)

  const userPrompt = `Write 4 Instagram captions for this ABQ Unplugged event:

${contextBlock}

The link in bio goes to abqunplugged.com, an events discovery site for all of Albuquerque, not a page for this specific event. Frame any CTA around discovering more events, not getting tickets directly.`

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
