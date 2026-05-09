/**
 * Admin — Instagram Posts
 *
 * Sections in priority order:
 *   1. Event Spotlights — per-event branded cards + 4 caption styles (searchable client-side)
 *   2. Round-Up Posts   — Tonight's picks + weekly digest (live data, updates daily)
 *   3. Site Promo Posts — 6 brand designs for site-promotion content
 */
import { fetchEvents, fetchTonightRanked, NormalizedEvent } from '@/lib/events'
import { CaptionCard } from './CaptionCard'
import { PromoCard, PromoVariant } from './PromoCard'
import { RoundUpCard } from './RoundUpCard'
import { QuickPostInput } from './QuickPostInput'
import { EventSpotlightsList, type SpotlightItem } from './EventSpotlightsList'

export const dynamic = 'force-dynamic'

// ─── Hashtag sets ─────────────────────────────────────────────────────────────

const BASE_TAGS = '#ABQUnplugged #Albuquerque #ABQ #NewMexico #505'
const MUSIC_TAGS = '#ABQMusic #LiveMusicABQ #AlbuquerqueMusic'
const ARTS_TAGS  = '#ABQArts #AlbuquerqueArts #NMArts'
const FOOD_TAGS  = '#ABQFood #AlbuquerqueEats #NMFood'
const FAMS_TAGS  = '#ABQKids #AlbuquerqueFamilies #NMFamily'
const OUTDR_TAGS = '#ABQOutdoors #NewMexicoOutdoors #NMOutdoors'
const SPORT_TAGS = '#ABQSports #AlbuquerqueSports #NMSports'

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

function catEmoji(c: string | null) { return CAT_EMOJI[c ?? ''] ?? '📍' }

function catTags(category: string | null): string {
  switch (category) {
    case 'Music':          return MUSIC_TAGS
    case 'Arts & Theater': return ARTS_TAGS
    case 'Food & Drink':   return FOOD_TAGS
    case 'Family':         return FAMS_TAGS
    case 'Outdoor':        return OUTDR_TAGS
    case 'Sports':         return SPORT_TAGS
    default:               return ''
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function friendlyDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver',
  })
}
function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
  })
}

// ─── Site promo captions ──────────────────────────────────────────────────────

interface PromoEntry { variant: PromoVariant; label: string; description: string; caption: string }

function buildPromos(total: number, tonightCount: number): PromoEntry[] {
  const tonight = tonightCount > 0 ? tonightCount : '?'

  return [
    {
      variant: 0,
      label: 'Big Stat',
      description: 'Terra background · centered stat number',
      caption: `🗺️ Albuquerque has more going on than you think.

Right now there are ${total}+ upcoming events across the city — live music, comedy, sports, art, food & drink, festivals, and more. Most people don't even know where to look.

We built ABQ Unplugged so you never have to ask "what's happening this weekend?" again.

🔗 Link in bio → abqunplugged.com

${BASE_TAGS} #ThingsToDo #AlbuquerqueEvents #ABQUnplugged`,
    },
    {
      variant: 1,
      label: 'Category Grid',
      description: 'Dark background · all 10 category pills',
      caption: `🎵 Live music tonight.
😂 Comedy show Friday.
🏟️ Game on Saturday.
🎨 Gallery opening Sunday.

Whatever you're into, it's probably happening in ABQ this week.

ABQ Unplugged tracks ${total}+ events across the city so you always know what's on.

→ abqunplugged.com (link in bio)

${BASE_TAGS} #ABQEvents #505 #AlbuquerqueNM #NMLife`,
    },
    {
      variant: 2,
      label: "Tonight's Picks",
      description: 'Live event list for tonight',
      caption: `📅 What are you doing tonight?

There ${Number(tonight) === 1 ? 'is' : 'are'} ${tonight} event${Number(tonight) === 1 ? '' : 's'} happening in ABQ tonight — live music, comedy shows, sports, and more.

ABQ Unplugged pulls from Ticketmaster, SeatGeek, Eventbrite, and local sources so you get the full picture in one place.

Tap the link in bio 👆 to see what's on tonight.

${BASE_TAGS} #ABQNightlife #ABQTonight #AlbuquerqueNightlife`,
    },
    {
      variant: 3,
      label: 'Bold Typography',
      description: 'Cream background · big dark text',
      caption: `⚠️ Don't sleep on this weekend in ABQ.

There's a lot happening — and it's all on ABQ Unplugged. We aggregate ${total}+ events so you never have to hunt across five different sites.

One search. All of Albuquerque.

Find your weekend plans → abqunplugged.com (link in bio)

${BASE_TAGS} #ABQWeekend #AlbuquerqueWeekend #ABQEvents #ThingsToDo505`,
    },
    {
      variant: 4,
      label: 'Desert Gradient',
      description: 'Terra → dark gradient · ABQ big',
      caption: `🌵 Albuquerque's culture is alive.

Live music at Launchpad. Comedy at Hyenas. Baseball at Rio Grande Credit Union Field. Art at Tortuga Gallery. The Duke City has it all — and ABQ Unplugged is your guide to all of it.

${total}+ events tracked. All in one place.

abqunplugged.com — link in bio.

${BASE_TAGS} #DukeCity #ABQCulture #AlbuquerqueCulture #NMLife`,
    },
    {
      variant: 5,
      label: 'Clean Minimal',
      description: 'Near-black · refined typography',
      caption: `We built ABQ Unplugged because we were tired of missing things.

There's always something going on in ABQ — but it was scattered across a dozen different sites. We pull it all together: Ticketmaster, SeatGeek, Eventbrite, local events, and more.

${total}+ events. Organized by date, category, and neighborhood.

It's free. No account needed. Just good events.

→ abqunplugged.com (link in bio)

${BASE_TAGS} #ABQEvents #AlbuquerqueEvents #NMEvents`,
    },
  ]
}

// ─── Round-up captions ────────────────────────────────────────────────────────

function buildTonightRoundup(events: NormalizedEvent[]): string {
  if (events.length === 0) return ''
  const lines = events.slice(0, 5).map(e => {
    const time = e.time ? ` · ${e.time}` : ''
    const venue = e.venue ? ` @ ${e.venue}` : ''
    return `${catEmoji(e.category)} ${e.title}${venue}${time}`
  })
  return `📅 What's on tonight in ABQ:

${lines.join('\n')}
${events.length > 5 ? `\n…and ${events.length - 5} more events on the site.` : ''}
Find tickets and details → abqunplugged.com (link in bio)

${BASE_TAGS} #ABQTonight #AlbuquerqueTonight #ABQNightlife`
}

function buildWeeklyRoundup(events: NormalizedEvent[]): string {
  const byDate: Record<string, NormalizedEvent[]> = {}
  for (const e of events.slice(0, 20)) {
    if (!e.date) continue
    byDate[e.date] = byDate[e.date] ?? []
    byDate[e.date].push(e)
  }
  const dates = Object.keys(byDate).slice(0, 5)
  if (dates.length === 0) return ''
  const lines = dates.map(d => {
    const picks = byDate[d].slice(0, 2).map(e => `  ${catEmoji(e.category)} ${e.title}`).join('\n')
    return `📆 ${shortDate(d)}\n${picks}`
  })
  return `Here's what's happening in Albuquerque this week:

${lines.join('\n\n')}

Tap the link in bio to see everything → abqunplugged.com

${BASE_TAGS} #ABQEvents #AlbuquerqueWeek #WhatsHappeningABQ`
}

// ─── Event captions (4 styles) ────────────────────────────────────────────────

type CaptionStyle = 'standard' | 'hype' | 'spotlight' | 'minimal'

function buildEventCaption(event: NormalizedEvent, style: CaptionStyle): string {
  const emoji    = catEmoji(event.category)
  const tags     = [BASE_TAGS, catTags(event.category)].filter(Boolean).join('\n')
  const priceStr = event.price ? `\n💵 ${event.price}` : ''
  const venueStr = event.venue ? `📍 ${event.venue}` : '📍 Albuquerque'
  const dateStr  = event.date  ? `📅 ${friendlyDate(event.date)}` : ''
  const timeStr  = event.time  ? ` at ${event.time}` : ''
  const ticketStr = event.ticketUrl
    ? `\n🎟️ Tickets → ${event.ticketUrl}`
    : '\n🎟️ Tickets → abqunplugged.com (link in bio)'

  switch (style) {
    case 'standard':
      return `${emoji} ${event.title}

${venueStr}
${dateStr}${timeStr}${priceStr}${ticketStr}

${tags}`

    case 'hype':
      // Note: title stays in title case — all-caps performs worse in feed captions
      return `${emoji} ${event.title} is coming to ABQ!

Don't miss it — ${event.venue ? `${event.venue}, ` : ''}${event.date ? friendlyDate(event.date) : 'coming up'}${timeStr}.${priceStr}

Grab your tickets before they're gone → abqunplugged.com (link in bio)

${tags}`

    case 'spotlight':
      return `Spotlight: ${event.title} ${emoji}

${dateStr}${timeStr}
${venueStr}${priceStr}

${event.description ? `${event.description.slice(0, 200).trim()}…\n\n` : ''}Find tickets and more details → abqunplugged.com (link in bio)

${tags}`

    case 'minimal':
      return `${event.title}
${event.date ? `📅 ${shortDate(event.date)}` : ''}${event.time ? ` · ${event.time}` : ''}
${event.venue ? `📍 ${event.venue}` : ''}${priceStr}

→ abqunplugged.com

${tags}`
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IGCaptionsPage() {
  const [{ total }, tonightEvents, { events: upcomingEvents }] = await Promise.all([
    fetchEvents({ timeFilter: 'upcoming', limit: 1 }),
    fetchTonightRanked(20),
    fetchEvents({ timeFilter: 'upcoming', limit: 60 }),
  ])

  const promos         = buildPromos(total, tonightEvents.length)
  const tonightRoundup = buildTonightRoundup(tonightEvents)
  const weeklyRoundup  = buildWeeklyRoundup(upcomingEvents)

  // Pre-compute all spotlight data server-side so the client component is pure display
  const rawSpotlights = upcomingEvents.filter(e => e.title && e.date).slice(0, 40)
  const spotlightItems: SpotlightItem[] = rawSpotlights.map(event => ({
    id:          event.id,
    title:       event.title,
    category:    event.category,
    dateLabel:   event.date ? friendlyDate(event.date) : null,
    time:        event.time,
    venue:       event.venue,
    price:       event.price,
    imageUrl:    event.imageUrl,
    description: event.description ? event.description.slice(0, 400) : null,
    emoji:       catEmoji(event.category),
    metaLine:  [
      event.date ? friendlyDate(event.date) : null,
      event.time,
      event.venue,
      event.price,
    ].filter(Boolean).join(' · '),
    captions: {
      standard:  buildEventCaption(event, 'standard'),
      hype:      buildEventCaption(event, 'hype'),
      spotlight: buildEventCaption(event, 'spotlight'),
      minimal:   buildEventCaption(event, 'minimal'),
    },
  }))

  const tonightForCard = tonightEvents.slice(0, 5).map(e => ({
    title: e.title, category: e.category, venue: e.venue, time: e.time,
  }))

  return (
    <div className="space-y-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-3xl font-black text-white mb-1"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Instagram Posts
        </h1>
        <p className="text-white/50 text-sm mb-3">
          Find an event below → download the card → copy a caption → paste into Instagram.
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-white/55 mb-4">
          <span>📊 {total} upcoming events</span>
          <span>🌙 {tonightEvents.length} tonight</span>
          <span>🎴 {spotlightItems.length} event cards ready</span>
        </div>

        {/* Quick URL-to-canvas shortcut */}
        <QuickPostInput />
      </div>

      {/* ── Section nav ─────────────────────────────────────────────────────── */}
      <nav className="flex gap-1 pb-4 border-b border-white/[0.07]" aria-label="Jump to section">
        {[
          { href: '#events',   label: 'Event Spotlights', badge: spotlightItems.length },
          { href: '#roundups', label: 'Round-Ups',         badge: null },
          { href: '#promo',    label: 'Site Promo',        badge: 6 },
        ].map(({ href, label, badge }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            {label}
            {badge !== null && (
              <span className="text-[10px] text-white/25 tabular-nums">{badge}</span>
            )}
          </a>
        ))}
      </nav>

      {/* ── Section 1: Event Spotlights ─────────────────────────────────────── */}
      <section id="events" className="scroll-mt-4">
        <div className="mb-5">
          <h2
            className="text-xl font-black text-white mb-1"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Event Spotlights
          </h2>
          <p className="text-xs text-white/55">
            {spotlightItems.length} upcoming events · 4:5 portrait or 1:1 square · 4 caption styles · search to jump to any event.
          </p>
        </div>
        <EventSpotlightsList events={spotlightItems} />
      </section>

      {/* ── Section 2: Round-Up Posts ─────────────────────────────────────── */}
      <section id="roundups" className="scroll-mt-4">
        <div className="mb-5">
          <h2
            className="text-xl font-black text-white mb-1"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Round-Up Posts
          </h2>
          <p className="text-xs text-white/55">
            Tonight&apos;s picks update in real time. Use these daily or weekly.
          </p>
        </div>

        <div className="space-y-8">
          {tonightRoundup && (
            <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 space-y-5">
              <p className="text-xs text-white/55">
                🌙 Tonight&apos;s picks — image + caption ready to paste into Instagram
              </p>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="shrink-0">
                  <RoundUpCard
                    type="tonight"
                    events={tonightForCard}
                    count={tonightEvents.length}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <CaptionCard
                    label="Tonight's Picks"
                    sublabel={`${tonightEvents.length} events tonight`}
                    caption={tonightRoundup}
                  />
                </div>
              </div>
            </div>
          )}

          {weeklyRoundup && (
            <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 space-y-5">
              <p className="text-xs text-white/55">
                📅 Weekly round-up — image + caption ready to paste into Instagram
              </p>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="shrink-0">
                  <RoundUpCard
                    type="weekly"
                    events={tonightForCard.length > 0 ? tonightForCard : upcomingEvents.slice(0, 5).map(e => ({
                      title: e.title, category: e.category, venue: e.venue, time: e.time,
                    }))}
                    count={upcomingEvents.length}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <CaptionCard
                    label="This Week in ABQ"
                    sublabel="Weekly digest"
                    caption={weeklyRoundup}
                  />
                </div>
              </div>
            </div>
          )}

          {!tonightRoundup && !weeklyRoundup && (
            <p className="text-white/55 text-sm">No upcoming events found.</p>
          )}
        </div>
      </section>

      {/* ── Section 3: Site Promo Posts ───────────────────────────────────── */}
      <section id="promo" className="scroll-mt-4">
        <div className="mb-6">
          <h2
            className="text-xl font-black text-white mb-1"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Site Promo Posts
          </h2>
          <p className="text-xs text-white/55">
            6 distinct designs — mix these throughout the week to build the brand.
          </p>
        </div>

        <div className="space-y-10">
          {promos.map(({ variant, label, description, caption }) => (
            <div
              key={variant}
              className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 space-y-5"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/45 bg-white/[0.04] rounded px-2 py-0.5">
                  Design {variant + 1} of 6
                </span>
                <span className="text-xs text-white/55">{description}</span>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                <div className="shrink-0">
                  <PromoCard
                    variant={variant}
                    label={label}
                    count={total}
                    tonightCount={tonightEvents.length}
                    tonightEvents={tonightForCard}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <CaptionCard
                    label="Caption"
                    sublabel="Copy & paste into Instagram"
                    caption={caption}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
