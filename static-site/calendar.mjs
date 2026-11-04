export const zone = 'America/Denver'
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: zone })
const label = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
export const localDate = (now = new Date()) => dateKey.format(now)
export const dateLabel = (date) => label.format(new Date(date + 'T12:00:00Z'))
export const slug = (name) => (name ?? '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const details = (event) => '/events/' + encodeURIComponent(event.id) + '/'

function offset(day, n) {
  const d = new Date(day + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function clockMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(time ?? '')
  if (!match) return null
  const hour = Number(match[1]), minute = Number(match[2]), period = match[3]?.toUpperCase()
  if (minute > 59 || hour > 23 || (period && (hour < 1 || hour > 12))) return null
  return (period ? (hour % 12) + (period === 'PM' ? 12 : 0) : hour) * 60 + minute
}

export function filterEvents(events, query, today = localDate()) {
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay()
  const friday = offset(today, weekday === 6 || weekday === 0 ? 0 : 5 - weekday)
  const sunday = offset(today, (7 - weekday) % 7)
  const term = (query.q ?? '').trim().toLowerCase()
  return events.filter(event => {
    if (event.date < today || (query.date && event.date !== query.date)) return false
    if (!query.date) {
      if (['today', 'tonight'].includes(query.time) && event.date !== today) return false
      if (query.time === 'tomorrow' && event.date !== offset(today, 1)) return false
      if (['weekend', 'this-weekend'].includes(query.time) && (event.date < friday || event.date > sunday)) return false
      if (query.time === 'this-week' && event.date > offset(today, 6)) return false
    }
    const minutes = clockMinutes(event.time)
    if (query.time === 'tonight' && minutes != null && minutes < 17 * 60) return false
    if (query.category && slug(event.category) !== slug(query.category)) return false
    if (query.neighborhood && slug(event.neighborhood) !== slug(query.neighborhood)) return false
    if (query.venue && event.venueSlug !== query.venue) return false
    if (query.price === 'free' && !/^free(?:\b|$)/i.test(event.price ?? '')) return false
    if (['25', '50'].includes(query.price) && !/^free\b/i.test(event.price ?? '')) {
      const min = /\$\s*(\d+(?:\.\d+)?)/.exec(event.price ?? '')
      if (!min || Number(min[1]) > Number(query.price)) return false
    }
    return !term || [event.title, event.venue, event.category, event.neighborhood].some(s => s?.toLowerCase().includes(term))
  })
}
