import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Users, MousePointer, Search, Heart, TrendingUp, Smartphone, Monitor, AlertTriangle } from 'lucide-react'

export const revalidate = 0

// V1 path patterns — hash-router SPA, filter these out for V2 clarity
const V1_PATH = /^#(events|discover|places|plan|profile|event\/|place\/)/

export default async function AnalyticsPage() {
  const supabase = await createServiceClient()

  const now   = new Date()
  // Use toLocaleDateString (date-only) so the result is a clean 'YYYY-MM-DD' string.
  // toLocaleString (with time) returns a locale-formatted string that new Date() can't
  // reliably parse — it produced Invalid Date and crashed the page with RangeError.
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
  const ago7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)
  const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [
    { data: raw30 },
    { data: rawHourly },
    { data: rawDow },
    { data: rawTopPages },
    { data: rawEngagement },
    { data: rawClickedEvents },
  ] = await (async () => {
    try {
      return await Promise.all([
        // 30-day daily sessions
        supabase.from('analytics')
          .select('created_at, session_id, device')
          .eq('event_type', 'session_start')
          .gte('created_at', ago30 + 'T00:00:00'),
        // Hourly distribution
        supabase.from('analytics')
          .select('created_at, session_id')
          .eq('event_type', 'session_start')
          .gte('created_at', ago30 + 'T00:00:00'),
        // Day of week
        supabase.from('analytics')
          .select('created_at, session_id')
          .eq('event_type', 'session_start')
          .gte('created_at', ago30 + 'T00:00:00'),
        // Top pages
        supabase.from('analytics')
          .select('data, session_id')
          .eq('event_type', 'pageview')
          .gte('created_at', ago30 + 'T00:00:00'),
        // Engagement events
        supabase.from('analytics')
          .select('event_type, session_id')
          .in('event_type', ['event_click', 'search', 'wishlist_add', 'wishlist_remove', 'category_click', 'checkin', 'share_click', 'directions_click'])
          .gte('created_at', ago30 + 'T00:00:00'),
        // Top clicked events (last 30d)
        supabase.from('analytics')
          .select('data')
          .eq('event_type', 'event_click')
          .gte('created_at', ago30 + 'T00:00:00'),
      ])
    } catch {
      return [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ]
    }
  })()

  // ── Daily sessions chart ───────────────────────────────────────────────────
  const byDay: Record<string, { sessions: Set<string>; mobile: number; desktop: number }> = {}
  for (const row of raw30 ?? []) {
    const day = new Date(row.created_at)
      .toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
    if (!byDay[day]) byDay[day] = { sessions: new Set(), mobile: 0, desktop: 0 }
    byDay[day].sessions.add(row.session_id)
    if (row.device === 'mobile') byDay[day].mobile++
    else if (row.device === 'desktop') byDay[day].desktop++
  }
  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => ({ day, count: d.sessions.size, mobile: d.mobile, desktop: d.desktop }))
  const maxDay = Math.max(...dailyData.map(d => d.count), 1)

  // Totals
  const totalSessions30 = dailyData.reduce((s, d) => s + d.count, 0)
  const todaySessions   = byDay[today]?.sessions.size ?? 0
  const week7Sessions   = Object.entries(byDay)
    .filter(([d]) => d >= ago7)
    .reduce((s, [, d]) => s + d.sessions.size, 0)

  // Device split
  const totalMobile  = (raw30 ?? []).filter(r => r.device === 'mobile').length
  const totalDesktop = (raw30 ?? []).filter(r => r.device === 'desktop').length
  const mobileShare  = totalMobile + totalDesktop > 0
    ? Math.round((totalMobile / (totalMobile + totalDesktop)) * 100)
    : 0

  // Data freshness: when was the last session_start?
  const lastSession = dailyData.at(-1)?.day ?? null
  const daysSilent  = lastSession
    ? Math.round((Date.now() - new Date(lastSession + 'T12:00:00').getTime()) / 86400000)
    : null
  const isStale = daysSilent !== null && daysSilent > 1

  // ── Hourly distribution ────────────────────────────────────────────────────
  const hourCounts: Record<number, Set<string>> = {}
  for (let h = 0; h < 24; h++) hourCounts[h] = new Set()
  for (const row of rawHourly ?? []) {
    const hour = new Date(row.created_at).toLocaleString('en-US', {
      timeZone: 'America/Denver', hour: 'numeric', hour12: false,
    })
    const h = parseInt(hour, 10) % 24
    hourCounts[h].add(row.session_id)
  }
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourCounts[h].size }))
  const maxHour    = Math.max(...hourlyData.map(d => d.count), 1)

  // ── Day of week ────────────────────────────────────────────────────────────
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowCounts: Record<number, Set<string>> = {}
  for (let d = 0; d < 7; d++) dowCounts[d] = new Set()
  for (const row of rawDow ?? []) {
    const dow = new Date(row.created_at).toLocaleDateString('en-US', {
      timeZone: 'America/Denver', weekday: 'short',
    })
    const idx = DOW_LABELS.indexOf(dow)
    if (idx >= 0) dowCounts[idx].add(row.session_id)
  }
  const dowData    = DOW_LABELS.map((label, i) => ({ label, count: dowCounts[i].size }))
  const maxDow     = Math.max(...dowData.map(d => d.count), 1)
  // Stable copies for peak/slowest — don't mutate dowData used in the chart
  const peakDay    = [...dowData].sort((a, b) => b.count - a.count)[0]?.label ?? '—'
  const slowestDay = [...dowData].sort((a, b) => a.count - b.count)[0]?.label ?? '—'

  // ── Top pages ─────────────────────────────────────────────────────────────
  const pageCounts: Record<string, { views: number; unique: Set<string> }> = {}
  for (const row of rawTopPages ?? []) {
    const path = (row.data as Record<string, string> | null)?.path ?? '(unknown)'
    if (V1_PATH.test(path)) continue
    if (!pageCounts[path]) pageCounts[path] = { views: 0, unique: new Set() }
    pageCounts[path].views++
    pageCounts[path].unique.add(row.session_id)
  }
  const topPages = Object.entries(pageCounts)
    .map(([path, d]) => ({ path, views: d.views, unique: d.unique.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  // ── Engagement ─────────────────────────────────────────────────────────────
  const engCounts: Record<string, { total: number; unique: Set<string> }> = {}
  for (const row of rawEngagement ?? []) {
    if (!engCounts[row.event_type]) engCounts[row.event_type] = { total: 0, unique: new Set() }
    engCounts[row.event_type].total++
    engCounts[row.event_type].unique.add(row.session_id)
  }

  // ── Top clicked events ─────────────────────────────────────────────────────
  const clickedEventCounts: Record<string, { count: number; id: string }> = {}
  for (const row of rawClickedEvents ?? []) {
    const d = row.data as Record<string, string> | null
    const id    = d?.event_id ?? ''
    const title = d?.title    ?? d?.event_id ?? '(unknown)'
    if (!id) continue
    if (!clickedEventCounts[id]) clickedEventCounts[id] = { count: 0, id }
    clickedEventCounts[id].count++
    // store the last-seen title for display
    ;(clickedEventCounts[id] as Record<string, unknown>).title = title
  }
  const topClickedEvents = Object.values(clickedEventCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const fmt = (n: number) => n.toLocaleString()
  const HOUR_LABEL = (h: number) => {
    if (h === 0)  return '12am'
    if (h === 12) return '12pm'
    return h < 12 ? `${h}am` : `${h - 12}pm`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Analytics</h1>
          <p className="text-white/40 text-sm">Last 30 days · America/Denver · unique sessions per visitor</p>
        </div>
      </div>

      {/* ── Staleness warning ── */}
      {isStale && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-300 text-sm font-semibold">Data is {daysSilent} days old</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              Last session recorded on {lastSession}. The analytics tracker is now active — new visits will appear here.
            </p>
          </div>
        </div>
      )}

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Today',         value: todaySessions,    icon: TrendingUp,  color: 'text-[#9a442d]',  tip: 'Unique visitor sessions today' },
          { label: 'This Week',     value: week7Sessions,    icon: Users,       color: 'text-[#7cc4bf]',  tip: 'Sessions in the last 7 days' },
          { label: '30-Day Total',  value: totalSessions30,  icon: Users,       color: 'text-white',      tip: 'Total sessions this month' },
          { label: 'Mobile Share',  value: `${mobileShare}%`, icon: Smartphone, color: 'text-[#b0c4b1]',  tip: 'Percentage of mobile visitors' },
        ].map(({ label, value, icon: Icon, color, tip }) => (
          <div key={label} className="bg-white/5 rounded-2xl p-4" title={tip}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <p className="text-white/40 text-xs uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-3xl font-black tabular-nums ${color}`} style={{ fontFamily: 'var(--font-epilogue)' }}>
              {typeof value === 'number' ? fmt(value) : value}
            </p>
            <p className="text-white/20 text-[10px] mt-1">{tip}</p>
          </div>
        ))}
      </div>

      {/* ── 30-Day Traffic Chart ── */}
      <section className="bg-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-widest text-white/30">Daily Visitors — Last 30 Days</h2>
          <span className="text-white/20 text-[10px] tabular-nums">{dailyData.length} days with data</span>
        </div>
        {dailyData.length === 0 ? (
          <p className="text-white/20 text-sm py-8 text-center">No session data yet — tracker just reactivated.</p>
        ) : (
          <>
            {/* items-stretch (default) so wrappers fill h-32 and percentage heights resolve */}
            <div className="flex gap-[2px] h-32">
              {dailyData.map(({ day, count }) => {
                const isToday = day === today
                const pct     = Math.round((count / maxDay) * 100)
                const label   = new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                return (
                  <div key={day} className="flex-1 flex flex-col justify-end items-center group relative" title={`${label}: ${count} sessions`}>
                    <div
                      className={`w-full rounded-t transition-all ${isToday ? 'bg-[#9a442d]' : 'bg-white/20 group-hover:bg-white/35'}`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                      {label}: {count}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-white/20 text-[10px]">{dailyData[0]?.day ?? ''}</span>
              <span className="text-white/20 text-[10px]">{today} (today)</span>
            </div>
          </>
        )}
      </section>

      {/* ── Hourly + Day-of-Week ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hourly heatmap */}
        <section className="bg-white/5 rounded-2xl p-5">
          <h2 className="text-xs uppercase tracking-widest text-white/30 mb-1">Busiest Hours</h2>
          <p className="text-white/20 text-[10px] mb-4">When visitors are on the site (Denver time)</p>
          <div className="space-y-1">
            {hourlyData.map(({ hour, count }) => {
              const pct   = Math.round((count / maxHour) * 100)
              const isTop = count === maxHour && count > 0
              return (
                <div key={hour} className="flex items-center gap-2">
                  <span className="text-white/30 text-[10px] w-8 text-right tabular-nums">{HOUR_LABEL(hour)}</span>
                  <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isTop ? 'bg-[#9a442d]' : 'bg-white/30'}`}
                      style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="text-white/30 text-[10px] w-5 tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Day of week */}
        <section className="bg-white/5 rounded-2xl p-5">
          <h2 className="text-xs uppercase tracking-widest text-white/30 mb-1">Busiest Days</h2>
          <p className="text-white/20 text-[10px] mb-4">Total sessions per weekday over 30 days</p>
          {/* items-stretch (default) so wrappers fill h-40 and flex-1 inner div gets definite height */}
          <div className="flex gap-2 h-40">
            {dowData.map(({ label, count }) => {
              const pct    = Math.round((count / maxDow) * 100)
              const isTop  = count === maxDow && count > 0
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-white/30 text-[10px] tabular-nums shrink-0">{count}</span>
                  <div className="w-full flex-1 flex flex-col justify-end">
                    <div
                      className={`w-full rounded-t transition-all ${isTop ? 'bg-[#9a442d]' : 'bg-white/20'}`}
                      style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-white/40 text-[10px] font-semibold shrink-0">{label}</span>
                </div>
              )
            })}
          </div>
          <p className="text-white/20 text-[10px] mt-2">
            Peak: {peakDay} · Slowest: {slowestDay}
          </p>
        </section>
      </div>

      {/* ── Device breakdown ── */}
      <section className="bg-white/5 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-white/30 mb-4">Device Breakdown</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#7cc4bf]" />
            <div>
              <p className="text-2xl font-black tabular-nums text-[#7cc4bf]" style={{ fontFamily: 'var(--font-epilogue)' }}>{mobileShare}%</p>
              <p className="text-white/30 text-xs">Mobile ({fmt(totalMobile)} sessions)</p>
            </div>
          </div>
          <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#7cc4bf] rounded-full" style={{ width: `${mobileShare}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-white/50" />
            <div>
              <p className="text-2xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{100 - mobileShare}%</p>
              <p className="text-white/30 text-xs">Desktop ({fmt(totalDesktop)} sessions)</p>
            </div>
          </div>
        </div>
        <p className="text-white/20 text-[10px] mt-3">
          Most ABQ Unplugged visitors are on {mobileShare > 50 ? 'mobile' : 'desktop'} — {mobileShare > 50 ? 'prioritize mobile UX' : 'desktop UX matters here'}.
        </p>
      </section>

      {/* ── Top Pages ── */}
      {topPages.length > 0 && (
        <section className="bg-white/5 rounded-2xl p-5">
          <h2 className="text-xs uppercase tracking-widest text-white/30 mb-1">Top Pages (V2)</h2>
          <p className="text-white/20 text-[10px] mb-4">Most-visited pages in the last 30 days</p>
          <div className="space-y-2">
            {topPages.map(({ path, views, unique }) => {
              const maxViews = topPages[0]?.views ?? 1
              const pct      = Math.round((views / maxViews) * 100)
              return (
                <div key={path} className="flex items-center gap-3">
                  <span className="text-white/50 text-xs font-mono w-36 truncate" title={path}>{path}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#9a442d] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-white/40 text-xs tabular-nums w-12 text-right">{views}</span>
                  <span className="text-white/20 text-[10px] w-16 text-right">{unique} uniq</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Engagement ── */}
      <section className="bg-white/5 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-white/30 mb-1">User Engagement</h2>
        <p className="text-white/20 text-[10px] mb-4">Actions taken in the last 30 days</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'event_click',    label: 'Event Clicks',   icon: MousePointer, color: 'text-[#9a442d]',  tip: 'Tapped through to an event detail page' },
            { key: 'search',         label: 'Searches',        icon: Search,       color: 'text-[#7cc4bf]',  tip: 'Used the search bar' },
            { key: 'wishlist_add',   label: 'Events Saved',    icon: Heart,        color: 'text-[#e8a898]',  tip: 'Added an event to wishlist/saved' },
            { key: 'category_click', label: 'Category Clicks', icon: TrendingUp,   color: 'text-[#b0c4b1]',  tip: 'Clicked a category filter' },
          ].map(({ key, label, icon: Icon, color, tip }) => {
            const d = engCounts[key]
            return (
              <div key={key} className="bg-white/5 rounded-xl p-3" title={tip}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <p className="text-white/40 text-[10px] uppercase tracking-wide">{label}</p>
                </div>
                <p className={`text-2xl font-black tabular-nums ${color}`} style={{ fontFamily: 'var(--font-epilogue)' }}>
                  {fmt(d?.total ?? 0)}
                </p>
                <p className="text-white/20 text-[10px] mt-0.5">{d?.unique.size ?? 0} visitors</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Top clicked events ── */}
      {topClickedEvents.length > 0 && (
        <section className="bg-white/5 rounded-2xl p-5">
          <h2 className="text-xs uppercase tracking-widest text-white/30 mb-1">Top Clicked Events</h2>
          <p className="text-white/20 text-[10px] mb-4">Events users opened most in the last 30 days</p>
          <div className="space-y-2">
            {topClickedEvents.map((ev, i) => {
              const title = (ev as Record<string, unknown>).title as string ?? ev.id
              const maxCt = topClickedEvents[0]?.count ?? 1
              const pct   = Math.round((ev.count / maxCt) * 100)
              return (
                <div key={ev.id} className="flex items-center gap-3">
                  <span className="text-white/20 text-[10px] w-4 tabular-nums text-right">{i + 1}</span>
                  <Link href={`/events/${ev.id}`} target="_blank" className="text-white/60 text-xs truncate w-48 hover:text-white transition-colors" title={title}>
                    {title}
                  </Link>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#7cc4bf] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-white/30 text-xs tabular-nums w-10 text-right">{ev.count}×</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Notes ── */}
      <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-white/30 text-xs leading-relaxed space-y-1">
        <p className="text-white/50 font-semibold text-[10px] uppercase tracking-widest mb-2">How to read this</p>
        <p><span className="text-white/50">Sessions</span> = one visit per device per day. If someone uses the site twice in a day, that&apos;s 2 sessions.</p>
        <p><span className="text-white/50">Unique visitors</span> = distinct session IDs — a proxy for individual people.</p>
        <p><span className="text-white/50">Hourly/day charts</span> = 30-day aggregate. Use this to know the best times to post social, add new events, or send push notifications.</p>
        <p><span className="text-white/50">Top pages</span> = V2 app routes only. V1 hash-route traffic (#events, #discover) is filtered out.</p>
        <p>Analytics auto-purge after 30 days to stay lean.</p>
      </section>
    </div>
  )
}
