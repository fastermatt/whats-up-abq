/**
 * /admin/ig/suggest — Instagram Post Suggestion Queue
 *
 * AI generates a 7-day posting schedule. Matt reviews, accepts or rejects
 * with optional comments (for learning). Accepted posts go to the scheduler.
 */
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { SuggestionQueue, Suggestion } from './SuggestionQueue'

export const metadata = {
  title: 'Suggestion Queue | ABQ Unplugged Admin',
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token  = cookieStore.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET
  return !!secret && token === secret
}

export default async function SuggestPage() {
  if (!(await isAdmin())) redirect('/admin/login?next=/admin/ig/suggest')

  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('ig_post_suggestions')
    .select('id, created_at, post_type, template_id, event_ids, event_data, caption, scheduled_for, status, rejection_reason, caption_edited, strategy_notes, generation_id')
    .order('scheduled_for', { ascending: true })
    .limit(100)

  // Stats for last 14 days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: statsRows } = await (supabase as any)
    .schema('public')
    .from('ig_post_suggestions')
    .select('status')
    .gte('created_at', new Date(Date.now() - 14 * 86400 * 1000).toISOString())

  const stats = (statsRows ?? []).reduce(
    (acc: Record<string, number>, row: { status: string }) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    },
    {}
  )

  return (
    <SuggestionQueue
      initial={(data ?? []) as Suggestion[]}
      initialStats={stats}
    />
  )
}
