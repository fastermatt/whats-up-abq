import assert from 'node:assert/strict'
import { access, readFile, stat } from 'node:fs/promises'
import { details } from './calendar.mjs'

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
  // Hosted event photos live in our public Supabase Storage bucket; any other database host is a leak.
  assert.doesNotMatch(html.replace(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/event-photos\/[^"'\s]*/g, ''), /\/_next\/|\.supabase\.co|\.netlify\/functions/)
}
for (const event of events) {
  assert.ok(event.date >= refreshed)
  await access(file(details(event) + 'index.html'))
}
for (const art of new Set(events.map(e=>e.art))) {
  assert.doesNotMatch(art, /\/assets\/photos\//, 'category stock photos must never be used as event photos')
  if (art.startsWith('/')) assert.ok((await stat(file(art))).size > 0)
  else assert.match(art, /^https:\/\//)
}
assert.ok(events.every(e => e.photo === (e.art !== '/assets/map.webp')))
assert.ok((await stat(file('catalog.json'))).size < 1024 * 1024)
await assert.rejects(access(file('_worker.js')), { code:'ENOENT' })
console.log(`Verified ${events.length} event pages, local images, and core routes.`)
