/**
 * Ko-Fi support section — shown sitewide between the newsletter bar and footer.
 * Deliberately light to contrast the dark newsletter bar above it.
 * Static server component — just a link, no client state needed.
 */
export function SupportBar() {
  return (
    <section
      className="relative overflow-hidden border-t border-[#ddc9a3]/50 py-10 px-4"
      style={{
        background: 'linear-gradient(160deg, #fef9f2 0%, #fdf3e4 100%)',
      }}
    >
      {/* Subtle dot grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, #c8a882 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative max-w-md mx-auto text-center">
        {/* Animated coffee cup */}
        <div className="text-4xl mb-4 animate-heartbeat inline-block select-none" aria-hidden="true">
          ☕
        </div>

        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-bold mb-2">
          Keep ABQ Unplugged free
        </p>

        <h2
          className="text-xl font-black text-[#1a1614] mb-3"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          This site runs on coffee.
        </h2>

        {/* Stats row */}
        <div className="flex justify-center gap-4 sm:gap-8 mb-5">
          {[
            { n: '1,000+', label: 'Events tracked' },
            { n: '1',      label: 'Developer' },
            { n: '$0',     label: 'Ads' },
          ].map(({ n, label }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-black text-[#9a442d] tabular-nums">{n}</p>
              <p className="text-[9px] uppercase tracking-[0.12em] text-[#9a8880] font-semibold whitespace-nowrap">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-[13px] text-[#6b5d57] leading-relaxed mb-6 max-w-xs mx-auto">
          Built independently for Albuquerque. No paywalls, no sponsored
          posts. If it helped you find something worth doing, a coffee covers the server bill.
        </p>

        <a
          href="https://ko-fi.com/stopscrolling"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#9a442d] text-white text-sm font-bold hover:bg-[#7d3725] active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          <span aria-hidden="true">☕</span>
          Buy a coffee on Ko-Fi
        </a>

        <p className="mt-3 text-[10px] text-[#b8a89e]">
          No account needed · Powered by Ko-Fi
        </p>
      </div>
    </section>
  )
}
