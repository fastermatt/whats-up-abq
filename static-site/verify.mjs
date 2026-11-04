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
  assert.doesNotMatch(html, /\/_next\/|\.supabase\.co|\.netlify\/functions/)
}
for (const event of events) {
  assert.ok(event.date >= refreshed)
  await access(file(details(event) + 'index.html'))
}
for (const art of new Set(events.map(e=>e.art))) assert.ok((await stat(file(art))).size > 0)
assert.ok((await stat(file('catalog.json'))).size < 1024 * 1024)
await assert.rejects(access(file('_worker.js')), { code:'ENOENT' })
console.log(`Verified ${events.length} event pages, local images, and core routes.`)
