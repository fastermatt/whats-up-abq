'use client'

/**
 * ClientChrome — lazily mounts every non-critical client component that the
 * layout used to import statically.
 *
 * Why: components like AnalyticsTracker, PWAManager, KoFiFloat, NewsletterBar
 * etc. all live in the layout. When they were imported synchronously they got
 * bundled into the layout's first-load JS. AnalyticsTracker pulls in
 * @supabase/ssr (~205 KB raw / ~54 KB gzip), which the homepage doesn't need
 * on first paint at all — auth-dependent UI lives behind /admin and /login.
 *
 * Every child here is `ssr: false` because:
 *   - none of them render anything visible above the fold,
 *   - none of them are needed for SEO / crawlable content,
 *   - they all use browser-only APIs (localStorage, navigator, matchMedia).
 *
 * AdminGate is kept on the server side in layout.tsx so /admin still hides
 * these without having to mount each one and bail. usePathname inside a
 * client wrapper would still work but mounting only to no-op wastes a frame.
 */

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const AnalyticsTracker  = dynamic(() => import('./AnalyticsTracker').then(m => ({ default: m.AnalyticsTracker })),  { ssr: false })
const WebVitals         = dynamic(() => import('./WebVitals').then(m => ({ default: m.WebVitals })),               { ssr: false })
const KoFiFloat         = dynamic(() => import('./KoFiFloat').then(m => ({ default: m.KoFiFloat })),               { ssr: false })
const PWAManager        = dynamic(() => import('./PWAManager').then(m => ({ default: m.PWAManager })),             { ssr: false })
const InstallPrompt     = dynamic(() => import('./InstallPrompt').then(m => ({ default: m.InstallPrompt })),       { ssr: false })
const FirstVisitBanner  = dynamic(() => import('./FirstVisitBanner').then(m => ({ default: m.FirstVisitBanner })), { ssr: false })
const AuthCallbackCatcher = dynamic(() => import('./AuthCallbackCatcher').then(m => ({ default: m.AuthCallbackCatcher })), { ssr: false })

export function ClientChrome() {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  // The homepage already runs HomepageStickyHook for the "new here / subscribe"
  // job. Suppress the install prompt + first-visit banner there so two+ capture
  // overlays don't stack over the featured events on mobile.
  const isHome = pathname === '/'

  return (
    <>
      <AuthCallbackCatcher />
      {!isAdmin && <KoFiFloat />}
      {!isAdmin && <AnalyticsTracker />}
      {!isAdmin && <WebVitals />}
      <PWAManager />
      {!isHome && <InstallPrompt />}
      {!isHome && <FirstVisitBanner />}
    </>
  )
}
