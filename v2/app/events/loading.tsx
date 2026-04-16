export default function EventsLoading() {
  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      {/* ── Header Skeleton ── */}
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between h-14">
          <div className="h-6 w-40 bg-[#e8ddd0] rounded animate-pulse" />
          <div className="h-4 w-32 bg-[#e8ddd0] rounded animate-pulse" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* ── Title Row Skeleton ── */}
        <div className="mb-5">
          <div className="h-8 w-48 bg-[#e8ddd0] rounded animate-pulse" />
        </div>

        {/* ── Filter Bar Skeleton ── */}
        <div className="space-y-3">
          {/* First row of filter pills */}
          <div className="flex gap-2 flex-wrap">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-8 w-24 bg-[#e8ddd0] rounded-full animate-pulse"
              />
            ))}
          </div>
          {/* Second row of filter pills */}
          <div className="flex gap-2 flex-wrap">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="h-8 w-24 bg-[#e8ddd0] rounded-full animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* ── Event Grid Skeleton ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="flex flex-col">
              {/* Card image skeleton */}
              <div className="w-full aspect-[16/10] bg-[#e8ddd0] rounded-xl animate-pulse mb-2" />
              {/* Title line 1 */}
              <div className="h-3 bg-[#e8ddd0] rounded animate-pulse mb-1.5" />
              {/* Title line 2 */}
              <div className="h-3 w-4/5 bg-[#e8ddd0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
