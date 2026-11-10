import assert from 'node:assert/strict'
import { access, readFile, stat } from 'node:fs/promises'
import { details } from './calendar.mjs'
import { BEACON_SRC, analyticsToken } from './analytics.mjs'

const root = new URL('./dist/', import.meta.url)
const file = path => new URL(path.replace(/^\//,''), root)
const read = path => readFile(file(path), 'utf8')
const { events, refreshed } = JSON.parse(await read('catalog.json'))
assert.match(refreshed, /^\d{4}-\d{2}-\d{2}$/)
assert.ok(events.length >= 200)
assert.equal(new Set(events.map(e => e.id)).size, events.length)
for (const route of ['index.html','events/index.html','tonight/index.html','weekend/index.html','free/index.html','404.html']) {
  const html = await read(route)
  assert.match(html, /ABQ Unplugged/)
  assert.doesNotMatch(html, /\/_next\/|\.supabase\.co|\.netlify\/functions/)
}
for (const event of events) {
  assert.ok(event.date >= refreshed)
  await access(file(details(event) + 'index.html'))
}
for (const art of new Set(events.map(e=>e.art))) assert.ok((await stat(file(art))).size > 0)
assert.ok((await stat(file('catalog.json'))).size < 1024 * 1024)
await assert.rejects(access(file('_worker.js')), { code:'ENOENT' })
const analytics = analyticsToken(process.env.ABQ_CF_ANALYTICS_TOKEN)
const headers = await read('_headers')
const privacy = await read('privacy/index.html')
for (const route of ['index.html','events/index.html','weekend/index.html','privacy/index.html','404.html']) {
  const html = await read(route)
  if (analytics) assert.ok(html.includes(BEACON_SRC) && html.includes(analytics), `${route} is missing the analytics beacon`)
  else assert.ok(!html.includes(BEACON_SRC), `${route} has an analytics beacon but no token is configured`)
}
if (analytics) {
  assert.match(headers, /script-src 'self' https:\/\/static\.cloudflareinsights\.com/)
  assert.match(headers, /connect-src 'self' https:\/\/cloudflareinsights\.com/)
  assert.match(privacy, /Cloudflare Web Analytics/)
} else {
  assert.doesNotMatch(headers, /cloudflareinsights/)
  assert.match(privacy, /does not use tracking scripts/)
}
console.log(`Verified ${events.length} event pages, local images, core routes, and analytics (${analytics ? 'on' : 'off'}).`)
