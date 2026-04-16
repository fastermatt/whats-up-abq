import type { Metadata, Viewport } from 'next'
import { Epilogue, Inter, Space_Grotesk } from 'next/font/google'
import Script from 'next/script'
import BottomNav from './components/BottomNav'
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://v2.abqunplugged.com'
  ),
  openGraph: {
    type:        'website',
    siteName:    'ABQ Unplugged',
    locale:      'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index:  true,
    follow: true,
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
      <head>
        {/* Material Symbols for bottom nav icons */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-[#fbf7f1] text-[#1a1614] min-h-full flex flex-col">
        <div className="pb-20 md:pb-0">{children}</div>
        <BottomNav />

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
