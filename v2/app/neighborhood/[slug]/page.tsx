/**
 * /neighborhood/<slug> — redirects to the canonical /neighborhoods/<slug>
 * (plural). Users naturally type the singular; we don't want a 404.
 */
import { redirect } from 'next/navigation'

interface PageProps { params: Promise<{ slug: string }> }

export default async function SingularNeighborhoodRedirect({ params }: PageProps) {
  const { slug } = await params
  redirect(`/neighborhoods/${slug}`)
}
