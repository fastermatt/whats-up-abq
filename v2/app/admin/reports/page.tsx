import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ReportActions } from './ReportActions'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  event_submission: 'Event Submission',
  wrong_info: 'Wrong info',
  cancelled: 'Cancelled',
  duplicate: 'Duplicate',
  inappropriate: 'Inappropriate',
  other: 'Other',
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

  if (status === 'submissions') {
    q = q.eq('report_type', 'event_submission').eq('status', 'pending')
  } else if (status !== 'all') {
    q = q.eq('status', status).neq('report_type', 'event_submission')
  }

  const { data: reports } = await q

  // Separate count for pending submissions badge
  const { count: pendingSubmissions } = await (supabase as any)
    .schema('public').from('event_reports')
    .select('*', { count: 'exact', head: true })
    .eq('report_type', 'event_submission')
    .eq('status', 'pending')

  const TABS = [
    { label: 'Pending', value: 'pending' },
    { label: `Submissions${(pendingSubmissions ?? 0) > 0 ? ` (${pendingSubmissions})` : ''}`, value: 'submissions' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Dismissed', value: 'dismissed' },
    { label: 'All', value: 'all' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Reports</h1>
        <span className="text-white/40 text-sm">{reports?.length ?? 0} shown</span>
      </div>

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
            <div key={r.id} className={`rounded-2xl p-5 space-y-3 ${r.report_type === 'event_submission' ? 'bg-[#9a442d]/15 border border-[#9a442d]/30' : 'bg-white/5'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                      {REPORT_TYPE_LABELS[r.report_type] ?? r.report_type.replace(/_/g, ' ')}
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
                  {r.admin_notes && (
                    <p className="text-xs text-[#9a442d]/80 mt-1 italic">Note: {r.admin_notes}</p>
                  )}
                  <p className="text-xs text-white/30 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                  <Link
                    href={`/events/${r.event_id}`}
                    className="text-xs text-[#9a442d] hover:underline"
                    target="_blank"
                  >
                    View event →
                  </Link>
                  <Link
                    href={`/admin/events/${r.event_id}`}
                    className="text-xs text-white/40 hover:text-white/60 hover:underline transition-colors"
                  >
                    Edit event →
                  </Link>
                </div>
              </div>

              <ReportActions
                reportId={r.id}
                eventId={r.event_id}
                currentStatus={r.status}
                initialNotes={r.admin_notes ?? ''}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
