/**
 * SEO landing page: Events This Weekend in Albuquerque
 * Redirects to canonical /things-to-do-this-weekend for SEO consolidation.
 */
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/things-to-do-this-weekend')
}
