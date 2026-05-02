import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abqunplugged.com'

  return {
    rules: [
      {
        userAgent: '*',
        // Allow the entire site — all event, category, neighborhood,
        // venue, and editorial pages should be crawlable.
        allow: ['/'],
        disallow: [
          '/api/',      // API routes — no need to crawl
          '/_next/',    // Next.js internals
          '/admin/',    // Admin section — private
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
