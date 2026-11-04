import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clockMinutes, filterEvents, localDate } from './calendar.mjs'

const event = (date, time, extra) => ({ date, time, title: 'Jazz in ABQ', category: 'Music', ...extra })
test('calendar follows Albuquerque dates, including after UTC midnight', () => {
  assert.equal(localDate(new Date('2026-11-05T04:00:00Z')), '2026-11-04')
})
test('weekend includes Friday through Sunday; older events never appear', () => {
  const days = ['2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09']
  const events = days.map(date => event(date,'7:00 PM'))
  assert.deepEqual(filterEvents(events,{time:'this-weekend'},'2026-11-04').map(e=>e.date), days.slice(1,4))
  assert.deepEqual(filterEvents(events,{time:'this-weekend'},'2026-11-08').map(e=>e.date), [days[3]])
})
test('tonight honors clock time and free filters require an explicit price', () => {
  const date = '2026-11-04'
  const free = event(date,'5:00 PM',{price:'Free',venue:'Outpost'})
  assert.equal(clockMinutes('12:00 AM'),0)
  assert.equal(clockMinutes('12:00 PM'),720)
  assert.deepEqual(filterEvents([event(date,'4:59 PM',{price:'Free'}),event(date,null),free],{ time:'tonight',price:'free',q:'outpost' },date),[free])
})
