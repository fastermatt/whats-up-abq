import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { SubmissionActions } from './SubmissionActions'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const TABS = [
  { label: 'Pending',   value: 'pending' },
  { label: 'Approved',  value: 'approved' },
  { label: 'Rejected',  value: 'rejected' },
  { label: 'Needs info', value: 'needs_info' },
  { label: 'All',       value: 'all' },
]

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400',
  approved:   'bg-green-500/20 text-green-400',
  rejected:   'bg-red-500/20 text-red-400',
  needs_info: 'bg-blue-500/20 text-blue-400',
}

interface SubmissionRow {
  id:                string
  title:             string
  description:       string | null
  event_date:        string
  start_time:        string | null
  venue_name:        string
  venue_address:     string | null
  category:          string | null
  neighborhood_slug: string | null
  photo_url:         string | null
  ticket_url:        string | null
  is_free:           boolean
  price_min_cents:   number | null
  price_max_cents:   number | null
  status:            string
  reviewer_notes:    string | null
  submitter_ip:      string | null
  user_agent:        string | null
  published_event_id: string | null
  created_at:        string
  submitted_by:      string | null
  submitter_handle:  string | null
  submitter_email:   string | null
}

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  const { status = 'pending' } = await searchParams
  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .schema('public').from('event_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status !== 'all') q = q.eq('status', status)
  const { data: subs } = await q

  // Join submitter profiles
  const userIds = Array.from(new Set((subs ?? []).map((s: SubmissionRow) => s.submitted_by).filter(Boolean)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = userIds.length ? await (supabase as any)
    .schema('public').from('profiles')
    .select('id, handle, display_name').in('id', userIds) : { data: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  // Fetch auth emails via admin API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = userIds.length ? await (supabase as any).auth.admin.listUsers({ perPage: 1000 }) : { data: { users: [] } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emailMap = new Map((users?.users ?? []).map((u: any) => [u.id, u.email]))

  const rows: SubmissionRow[] = (subs ?? []).map((s: SubmissionRow) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = s.submitted_by ? profileMap.get(s.submitted_by) as any : null
    return {
      ...s,
      submitter_handle: profile?.handle ?? null,
      submitter_email:  s.submitted_by ? (emailMap.get(s.submitted_by) as string ?? null) : null,
    }
  })

  const formatPrice = (s: SubmissionRow) => {
    if (s.is_free) return 'Free'
    if (s.price_min_cents === null && s.price_max_cents === null) return null
    const min = s.price_min_cents !== null ? `$${(s.price_min_cents / 100).toFixed(0)}` : null
    const max = s.price_max_cents !== null ? `$${(s.price_max_cents / 100).toFixed(0)}` : null
    if (min && max && min !== max) return `${min}–${max}`
    return min ?? max
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Submissions</h1>
          <p className="text-sm text-white/40">Community-submitted events awaiting review</p>
        </div>
        <span className="text-white/40 text-sm">{rows.length} shown</span>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-0 flex-wrap">
        {TABS.map(tab => (
          <Link
            key={tab.value}
            href={`/admin/submissions?status=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              status === tab.value ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-white/40 text-sm py-12 text-center">
          No {status === 'all' ? '' : status} submissions.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((s) => (
            <div key={s.id} className="bg-white/5 rounded-2xl p-5 flex flex-col md:flex-row gap-5">
              {/* Photo */}
              {s.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.photo_url}
                  alt=""
                  className="w-full md:w-48 aspect-[16/10] object-cover rounded-xl flex-shrink-0 bg-white/5"
                />
              )}

              <div className="flex-1 min-w-0 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] ?? 'bg-white/10 text-white/40'}`}>
                        {s.status}
                      </span>
                      {s.category && (
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                          {s.category}
                        </span>
                      )}
                      {s.is_free && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Free</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white">{s.title}</h3>
                    <p className="text-sm text-white/60 mt-0.5">
                      {new Date(s.event_date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      {s.start_time && ` · ${s.start_time.slice(0, 5)}`}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-white/40">Venue</div>
                  <div className="text-white/80">{s.venue_name}{s.venue_address && <span className="text-white/40"> · {s.venue_address}</span>}</div>

                  {formatPrice(s) && (<>
                    <div className="text-white/40">Price</div>
                    <div className="text-white/80">{formatPrice(s)}</div>
                  </>)}

                  {s.ticket_url && (<>
                    <div className="text-white/40">Ticket URL</div>
                    <div className="text-white/80 truncate">
                      <a href={s.ticket_url} target="_blank" rel="noopener" className="text-[#9a442d] hover:underline">
                        {s.ticket_url}
                      </a>
                    </div>
                  </>)}

                  <div className="text-white/40">Submitted by</div>
                  <div className="text-white/80">
                    {s.submitter_handle ? (
                      <>
                        @{s.submitter_handle}
                        {s.submitter_email && <span className="text-white/40"> · {s.submitter_email}</span>}
                      </>
                    ) : (
                      <span className="text-white/40">anonymous</span>
                    )}
                  </div>

                  <div className="text-white/40">Submitted at</div>
                  <div className="text-white/80">{new Date(s.created_at).toLocaleString()}</div>
                </div>

                {/* Description */}
                {s.description && (
                  <div className="bg-white/5 rounded-lg p-3 text-sm text-white/80 whitespace-pre-wrap">
                    {s.description}
                  </div>
                )}

                {/* Reviewer notes (if any) */}
                {s.reviewer_notes && (
                  <p className="text-xs text-[#9a442d]/80 italic">
                    Note: {s.reviewer_notes}
                  </p>
                )}

                {/* Published link */}
                {s.published_event_id && (
                  <p className="text-xs">
                    <Link href={`/events/${s.published_event_id}`} target="_blank"
                      className="text-green-400 hover:underline">
                      Published event →
                    </Link>
                  </p>
                )}

                {/* Actions */}
                {s.status === 'pending' && (
                  <SubmissionActions submissionId={s.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
