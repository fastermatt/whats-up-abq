// Official event flyers from venue websites, matched to our photoless events by title and mirrored onto our own
// host (Cloudflare Pages). Fail-soft by design: any site that is down or changes just means fewer flyers.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../v2/package.json'))

// venue: matches the event's venue name. pages: listing pages whose linked flyers are collected.
export const FLYER_SOURCES = [
  { venue: /popejoy/i, pages: ['https://www.popejoypresents.com/events', 'https://www.popejoypresents.com/season'] },
  { venue: /revel/i, pages: ['https://revelabq.com/events'] },
  { venue: /sunshine (theater|theatre)/i, pages: ['https://www.sunshinetheaterlive.com'] },
]

const decode = s => s.replace(/&#038;|&amp;/g, '&').replace(/&#8211;|&#8212;/g, '-').replace(/&#8217;|&#8216;|&rsquo;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#\d+;/g, ' ')
export const normalize = t => decode(t).toLowerCase().replace(/^more info for\s+/, '').replace(/\s+-\s+albuquerque$/, '')
  .replace(/\s+(\*|with|featuring|presents|w\/)\s.*$/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|a|an|live|in concert|tour)\b/g, ' ').replace(/\s+/g, ' ').trim()

export function matches(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a))) return true
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b + ' ') || b.startsWith(a + ' '))) return true
  const x = new Set(a.split(' ')), y = new Set(b.split(' '))
  const shared = [...x].filter(w => y.has(w)).length
  return shared >= 2 && shared / Math.min(x.size, y.size) >= 0.75
}

// Some venue sites intermittently answer 406/5xx to scripts; retry a few times before giving up.
async function politeFetch(url, tries = 4) {
  let last
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise(r => setTimeout(r, 1500 * i))
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(25000) })
      if (res.ok) return res
      last = new Error(`${url} ${res.status}`)
    } catch (e) { last = e }
  }
  throw last
}

async function listFlyers(url) {
  const res = await politeFetch(url)
  const html = await res.text(), out = []
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const img = m[2].match(/<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/i)
    if (!img || /logo|icon|sprite/i.test(img[1])) continue
    const alt = img[0].match(/alt=["']([^"']*)["']/i)?.[1] || ''
    // Title: link text, else image alt, else the next heading (flyer links with the title just after, as on holdmyticket pages).
    const ahead = html.slice(m.index + m[0].length, m.index + m[0].length + 400).match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i)?.[1] || ''
    const title = normalize((m[2].replace(/<[^>]+>/g, ' ') + ' ').replace(/\s+/g, ' ').trim() || alt || ahead.replace(/<[^>]+>/g, ' ').trim())
    if (title) out.push({ title, img: new URL(img[1].replace(/&amp;/g, '&').replace('w_225', 'w_900'), url).href })
  }
  return out
}

async function mirror(url, outDir, sharp) {
  const res = await politeFetch(url)
  if (!/^image\//.test(res.headers.get('content-type') || '')) throw new Error(`${url} ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  if (!meta.width || meta.width < 300) throw new Error(`${url} too small`)
  const name = createHash('sha256').update(buf).digest('hex').slice(0, 16) + '.webp'
  await writeFile(join(outDir, name), await sharp(buf).rotate().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer())
  return `/assets/flyers/${name}`
}

// held: Map(eventId -> remote image url) for real event photos on hosts we can't hotlink (e.g. nhccnm.org).
export async function mirrorHeld(held, dist) {
  const found = new Map()
  let sharp
  try { sharp = require('sharp') } catch { return found }
  const outDir = join(dist, 'assets', 'flyers')
  await mkdir(outDir, { recursive: true })
  const cache = new Map()
  for (const [id, url] of held) {
    try {
      if (!cache.has(url)) cache.set(url, await mirror(url, outDir, sharp))
      found.set(id, cache.get(url))
    } catch (e) { console.warn('held photo: skip', e.message) }
  }
  console.log(`Mirrored ${found.size}/${held.size} photos from blocked hosts`)
  return found
}

// events: photoless records ({ id, title, venue }). Returns Map(eventId -> '/assets/flyers/x.webp').
export async function fetchFlyers(events, dist) {
  const found = new Map(), report = []
  let sharp
  try { sharp = require('sharp') } catch { console.warn('flyers: sharp unavailable, skipping'); return found }
  const outDir = join(dist, 'assets', 'flyers')
  await mkdir(outDir, { recursive: true })
  const cache = new Map()
  for (const source of FLYER_SOURCES) {
    const targets = events.filter(e => source.venue.test(e.venue || ''))
    if (!targets.length) continue
    let flyers = []
    for (const page of source.pages) {
      try { flyers.push(...await listFlyers(page)) } catch (e) { console.warn('flyers: listing failed', e.message) }
    }
    let hit = 0
    for (const event of targets) {
      const key = normalize(event.title)
      const flyer = flyers.find(f => matches(key, f.title))
      if (!flyer) continue
      try {
        if (!cache.has(flyer.img)) cache.set(flyer.img, await mirror(flyer.img, outDir, sharp))
        found.set(event.id, cache.get(flyer.img)); hit++
      } catch (e) { console.warn('flyers: skip', e.message) }
    }
    report.push(`${source.venue.source}: ${hit}/${targets.length}`)
  }
  console.log('Flyers matched ->', report.join('; ') || 'none')
  return found
}
