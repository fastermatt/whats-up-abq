export interface RichCaptionContext {
  title: string
  category: string | null
  date: string | null
  time: string | null
  venue: string | null
  price: string | null
  siteUrl: string
  about: string | null
  highlights: string[]
  venueTips: string | null
  localRec: string | null
  nearbyDining: string[]
}

interface CaptionEventInput {
  id?: string | null
  title?: string | null
  category?: string | null
  date?: string | null
  time?: string | null
  venue?: string | null
  price?: string | null
  about?: string | null
  highlights?: unknown
  venueTips?: string | null
  localTips?: string | null
  localRec?: string | null
  nearbyDining?: unknown
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : null
}

function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (typeof item === 'string') return cleanText(item)
      if (item && typeof item === 'object' && 'name' in item) {
        return cleanText((item as { name?: unknown }).name)
      }
      return null
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, max)
}

export function buildRichCaptionContext(event: CaptionEventInput): RichCaptionContext {
  const id = cleanText(event.id)
  return {
    title: cleanText(event.title) ?? '',
    category: cleanText(event.category),
    date: cleanText(event.date),
    time: cleanText(event.time),
    venue: cleanText(event.venue),
    price: cleanText(event.price),
    siteUrl: id ? `https://abqunplugged.com/events/${id}` : 'https://abqunplugged.com',
    about: cleanText(event.about),
    highlights: cleanList(event.highlights, 2),
    venueTips: cleanText(event.venueTips ?? event.localTips),
    localRec: cleanText(event.localRec),
    nearbyDining: cleanList(event.nearbyDining, 2),
  }
}

export function renderRichCaptionContext(ctx: RichCaptionContext): string {
  const lines = [
    `Title: ${ctx.title}`,
    ctx.category && `Category: ${ctx.category}`,
    ctx.date && `Date: ${ctx.date}`,
    ctx.time && `Time: ${ctx.time}`,
    ctx.venue && `Venue: ${ctx.venue}`,
    ctx.price && `Price: ${ctx.price}`,
    `Site URL: ${ctx.siteUrl}`,
    ctx.about && `About: ${ctx.about}`,
    ctx.highlights.length > 0 && `Highlights: ${ctx.highlights.join(' | ')}`,
    ctx.venueTips && `Venue tips: ${ctx.venueTips}`,
    ctx.localRec && `Local recommendation: ${ctx.localRec}`,
    ctx.nearbyDining.length > 0 && `Nearby dining: ${ctx.nearbyDining.join(' | ')}`,
  ].filter(Boolean)

  return lines.join('\n')
}
