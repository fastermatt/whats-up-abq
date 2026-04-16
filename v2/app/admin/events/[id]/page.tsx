import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EventEditForm } from './EventEditForm'

export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminEventEditPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .schema('public').from('events')
    .select('id, source, event_date, hidden, featured, ai_enrichment, raw')
    .eq('id', id)
    .single()

  if (!row) notFound()

  const raw = row.raw as Record<string, unknown>
  const ai = (row.ai_enrichment as Record<string, unknown>) ?? {}

  let rawTitle = ''
  if (row.source === 'eventbrite') {
    const nameField = raw.name as Record<string, unknown> | string | undefined
    rawTitle = typeof nameField === 'object' && nameField ? (nameField.text as string) : (nameField as string) ?? ''
  } else {
    rawTitle = (raw.name as string) ?? (raw.title as string) ?? ''
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/events" className="text-white/40 hover:text-white text-sm transition-colors">← Events</Link>
      </div>

      <div>
        <h1 className="text-2xl font-black mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
          {String(ai.title_override ?? rawTitle) || 'Edit Event'}
        </h1>
        <p className="text-white/40 text-xs">
          {row.source} · {row.event_date} · ID: {id}
          {' · '}
          <Link href={`/events/${id}`} className="text-[#9a442d] hover:underline" target="_blank">
            View on site →
          </Link>
        </p>
      </div>

      <EventEditForm
        eventId={id}
        initialValues={{
          category: (ai.category as string) ?? '',
          subcategory: (ai.subcategory as string) ?? '',
          title_override: (ai.title_override as string) ?? '',
          admin_notes: (ai.admin_notes as string) ?? '',
          hidden: row.hidden ?? false,
          featured: row.featured ?? false,
        }}
        rawTitle={rawTitle}
      />

      {/* Raw data preview */}
      <details className="bg-white/5 rounded-xl p-4">
        <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">Raw data</summary>
        <pre className="text-[10px] text-white/40 mt-3 overflow-auto max-h-64">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  )
}
