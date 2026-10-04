import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abqunplugged.com'

  return {
    rules: [
      {
        // Crawlers that burned Netlify function quota with no benefit to a local
        // events site. Also hard-blocked at the edge in middleware.ts (keep the
        // two lists in sync). Do NOT add facebookexternalhit (IG/FB link previews)
        // or search engines here.
        userAgent: [
          'meta-externalagent',
          'meta-webindexer',
          'ShapBot',
          'Bytespider',
          'Baiduspider',
          'PetalBot',
          'MJ12bot',
          'DotBot',
          'SemrushBot',
          'AhrefsBot',
        ],
        disallow: '/',
      },
      {
        userAgent: '*',
        // Allow the entire site — all event, category, neighborhood,
        // venue, and editorial pages should be crawlable.
        allow: ['/'],
        disallow: [
          '/api/',          // API routes — no need to crawl
          '/_next/',        // Next.js internals
          '/admin/',        // Admin section — private
          '/ig',            // IG post designer tool
          '/events/*/ig',   // Event IG card (square)
          '/events/*/ig2',  // Event IG card (portrait)
          '/events/*/ig3',  // Event IG card (story)
          '/feedback',      // Utility form — noindex, not useful in search
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
