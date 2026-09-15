import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackCaption, formatTime, parseCaptionResponse, resolveCaption, selectEvents } from './ig-autopost.mjs'

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

test('reviewed caption override bypasses the model and still applies safety limits', async () => {
  let generated = false
  const caption = await resolveCaption(
    'Reviewed copy.\n\n#One #Two #Three #Four #Five #Six #Seven',
    async () => { generated = true; return 'model copy' },
    ['@venue'],
  )

  assert.equal(generated, false)
  assert.equal((caption.match(/#[\w]+/g) ?? []).length, 6)
  assert.match(caption, /@venue$/)
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

test('top-three never repeats an event series across dates', () => {
  const events = [
    { id: 'band-fri', title: 'Bands of Enchantment Live', date: '2026-09-18', venue: 'KiMo Theatre', category: 'Music', imageUrl: 'https://example.com/fri.jpg', popularityScore: 10 },
    { id: 'band-sat', title: 'Bands of Enchantment Live', date: '2026-09-19', venue: 'KiMo Theatre', category: 'Music', imageUrl: 'https://example.com/sat.jpg', popularityScore: 9.8 },
    { id: 'rodeo', title: 'Tanya Tucker with PRCA Rodeo', date: '2026-09-18', venue: 'Tingley Coliseum', category: 'Music', imageUrl: 'https://example.com/rodeo.jpg', popularityScore: 9.5 },
    { id: 'comedy', title: 'Kevin Sullivan', date: '2026-09-17', venue: "Hyena's Comedy Nightclub", category: 'Comedy', imageUrl: 'https://example.com/comedy.jpg', popularityScore: 9 },
  ]

  const selected = selectEvents(
    { id: 'top-three', kind: 'digest', period: 'next-10' },
    events,
    '2026-09-14',
    new Set(),
  )

  assert.deepEqual(selected.map(event => event.id), ['band-fri', 'comedy', 'rodeo'])
})

test('top-three collapses opposing team rows for one sports game', () => {
  const events = [
    { id: 'lobos', title: 'New Mexico Lobos Football', date: '2026-09-12', venue: 'University Stadium', category: 'Sports', imageUrl: 'https://example.com/lobos.jpg', popularityScore: 9.5 },
    { id: 'mercyhurst', title: 'Mercyhurst Lakers at New Mexico', date: '2026-09-12', venue: 'University Stadium', category: 'Sports', imageUrl: 'https://example.com/lakers.jpg', popularityScore: 9 },
    { id: 'emo', title: 'Emo Nite', date: '2026-09-12', venue: 'Launchpad', category: 'Music', imageUrl: 'https://example.com/emo.jpg', popularityScore: 8.5 },
    { id: 'dance', title: 'Next Generation Dance Group', date: '2026-09-12', venue: 'Indian Pueblo Cultural Center', category: 'Arts & Theater', imageUrl: 'https://example.com/dance.jpg', popularityScore: 8 },
  ]

  const selected = selectEvents(
    { id: 'top-three', kind: 'digest', period: 'next-10' },
    events,
    '2026-09-10',
    new Set(),
  )

  assert.deepEqual(selected.map(event => event.id), ['lobos', 'emo', 'dance'])
})

test('top-three excludes unverified direct-venue artwork', () => {
  const events = [
    { id: 'bad-flyer', title: 'Drag Bingo', date: '2026-09-19', venue: 'Canteen Brewhouse', category: 'Food & Drink', source: 'local-venue', imageStatus: 'unverified', imageUrl: 'https://example.com/beer-pairings.png', popularityScore: 10 },
    { id: 'verified-local', title: 'Local Concert', date: '2026-09-19', venue: 'Canteen Brewhouse', category: 'Music', source: 'local-venue', imageStatus: 'verified', imageUrl: 'https://example.com/concert.jpg', popularityScore: 9.5 },
    { id: 'api-event', title: 'Touring Show', date: '2026-09-20', venue: 'KiMo Theatre', category: 'Arts & Theater', source: 'ticketmaster', imageStatus: 'unverified', imageUrl: 'https://example.com/show.jpg', popularityScore: 9 },
  ]

  const selected = selectEvents(
    { id: 'top-three', kind: 'digest', period: 'next-10' },
    events,
    '2026-09-15',
    new Set(),
  )

  assert.deepEqual(selected.map(event => event.id), ['verified-local', 'api-event'])
})
