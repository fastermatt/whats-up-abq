import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchNowPlayingMovies, type Movie } from '@/lib/movies'
import { ExternalLink, Star } from 'lucide-react'
import { buildBreadcrumbs } from '@/lib/seo'
import { OG_IMAGE } from '@/lib/fallback-images'

export const dynamic = 'force-dynamic' // always SSR, env var must be read at runtime

export const metadata: Metadata = {
  title: 'Movies Now Playing in Albuquerque, ABQ Unplugged',
  description:
    'See what movies are playing in Albuquerque theaters right now. Click to get showtimes.',
  openGraph: {
    title: 'Movies Now Playing in Albuquerque',
    description: 'What\'s showing at Albuquerque theaters this week, click any film for showtimes.',
    url: 'https://abqunplugged.com/movies',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Movies playing in Albuquerque, NM' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: {
    canonical: 'https://abqunplugged.com/movies',
  },
}

export default async function MoviesPage() {
  const movies = await fetchNowPlayingMovies(20)
  const hasMovies = movies.length > 0
  const hasKey = !!process.env.TMDB_READ_ACCESS_TOKEN

  const breadcrumbLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    { name: 'Movies', url: 'https://abqunplugged.com/movies' },
  ])
  const itemListLd = hasMovies ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Movies Now Playing in Albuquerque',
    description: 'Currently showing films in Albuquerque theaters with showtimes.',
    url: 'https://abqunplugged.com/movies',
    itemListElement: movies.slice(0, 10).map((m: Movie, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Movie',
        name: m.title,
        ...(m.overview ? { description: m.overview } : {}),
        ...(m.posterUrl ? { image: m.posterUrl } : {}),
      },
    })),
  } : null

  return (
    <main id="main" className="min-h-dvh bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {/* ── Page header — solid dark (thematic: movies show in dark
          theaters, posters look right on a dark canvas). Round-6 flagged
          the prior gradient-to-cream fade as an awkward theme break;
          this version is intentional, not accidental. */}
      <section className="py-10 px-4 bg-ink">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-[10px] uppercase tracking-[0.15em] text-[#c8aa8c] mb-3 font-semibold inline-flex items-center gap-1 hover:text-white transition-colors"
          >
            ← ABQ Unplugged
          </Link>
          <h1
            className="font-black text-white leading-tight mb-2"
            style={{
              fontFamily: 'var(--font-epilogue)',
              fontSize: 'clamp(28px, 5vw, 52px)',
              letterSpacing: '-0.5px',
            }}
          >
            Now at the movies
          </h1>
          <p className="text-[#c8aa8c] text-sm">
            Playing in Albuquerque theaters this week · Click any film for showtimes
          </p>
        </div>
      </section>

      {/* ── Movie grid ── */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        {!hasKey ? (
          /* Admin notice, only shows when TMDB_READ_ACCESS_TOKEN is not set */
          <div className="rounded-xl border border-sand-light bg-white p-8 text-center">
            <p className="text-2xl mb-3">🎬</p>
            <h2 className="font-bold text-ink text-lg mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Movies feature needs a TMDb API key
            </h2>
            <p className="text-sm text-ink-light mb-4 max-w-sm mx-auto">
              Get a free key at{' '}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-terra underline hover:no-underline"
              >
                themoviedb.org/settings/api
              </a>
              {' '}then add <code className="bg-[#f5ece3] px-1 rounded">TMDB_READ_ACCESS_TOKEN=your_token</code> to{' '}
              <code className="bg-[#f5ece3] px-1 rounded">.env.local</code> and Netlify.
            </p>
          </div>
        ) : !hasMovies ? (
          <div className="rounded-xl border border-sand-light bg-white p-8 text-center">
            <p className="text-sm text-ink-light">No movies found right now. Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {movies.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} priority={i < 5} />
              ))}
            </div>

            {/* TMDb attribution, required by their API ToS */}
            <p className="mt-8 text-center text-[11px] text-ink-light flex items-center justify-center gap-2">
              <span>Movie data provided by</span>
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-terra transition-colors underline"
              >
                The Movie Database (TMDb)
              </a>
            </p>
          </>
        )}
      </section>
    </main>
  )
}

// ─── Movie poster card ────────────────────────────────────────────────────────

function MovieCard({ movie, priority }: { movie: Movie; priority?: boolean }) {
  const ratingDisplay = movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : null

  // Genre-specific background gradient when no poster available
  const fallbackBg = 'linear-gradient(135deg, #2d201c 0%, #4a3f3a 100%)'

  return (
    <a
      href={movie.fandangoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      aria-label={`${movie.title}, get showtimes`}
    >
      {/* Poster, 2:3 ratio */}
      <div
        className="relative overflow-hidden rounded-xl mb-2 shadow-md group-hover:shadow-xl transition-shadow duration-300"
        style={{ aspectRatio: '2/3', background: fallbackBg }}
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
            loading={priority ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-50">🎬</span>
          </div>
        )}

        {/* Rating badge */}
        {ratingDisplay && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <Star className="w-2.5 h-2.5 fill-[#f5c518] text-[#f5c518] flex-shrink-0" />
            {ratingDisplay}
          </div>
        )}

        {/* Hover overlay with CTA */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end">
          <div className="w-full p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="flex items-center justify-center gap-1.5 w-full bg-terra text-white text-[11px] font-bold py-2 rounded-lg">
              <ExternalLink className="w-3 h-3" />
              Get showtimes
            </span>
          </div>
        </div>
      </div>

      {/* Title */}
      <h2
        className="font-bold text-ink text-xs leading-tight line-clamp-2 group-hover:text-terra transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {movie.title}
      </h2>

      {/* Release year */}
      {movie.releaseDate && (
        <p className="text-[10px] text-ink-light mt-0.5">
          {movie.releaseDate.slice(0, 4)}
        </p>
      )}
    </a>
  )
}
