/**
 * Conservative semantic matching shared by venue ingestion and the cleanup pass.
 * Date, place, and showing time remain hard safety boundaries.
 */

const TITLE_NOISE = new Set([
  'a', 'an', 'and', 'at', 'live', 'music', 'nm', 'presents', 'the', 'tour', 'w', 'with',
])

function words(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function getEventTitle(row) {
  const raw = row?.raw || {}
  const value = raw.name ?? raw.title ?? raw.event_name ?? ''
  return String(typeof value === 'object' ? value?.text ?? '' : value).trim()
}

export function getEventTime(row) {
  const raw = row?.raw || {}
  const value = raw?.dates?.start?.localTime
    ?? raw?.start_time
    ?? raw?.start?.local
    ?? raw?.datetime_local
    ?? raw?.time
    ?? ''
  const match = String(value).match(/(?:T|\b)(\d{1,2}):(\d{2})/)
  return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : ''
}

export function canonicalTitle(value) {
  let title = String(value || '').toLowerCase()
  title = title
    .replace(/^live music at (?:the )?(?:brewhouse|taproom)\s*[-:–—]?\s*/i, '')
    .replace(/^trivia at (?:the )?(?:brewhouse|taproom)\s*[-:–—]?\s*/i, '')
    .replace(/\s+at (?:the )?(?:brewhouse|taproom)$/i, '')
  return words(title).join(' ')
}

export function strongTitleMatch(a, b) {
  const left = canonicalTitle(a)
  const right = canonicalTitle(b)
  if (!left || !right) return false
  if (left === right) return true

  const compactLeft = left.replace(/\s/g, '')
  const compactRight = right.replace(/\s/g, '')
  const shorter = compactLeft.length <= compactRight.length ? compactLeft : compactRight
  const longer = compactLeft.length > compactRight.length ? compactLeft : compactRight
  if (shorter.length >= 8 && longer.includes(shorter)) return true

  const leftTokens = new Set(words(left).filter(token => !TITLE_NOISE.has(token)))
  const rightTokens = new Set(words(right).filter(token => !TITLE_NOISE.has(token)))
  if (Math.min(leftTokens.size, rightTokens.size) < 2) return false
  const overlap = [...leftTokens].filter(token => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return overlap >= 2 && overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.75 && overlap / union >= 0.5
}

export function canonicalVenue(value) {
  const cleaned = words(value)
    .filter((token, index) => !(index === 0 && token === 'the'))
    .filter(token => !['bar', 'theater', 'theatre'].includes(token))
    .join('')
  if (cleaned.startsWith('nationalhispanicculturalcenter')) return 'nationalhispanicculturalcenter'
  if (cleaned.startsWith('outpostperformancespace')) return 'outpostperformancespace'
  return cleaned
}

export function streetAddress(row) {
  const raw = row?.raw || {}
  const embedded = raw?._embedded?.venues?.[0]
  const value = raw.address ?? embedded?.address?.line1 ?? ''
  return String(value)
    .split(',')[0]
    .toLowerCase()
    .replace(/\b(street|st\.?)\b/g, 'st')
    .replace(/\b(avenue|ave\.?)\b/g, 'ave')
    .replace(/\b(boulevard|blvd\.?)\b/g, 'blvd')
    .replace(/\b(road|rd\.?)\b/g, 'rd')
    .replace(/\b(drive|dr\.?)\b/g, 'dr')
    .replace(/[^a-z0-9]/g, '')
}

export function samePlace(a, b) {
  const aStreet = streetAddress(a)
  const bStreet = streetAddress(b)
  if (aStreet && bStreet && aStreet === bStreet) return true
  if (aStreet && bStreet) {
    const direction = value => value.match(/(nw|ne|sw|se)$/)?.[1] ?? ''
    const withoutDirection = value => value.replace(/(nw|ne|sw|se)$/, '')
    const aDirection = direction(aStreet)
    const bDirection = direction(bStreet)
    if (withoutDirection(aStreet) === withoutDirection(bStreet)
        && (!aDirection || !bDirection)) return true
  }
  const aVenue = canonicalVenue(a?.venue_name ?? a?.raw?.venue_name ?? a?.raw?.venue)
  const bVenue = canonicalVenue(b?.venue_name ?? b?.raw?.venue_name ?? b?.raw?.venue)
  return Boolean(aVenue && bVenue && (
    aVenue === bVenue ||
    (Math.min(aVenue.length, bVenue.length) >= 8 && (aVenue.startsWith(bVenue) || bVenue.startsWith(aVenue)))
  ))
}

export function duplicateReason(a, b, datePeers = []) {
  if (String(a?.event_date).slice(0, 10) !== String(b?.event_date).slice(0, 10)) return null
  if (!samePlace(a, b)) return null

  const aTitle = getEventTitle(a)
  const bTitle = getEventTitle(b)
  if (!strongTitleMatch(aTitle, bTitle)) return null

  const aTime = getEventTime(a)
  const bTime = getEventTime(b)
  if (aTime && bTime) return aTime === bTime ? 'same place, date, time, and matching title' : null

  // A missing time is only safe when title and street address are exact and
  // there is no evidence of multiple showings that day.
  if (canonicalTitle(aTitle) !== canonicalTitle(bTitle)) return null
  const aStreet = streetAddress(a)
  const bStreet = streetAddress(b)
  if (!aStreet || aStreet !== bStreet) return null
  const knownTimes = new Set(datePeers
    .filter(peer => streetAddress(peer) === aStreet && canonicalTitle(getEventTitle(peer)) === canonicalTitle(aTitle))
    .map(getEventTime)
    .filter(Boolean))
  return knownTimes.size <= 1 ? 'same exact title, date, and address with one possible showing' : null
}

export function findSemanticDuplicateGroups(rows) {
  const parent = new Map(rows.map(row => [row.id, row.id]))
  const reasons = new Map()
  const find = id => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)
    while (parent.get(id) !== id) {
      const next = parent.get(id)
      parent.set(id, root)
      id = next
    }
    return root
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  const byDate = new Map()
  for (const row of rows) {
    const key = String(row.event_date).slice(0, 10)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(row)
  }

  for (const peers of byDate.values()) {
    for (let i = 0; i < peers.length; i++) {
      for (let j = i + 1; j < peers.length; j++) {
        const reason = duplicateReason(peers[i], peers[j], peers)
        if (!reason) continue
        union(peers[i].id, peers[j].id)
        reasons.set(`${peers[i].id}\0${peers[j].id}`, reason)
      }
    }
  }

  const groups = new Map()
  for (const row of rows) {
    const root = find(row.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(row)
  }
  return [...groups.values()]
    .filter(group => group.length > 1)
    .map(group => ({ rows: group, reasons }))
}

export function collapseExtractedVenueEvents(events) {
  const kept = []
  const dropped = []
  for (const event of events) {
    const matchIndex = kept.findIndex(existing =>
      existing.date === event.date &&
      (existing.time ?? '') === (event.time ?? '') &&
      strongTitleMatch(existing.title, event.title)
    )
    if (matchIndex === -1) {
      kept.push(event)
      continue
    }
    const existing = kept[matchIndex]
    const winner = String(existing.title).length <= String(event.title).length ? existing : event
    const loser = winner === existing ? event : existing
    kept[matchIndex] = winner
    dropped.push(loser)
  }
  return { events: kept, dropped }
}
