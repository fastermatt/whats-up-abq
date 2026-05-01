/**
 * TMDb "Now Playing" movie fetcher.
 *
 * Requires TMDB_READ_ACCESS_TOKEN in the environment (the JWT bearer token
 * from https://www.themoviedb.org/settings/api → "API Read Access Token").
 *
 * If the token is absent, all functions return [] — the UI degrades gracefully.
 */

export interface Movie {
  id: number
  title: string
  overview: string
  posterUrl: string | null    // full https URL or null
  backdropUrl: string | null
  releaseDate: string         // YYYY-MM-DD
  voteAverage: number         // 0–10
  voteCount: number
  fandangoUrl: string         // search link scoped to ABQ showtimes
}

const TMDB_BASE  = 'https://api.themoviedb.org/3'
const IMG_BASE_W = 'https://image.tmdb.org/t/p/w500'
const IMG_BASE_B = 'https://image.tmdb.org/t/p/w1280'

/** Build a Fandango movie-times search URL for a given title in Albuquerque. */
function fandangoUrl(title: string): string {
  return `https://www.fandango.com/movie-times?q=${encodeURIComponent(title)}&location=Albuquerque%2CNM`
}

interface TmdbMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
}

interface TmdbNowPlayingResponse {
  results: TmdbMovie[]
  total_results: number
  total_pages: number
}

function shapeMovie(m: TmdbMovie): Movie {
  return {
    id: m.id,
    title: m.title,
    overview: m.overview ?? '',
    posterUrl: m.poster_path ? `${IMG_BASE_W}${m.poster_path}` : null,
    backdropUrl: m.backdrop_path ? `${IMG_BASE_B}${m.backdrop_path}` : null,
    releaseDate: m.release_date ?? '',
    voteAverage: Math.round(m.vote_average * 10) / 10,
    voteCount: m.vote_count,
    fandangoUrl: fandangoUrl(m.title),
  }
}

/**
 * Fetch movies currently playing in US theaters from TMDb.
 *
 * @param limit  Max results (default 20). TMDb pages at 20 per page.
 * @returns      Sorted by popularity desc. Empty array if token missing.
 */
export async function fetchNowPlayingMovies(limit = 20): Promise<Movie[]> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) return []

  try {
    const url = `${TMDB_BASE}/movie/now_playing?language=en-US&page=1&region=US`
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // cache 1hr — movies change weekly
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      console.error(`[movies] TMDb error ${res.status}: ${res.statusText}`)
      return []
    }

    const data: TmdbNowPlayingResponse = await res.json()
    return data.results
      .filter(m => m.vote_count > 10)  // skip brand-new titles with no votes yet
      .slice(0, limit)
      .map(shapeMovie)
  } catch (err) {
    console.error('[movies] fetch failed:', err)
    return []
  }
}
