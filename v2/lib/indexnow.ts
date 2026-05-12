/**
 * IndexNow — ping Bing (and Yandex) to index URLs immediately.
 * No account required. Key is served at /a8f4c2b1d7e5f3a9b4c8d2e6f1a5b9c3.txt
 * and validated by search engines via GET request to that URL.
 *
 * Docs: https://www.indexnow.org/documentation
 */

const INDEXNOW_KEY = 'a8f4c2b1d7e5f3a9b4c8d2e6f1a5b9c3'
const INDEXNOW_HOST = 'www.bing.com'
const SITE_HOST    = 'abqunplugged.com'

/**
 * Notify IndexNow of one or more updated URLs.
 * Call this after publishing new events or pages.
 * Safe to fire-and-forget (errors are logged but not thrown).
 *
 * @example
 * // After ingesting new events:
 * await notifyIndexNow(['https://abqunplugged.com/events/abc123'])
 *
 * // Ping the sitemap root to trigger bulk discovery:
 * await notifyIndexNow(['https://abqunplugged.com'])
 */
export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return

  // IndexNow supports up to 10,000 URLs per batch — chunk for safety
  const batch = urls.slice(0, 10_000)

  try {
    const res = await fetch(`https://${INDEXNOW_HOST}/indexnow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: batch,
      }),
    })

    if (!res.ok && res.status !== 202) {
      console.warn(`[IndexNow] Unexpected status ${res.status} for ${batch.length} URLs`)
    }
  } catch (err) {
    // Non-fatal — never let IndexNow failures block the ingestion pipeline
    console.warn('[IndexNow] Submission failed (non-fatal):', err)
  }
}

/**
 * Convenience: ping the homepage + sitemap root so Bing discovers
 * all new content via the sitemap. Call once after each ingestion run.
 */
export async function notifyIndexNowSitemap(): Promise<void> {
  return notifyIndexNow([
    'https://abqunplugged.com',
    'https://abqunplugged.com/events',
    'https://abqunplugged.com/tonight',
    'https://abqunplugged.com/weekend',
  ])
}
