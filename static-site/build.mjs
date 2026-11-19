import { copyFile, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORY_SLUG_MAP, cleanDescription, normalizeRow } from '../v2/lib/events.ts'
import { clockMinutes, dateLabel, details, filterEvents, localDate, slug } from './calendar.mjs'

const base = fileURLToPath(new URL('./', import.meta.url))
const publicDir = join(base, '../v2/public')
const site = 'https://abqunplugged.com'
const legacy = 'https://abq-unplugged-v2.netlify.app'
const source = 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const today = localDate()
const previewDays = Number(process.env.ABQ_PREVIEW_DAYS || 0)
const cols = 'id,source,raw,event_date,category,venue_name,venue_slug,neighborhood,image_status,cached_photo_url'
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const clean = (value, max = 200) => cleanDescription(value, max)?.trim() || null
const canonical = path => site + path

// ---- SEO helpers: unique titles/descriptions, structured data, freshness ----
const ld = (...items) => items.filter(Boolean).map(item =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...item }).replace(/</g, '\\u003c')}</script>`).join('')
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortDay = date => dayFmt.format(new Date(date + 'T12:00:00Z'))
const monthYear = date => monthFmt.format(new Date(date + 'T12:00:00Z'))
const shift = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const clip = (text, max = 155) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}
function weekendRange() {
  const wd = new Date(today + 'T12:00:00Z').getUTCDay()
  const fri = shift(today, wd === 6 || wd === 0 ? 0 : 5 - wd), sun = shift(today, (7 - wd) % 7)
  return fri === sun ? shortDay(fri) : shortDay(fri) + '–' + (fri.slice(5, 7) === sun.slice(5, 7) ? String(Number(sun.slice(8))) : shortDay(sun))
}
const offsetCache = new Map()
function mountainOffset(date) {
  if (!offsetCache.has(date)) {
    const value = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', timeZoneName: 'longOffset' })
      .formatToParts(new Date(date + 'T12:00:00Z')).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-07:00'
    offsetCache.set(date, value.replace('GMT', '') || '-07:00')
  }
  return offsetCache.get(date)
}
function startDate(event) {
  const m = clockMinutes(event.time)
  if (m == null) return event.date
  return `${event.date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00${mountainOffset(event.date)}`
}
const crumbs = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) =>
  ({ '@type': 'ListItem', position: i + 1, name, item: canonical(path) })) })
function eventLd(event) {
  const url = canonical(details(event))
  const price = /^free\b/i.test(event.price ?? '') ? 0 : (/\$\s*(\d+(?:\.\d+)?)/.exec(event.price ?? '') ? Number(/\$\s*(\d+(?:\.\d+)?)/.exec(event.price)[1]) : null)
  return { '@type': 'Event', name: event.title, startDate: startDate(event), url,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: event.venue || 'Albuquerque, NM', address: { '@type': 'PostalAddress',
      ...(event.address ? { streetAddress: event.address } : {}), addressLocality: 'Albuquerque', addressRegion: 'NM', addressCountry: 'US' } },
    description: clip(event.description || [event.title, dateLabel(event.date), event.venue].filter(Boolean).join(' · '), 300),
    image: [event.photo ? event.art : site + '/og-image.jpg'],
    ...(price != null ? { offers: { '@type': 'Offer', url: event.tickets || url, price, priceCurrency: 'USD', availability: 'https://schema.org/InStock' } } : {}) }
}

function ticketLink(input) {
  try {
    const u = new URL(input)
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null
  } catch { return null }
}

// PHOTO POLICY (permanent): an event shows a photo only if the resolver
// (cached_photo_url -> raw image, with admin image_status='rejected' => null) gave us a
// real, servable https image. Otherwise it gets a neutral branded placeholder. We never
// substitute category stock photos: they were the source of "wrong photo" complaints
// (a library storytime showing a rock concert).
const PLACEHOLDER = '/assets/map.webp'
const blockedPhotoHosts = /(^|\.)(abqtodo\.com|nhccnm\.org|lovenm\.org|do505\.com)$/i
const genericPhoto = /evbstatic|eb_orange|placeholder|default[-_]?(image|event)|no[-_]?image|e9bd5d127ea|logo/i
function photoUrl(value) {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password || blockedPhotoHosts.test(u.hostname) || genericPhoto.test(u.href)) return null
    return u.href
  } catch { return null }
}

function eventRecord(row) {
  if (!/^[\w-][\w.-]{0,190}$/.test(row.id) || !/^\d{4}-\d{2}-\d{2}$/.test(row.event_date)) return null
  const event = normalizeRow(row)
  const title = clean(event?.title)
  if (!title) return null
  const photo = row.image_status === 'rejected' ? null : photoUrl(event.imageUrl)
  return {
    id: row.id, title, date: row.event_date, time: clean(event.time, 40), venue: clean(event.venue),
    venueSlug: event.venueSlug, category: clean(event.category), neighborhood: clean(event.neighborhood),
    price: clean(event.price, 120), art: photo ?? PLACEHOLDER, photo: Boolean(photo),
    description: clean(event.description, 1000), address: clean(event.address), tickets: ticketLink(event.ticketUrl),
  }
}

async function readEvents(key) {
  if (!key?.startsWith('sb_publishable_')) throw new Error('Set the Supabase publishable key in ABQ_PUBLIC_KEY.')
  const events = [], ids = new Set()
  for (let start = 0; start < 10000; start += 250) {
    const url = new URL('/rest/v1/events', source)
    url.search = new URLSearchParams({ select: cols, hidden: 'eq.false', event_date: 'gte.' + today,
      order: 'event_date.asc,id.asc', offset: String(start), limit: '250' })
    const response = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('Public catalog read failed: HTTP ' + response.status)
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error('Unexpected catalog response')
    for (const row of rows) {
      const event = eventRecord(row)
      if (!event) continue
      if (ids.has(event.id)) throw new Error('Catalog shifted during pagination; retry after writes finish.')
      ids.add(event.id)
      events.push(event)
    }
    if (rows.length < 250) {
      if (events.length < 200 || filterEvents(events, { time: 'this-week' }, today).length < 15) {
        throw new Error('Catalog is unexpectedly sparse. Keep the last good deployment.')
      }
      return events.sort((a,b) => a.date.localeCompare(b.date) ||
        (clockMinutes(a.time) ?? 1440) - (clockMinutes(b.time) ?? 1440) || a.title.localeCompare(b.title))
    }
  }
  throw new Error('Catalog exceeded the bounded snapshot size.')
}

const nav = [['Events','/events/'],['Tonight','/tonight/'],['This weekend','/weekend/'],['Free','/free/']]
function layout({ path, title, description, content, extra = '', seoTitle }) {
  const tabTitle = seoTitle || (path === '/' ? 'ABQ Unplugged — Things to Do in Albuquerque, NM' : title + ' · ABQ Unplugged')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tabTitle)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical(path))}">
<meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:site_name" content="ABQ Unplugged"><meta name="twitter:card" content="summary_large_image">
<meta property="og:title" content="${esc(tabTitle)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical(path))}"><meta property="og:image" content="${site}/og-image.jpg">
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/site.css"><script src="/assets/img.js" defer></script>${extra}</head>
<body><a class="skip" href="#main">Skip to content</a><header class="mast"><div class="wrap"><a href="/"><img src="/assets/logo.svg" alt="ABQ Unplugged" width="144" height="50"></a><nav class="nav" aria-label="Main">${nav.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}</nav></div></header>
<main id="main">${content}</main><footer class="foot"><div class="wrap"><span>Built with love for Albuquerque.</span><a href="/about/">About</a><a href="/submit/">Submit an event</a><a href="/privacy/">Privacy</a><a href="https://www.instagram.com/abqunplugged/">Instagram</a><a href="https://ko-fi.com/stopscrolling">Support ABQ Unplugged</a></div></footer></body></html>`
}

const card = event => `<li class="card"><img${event.photo ? '' : ' class="ph"'} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${event.art}"><div class="body">
<span class="tag">${esc(event.category || 'Event')}</span><h3><a href="${details(event)}">${esc(event.title)}</a></h3>
<p class="meta">${esc([dateLabel(event.date),event.time,event.venue,event.price].filter(Boolean).join(' · '))}</p></div></li>`
const cardTemplate = '<li class="card"><img alt="" loading="lazy" decoding="async"><div class="body"><span class="tag"></span><h3><a></a></h3><p class="meta"></p></div></li>'
const option = (value, label, selected) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`

function filters(events, query) {
  const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort()
  const options = (items, key) => items.map(([v, l]) => option(v,l,query[key])).join('')
  return `<form class="filters" id="filters" aria-label="Filter events" action="/events/">
<label>Search<input name="q" type="search" placeholder="Band, venue, or event"></label>
<label>When<select name="time">${options([['','Any time'],['today','Today'],['tonight','Tonight'],['tomorrow','Tomorrow'],['this-weekend','This weekend'],['this-week','Next 7 days']], 'time')}</select></label>
<label>Category<select name="category">${options([['','All categories'], ...categories.map(c => [slug(c),c])], 'category')}</select></label>
<label>Price<select name="price">${options([['','Any price'],['free','Free'],['25','Up to $25'],['50','Up to $50']], 'price')}</select></label>
${['date','neighborhood','venue'].map(key => `<input type="hidden" name="${key}" value="${esc(query[key])}">`).join('')}
<button class="button" type="submit">Find events</button></form>`
}

function listing(path, title, events, query) {
  const matched = filterEvents(events, query, today)
  const range = weekendRange()
  const phrase = {
    '/': 'upcoming Albuquerque events', '/events/': 'upcoming Albuquerque events',
    '/tonight/': 'things to do in Albuquerque tonight', '/weekend/': `Albuquerque events this weekend (${range})`,
    '/free/': 'free Albuquerque events', '/this-week/': 'Albuquerque events in the next 7 days',
    '/things-to-do-today/': 'things to do in Albuquerque today',
  }[path] ?? (path.startsWith('/categories/') ? title.toLowerCase() + ' in Albuquerque'
    : path.startsWith('/venues/') ? 'upcoming events at ' + title
    : path.startsWith('/neighborhoods/') ? 'upcoming events in ' + title + ', Albuquerque' : 'upcoming Albuquerque events')
  const seoTitle = {
    '/': 'Things to Do in Albuquerque: Events This Week · ABQ Unplugged',
    '/events/': `Albuquerque Events Calendar, ${monthYear(today)} · ABQ Unplugged`,
    '/tonight/': `Things to Do in Albuquerque Tonight (${shortDay(today)}) · ABQ Unplugged`,
    '/weekend/': `Albuquerque Events This Weekend (${range}) · ABQ Unplugged`,
    '/free/': 'Free Events & Things to Do in Albuquerque · ABQ Unplugged',
    '/this-week/': `Albuquerque Events This Week (${shortDay(today)}–${shortDay(shift(today, 6))}) · ABQ Unplugged`,
    '/things-to-do-today/': `Things to Do in Albuquerque Today (${shortDay(today)}) · ABQ Unplugged`,
  }[path] ?? (path.startsWith('/categories/') ? `${title} in Albuquerque, NM · ABQ Unplugged`
    : path.startsWith('/venues/') ? `Events at ${title}, Albuquerque · ABQ Unplugged`
    : path.startsWith('/neighborhoods/') ? `Things to Do in ${title}, Albuquerque · ABQ Unplugged` : undefined)
  const names = matched.slice(0, 3).map(e => e.title)
  const mix = Object.entries(matched.reduce((m, e) => (e.category && (m[e.category] = (m[e.category] || 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} (${n})`)
  const fits = n => `${matched.length} ${phrase}${n ? ': ' + names.slice(0, n).join(', ') : ''}. Updated ${shortDay(today)}.`
  const generic = ['/', '/events/'].includes(path)
  const description = !matched.length || generic
    ? `${matched.length ? matched.length + ' upcoming Albuquerque events' : 'Albuquerque events'}: concerts, festivals, comedy, family outings and free things to do. Updated ${shortDay(today)}.`
    : clip([3, 2, 1, 0].map(fits).find(text => text.length <= 155) ?? fits(0))
  const lead = matched.length
    ? `${matched.length} ${phrase}${names.length ? ', including ' + names.join(', ') : ''}.${mix.length ? ' Most listed: ' + mix.join(', ') + '.' : ''} Updated ${dateLabel(today)}.`
    : 'Nothing is listed for this view right now. Browse the full Albuquerque calendar for upcoming events.'
  const slugOk = k => k && /^[a-z0-9-]+$/.test(k)
  const cats = [...new Set(events.map(e => e.category).filter(Boolean))].sort()
  const hoods = [...new Map(events.filter(e => slugOk(slug(e.neighborhood))).map(e => [slug(e.neighborhood), e.neighborhood])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const browse = `<h2>Browse Albuquerque events by category</h2><nav class="tabs" aria-label="Browse by category">${cats.filter(c => slugOk(slug(c))).map(c => `<a href="/categories/${slug(c)}/">${esc(c)}</a>`).join('')}</nav>
<h2>Things to do by neighborhood</h2><nav class="tabs" aria-label="Browse by neighborhood">${hoods.map(([k, n]) => `<a href="/neighborhoods/${k}/">${esc(n)}</a>`).join('')}</nav>`
  const extra = ld(
    path === '/' ? { '@type': 'WebSite', name: 'ABQ Unplugged', url: site + '/', potentialAction: { '@type': 'SearchAction', target: site + '/events/?q={search_term_string}', 'query-input': 'required name=search_term_string' } } : null,
    path === '/' ? { '@type': 'Organization', name: 'ABQ Unplugged', url: site + '/', sameAs: ['https://www.instagram.com/abqunplugged/'] } : null,
    path !== '/' ? crumbs([['Home', '/'], [title, path]]) : null,
    { '@type': 'ItemList', name: seoTitle?.replace(' · ABQ Unplugged', '') || title, numberOfItems: matched.length,
      itemListElement: matched.slice(0, 24).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: canonical(details(e)), name: e.title })) })
  return layout({ path, title, seoTitle, description, extra, content: `<section class="hero"><div class="wrap"><p class="eyebrow">Albuquerque, New Mexico</p><h1>${esc(title)}</h1><p>${esc(lead)}</p></div></section>
<section class="wrap content" aria-labelledby="upcoming"><h2 id="upcoming">Find your next outing</h2><nav class="tabs" aria-label="Quick filters">${nav.map(([label, href]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
${filters(events, query)}
<p class="count" id="count" aria-live="polite">${matched.length ? matched.length + ' upcoming events' : 'No upcoming events match.'}</p><ul id="cards" class="cards">${matched.slice(0, 24).map(card).join('')}</ul>
<button type="button" class="button" id="more" hidden>Show more events</button><template id="event-card">${cardTemplate}</template>
${browse}
<p class="meta">Calendar refreshed ${dateLabel(today)}. Confirm details with the organizer before you go.</p></section><script type="module" src="/assets/catalog.mjs"></script>` })
}

function detail(event) {
  const path = details(event)
  const facts = [dateLabel(event.date), event.time, event.venue ? 'at ' + event.venue : 'in Albuquerque'].filter(Boolean).join(' ')
  const description = clip(event.description ? `${event.title}, ${facts}. ${event.description}` : `${event.title}, ${facts}. Details and tickets on ABQ Unplugged.`)
  const base = [event.title, dateLabel(event.date), event.venue].filter(Boolean).join(' · ')
  const seoTitle = base.length <= 50 ? base + ' · ABQ Unplugged' : clip(base, 72)
  const meta = [['Date', dateLabel(event.date)],['Time', event.time || 'Time not listed'],['Venue', event.venue],['Address', event.address],['Price',event.price]]
  const extra = ld(eventLd(event), crumbs([['Home', '/'], ['Events', '/events/'], [event.title, path]]))
  return layout({ path, title: event.title, seoTitle, description, extra, content: `<div class="wrap content"><a href="/events/">← All events</a>
<article class="detail"><p class="tag">${esc(event.category || 'Event')}</p><h1>${esc(event.title)}</h1><img${event.photo ? '' : ' class="ph"'} src="${event.art}" alt="" width="950" height="380" referrerpolicy="no-referrer">
<dl>${meta.filter(([,v]) => v).map(([k,v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
${event.description ? `<p>${esc(event.description)}</p>` : ''}
${event.tickets ? `<a class="button" rel="noopener noreferrer" href="${esc(event.tickets)}">Organizer and tickets ↗</a>` : ''}
</article></div>` })
}

const listings = {
  '/': ['Things to do in Albuquerque', {}], '/events/': ['Albuquerque events', {}],
  '/tonight/': ['Things to do in Albuquerque tonight', { time:'tonight' }], '/weekend/': ['Things to do in Albuquerque this weekend', { time:'this-weekend' }],
  '/free/': ['Free events in Albuquerque', { price:'free' }], '/this-week/': ['Things to do in Albuquerque this week', { time:'this-week' }],
  '/things-to-do-today/': ['Things to do in Albuquerque today', { time:'today' }],
  '/ig/': ['What’s happening in ABQ', { time:'this-week' }], '/search/': ['Find Albuquerque events', {}],
}
const aliases = {
  'events-this-weekend':'weekend', 'things-to-do-this-weekend':'weekend', 'weekend-in-albuquerque':'weekend',
  'free-events-albuquerque':'free', 'things-to-do':'', 'things-to-do-in-albuquerque':'',
  'concerts':'categories/music', 'concerts-albuquerque':'categories/music', 'live-music':'categories/music',
  'arts':'categories/arts-theater', 'arts-theater-albuquerque':'categories/arts-theater', 'art-events-albuquerque':'categories/arts-theater',
  'comedy':'categories/comedy', 'comedy-shows-albuquerque':'categories/comedy', 'sports-events':'categories/sports',
  'family-friendly':'categories/family', 'family-events-albuquerque':'categories/family', 'kids-activities':'categories/family',
  'food-drink-events':'categories/food-drink', 'outdoor-activities':'categories/outdoor',
  'outdoor-activities-albuquerque':'categories/outdoor', 'festivals':'categories/festivals',
  'movies':'categories/film',
  // Legacy SEO/landing paths from the old Next app, kept so indexed links do not 404.
  'balloon-fiesta':'events', 'date-night':'events', 'albuquerque-date-night-ideas':'events',
  'brewery-concerts':'categories/music', 'christian-music-albuquerque':'categories/music', 'live-music-tonight':'tonight',
  'comedy-tonight':'categories/comedy', 'farmers-markets-albuquerque':'categories/food-drink', 'nightlife':'categories/community',
  'neighborhood':'neighborhoods', 'feed.xml':'events',
  // Per-user features of the old app (accounts, saved events) no longer exist on the static calendar.
  'for-you':'events', 'saved':'events', 'profile':'events', 'onboarding':'events', 'welcome':'events',
  'leaderboard':'events', 'why':'about', 'offline':'', 'l':'events', 'u':'events',
}

async function writePage(dir, path, content) {
  const file = join(dir, path.slice(1), 'index.html')
  await mkdir(dirname(file), { recursive:true })
  await writeFile(file, content)
}

function information(path, title, copy, actions = '') {
  return layout({ path, title, description: copy, content: `<div class="wrap content"><h1>${esc(title)}</h1><p>${esc(copy)}</p>${actions}</div>` })
}

async function build(dir, events) {
  await mkdir(join(dir, 'assets'), { recursive:true })
  for (const file of ['favicon.ico','og-image.jpg','a8f4c2b1d7e5f3a9b4c8d2e6f1a5b9c3.txt']) await copyFile(join(publicDir,file), join(dir,file))
  for (const [file,target] of [['logo-terra.svg','logo.svg'],['abq-map-bg.webp','map.webp']]) {
    await copyFile(join(publicDir,file), join(dir,'assets',target))
  }
  for (const file of ['calendar.mjs','catalog.mjs','site.css','img.js']) await copyFile(join(base,file), join(dir,'assets',file))

  const routes = new Set()
  const listingPage = async (path,title,query) => { routes.add(path); await writePage(dir,path,listing(path,title,events,query)) }
  for (const [path,[title,query]] of Object.entries(listings)) await listingPage(path,title,query)
  for (const category of new Set(events.map(e => e.category).filter(Boolean))) {
    const key = slug(category)
    if (key) await listingPage('/categories/' + key + '/', category + ' events', { category:key })
  }
  for (const [key, category] of Object.entries(CATEGORY_SLUG_MAP)) {
    if (key !== slug(category)) aliases['categories/' + key] = 'categories/' + slug(category)
  }
  for (const event of events) {
    for (const [basePath,key,name] of [['venues',event.venueSlug,event.venue],['neighborhoods',slug(event.neighborhood),event.neighborhood]]) {
      if (!key || !name || !/^[a-z0-9-]+$/.test(key)) continue
      const path = '/' + basePath + '/' + key + '/'
      if (!routes.has(path)) await listingPage(path,name,basePath === 'venues' ? { venue:key } : { neighborhood:key })
    }
    await writePage(dir,details(event),detail(event))
    routes.add(details(event))
  }
  for (const [segment, title] of [['venues','Albuquerque venues'],['neighborhoods','Albuquerque neighborhoods']]) {
    const prefix = '/' + segment + '/'
    const links = [...routes].filter(path => path.startsWith(prefix)).sort().map(path =>
      `<li><a href="${path}">${esc(path.slice(prefix.length,-1).replace(/-/g,' '))}</a></li>`).join('')
    await writePage(dir,prefix,information(prefix,title,'Explore upcoming events by location.',`<ul>${links}</ul>`))
    routes.add(prefix)
  }
  await writePage(dir,'/about/',information('/about/','About ABQ Unplugged','An independent guide to things to do around Albuquerque. The public calendar is refreshed weekly.'))
  await writePage(dir,'/privacy/',information('/privacy/','Privacy','The public calendar runs from static files. It does not require an account or use tracking scripts. Organizer sites and event submissions have their own privacy policies.'))
  await writePage(dir,'/submit/',information('/submit/','Submit an event','Share an upcoming Albuquerque area event. Approved submissions can appear in the next weekly refresh.',`<a class="button" href="${legacy}/submit">Open the submission form ↗</a>`))
  await writeFile(join(dir,'404.html'),information('/404','Page not found','The event may have passed, or the page may have moved. Browse the calendar for upcoming events.','<a class="button" href="/events/">Browse events</a>'))
  await writeFile(join(dir,'catalog.json'),JSON.stringify({ refreshed: today, events: events.map(({ description: _d,address: _a,tickets: _t,...event }) => event) }))
  await writeFile(join(dir,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    [...routes].map(path => '<url><loc>' + esc(canonical(path)) + '</loc><lastmod>' + today + '</lastmod></url>').join('') + '</urlset>')
  await writeFile(join(dir,'robots.txt'), 'User-agent: *\nDisallow: /admin/\nSitemap: ' + site + '/sitemap.xml\n')
  await writeFile(join(dir,'_redirects'),Object.entries(aliases).map(([from,to]) => `/${from} /${to ? to + '/' : ''} 301`).join('\n') +
    `\n/neighborhood/:slug /neighborhoods/:slug/ 301\n/admin ${legacy}/admin 302\n/admin/* ${legacy}/admin/:splat 302\n/login ${legacy}/login 302\n/feedback ${legacy}/feedback 302\n/surprise-me ${legacy}/api/surprise 302\n/api/* ${legacy}/api/:splat 307\n`)
  await writeFile(join(dir,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
/catalog.json
  Cache-Control: public, max-age=300
`)
  await writeFile(join(dir,'sw.js'),"self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', e => e.waitUntil(caches.delete('abq-shell-v1').then(() => self.registration.unregister())));\n")
}

async function countFiles(dir) {
  let count = 0
  for (const entry of await readdir(dir,{ withFileTypes:true })) {
    count += entry.isDirectory() ? await countFiles(join(dir,entry.name)) : 1
  }
  return count
}

const output = resolve(base, 'dist')
await mkdir(dirname(output), { recursive:true })
const temporary = await mkdtemp(join(dirname(output),'.abq-build-'))
try {
  let events = await readEvents(process.env.ABQ_PUBLIC_KEY)
  if (previewDays > 0) {
    const until = new Date(today + 'T12:00:00Z')
    until.setUTCDate(until.getUTCDate() + previewDays)
    events = events.filter(event => event.date <= until.toISOString().slice(0,10))
  }
  await build(temporary,events)
  if (previewDays > 0) {
    const headers = await import('node:fs/promises').then(fs => fs.readFile(join(temporary,'_headers'),'utf8'))
    await writeFile(join(temporary,'_headers'), headers.replace('/*\n','/*\n  X-Robots-Tag: noindex\n'))
  }
  const files = await countFiles(temporary)
  if (files > 20000) throw new Error('Cloudflare Pages asset limit exceeded.')
  await rm(output,{ recursive:true, force:true })
  await rename(temporary,output)
  console.log(`Built ${files} static files for ${events.length} upcoming events (${today}).`)
} finally {
  await rm(temporary,{ recursive:true, force:true })
}
