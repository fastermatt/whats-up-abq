import type { Metadata, Viewport } from 'next'
import { Epilogue, Inter, Space_Grotesk } from 'next/font/google'
import Script from 'next/script'
import BottomNav from './components/BottomNav'
import DesktopNav from './components/DesktopNav'
import { InstallPrompt } from './components/InstallPrompt'
import { AuthCallbackCatcher } from './components/AuthCallbackCatcher'
import { OG_IMAGE } from '@/lib/fallback-images'
import './globals.css'

const epilogue = Epilogue({
  variable: '--font-epilogue',
  subsets:  ['latin'],
  weight:   ['400', '600', '700', '800', '900'],
  display:  'swap',
})

const inter = Inter({
  variable: '--font-inter',
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  display:  'swap',
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets:  ['latin'],
  weight:   ['400', '500'],
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
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'ABQ Unplugged — Events in Albuquerque, NM',
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
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ABQ Unplugged',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  width:              'device-width',
  initialScale:       1,
  themeColor:         '#fbf7f1',
  colorScheme:        'light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const umamiId  = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC ?? 'https://cloud.umami.is/script.js'

  return (
    <html
      lang="en"
      className={`${epilogue.variable} ${inter.variable} ${spaceGrotesk.variable} h-full`}
    >
      <head />
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
        <AuthCallbackCatcher />
        <div className="w-full overflow-x-clip">
          <DesktopNav />
          <div className="pb-20 md:pb-0">{children}</div>
          <BottomNav />
        </div>
        <InstallPrompt />

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
