// Cloudflare Web Analytics for the static site: cookieless, no local storage,
// no cross-site tracking. Enabled only when ABQ_CF_ANALYTICS_TOKEN (the public
// site token from the Web Analytics snippet) is set; otherwise the site ships
// with no analytics script at all.

export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'
const BEACON_ENDPOINT = 'https://cloudflareinsights.com'

// The token is printed into every page, so it must be exactly the 32-hex value
// Cloudflare issues; anything else fails the build instead of shipping bad HTML.
export function analyticsToken(raw) {
  const token = String(raw ?? '').trim()
  if (!token) return null
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    throw new Error('ABQ_CF_ANALYTICS_TOKEN must be the 32-character token from the Cloudflare Web Analytics snippet.')
  }
  return token.toLowerCase()
}

export function analyticsSnippet(token) {
  if (!token) return ''
  return `<script defer src="${BEACON_SRC}" data-cf-beacon='{"token":"${token}"}'></script>`
}

export function contentSecurityPolicy(token) {
  const parts = ["default-src 'self'"]
  if (token) parts.push(`script-src 'self' https://static.cloudflareinsights.com`, `connect-src 'self' ${BEACON_ENDPOINT}`)
  parts.push("object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'")
  return parts.join('; ')
}

export function privacyCopy(token) {
  const intro = 'The public calendar runs from static files and does not require an account.'
  const outro = 'Organizer sites and event submissions have their own privacy policies.'
  if (!token) return `${intro} It does not use tracking scripts. ${outro}`
  return `${intro} We count visits with Cloudflare Web Analytics, which does not use cookies or local storage, does not fingerprint you, and does not follow you across other sites. It reports totals only: pages viewed, referring sites, browser and device type, country, and page load speed. We do not sell or share this information. ${outro}`
}
