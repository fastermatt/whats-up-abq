import type { Metadata, Viewport } from 'next'
import { Epilogue, Inter } from 'next/font/google'
import Script from 'next/script'
import { headers } from 'next/headers'
import BottomNav from './components/BottomNav'
import DesktopNav from './components/DesktopNav'
import { InstallPrompt } from './components/InstallPrompt'
import { FirstVisitBanner } from './components/FirstVisitBanner'
import { PWAManager } from './components/PWAManager'
import { AuthCallbackCatcher } from './components/AuthCallbackCatcher'
import { NewsletterBar } from './components/NewsletterBar'
import { KoFiFloat } from './components/KoFiFloat'
import { AnalyticsTracker } from './components/AnalyticsTracker'
import { WebVitals } from './components/WebVitals'
import { OG_IMAGE } from '@/lib/fallback-images'
import './globals.css'

const epilogue = Epilogue({
  variable: '--font-epilogue',
  subsets:  ['latin'],
  weight:   ['600', '700', '900'],  // only weights actually used in the app
  display:  'swap',
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
}

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ABQ Unplugged',
  url: 'https://abqunplugged.com',
  logo: 'https://abqunplugged.com/icon-512.png',
  description:
    'Albuquerque\'s event aggregator — concerts, comedy, arts, sports, food and more from every ticket source in one place.',
  areaServed: {
    '@type': 'City',
    name: 'Albuquerque',
    containedInPlace: { '@type': 'State', name: 'New Mexico', identifier: 'NM' },
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: 'https://abqunplugged.com',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const umamiId  = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC ?? 'https://cloud.umami.is/script.js'

  // Suppress public-site widgets when inside the admin section so they don't
  // bleed through below the admin layout container when scrolled to the bottom.
  // x-pathname is set by middleware.ts on every request.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const isAdmin  = pathname.startsWith('/admin')

  return (
    <html
      lang="en"
      className={`${epilogue.variable} ${inter.variable} h-full`}
    >
      <head>
        {/* Preconnect to Flaticon CDN so the TCP handshake is done before the async CSS loads */}
        <link rel="preconnect" href="https://cdn-uicons.flaticon.com" />
        {/* Flaticon Uicons — loaded async to avoid render-blocking. Icons appear ~200ms after
            page paint. noscript fallback ensures they still load without JS. */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css" />
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css" />
        </noscript>
      </head>
      <body className="bg-[#fbf7f1] text-[#1a1614] min-h-full flex flex-col">
        {/* Skip to main content — for keyboard/screen-reader users */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-[#9a442d] focus:px-3 focus:py-2 focus:rounded-lg focus:font-semibold focus:text-sm focus:shadow-lg"
        >
          Skip to main content
        </a>
        {/* overflow-x-clip — clips overflow without creating a scroll container,
            so position:sticky still works inside pages */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
        <AuthCallbackCatcher />
        <div className="w-full overflow-x-clip">
          <DesktopNav />
          <div className="pb-20 md:pb-0">
            {children}

            {/* ── Newsletter signup — hidden in admin ── */}
            {!isAdmin && <NewsletterBar />}

            {/* ── Site footer — hidden in admin ── */}
            {!isAdmin && <footer className="mt-8 pb-6 w-full flex flex-col items-center gap-3 select-none" aria-label="Site footer">
              {/* Ornamental rule — left line shorter so dot sits above the ♥ */}
              <div className="flex items-center gap-3">
                <div className="w-[77px] h-px bg-gradient-to-r from-transparent via-[#c8b4a4] to-[#c8b4a4]" />
                <div className="w-1 h-1 rounded-full bg-[#9a442d]/50" />
                <div className="w-[135px] h-px bg-gradient-to-l from-transparent via-[#c8b4a4] to-[#c8b4a4]" />
              </div>

              {/* The line */}
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#9a8880]">
                <span>Built with</span>
                <span
                  className="animate-heartbeat-word inline-flex items-center gap-0.5 text-[#9a442d]"
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
                className="text-[10px] text-[#b8a89e] hover:text-[#9a442d] transition-colors tracking-wide"
              >
                ☕ ko-fi.com/stopscrolling
              </a>
            </footer>}
          </div>
          <BottomNav />
        </div>
        {!isAdmin && <KoFiFloat />}
        {!isAdmin && <AnalyticsTracker />}
        {!isAdmin && <WebVitals />}
        <PWAManager />
        <InstallPrompt />
        <FirstVisitBanner />

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
      </body>
    </html>
  )
}
