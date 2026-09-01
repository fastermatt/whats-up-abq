import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, CheckSquare, Heart, Star, TrendingUp, BarChart2 } from 'lucide-react'

export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = await createServiceClient()
  const today   = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const [
    { count: pendingCount },
    { count: totalEvents },
    { count: hiddenCount },
    { count: featuredCount },
    { count: enrichedCount },
    { count: userCount },
    { count: checkInCount },
    { count: savedCount },
    { count: goingCount },
    { count: weekCheckIns },
    { data: recentReports },
    { data: topEvents },
    { data: catRows },
    { data: recentAnalytics },
  ] = await Promise.all([
    supabase.from('event_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('hidden', false).gte('event_date', today),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('hidden', true),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('featured', true).eq('hidden', false),
    supabase.from('events').select('*', { count: 'exact', head: true }).not('ai_enrichment', 'is', null).eq('hidden', false).gte('event_date', today),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('check_ins').select('*', { count: 'exact', head: true }),
    supabase.from('user_events').select('*', { count: 'exact', head: true }).eq('state', 'saved'),
    supabase.from('user_events').select('*', { count: 'exact', head: true }).eq('state', 'going'),
    supabase.from('check_ins').select('*', { count: 'exact', head: true }).gte('checked_in_at', weekAgo),
    supabase.from('event_reports').select('id, event_id, event_title, report_type, message, created_at, status').order('created_at', { ascending: false }).limit(5),
    // Most-saved events
    supabase.from('user_events').select('event_id, event_name').limit(500),
    // Category breakdown, read the actual category column, not ai_enrichment
    supabase.from('events').select('category').eq('hidden', false).gte('event_date', today),
    // Analytics events in last 7 days (pulls `data` so we can filter out V1 noise)
    supabase.from('analytics').select('event_type, data, created_at').eq('is_bot', false).gte('created_at', weekAgo + 'T00:00:00').order('created_at', { ascending: false }).limit(500),
  ])

  // Category tally from the actual category column
  const categoryCounts: Record<string, number> = {}
  let uncategorized = 0
  for (const row of catRows ?? []) {
    const cat = row.category as string | null | undefined
    if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
    else uncategorized++
  }
  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])

  // Top events by saves
  const savesByEvent: Record<string, { name: string; count: number }> = {}
  for (const ev of topEvents ?? []) {
    if (!savesByEvent[ev.event_id]) savesByEvent[ev.event_id] = { name: ev.event_name ?? ev.event_id, count: 0 }
    savesByEvent[ev.event_id].count++
  }
  const topSaved = Object.values(savesByEvent).sort((a, b) => b.count - a.count).slice(0, 5)

  // Analytics breakdown, filter out V1 (abandoned Vite SPA) error noise.
  // V1 errors reference Vite bundle paths (/assets/index-*.js) or old Netlify
  // preview URLs, they're cached bundles in returning users' browsers, not
  // V2 bugs. See session notes 2026-04-17.
  // Internal event types that shouldn't surface in the admin analytics tiles
  const INTERNAL_EVENT_TYPES = new Set(['system_purge'])

  const analyticsTypes: Record<string, number> = {}
  let v1ErrorsFiltered = 0
  for (const ev of recentAnalytics ?? []) {
    if (INTERNAL_EVENT_TYPES.has(ev.event_type)) continue
    if (ev.event_type === 'client_error') {
      const data = ev.data as Record<string, unknown> | null
      const src = (data?.source as string | undefined) ?? ''
      const url = (data?.url as string | undefined) ?? ''
      const isV1 =
        /\/assets\/index-[A-Za-z0-9]+\.js/.test(src) ||
        /\/assets\/index-[A-Za-z0-9]+\.js/.test(url) ||
        /netlify\.app/.test(url) // old preview URLs
      if (isV1) { v1ErrorsFiltered++; continue }
    }
    analyticsTypes[ev.event_type] = (analyticsTypes[ev.event_type] ?? 0) + 1
  }

  const enrichmentPct = totalEvents ? Math.round(((enrichedCount ?? 0) / (totalEvents ?? 1)) * 100) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>Dashboard</h1>
        <p className="text-white/40 text-sm">ABQ Unplugged, site management & analytics</p>
      </div>

      {/* ── Help banner ── */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white/50 leading-relaxed space-y-1">
        <p className="text-white/70 font-semibold text-xs uppercase tracking-widest mb-2">How this works</p>
        <p><span className="text-white/70">Live Events</span>, Visible on the public site right now (today or future, not hidden).</p>
        <p><span className="text-white/70">Hidden</span>, Filtered out: past events, cross-source duplicates, non-ABQ listings, cancelled shows, Eventbrite spam. Click to review and unhide anything that shouldn&apos;t be hidden.</p>
        <p><span className="text-white/70">Featured</span>, Pinned to the top of the homepage &quot;Featured&quot; section. Use sparingly, 3–6 events max.</p>
        <p><span className="text-white/70">Pending Reports</span>, Users flagged these events as wrong/inappropriate. Review and resolve in Reports.</p>
        <p><span className="text-white/70">AI Enrichment</span>, Events that have been enriched with descriptions, highlights, venue tips, and mood tags by the AI pipeline. Run <code className="text-terra text-xs">node scripts/enrich-moods-lm.mjs</code> to enrich more.</p>
        <p><span className="text-white/70">Submissions</span>, Community-submitted events awaiting your approval before going live.</p>
      </section>

      {/* ── Events stats ── */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-3">Events</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Live Events"      value={totalEvents ?? 0}   href="/admin/events"            tip="Upcoming events visible to the public" />
          <StatCard label="Hidden"           value={hiddenCount ?? 0}   href="/admin/events?hidden=1"   color="yellow" tip="Filtered out, click to review" />
          <StatCard label="Featured"         value={featuredCount ?? 0} href="/admin/events?featured=1" color="blue"   tip="Pinned to the homepage hero" />
          <StatCard label="Pending Reports"  value={pendingCount ?? 0}  href="/admin/reports"           color={pendingCount ? 'red' : 'green'} tip="User-flagged events needing review" />
        </div>
      </section>

      {/* ── User / social stats ── */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-3">Users & Social</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#7cc4bf]" />
              <p className="text-white/40 text-xs uppercase tracking-wider">Members</p>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{(userCount ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="w-4 h-4 text-[#b0c4b1]" />
              <p className="text-white/40 text-xs uppercase tracking-wider">Check-ins</p>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{(checkInCount ?? 0).toLocaleString()}</p>
            <p className="text-white/55 text-[10px] mt-1">+{weekCheckIns ?? 0} this week</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-terra-light" />
              <p className="text-white/40 text-xs uppercase tracking-wider">Saved</p>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{(savedCount ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <p className="text-white/40 text-xs uppercase tracking-wider">Going</p>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{(goingCount ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* ── Enrichment + categories ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Enrichment */}
        <div className="bg-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-terra" />
            <p className="text-white/40 text-xs uppercase tracking-wider">AI Enrichment</p>
          </div>
          <p className="text-4xl font-black tabular-nums mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {enrichmentPct}%
          </p>
          <div className="h-2 bg-white/10 rounded-full mb-2">
            <div className="h-full bg-terra rounded-full transition-all" style={{ width: `${enrichmentPct}%` }} />
          </div>
          <p className="text-white/55 text-xs">{(enrichedCount ?? 0).toLocaleString()} of {(totalEvents ?? 0).toLocaleString()} live events enriched</p>
        </div>

        {/* Categories */}
        <div className="bg-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-terra" />
            <p className="text-white/40 text-xs uppercase tracking-wider">Events by Category</p>
          </div>
          {sortedCats.length === 0 ? (
            <p className="text-white/55 text-xs">No data</p>
          ) : (
            <div className="space-y-1.5">
              {sortedCats.slice(0, 7).map(([cat, cnt]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-white/60 text-xs w-28 truncate">{cat}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full">
                    <div className="h-full bg-terra rounded-full" style={{ width: `${Math.round((cnt / (totalEvents ?? 1)) * 100)}%` }} />
                  </div>
                  <span className="text-white/55 text-xs w-6 text-right">{cnt}</span>
                </div>
              ))}
              {uncategorized > 0 && <p className="text-white/45 text-xs pt-1">+ {uncategorized} uncategorized</p>}
            </div>
          )}
        </div>
      </section>

      {/* ── Top saved events ── */}
      {topSaved.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-white/55 mb-3">Most Saved Events</h2>
          <div className="space-y-2">
            {topSaved.map((ev, i) => (
              <div key={i} className="bg-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-white/80 truncate">{ev.name}</p>
                <span className="text-xs text-white/40 ml-3 flex-shrink-0">{ev.count} saves</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Site analytics (last 7 days) ── */}
      {Object.keys(analyticsTypes).length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-white/55 mb-3">Analytics (Last 7 Days)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(analyticsTypes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, cnt]) => (
              <div key={type} className="bg-white/5 rounded-xl p-3">
                <p className="text-white/55 text-[10px] uppercase tracking-wide mb-1 truncate">{type.replace(/_/g, ' ')}</p>
                <p className="text-xl font-black text-white tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>{cnt}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent reports ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-white/55">Recent Reports</h2>
          <Link href="/admin/reports" className="text-xs text-terra hover:underline">View all →</Link>
        </div>
        {!recentReports?.length ? (
          <p className="text-white/55 text-sm">No reports yet.</p>
        ) : (
          <div className="space-y-2">
            {recentReports.map((r: Record<string, string>) => (
              <div key={r.id} className="bg-white/5 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.event_title ?? 'Unknown event'}</p>
                  <p className="text-xs text-white/40 mt-0.5">{r.report_type?.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}</p>
                  {r.message && <p className="text-xs text-white/60 mt-1 line-clamp-1">{r.message}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/40'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/55 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/admin/analytics',         label: '📊 Analytics' },
            { href: '/admin/reports',            label: 'Review Reports' },
            { href: '/admin/submissions',        label: 'Submissions' },
            { href: '/admin/events',             label: 'Browse Events' },
            { href: '/admin/events?featured=1',  label: 'Featured' },
            { href: '/admin/events?hidden=1',    label: 'Hidden' },
            { href: '/leaderboard',              label: 'Leaderboard' },
            { href: '/events',                   label: '↗ View Site' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, href, color, tip }: { label: string; value: number; href: string; color?: string; tip?: string }) {
  const colors: Record<string, string> = {
    red: 'text-red-400', yellow: 'text-yellow-400', green: 'text-green-400', blue: 'text-blue-400',
  }
  return (
    <Link href={href} className="bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-colors group" title={tip}>
      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-4xl font-black tabular-nums ${colors[color ?? ''] ?? 'text-white'}`} style={{ fontFamily: 'var(--font-epilogue)' }}>
        {value.toLocaleString()}
      </p>
      {tip && <p className="text-white/45 text-[10px] mt-1.5 leading-tight">{tip}</p>}
    </Link>
  )
}
