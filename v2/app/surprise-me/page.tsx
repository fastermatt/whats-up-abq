/**
 * /surprise-me — server-side redirect to /api/surprise.
 * /api/surprise picks a random upcoming photo-bearing event and redirects to
 * its detail page. The /surprise-me path was discovered as 404 during user
 * testing; this page redirects so both URL forms work.
 */
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function SurpriseMePage() {
  redirect('/api/surprise')
}
