import { dateLabel, details, filterEvents, slug } from './calendar.mjs'

const form = document.querySelector('#filters')
const cards = document.querySelector('#cards')
const count = document.querySelector('#count')
const more = document.querySelector('#more')
const template = document.querySelector('#event-card')
const params = new URLSearchParams(location.search)
if (params.get('free') === '1' && !params.has('price')) params.set('price', 'free')
if (params.get('time') === 'weekend') params.set('time', 'this-weekend')
for (const key of ['q', 'category', 'time', 'price', 'date', 'neighborhood', 'venue']) {
  const field = form.elements.namedItem(key)
  if (field && params.has(key)) field.value = key === 'category' ? slug(params.get(key)) : params.get(key)
}
let events, shown = 24

function eventCard(event) {
  const item = template.content.cloneNode(true)
  const img = item.querySelector('img'), link = item.querySelector('a')
  img.src = event.art
  link.href = details(event)
  link.textContent = event.title
  item.querySelector('.tag').textContent = event.category ?? 'Event'
  item.querySelector('.meta').textContent = [dateLabel(event.date), event.time, event.venue, event.price].filter(Boolean).join(' · ')
  return item
}

function render({ append = false } = {}) {
  const filters = Object.fromEntries(new FormData(form))
  const matching = filterEvents(events, filters)
  const start = append ? shown - 24 : 0
  const items = matching.slice(start, shown).map(eventCard)
  if (append) cards.append(...items)
  else cards.replaceChildren(...items)
  count.textContent = matching.length ? `${matching.length} upcoming event${matching.length === 1 ? '' : 's'}` : 'No upcoming events match. Try changing a filter.'
  more.hidden = matching.length <= shown
}

try {
  const response = await fetch('/catalog.json')
  if (!response.ok) throw new Error('Catalog unavailable')
  events = (await response.json()).events
  render()
  more.addEventListener('click', () => { shown += 24; render({ append: true }) })
  form.addEventListener('submit', event => {
    event.preventDefault()
    const query = new URLSearchParams([...new FormData(form)].filter(([, value]) => value))
    history.replaceState(null, '', location.pathname + (query.size ? '?' + query : ''))
    shown = 24
    render()
  })
} catch {
  count.textContent = 'Filters are temporarily unavailable. You can still browse the listings below.'
}
