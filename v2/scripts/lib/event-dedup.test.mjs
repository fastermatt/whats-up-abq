import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collapseExtractedVenueEvents,
  duplicateReason,
  getEventTime,
  samePlace,
  strongTitleMatch,
} from './event-dedup.mjs'

const row = ({ id, title, date = '2026-09-03', time = '19:00', venue = 'Sister Bar', address = '407 Central Ave NW' }) => ({
  id,
  event_date: date,
  venue_name: venue,
  raw: { title, start_time: time, address },
})

test('venue wrappers collapse without weakening title matching', () => {
  assert.equal(strongTitleMatch('The Mothership', 'Live Music at the Brewhouse The Mothership'), true)
  assert.equal(strongTitleMatch('Brain Gang Trivia', 'Trivia at the Taproom Brain Gang Trivia'), true)
  assert.equal(strongTitleMatch("Thursday Nights at Babydoll's with John Rangel", "Thursday Nights at Babydoll's with Michael Matison"), false)
})

test('venue aliases and street addresses identify the same place', () => {
  assert.equal(samePlace(row({ id: 'a', title: 'Faetooth', venue: 'Sister' }), row({ id: 'b', title: 'Faetooth', venue: 'Sister Bar' })), true)
  assert.equal(samePlace(row({ id: 'a', title: 'Sex Trivia', venue: 'Marble Brewery Downtown', address: '111 Marble Ave NW' }), row({ id: 'b', title: 'Sex Trivia', venue: 'Marble Brewery NE Heights', address: '9904 Montgomery Blvd NE' })), false)
})

test('one omitted street quadrant matches, but conflicting quadrants do not', () => {
  assert.equal(samePlace(
    row({ id: 'a', title: 'Faetooth', venue: '', address: '407 Central Ave. NW' }),
    row({ id: 'b', title: 'Faetooth', venue: '', address: '407 Central Avenue' })
  ), true)
  assert.equal(samePlace(
    row({ id: 'a', title: 'Show', venue: '', address: '407 Central Avenue NW' }),
    row({ id: 'b', title: 'Show', venue: '', address: '407 Central Avenue NE' })
  ), false)
})

test('same place and title still requires the same explicit showing time', () => {
  const evening = row({ id: 'a', title: 'Company', time: '19:30' })
  const matinee = row({ id: 'b', title: 'Company', time: '14:00' })
  assert.equal(duplicateReason(evening, matinee, [evening, matinee]), null)
})

test('exact title/address with one possible time safely absorbs an untimed listing', () => {
  const timed = row({ id: 'a', title: 'Poetry & Beer', time: '19:00', venue: 'Tractor Brewing', address: '1800 4th St NW, Albuquerque' })
  const untimed = row({ id: 'b', title: 'Poetry & Beer', time: null, venue: 'Albuquerque', address: '1800 4th St NW' })
  assert.match(duplicateReason(timed, untimed, [timed, untimed]), /one possible showing/)
  const secondShowing = row({ id: 'c', title: 'Poetry & Beer', time: '21:00', venue: 'Tractor Brewing', address: '1800 4th St NW' })
  assert.equal(duplicateReason(timed, untimed, [timed, untimed, secondShowing]), null)
})

test('local start_time is recognized', () => {
  assert.equal(getEventTime(row({ id: 'a', title: 'Open Mic', time: '6:30' })), '06:30')
})

test('venue extraction collapses marketing-title duplicates before upsert', () => {
  const result = collapseExtractedVenueEvents([
    { title: 'The Mothership', date: '2026-09-03', time: '18:00' },
    { title: 'Live Music at the Brewhouse The Mothership', date: '2026-09-03', time: '18:00' },
    { title: 'Another Band', date: '2026-09-03', time: '20:00' },
  ])
  assert.deepEqual(result.events.map(event => event.title), ['The Mothership', 'Another Band'])
  assert.equal(result.dropped.length, 1)
})
