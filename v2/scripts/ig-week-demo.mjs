// Renders a representative WEEK of 7 daily IG posts (demo / dry-run) using the
// server-side render path. Real events, accurate times, real photos.
// Usage: node scripts/ig-week-demo.mjs --token $ADMIN_SECRET
import { mkdir, writeFile } from 'node:fs/promises'
import { renderIG } from './ig-render.mjs'

const BASE = process.env.IG_BASE_URL || 'http://localhost:3000'
const TOKEN = process.argv.includes('--token')
  ? process.argv[process.argv.indexOf('--token') + 1]
  : process.env.ADMIN_SECRET
const OUTDIR = '/tmp/ig-demo'

const IMG = {
  kenny: 'https://s1.ticketm.net/dam/a/3c1/7e76aba7-9025-49a5-a16c-56a616d703c1_RETINA_PORTRAIT_3_2.jpg',
  joe: 'https://seatgeekimages.com/performers-landscape/joe-machi-942553/24695/huge.jpg',
  herb: 'https://seatgeekimages.com/performers-landscape/herb-alpert-07bc34/850/66663/huge.jpg',
  company: 'https://seatgeekimages.com/performers-landscape/company-the-musical-aafbdb/9416/huge.jpg',
  loverboy: 'https://s1.ticketm.net/dam/a/402/3457e611-0b68-4f0d-8122-4bd815cd8402_TABLET_LANDSCAPE_LARGE_16_9.jpg',
  sanpacho: 'https://seatgeekimages.com/performers-landscape/san-pacho-8bc901/801053/huge.jpg',
  flamenco: 'https://nhccnm.org/wp-content/uploads/2026/02/Maria-Pages.png',
}

const weekEvents = [
  { title: 'Kenny Wayne Shepherd', date: '2026-06-17', time: '7:30 PM', venue: 'Kiva Auditorium', category: 'Music' },
  { title: 'Joe Machi', date: '2026-06-19', time: '6:30 PM', venue: "Hyena's Comedy Nightclub", category: 'Comedy' },
  { title: 'Herb Alpert', date: '2026-06-19', time: '7:30 PM', venue: 'Kiva Auditorium', category: 'Music' },
  { title: 'Company - The Musical', date: '2026-06-19', time: '7:30 PM', venue: 'The Historic El Rey Theater', category: 'Arts & Theater' },
  { title: 'Loverboy', date: '2026-06-20', time: '7:00 PM', venue: 'Route 66 Casino', category: 'Music' },
  { title: 'Festival Flamenco: María Pagés', date: '2026-06-20', time: '8:00 PM', venue: 'National Hispanic Cultural Center', category: 'Arts & Theater' },
]

const weekendEvents = [
  { title: 'Loverboy', date: '2026-06-20', time: '7:00 PM', venue: 'Route 66 Casino', category: 'Music' },
  { title: 'Festival Flamenco: María Pagés', date: '2026-06-20', time: '8:00 PM', venue: 'National Hispanic Cultural Center', category: 'Arts & Theater' },
  { title: 'Evolution of the Blues', date: '2026-06-20', time: '7:30 PM', venue: 'Outpost Performance Space', category: 'Music' },
  { title: 'San Pacho', date: '2026-06-20', time: '8:45 PM', venue: 'Revel Entertainment Center', category: 'Music' },
  { title: 'Joe Machi', date: '2026-06-20', time: '8:30 PM', venue: "Hyena's Comedy Nightclub", category: 'Comedy' },
  { title: 'Company - The Musical', date: '2026-06-21', time: '2:00 PM', venue: 'The Historic El Rey Theater', category: 'Arts & Theater' },
]

const topThreeEvents = [
  { title: 'Loverboy', date: '2026-06-20', time: '7:00 PM', venue: 'Route 66 Casino', category: 'Music', imageUrl: IMG.loverboy },
  { title: 'San Pacho', date: '2026-06-20', time: '8:45 PM', venue: 'Revel Entertainment Center', category: 'Music', imageUrl: IMG.sanpacho },
  { title: 'Festival Flamenco: María Pagés', date: '2026-06-20', time: '8:00 PM', venue: 'National Hispanic Cultural Center', category: 'Arts & Theater', imageUrl: IMG.flamenco },
]

const POSTS = [
  { day: '1-mon', label: 'Mon — This Week in ABQ', templateId: 'weekly-summary',
    ctx: { events: weekEvents, postDate: '2026-06-16' } },
  { day: '2-tue', label: 'Tue — Spotlight: Kenny Wayne Shepherd', templateId: 'poster',
    ctx: { title: 'Kenny Wayne Shepherd', date: '2026-06-17', time: '7:30 PM', venue: 'Kiva Auditorium', category: 'Music', imageUrl: IMG.kenny,
      tagline: 'Three decades of Ledbetter Heights, live.', cta: 'abqunplugged.com' } },
  { day: '3-wed', label: 'Wed — Spotlight: Joe Machi', templateId: 'golden-hour',
    ctx: { title: 'Joe Machi', date: '2026-06-19', time: '6:30 PM', venue: "Hyena's Comedy Nightclub", category: 'Comedy', imageUrl: IMG.joe,
      tagline: 'Stand-up at Hyena’s this Friday.', cta: 'abqunplugged.com' } },
  { day: '4-thu', label: 'Thu — Spotlight: Herb Alpert', templateId: 'split',
    ctx: { title: 'Herb Alpert', date: '2026-06-19', time: '7:30 PM', venue: 'Kiva Auditorium', category: 'Music', imageUrl: IMG.herb,
      tagline: 'The Tijuana Brass sound, in person.', cta: 'abqunplugged.com' } },
  { day: '5-fri', label: 'Fri — This Weekend in ABQ', templateId: 'weekend-digest',
    ctx: { events: weekendEvents, postDate: '2026-06-19' } },
  { day: '6-sat', label: 'Sat — Top 3 This Weekend', templateId: 'top-three',
    ctx: { events: topThreeEvents, postDate: '2026-06-20' } },
  { day: '7-sun', label: 'Sun — Spotlight: Company – The Musical', templateId: 'terra',
    ctx: { title: 'Company - The Musical', date: '2026-06-21', time: '2:00 PM', venue: 'The Historic El Rey Theater', category: 'Arts & Theater', imageUrl: IMG.company,
      tagline: 'Sondheim’s classic, Sunday matinee.', cta: 'abqunplugged.com' } },
]

async function main() {
  if (!TOKEN) throw new Error('need --token or ADMIN_SECRET')
  await mkdir(OUTDIR, { recursive: true })
  const manifest = []
  for (const post of POSTS) {
    process.stdout.write(`rendering ${post.day} (${post.templateId})... `)
    try {
      const { buffer, width, height } = await renderIG({
        baseUrl: BASE, adminToken: TOKEN, templateId: post.templateId, ctx: post.ctx, format: '4:5',
      })
      const out = `${OUTDIR}/${post.day}.png`
      await writeFile(out, buffer)
      console.log(`OK ${width}x${height} ${buffer.length}b -> ${out}`)
      manifest.push({ ...post, out, width, height, bytes: buffer.length, ok: true })
    } catch (err) {
      console.log(`FAIL ${err.message}`)
      manifest.push({ ...post, ok: false, error: err.message })
    }
  }
  console.log('\n=== MANIFEST ===')
  for (const m of manifest) console.log(`${m.ok ? 'OK ' : 'XX '} ${m.day}  ${m.templateId.padEnd(15)} ${m.label}`)
}

main().catch(e => { console.error(e); process.exit(1) })
