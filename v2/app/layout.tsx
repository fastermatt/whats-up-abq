import type { Metadata, Viewport } from 'next'
import { Epilogue, Inter } from 'next/font/google'
import Script from 'next/script'
import BottomNav from './components/BottomNav'
import DesktopNav from './components/DesktopNav'
import { ClientChrome } from './components/ClientChrome'
import { AdminGate } from './components/AdminGate'
import { LazyNewsletterBar } from './components/LazyNewsletterBar'
import { HolidayBanner } from './components/HolidayBanner'
import { OG_IMAGE } from '@/lib/fallback-images'
import { getActiveHoliday } from '@/data/holidays'
import './globals.css'

const epilogue = Epilogue({
  variable: '--font-epilogue',
  subsets:  ['latin'],
  weight:   ['600', '700', '900'],
  // 'optional': very short block period (≤100ms), no late swap.
  // The woff2 is preloaded so it arrives before the block period ends (~1s on 4G),
  // meaning the custom font STILL renders — just without ever triggering a late swap.
  // Removing font-display:block base64 workaround: that 47KB inline decode was
  // adding >3s to mobile LCP on throttled connections (CPU decode cost at 4x slowdown).
  display:  'optional',
})

const inter = Inter({
  variable: '--font-inter',
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  display:  'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | ABQ Unplugged',
    default:  'ABQ Unplugged — Things to do in Albuquerque',
  },
  description:
    'The best events in Albuquerque, NM — concerts, comedy, arts, sports, food & drink. ' +
    'Every ticket source in one place.',
  metadataBase: new URL('https://abqunplugged.com'),
  openGraph: {
    type:        'website',
    siteName:    'ABQ Unplugged',
    locale:      'en_US',
    images: [
      {
        url:    OG_IMAGE,   // JPEG 1200×630 — universal platform support
        width:  1200,
        height: 630,
        alt:    'ABQ Unplugged — Events in Albuquerque, NM',
        type:   'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index:  true,
    follow: true,
  },
  verification: {
    // Public Google Search Console verification token — safe to commit. Pinned
    // here so verification keeps working even if the Netlify env var is unset.
    // Created 2026-04-26 for the URL-prefix property `https://abqunplugged.com/`.
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION ?? 'VyqMRyVfgsMPxQqQLbp0-iFnZiiHJ6riNpWNm3q4Wns',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ABQ Unplugged',
  },
  icons: {
    icon: [
      { url: '/favicon.ico',          sizes: 'any',     type: 'image/x-icon' },
      { url: '/favicon-16x16.png',    sizes: '16x16',   type: 'image/png' },
      { url: '/favicon.png',          sizes: '32x32',   type: 'image/png' },
      { url: '/icon-192.png',         sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png',         sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width:              'device-width',
  initialScale:       1,
  themeColor:         '#fbf7f1',
  colorScheme:        'light',
  // viewportFit: 'cover' lets the page extend into iPhone notched-device
  // safe areas. The bottom nav already honors env(safe-area-inset-bottom)
  // so content never gets covered by the home indicator.
  viewportFit:        'cover',
}

// NOTE: Organization JSON-LD is emitted per-page (not in this root layout) to
// avoid 3x duplication in the rendered HTML. See app/page.tsx for the homepage
// copy; sub-routes don't need the Org schema as Google reads it from the
// homepage canonical anyway.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const umamiId  = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC ?? 'https://cloud.umami.is/script.js'

  // Server-side resolved active holiday — drives the contextual banner.
  // Recomputes on every render. Layouts in App Router are server components
  // so this runs at request time (or ISR rebuild time). The Holiday object
  // contains a function (date), so we strip to a serializable subset before
  // passing to the client banner component.
  const active = getActiveHoliday()
  const banner = active ? {
    holidayKey: active.holiday.key,
    name:       active.holiday.name,
    tagline:    active.holiday.tagline,
    subtitle:   active.holiday.subtitle,
    emoji:      active.holiday.emoji,
    bgClass:    active.holiday.bgClass,
    textClass:  active.holiday.textClass,
    bgImage:    active.holiday.bgImage,
    date:       active.date,
    daysUntil:  active.daysUntil,
  } : null

  return (
    <html
      lang="en"
      className={`${epilogue.variable} ${inter.variable} h-full`}
    >
      <head>
        {/* Hero map image removed — heading text is now the LCP element.
            No preload needed; heading renders from HTML+CSS with no external resource. */}
        {/* Preconnect to Flaticon CDN so the TCP handshake is done before the async CSS loads */}
        <link rel="preconnect" href="https://cdn-uicons.flaticon.com" />
        <link rel="alternate" type="application/rss+xml" title="ABQ Unplugged Events" href="https://abqunplugged.com/feed.xml" />
        {/* Flaticon Uicons — loaded async to avoid render-blocking. Icons appear ~200ms after
            page paint. noscript fallback ensures they still load without JS. */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css" />
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css" />
        </noscript>
      </head>
      <body className="bg-cream text-ink min-h-full flex flex-col">
        {/* Skip to main content — for keyboard/screen-reader users */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-terra focus:px-3 focus:py-2 focus:rounded-lg focus:font-semibold focus:text-sm focus:shadow-lg"
        >
          Skip to main content
        </a>
        {/* overflow-x-clip — clips overflow without creating a scroll container,
            so position:sticky still works inside pages */}
        <div className="w-full overflow-x-clip">
          {/* Holiday banner — shown only when getActiveHoliday() returns a
              hit (within preDays/postDays of a calendar entry). Hidden in
              admin to avoid distracting the dashboard. Sits ABOVE the nav
              so it pushes the nav down rather than overlapping. */}
          {banner && (
            <AdminGate>
              <HolidayBanner {...banner} />
            </AdminGate>
          )}
          <DesktopNav />
          {/* pb-[100px] clears the 65px BottomNav with ~35px breathing
              room. Mobile audit (2026-05-09) caught the footer "Built with
              love" tagline being cropped by the nav at scroll-bottom on
              iPhone 14 Pro. The previous pb-20 (80px) wasn't enough once
              you account for the NewsletterBar's own bottom border. */}
          <div className="pb-[100px] md:pb-0">
            {children}

            {/* ── Newsletter signup — hidden in admin ── */}
            <AdminGate><LazyNewsletterBar /></AdminGate>

            {/* ── Site footer — hidden in admin ── */}
            <AdminGate>
              <footer className="mt-8 pb-6 w-full flex flex-col items-center gap-3 select-none" aria-label="Site footer">
                {/* Ornamental rule — left line shorter so dot sits above the ♥ */}
                <div className="flex items-center gap-3">
                  <div className="w-[77px] h-px bg-gradient-to-r from-transparent via-[#c8b4a4] to-[#c8b4a4]" />
                  <div className="w-1 h-1 rounded-full bg-terra/50" />
                  <div className="w-[135px] h-px bg-gradient-to-l from-transparent via-[#c8b4a4] to-[#c8b4a4]" />
                </div>

                {/* The line */}
                <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#9a8880]">
                  <span>Built with</span>
                  <span
                    className="animate-heartbeat-word inline-flex items-center gap-0.5 text-terra"
                    aria-label="love"
                  >
                    <span style={{ fontSize: '0.95rem', lineHeight: 1 }} aria-hidden="true">♥</span>
                    <span>Love</span>
                  </span>
                  <span>for Albuquerque</span>
                </p>

                {/* Ko-Fi micro-link */}
                <a
                  href="https://ko-fi.com/stopscrolling"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#b8a89e] hover:text-terra transition-colors tracking-wide"
                >
                  ☕ ko-fi.com/stopscrolling
                </a>
              </footer>
            </AdminGate>
          </div>
          <BottomNav />
        </div>
        <ClientChrome />

        {/* Flaticon Uicons — async CSS inject, avoids render-blocking */}
        <Script id="flaticon-css" strategy="afterInteractive">{`
          [
            'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css',
            'https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css'
          ].forEach(function(href){
            var l=document.createElement('link');l.rel='stylesheet';l.href=href;
            document.head.appendChild(l);
          });
        `}</Script>

        {/* Umami analytics — loads after page is interactive, privacy-first */}
        {umamiId && (
          <Script
            src={umamiSrc}
            data-website-id={umamiId}
            strategy="afterInteractive"
          />
        )}

        {/* Ahrefs Web Analytics — lazyOnload so it never competes with LCP-critical resources.
            Ahrefs may show "script not verified" in dashboard but data collection still works. */}
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="leD8mIKA17PaP6xSPa9/4g"
          strategy="lazyOnload"
        />

      </body>
    </html>
  )
}
