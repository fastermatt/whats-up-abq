import { redirect } from 'next/navigation'

/**
 * /search redirect — many users type /search?q=... but the real search
 * lives on /events?q=.... Redirect to keep them working.
 */
interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; time?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  if (params.q)        qs.set('q', params.q)
  if (params.category) qs.set('category', params.category)
  if (params.time)     qs.set('time', params.time)

  const target = `/events${qs.toString() ? `?${qs.toString()}` : ''}`
  redirect(target)
}
