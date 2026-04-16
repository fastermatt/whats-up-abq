import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = await createServiceClient()

  // Fetch pending report count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingCount } = await (supabase as any)
    .schema('public').from('event_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // Fetch total event count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: totalEvents } = await (supabase as any)
    .schema('public').from('events')
    .select('*', { count: 'exact', head: true })
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))

  // Fetch hidden event count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: hiddenCount } = await (supabase as any)
    .schema('public').from('events')
    .select('*', { count: 'exact', head: true })
    .eq('hidden', true)

  // Recent reports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentReports } = await (supabase as any)
    .schema('public').from('event_reports')
    .select('id, event_title, report_type, message, created_at, status')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>Dashboard</h1>
        <p className="text-white/40 text-sm">ABQ Unplugged event management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Live Events" value={totalEvents ?? 0} href="/admin/events" />
        <StatCard label="Hidden Events" value={hiddenCount ?? 0} href="/admin/events?hidden=1" color="yellow" />
        <StatCard label="Pending Reports" value={pendingCount ?? 0} href="/admin/reports" color={pendingCount ? 'red' : 'green'} />
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
