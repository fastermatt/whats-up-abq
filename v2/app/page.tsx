import { createClient } from '@/lib/supabase/server'

export const revalidate = 60  // ISR: revalidate every 60 seconds

async function getStats() {
  try {
    const supabase = await createClient()
    const [venues, categories] = await Promise.all([
      supabase.schema('v2').from('venues').select('id', { count: 'exact', head: true }),
      supabase.schema('v2').from('categories').select('slug', { count: 'exact', head: true }),
    ])
    return {
      venues:     venues.count     ?? 0,
      categories: categories.count ?? 0,
      ok: true,
    }
  } catch {
    return { venues: 0, categories: 0, ok: false }
  }
}

export default async function HomePage() {
  const stats = await getStats()

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-dvh px-4">
      {/* ── Header ── */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f0e4cc] text-[#9a442d] text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-[#9a442d] animate-pulse" />
          v2 preview — building in public
        </div>
        <h1
          className="text-5xl font-black tracking-tight text-[#1a1614]"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          ABQ Unplugged
        </h1>
        <p className="text-lg text-[#4a3f3a] max-w-md mx-auto">
          Every event in Albuquerque. Every ticket source. One place.
        </p>
      </div>

      {/* ── DB health card ── */}
      <div className="w-full max-w-md rounded-2xl border border-[#ddc9a3] bg-white shadow-[0_2px_12px_0_rgba(26,22,20,0.08)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#1a1614]">Database Status</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              stats.ok
                ? 'bg-[#b0c4b1] text-[#4f6249]'
                : 'bg-[#e8a898] text-[#9a442d]'
            }`}
          >
            {stats.ok ? '✓ Connected' : '✗ Offline'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#fbf7f1] rounded-xl p-3">
            <div className="text-2xl font-black text-[#9a442d]">{stats.venues}</div>
            <div className="text-[#8a7a74]">Venues seeded</div>
          </div>
          <div className="bg-[#fbf7f1] rounded-xl p-3">
            <div className="text-2xl font-black text-[#006a62]">{stats.categories}</div>
            <div className="text-[#8a7a74]">Categories</div>
          </div>
        </div>

        <div className="text-xs text-[#8a7a74] pt-1 border-t border-[#f0e4cc]">
          Supabase project: bsmvfutebmbkjvlrhiyq · schema: v2
        </div>
      </div>

      {/* ── What's coming ── */}
      <div className="mt-8 w-full max-w-md space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#8a7a74] mb-3">
          Phase 0 checklist
        </p>
        {[
          { done: true,  label: 'v2.* schema applied (10 tables)' },
          { done: true,  label: '228 venues seeded from v1' },
          { done: true,  label: '32 categories seeded' },
          { done: true,  label: 'API quota caps enforced (TM, SG, Nominatim…)' },
          { done: true,  label: 'Next.js 15 + Tailwind scaffold' },
          { done: true,  label: 'TypeScript types generated' },
          { done: false, label: 'Ticketmaster ingestion (Phase 2)' },
          { done: false, label: 'Event list + filter UI (Phase 3)' },
          { done: false, label: 'SEO + OG images (Phase 4)' },
        ].map(({ done, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
              done ? 'bg-[#b0c4b1] text-[#4f6249]' : 'bg-[#f0e4cc] text-[#c4a97d]'
            }`}>
              {done ? '✓' : '○'}
            </span>
            <span className={done ? 'text-[#4a3f3a]' : 'text-[#8a7a74]'}>{label}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
