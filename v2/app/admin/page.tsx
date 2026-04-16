import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = await createServiceClient()

  // All counts in parallel
  const [
    { count: pendingCount },
    { count: totalEvents },
    { count: hiddenCount },
    { count: featuredCount },
    { count: enrichedCount },
    { data: recentReports },
    { data: catRows },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('event_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('events')
      .select('*', { count: 'exact', head: true })
      .eq('hidden', false)
      .gte('event_date', new Date().toISOString().slice(0, 10)),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('events')
      .select('*', { count: 'exact', head: true })
      .eq('hidden', true),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('events')
      .select('*', { count: 'exact', head: true })
      .eq('featured', true)
      .eq('hidden', false),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('events')
      .select('*', { count: 'exact', head: true })
      .not('ai_enrichment', 'is', null),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('event_reports')
      .select('id, event_id, event_title, report_type, message, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5),

    // Category breakdown — pull category from ai_enrichment JSONB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).schema('public').from('events')
      .select('ai_enrichment')
      .eq('hidden', false)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .not('ai_enrichment', 'is', null),
  ])

  // Tally categories client-side from fetched rows
  const categoryCounts: Record<string, number> = {}
  let uncategorized = 0
  for (const row of catRows ?? []) {
    const cat = (row.ai_enrichment as Record<string, unknown>)?.category as string | undefined
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
    } else {
      uncategorized++
    }
  }
  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>Dashboard</h1>
        <p className="text-white/40 text-sm">ABQ Unplugged event management</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Live Events" value={totalEvents ?? 0} href="/admin/events" />
        <StatCard label="Hidden Events" value={hiddenCount ?? 0} href="/admin/events?hidden=1" color="yellow" />
        <StatCard label="Featured" value={featuredCount ?? 0} href="/admin/events?featured=1" color="blue" />
        <StatCard label="Pending Reports" value={pendingCount ?? 0} href="/admin/reports" color={pendingCount ? 'red' : 'green'} />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">AI Enriched</p>
          <p className="text-2xl font-black tabular-nums" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {(enrichedCount ?? 0).toLocaleString()}
          </p>
          <p className="text-white/30 text-xs mt-1">of all events have enrichment data</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Events by Category</p>
          {sortedCats.length === 0 ? (
            <p className="text-white/30 text-xs">No category data</p>
          ) : (
            <div className="space-y-1.5">
              {sortedCats.slice(0, 6).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-white/70 truncate">{cat}</span>
                      <span className="text-white/40 ml-2 flex-shrink-0">{count}</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#9a442d] rounded-full"
                        style={{ width: `${Math.round((count / (totalEvents ?? 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {uncategorized > 0 && (
                <div className="flex justify-between text-xs text-white/30 pt-0.5">
                  <span>Uncategorized</span>
                  <span>{uncategorized}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent reports */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-epilogue)' }}>Recent Reports</h2>
          <Link href="/admin/reports" className="text-xs text-[#9a442d] hover:underline">View all →</Link>
        </div>
        {!recentReports?.length ? (
          <p className="text-white/40 text-sm">No reports yet.</p>
        ) : (
          <div className="space-y-2">
            {recentReports.map((r: Record<string, string>) => (
              <div key={r.id} className="bg-white/5 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.event_title ?? 'Unknown event'}</p>
                  <p className="text-xs text-white/40 mt-0.5">{r.report_type.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}</p>
                  {r.message && <p className="text-xs text-white/60 mt-1 line-clamp-1">{r.message}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/40'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-epilogue)' }}>Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/reports" className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors">
            Review Reports
          </Link>
          <Link href="/admin/events" className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors">
            Browse Events
          </Link>
          <Link href="/admin/events?featured=1" className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors">
            Featured Events
          </Link>
          <Link href="/admin/events?hidden=1" className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors">
            Hidden Events
          </Link>
          <Link href="/events" className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/15 transition-colors">
            View Site
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, href, color }: { label: string; value: number; href: string; color?: string }) {
  const colors: Record<string, string> = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
  }
  return (
    <Link href={href} className="bg-white/5 hover:bg-white/10 rounded-2xl p-5 transition-colors">
      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-4xl font-black tabular-nums ${colors[color ?? ''] ?? 'text-white'}`} style={{ fontFamily: 'var(--font-epilogue)' }}>
        {value.toLocaleString()}
      </p>
    </Link>
  )
}
