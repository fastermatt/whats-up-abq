import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ReportActions } from './ReportActions'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const { status = 'pending' } = await searchParams
  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .schema('public').from('event_reports')
    .select('id, event_id, event_title, report_type, message, user_email, status, admin_notes, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') q = q.eq('status', status)

  const { data: reports } = await q

  const TABS = [
    { label: 'Pending', value: 'pending' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Dismissed', value: 'dismissed' },
    { label: 'All', value: 'all' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Reports</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {TABS.map(tab => (
          <Link
            key={tab.value}
            href={`/admin/reports?status=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              status === tab.value ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!reports?.length ? (
        <p className="text-white/40 text-sm py-8 text-center">No {status} reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r: Record<string, string>) => (
            <div key={r.id} className="bg-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                      {r.report_type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      r.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-white/10 text-white/30'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{r.event_title ?? r.event_id}</p>
                  {r.message && <p className="text-sm text-white/60 mt-1">{r.message}</p>}
                  {r.user_email && <p className="text-xs text-white/40 mt-1">From: {r.user_email}</p>}
                  <p className="text-xs text-white/30 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <Link
                  href={`/events/${r.event_id}`}
                  className="text-xs text-[#9a442d] hover:underline flex-shrink-0"
                  target="_blank"
                >
                  View event →
                </Link>
              </div>

              <ReportActions
                reportId={r.id}
                eventId={r.event_id}
                currentStatus={r.status}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
