import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackCaption, formatTime, parseCaptionResponse, selectEvents } from './ig-autopost.mjs'

test('accepts the preferred plain-text caption format', () => {
  assert.equal(parseCaptionResponse('Burque has plans.\n\nFull details at the link in bio.'), 'Burque has plans.\n\nFull details at the link in bio.')
})

test('formats on-the-hour event times compactly for narrow Reel metadata', () => {
  assert.equal(formatTime('20:00:00'), '8 PM')
  assert.equal(formatTime('8:00 pm'), '8 PM')
  assert.equal(formatTime('18:30'), '6:30 PM')
})

test('unwraps legacy JSON captions and decodes line breaks', () => {
  const value = '{"caption":"Three picks for Burque.\\n\\nWhich one is yours? 👇\\n\\n#ABQ #Burque"}'
  assert.equal(parseCaptionResponse(value), 'Three picks for Burque.\n\nWhich one is yours? 👇\n\n#ABQ #Burque')
})

test('extracts a JSON caption surrounded by model commentary', () => {
  const value = 'Here is the caption:\n{"caption":"One good weekend.\\n\\n#ABQ"}\nHope this helps.'
  assert.equal(parseCaptionResponse(value), 'One good weekend.\n\n#ABQ')
})

test('recovers the malformed wrapper that previously leaked to Instagram', () => {
  const value = '{"caption": "Riley Green and Lobo football.\\n\\nTwo big gatherings.\\n\\n#ABQ #Burque"}'
  assert.equal(parseCaptionResponse(value), 'Riley Green and Lobo football.\n\nTwo big gatherings.\n\n#ABQ #Burque')
})

test('digest fallback stays short and does not duplicate the event list', () => {
  const caption = fallbackCaption([
    { title: 'First Event' },
    { title: 'Second Event' },
  ], { kind: 'digest' })

  assert.equal(caption.includes('First Event'), false)
  assert.equal(caption.includes('Second Event'), false)
  assert.ok(caption.split(/\s+/).length < 60)
  assert.equal((caption.match(/#[\w]+/g) ?? []).length, 6)
})

test('weekly summary selects at most one event from each date', () => {
  const events = Array.from({ length: 7 }, (_, day) => ({
    id: `event-${day}`,
    title: `Event ${day}`,
    date: `2026-09-${String(14 + day).padStart(2, '0')}`,
    venue: `Venue ${day}`,
    category: day % 2 ? 'Music' : 'Family',
    imageUrl: `https://example.com/${day}.jpg`,
    popularityScore: 10 - day,
  }))
  events.push({ ...events[0], id: 'second-on-monday', title: 'Second Monday Event', popularityScore: 9.5 })
  events.push({ ...events[1], id: 'same-series-later', date: '2026-09-20', popularityScore: 9.4 })

  const selected = selectEvents(
    { id: 'weekly-summary', kind: 'digest', period: 'this-week' },
    events,
    '2026-09-14',
    new Set(),
  )

  assert.equal(selected.length, 5)
  assert.equal(new Set(selected.map(event => event.date)).size, 5)
  assert.equal(selected.filter(event => event.title === 'Event 1').length, 1)
})
