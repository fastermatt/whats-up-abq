import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Auth
  const adminToken = request.cookies.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { event: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const event = body.event
  if (!event || !event.title) {
    return NextResponse.json({ error: 'Missing required field: event.title' }, { status: 400 })
  }

  // Build prompt
  const fields = [
    event.title   && `Title: ${event.title}`,
    event.date    && `Date: ${event.date}`,
    event.time    && `Time: ${event.time}`,
    event.venue   && `Venue: ${event.venue}`,
    event.category && `Category: ${event.category}`,
    event.about   && `About: ${event.about}`,
    event.price   && `Price: ${event.price}`,
  ].filter(Boolean).join('\n')

  const userPrompt = `Generate 4 social media captions for the following local event in Albuquerque, NM. Return ONLY a JSON array of objects with keys: id, label, sublabel, text. The ids must be exactly: standard, hype, spotlight, minimal. Each caption must end with "abqunplugged.com" and include the hashtags #ABQUnplugged #Albuquerque #ABQ #NewMexico #505.

Event details:
${fields}

Respond with valid JSON only, no markdown or extra text.`

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing DeepSeek API key' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: "You are a social media copywriter for ABQ Unplugged, Albuquerque's premier local events guide.",
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API error:', response.status, errorText)
      return NextResponse.json({ error: `DeepSeek API error ${response.status}` }, { status: 502 })
    }

    const ds = await response.json()
    const content = ds?.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: 'DeepSeek returned no content' }, { status: 502 })
    }

    // Strip possible ```json fences
    let cleaned = content.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) cleaned = fenceMatch[1].trim()

    let captions: unknown
    try {
      captions = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse DeepSeek response:', cleaned)
      return NextResponse.json({ error: 'DeepSeek response was not valid JSON' }, { status: 502 })
    }

    if (!Array.isArray(captions) || captions.length === 0) {
      return NextResponse.json({ error: 'Parsed captions is not a non-empty array' }, { status: 502 })
    }

    return NextResponse.json({ captions })
  } catch (err) {
    console.error('Error calling DeepSeek:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
