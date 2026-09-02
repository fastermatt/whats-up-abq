import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Bot, Globe, Heart, MousePointer, Share2, Smartphone, Ticket, TrendingUp, Users } from 'lucide-react'
import { ExcludeVisits } from './ExcludeVisits'

export const revalidate = 0

const TIME_ZONE = 'America/Denver'
const PAGE_SIZE = 1_000
const CONVERSION_EVENTS = new Set(['ticket_click', 'save_event', 'going_event', 'share_click', 'newsletter_signup'])

interface AnalyticsRow {
  created_at: string | null
  data: unknown
  device: string | null
  event_type: string
  is_bot: boolean
  session_id: string | null
  suspicious: boolean
  visitor_id: string | null
}

type ServiceClient = ReturnType<typeof createServiceClient>

function denverDay(value: string): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

function rowData(row: AnalyticsRow): Record<string, unknown> {
  return row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : {}
}

function categorizeReferrer(referrer: unknown): string | null {
  if (typeof referrer !== 'string' || !referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (['abqunplugged.com', 'localhost', '127.0.0.1'].includes(host)) return null
    if (/google\./i.test(host)) return 'Google'
    if (/bing\.com/i.test(host)) return 'Bing'
    if (/yahoo\.com/i.test(host)) return 'Yahoo'
    if (/duckduckgo\.com/i.test(host)) return 'DuckDuckGo'
    if (/facebook\.com|fb\.me|fb\.com/i.test(host)) return 'Facebook'
    if (/instagram\.com/i.test(host)) return 'Instagram'
    if (/twitter\.com|x\.com|t\.co/i.test(host)) return 'Twitter / X'
    if (/reddit\.com/i.test(host)) return 'Reddit'
    if (/nextdoor\.com/i.test(host)) return 'Nextdoor'
    if (/linkedin\.com/i.test(host)) return 'LinkedIn'
    if (/tiktok\.com/i.test(host)) return 'TikTok'
    return host
  } catch {
    return 'Direct'
  }
}

async function fetchAnalyticsRows(supabase: ServiceClient, since: string): Promise<AnalyticsRow[]> {
  const rows: AnalyticsRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('analytics')
      .select('created_at,data,device,event_type,is_bot,session_id,suspicious,visitor_id')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as AnalyticsRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function addToSet(map: Map<string, Set<string>>, key: string, value: string | null): void {
  if (!key || !value) return
  const values = map.get(key) ?? new Set<string>()
  values.add(value)
  map.set(key, values)
}

function positiveAction(row: AnalyticsRow): boolean {
  const action = rowData(row).action
  if (row.event_type === 'save_event') return action === 'save'
  if (row.event_type === 'going_event') return action === 'going'
  return true
}

function buildIdentityMetrics(human: AnalyticsRow[], today: string, ago7: string) {
  const starts = human.filter(row => row.event_type === 'session_start')
  const visitorsByDay = new Map<string, Set<string>>()
  const sessionsByDay = new Map<string, Set<string>>()
  const daysByVisitor = new Map<string, Set<string>>()
  const weekVisitorIds = new Set<string>()
  for (const row of starts) {
    if (!row.created_at) continue
    const day = denverDay(row.created_at)
    addToSet(visitorsByDay, day, row.visitor_id)
    addToSet(sessionsByDay, day, row.session_id)
    addToSet(daysByVisitor, row.visitor_id ?? '', day)
    if (day >= ago7 && row.visitor_id) weekVisitorIds.add(row.visitor_id)
  }
  const daily = [...visitorsByDay.keys()].sort().map(day => ({
    day,
    visitors: visitorsByDay.get(day)?.size ?? 0,
    sessions: sessionsByDay.get(day)?.size ?? 0,
  }))
  const mobile = starts.filter(row => row.device === 'mobile').length
  const desktop = starts.filter(row => row.device === 'desktop').length
  return {
    daily,
    visitors: new Set(human.map(row => row.visitor_id).filter(Boolean)).size,
    sessions: new Set(human.map(row => row.session_id).filter(Boolean)).size,
    returningVisitors: [...daysByVisitor.values()].filter(days => days.size >= 2).length,
    todayVisitors: visitorsByDay.get(today)?.size ?? 0,
    weekVisitors: weekVisitorIds.size,
    mobileShare: mobile + desktop ? Math.round((mobile / (mobile + desktop)) * 100) : 0,
  }
}

function buildContentMetrics(human: AnalyticsRow[]) {
  const pageMap = new Map<string, { views: number; visitors: Set<string> }>()
  for (const row of human.filter(item => item.event_type === 'pageview')) {
    const path = rowData(row).path
    if (typeof path !== 'string' || /^#(events|discover|places|plan|profile|event\/|place\/)/.test(path)) continue
    const current = pageMap.get(path) ?? { views: 0, visitors: new Set<string>() }
    current.views++
    if (row.visitor_id) current.visitors.add(row.visitor_id)
    pageMap.set(path, current)
  }
  const engagement = new Map<string, { events: number; visitors: Set<string> }>()
  for (const row of human.filter(item => CONVERSION_EVENTS.has(item.event_type))) {
    const current = engagement.get(row.event_type) ?? { events: 0, visitors: new Set<string>() }
    current.events++
    if (row.visitor_id) current.visitors.add(row.visitor_id)
    engagement.set(row.event_type, current)
  }
  return {
    topPages: [...pageMap.entries()].map(([path, value]) => ({ path, views: value.views, visitors: value.visitors.size })).sort((a, b) => b.views - a.views).slice(0, 10),
    engagement,
  }
}

function buildFunnel(human: AnalyticsRow[]) {
  const eventDetails = human.filter(row => row.event_type === 'pageview' && String(rowData(row).path ?? '').startsWith('/events/'))
  const positive = human.filter(row => CONVERSION_EVENTS.has(row.event_type) && positiveAction(row))
  const stages = [
    { label: 'Event detail views', count: eventDetails.length },
    { label: 'Ticket clicks', count: positive.filter(row => row.event_type === 'ticket_click').length },
    { label: 'Save / going / share', count: positive.filter(row => ['save_event', 'going_event', 'share_click'].includes(row.event_type)).length },
    { label: 'Newsletter signups', count: positive.filter(row => row.event_type === 'newsletter_signup').length },
  ]
  return stages.map((stage, index) => ({
    ...stage,
    rate: index === 0 ? null : stages[index - 1].count ? Math.round(stage.count / stages[index - 1].count * 1_000) / 10 : 0,
  }))
}

function buildTrafficSources(starts: AnalyticsRow[]) {
  const sources = new Map<string, Set<string>>()
  for (const row of starts) {
    const source = categorizeReferrer(rowData(row).referrer)
    if (source) addToSet(sources, source, row.session_id ?? row.visitor_id)
  }
  return [...sources.entries()].map(([source, values]) => ({ source, sessions: values.size })).sort((a, b) => b.sessions - a.sessions)
}

function buildBotMetrics(botRows: AnalyticsRow[]) {
  const agents = new Map<string, number>()
  for (const row of botRows) {
    const userAgent = rowData(row).user_agent
    const label = typeof userAgent === 'string' && userAgent ? userAgent : '(missing user agent)'
    agents.set(label, (agents.get(label) ?? 0) + 1)
  }
  return {
    events: botRows.length,
    visitors: new Set(botRows.map(row => row.visitor_id).filter(Boolean)).size,
    agents: [...agents.entries()].map(([agent, count]) => ({ agent, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  }
}

function buildReport(rows: AnalyticsRow[], today: string, ago7: string) {
  const human = rows.filter(row => !row.is_bot)
  const identity = buildIdentityMetrics(human, today, ago7)
  const content = buildContentMetrics(human)
  const positiveTickets = human.filter(row => row.event_type === 'ticket_click' && positiveAction(row))
  const tickets = new Map<string, number>()
  for (const row of positiveTickets) {
    const eventId = rowData(row).event_id
    if (typeof eventId === 'string') tickets.set(eventId, (tickets.get(eventId) ?? 0) + 1)
  }
  const lastEventAt = human.at(-1)?.created_at ?? null
  return {
    ...identity,
    ...content,
    funnel: buildFunnel(human),
    trafficSources: buildTrafficSources(human.filter(row => row.event_type === 'session_start')),
    bots: buildBotMetrics(rows.filter(row => row.is_bot)),
    suspiciousRows: human.filter(row => row.suspicious).length,
    topTicketEvents: [...tickets.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    lastEventAt,
    daysSilent: lastEventAt ? Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 86_400_000) : null,
  }
}

const fmt = (value: number) => value.toLocaleString()

export default async function AnalyticsPage() {
  const supabase = createServiceClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
  const ago7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let rows: AnalyticsRow[] = []
  let loadError: string | null = null
  try { rows = await fetchAnalyticsRows(supabase, since) } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unknown analytics query error'
  }
  const report = buildReport(rows, today, ago7)
  const maxDaily = Math.max(...report.daily.map(day => day.visitors), 1)
  const maxSource = Math.max(...report.trafficSources.map(source => source.sessions), 1)

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <Link href="/admin" className="text-white/40 hover:text-white/70"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Analytics</h1>
          <p className="text-white/40 text-sm">Last 30 days · America/Denver · known bots excluded from human KPIs</p>
        </div>
        <ExcludeVisits />
      </header>

      {loadError && <Warning title="Analytics query failed" detail={loadError} />}
      {!loadError && report.daysSilent !== null && report.daysSilent > 1 && <Warning title={`Human analytics data is ${report.daysSilent} days old`} detail={`Last human event: ${report.lastEventAt ? new Date(report.lastEventAt).toLocaleString() : 'unknown'}. The heartbeat alerts after a 26-hour zero-data window.`} />}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Today" value={report.todayVisitors} icon={TrendingUp} tip="Unique browser visitors today" />
        <Kpi label="7-Day Visitors" value={report.weekVisitors} icon={Users} tip="Daily unique visitors summed over 7 days" />
        <Kpi label="Unique Visitors" value={report.visitors} icon={Users} tip="Distinct browser IDs in 30 days; not people" />
        <Kpi label="Sessions" value={report.sessions} icon={MousePointer} tip="Distinct 30-minute visit IDs in 30 days" />
        <Kpi label="Returning" value={report.returningVisitors} icon={Heart} tip="Visitors active on at least 2 Denver calendar days" />
        <Kpi label="Mobile" value={`${report.mobileShare}%`} icon={Smartphone} tip="Human session starts on mobile" />
      </section>

      <section className="bg-white/5 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-1">30-Day Conversion Funnel</h2>
        <p className="text-white/45 text-[10px] mb-4">Human events only · positive save/going actions only · stage-over-stage rate</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {report.funnel.map((stage, index) => <div key={stage.label} className="bg-white/5 rounded-xl p-4">
            <p className="text-white/45 text-[10px] uppercase tracking-wide">{index + 1}. {stage.label}</p>
            <p className="text-3xl font-black tabular-nums mt-1">{fmt(stage.count)}</p>
            <p className="text-white/45 text-[10px] mt-1">{stage.rate === null ? 'Funnel entry' : `${stage.rate}% from prior stage`}</p>
          </div>)}
        </div>
      </section>

      <section className="bg-red-500/5 border border-red-400/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1"><Bot className="w-4 h-4 text-red-300" /><h2 className="text-xs uppercase tracking-widest text-red-200/80">Bot Traffic</h2></div>
        <p className="text-red-100/50 text-[10px] mb-4">{fmt(report.bots.events)} events from {fmt(report.bots.visitors)} browser IDs · excluded from every KPI above</p>
        {report.bots.agents.length === 0 ? <p className="text-white/45 text-sm">No classified bot traffic in this window.</p> : report.bots.agents.map(bot => <div key={bot.agent} className="flex gap-3 py-1.5 border-t border-white/5 first:border-0"><span className="text-white/45 text-xs tabular-nums w-16 text-right">{fmt(bot.count)}</span><span className="text-white/55 text-xs font-mono truncate" title={bot.agent}>{bot.agent}</span></div>)}
        {report.suspiciousRows > 0 && <p className="text-yellow-300/70 text-[10px] mt-3">{fmt(report.suspiciousRows)} human-classified rows are separately marked suspicious.</p>}
      </section>

      <section className="bg-white/5 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-4">Daily Human Visitors</h2>
        {report.daily.length === 0 ? <p className="text-white/45 text-sm py-6 text-center">No human session data in this window.</p> : <>
          <div className="flex gap-[2px] h-32 overflow-hidden">{report.daily.map(day => <div key={day.day} className="flex-1 relative group" title={`${day.day}: ${day.visitors} visitors, ${day.sessions} sessions`}><div className={`absolute bottom-0 inset-x-0 rounded-t ${day.day === today ? 'bg-terra' : 'bg-white/20 group-hover:bg-white/35'}`} style={{ height: `${Math.max(Math.round(day.visitors / maxDaily * 128), 2)}px` }} /></div>)}</div>
          <div className="flex justify-between mt-2 text-white/45 text-[10px]"><span>{report.daily[0]?.day}</span><span>{today}</span></div>
        </>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1"><Globe className="w-4 h-4 text-[#7cc4bf]" /><h2 className="text-xs uppercase tracking-widest text-white/55">Traffic Sources</h2></div>
          <p className="text-white/45 text-[10px] mb-4">Human sessions · internal referrals excluded</p>
          <div className="space-y-2">{report.trafficSources.slice(0, 10).map(source => <BarRow key={source.source} label={source.source} value={source.sessions} percent={Math.round(source.sessions / maxSource * 100)} />)}</div>
        </section>
        <Engagement engagement={report.engagement} />
      </div>

      {report.topPages.length > 0 && <section className="bg-white/5 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-4">Top Human-Viewed Pages</h2>
        <div className="space-y-2">{report.topPages.map(page => <div key={page.path} className="flex gap-3 text-xs"><span className="text-white/60 font-mono truncate flex-1" title={page.path}>{page.path}</span><span className="text-white/45 tabular-nums">{fmt(page.views)} views</span><span className="text-white/45 tabular-nums w-24 text-right">{fmt(page.visitors)} visitors</span></div>)}</div>
      </section>}

      {report.topTicketEvents.length > 0 && <section className="bg-white/5 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-4">Top Ticket-Click Events</h2>
        <div className="space-y-2">{report.topTicketEvents.map(event => <div key={event.id} className="flex gap-3 text-xs"><Link href={`/events/${event.id}`} target="_blank" className="text-white/60 hover:text-white truncate flex-1">{event.id}</Link><span className="text-white/45 tabular-nums">{fmt(event.count)} clicks</span></div>)}</div>
      </section>}

      <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-white/55 text-xs leading-relaxed space-y-1">
        <p className="text-white/50 font-semibold text-[10px] uppercase tracking-widest mb-2">Metric definitions</p>
        <p><span className="text-white/70">Unique visitor</span> = one browser installation ID. It is not necessarily one person.</p>
        <p><span className="text-white/70">Session</span> = one browser-tab visit, rotated after more than 30 minutes without a tracked action.</p>
        <p><span className="text-white/70">Returning visitor</span> = a human-classified visitor active on at least two distinct Denver calendar days in this window.</p>
        <p><span className="text-white/70">Bot traffic</span> remains stored and visible separately, but is excluded from human KPIs.</p>
        <p>Raw analytics are rolled up daily, then automatically purged after 30 days.</p>
      </section>
    </div>
  )
}

function Engagement({ engagement }: { engagement: Map<string, { events: number; visitors: Set<string> }> }) {
  const items = [
    ['ticket_click', 'Ticket clicks', Ticket], ['save_event', 'Save actions', Heart],
    ['going_event', 'Going actions', TrendingUp], ['share_click', 'Shares', Share2],
    ['newsletter_signup', 'Newsletter', Users],
  ] as const
  return <section className="bg-white/5 rounded-2xl p-5"><h2 className="text-xs uppercase tracking-widest text-white/55 mb-1">Measured Actions</h2><p className="text-white/45 text-[10px] mb-4">Human events · includes positive and removal actions</p><div className="grid grid-cols-2 gap-3">{items.map(([key, label, Icon]) => { const value = engagement.get(key); return <div key={key} className="bg-white/5 rounded-xl p-3"><div className="flex gap-1.5 items-center text-white/45 text-[10px] uppercase tracking-wide"><Icon className="w-3.5 h-3.5 text-terra" /> {label}</div><p className="text-2xl font-black mt-1">{fmt(value?.events ?? 0)}</p><p className="text-white/45 text-[10px]">{value?.visitors.size ?? 0} visitors</p></div> })}</div></section>
}

function Warning({ title, detail }: { title: string; detail: string }) {
  return <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4"><AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" /><div><p className="text-yellow-300 text-sm font-semibold">{title}</p><p className="text-yellow-400/70 text-xs mt-0.5">{detail}</p></div></div>
}

function Kpi({ label, value, icon: Icon, tip }: { label: string; value: number | string; icon: typeof Users; tip: string }) {
  return <div className="bg-white/5 rounded-2xl p-4 min-w-0" title={tip}><div className="flex items-center gap-2 mb-2"><Icon className="w-3.5 h-3.5 text-terra" /><p className="text-white/40 text-[10px] uppercase tracking-wider">{label}</p></div><p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{typeof value === 'number' ? fmt(value) : value}</p><p className="text-white/45 text-[10px] mt-1 line-clamp-2">{tip}</p></div>
}

function BarRow({ label, value, percent }: { label: string; value: number; percent: number }) {
  return <div className="flex items-center gap-3"><span className="text-white/60 text-xs w-32 truncate" title={label}>{label}</span><div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#7cc4bf] rounded-full" style={{ width: `${Math.max(percent, 2)}%` }} /></div><span className="text-white/45 text-xs tabular-nums w-12 text-right">{fmt(value)}</span></div>
}
