export default function HomeLoading() {
  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      {/* ── Hero Skeleton ── */}
      <section className="relative overflow-hidden h-[380px] bg-gradient-to-br from-[#e8ddd0] via-[#ede2d6] to-[#e8ddd0] animate-pulse" />

      {/* ── Quick Stats Skeleton ── */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-[#e8ddd0] rounded-xl p-3 h-[100px] animate-pulse"
            />
          ))}
        </div>
      </section>

      {/* ── Section 1 Skeleton ── */}
      <section className="py-6">
        <div className="max-w-6xl mx-auto px-4 mb-3">
          <div className="h-5 bg-[#e8ddd0] rounded w-32 mb-2 animate-pulse" />
          <div className="h-7 bg-[#e8ddd0] rounded w-48 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0">
              <div className="w-[220px] aspect-[16/10] bg-[#e8ddd0] rounded-xl animate-pulse mb-1.5" />
              <div className="w-[220px] h-4 bg-[#e8ddd0] rounded animate-pulse mb-1.5" />
              <div className="w-[200px] h-3 bg-[#e8ddd0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2 Skeleton ── */}
      <section className="py-6">
        <div className="max-w-6xl mx-auto px-4 mb-3">
          <div className="h-5 bg-[#e8ddd0] rounded w-32 mb-2 animate-pulse" />
          <div className="h-7 bg-[#e8ddd0] rounded w-48 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0">
              <div className="w-[220px] aspect-[16/10] bg-[#e8ddd0] rounded-xl animate-pulse mb-1.5" />
              <div className="w-[220px] h-4 bg-[#e8ddd0] rounded animate-pulse mb-1.5" />
              <div className="w-[200px] h-3 bg-[#e8ddd0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 3 Skeleton ── */}
      <section className="py-6">
        <div className="max-w-6xl mx-auto px-4 mb-3">
          <div className="h-5 bg-[#e8ddd0] rounded w-32 mb-2 animate-pulse" />
          <div className="h-7 bg-[#e8ddd0] rounded w-48 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0">
              <div className="w-[220px] aspect-[16/10] bg-[#e8ddd0] rounded-xl animate-pulse mb-1.5" />
              <div className="w-[220px] h-4 bg-[#e8ddd0] rounded animate-pulse mb-1.5" />
              <div className="w-[200px] h-3 bg-[#e8ddd0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Browse All Button Skeleton ── */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-12 bg-[#e8ddd0] rounded-2xl animate-pulse" />
      </section>
    </main>
  )
}
