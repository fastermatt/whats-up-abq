import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { FeedbackActions } from './FeedbackActions'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ status?: string; category?: string }>
}

const STATUS_TABS = [
  { label: 'New',         value: 'new' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Resolved',    value: 'resolved' },
  { label: 'Won\'t fix',  value: 'wontfix' },
  { label: 'Spam',        value: 'spam' },
  { label: 'All',         value: 'all' },
]

const CATEGORY_FILTERS = [
  { label: 'All types',        value: '' },
  { label: '💡 Event ideas',   value: 'event_idea' },
  { label: '✨ Site suggest.', value: 'site_suggestion' },
  { label: '🐛 Bug reports',   value: 'bug_report' },
  { label: '🚩 Event reports', value: 'event_report' },
  { label: '💬 General',       value: 'general' },
]

const CATEGORY_LABEL: Record<string, string> = {
  event_idea:      '💡 Event idea',
  site_suggestion: '✨ Site suggestion',
  bug_report:      '🐛 Bug',
  event_report:    '🚩 Event report',
  general:         '💬 General',
}

const STATUS_COLORS: Record<string, string> = {
  new:         'bg-[#9a442d]/30 text-[#e8a898]',
  in_progress: 'bg-blue-500/20 text-blue-400',
  resolved:    'bg-green-500/20 text-green-400',
  wontfix:     'bg-white/10 text-white/50',
  spam:        'bg-red-500/20 text-red-400',
}

interface FeedbackRow {
  id:           string
  category:     string
  subject:      string | null
  message:      string
  email:        string | null
  contact_email: string | null
  submitted_by: string | null
  event_id:     string | null
  status:       string
  admin_notes:  string | null
  page:         string | null
  device:       string | null
  created_at:   string
}

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  const { status = 'new', category = '' } = await searchParams
  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .schema('public').from('feedback')
    .select('id, category, subject, message, email, contact_email, submitted_by, event_id, status, admin_notes, page, device, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status !== 'all')  q = q.eq('status', status)
  if (category)          q = q.eq('category', category)

  const { data: rows } = await q
  const feedback: FeedbackRow[] = rows ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Feedback</h1>
          <p className="text-sm text-white/40">Ideas, bug reports, and reports of site issues</p>
        </div>
        <span className="text-white/40 text-sm">{feedback.length} shown</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0 flex-wrap">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.value}
            href={`/admin/feedback?status=${tab.value}${category ? '&category='+category : ''}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              status === tab.value ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_FILTERS.map(f => (
          <Link
            key={f.value}
            href={`/admin/feedback?status=${status}${f.value ? '&category='+f.value : ''}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              category === f.value ? 'bg-[#9a442d] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {feedback.length === 0 ? (
        <p className="text-white/40 text-sm py-12 text-center">No {status === 'all' ? '' : status} feedback.</p>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="bg-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                      {CATEGORY_LABEL[f.category] ?? f.category}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[f.status] ?? 'bg-white/10 text-white/30'}`}>
                      {f.status.replace('_', ' ')}
                    </span>
                  </div>
                  {f.subject && <p className="text-sm font-semibold text-white">{f.subject}</p>}
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{f.message}</p>

                  <div className="text-xs text-white/40 mt-2 space-y-0.5">
                    {(f.email || f.contact_email) && (
                      <p>From: {f.email ?? f.contact_email}{f.submitted_by && ' (signed in)'}</p>
                    )}
                    {f.event_id && (
                      <p>Event: <Link href={`/events/${f.event_id}`} target="_blank" className="text-[#9a442d] hover:underline">{f.event_id}</Link></p>
                    )}
                    <p>{new Date(f.created_at).toLocaleString()}</p>
                  </div>

                  {f.admin_notes && (
                    <p className="text-xs text-[#9a442d]/80 mt-2 italic">Note: {f.admin_notes}</p>
                  )}
                </div>
              </div>

              <FeedbackActions feedbackId={f.id} currentStatus={f.status} initialNotes={f.admin_notes ?? ''} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
