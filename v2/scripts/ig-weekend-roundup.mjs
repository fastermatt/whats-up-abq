import sharp from 'sharp'

const WIDTH = 1080
const HEIGHT = 1350
const heading = 'What’s Happening This Weekend'
const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
})

function groupByDay(events) {
  const days = new Map()
  for (const event of events) {
    const day = dayFormat.format(new Date(event.date + 'T12:00:00Z'))
    if (!days.has(day)) days.set(day, [])
    days.get(day).push(event)
  }
  return days
}

function shorten(value, max) {
  const text = value.replace(/\s+/gu, ' ').trim()
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : text
}

function metadata(event, venueLength) {
  return [event.time || 'Time not listed', shorten(event.venue, venueLength)].join(' · ')
}

export function weekendCaption(events) {
  const sections = [...groupByDay(events)].map(([day, entries]) => [
    day,
    ...entries.map(event => `• ${shorten(event.title, 105)} | ${metadata(event, 65)}`),
  ].join('\n'))
  return [heading, ...sections, 'More events at the link in bio.'].join('\n\n')
}

// Text must stay inside the 910px column (x 85–995). DejaVu Sans Bold averages
// about 0.66em per character and the regular weight about 0.6em, so these limits
// keep the widest realistic titles and venue lines from running off the image.
const COLUMN_WIDTH = 910
const TITLE_EM = 0.66
const TITLE_MIN = 28
const TITLE_MAX = 38
const META_MAX_CHARS = Math.floor(COLUMN_WIDTH / (25 * 0.6))

export function fitTitle(value) {
  const maxChars = Math.floor(COLUMN_WIDTH / (TITLE_MIN * TITLE_EM))
  const title = shorten(value, maxChars)
  const fitted = Math.floor(COLUMN_WIDTH / (Array.from(title).length * TITLE_EM))
  return { title, titleSize: Math.max(TITLE_MIN, Math.min(TITLE_MAX, fitted)) }
}

const escape = value => value.replace(/[<>&]/gu, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[character])

export function renderWeekendRoundup(events) {
  const groups = [...groupByDay(events)]
  const rowHeight = 74
  const dayHeight = 50
  const dayGap = 18
  const contentHeight = groups.reduce((total, [, entries]) => total + dayHeight + entries.length * rowHeight + dayGap, 0)
  let y = 320 + Math.min(85, Math.floor((880 - contentHeight) / 3))
  const sections = groups.map(([day, entries]) => {
    const dayY = y
    y += dayHeight
    const rows = entries.map(event => {
      const baseline = y
      y += rowHeight
      const { title, titleSize } = fitTitle(event.title)
      return `<text x="85" y="${baseline}" font-size="${titleSize}" font-weight="700">${escape(title)}</text>
        <text x="85" y="${baseline + 30}" fill="#51453e" font-size="25">${escape(shorten(metadata(event, 46), META_MAX_CHARS))}</text>`
    }).join('')
    y += dayGap
    return `<text x="85" y="${dayY}" fill="#99412a" font-size="29" font-weight="700">${escape(day.toUpperCase())}</text>
      <path d="M85 ${dayY + 14}H995" stroke="#d9c7b5" stroke-width="2"/>${rows}`
  }).join('')
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#fbf7f1"/>
    <path d="M0 0H1080V21H0Z" fill="#99412a"/>
    <g font-family="DejaVu Sans, sans-serif" fill="#221c19">
      <text x="85" y="112" fill="#99412a" font-size="25" font-weight="700" letter-spacing="3">ABQ UNPLUGGED</text>
      <text x="82" y="190" font-size="65" font-weight="700">What’s Happening</text>
      <text x="82" y="258" font-size="65" font-weight="700">This Weekend</text>
      ${sections}
      <path d="M85 1195H995" stroke="#d9c7b5" stroke-width="2"/>
      <text x="85" y="1235" font-size="25" font-weight="700">abqunplugged.com</text>
    </g>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}
