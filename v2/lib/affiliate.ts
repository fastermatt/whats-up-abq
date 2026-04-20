/**
 * Affiliate URL transformer
 *
 * Appends affiliate tracking parameters to ticket URLs before they're rendered.
 * Reads IDs from env vars — returns the original URL unchanged when vars are unset.
 *
 * Programs to sign up for:
 *   Ticketmaster → https://affiliates.ticketmaster.com  (publisher ID → AFFILIATE_TM_ID)
 *   SeatGeek     → https://seatgeek.com/affiliates      (Impact.com AID → AFFILIATE_SG_AID)
 *   Eventbrite   → https://www.awin.com/us/advertiser/eventbrite (Awin → AFFILIATE_EB_CODE)
 *
 * After approval, add to .env.local and Netlify environment variables:
 *   AFFILIATE_TM_ID=your_publisher_id
 *   AFFILIATE_SG_AID=your_impact_aid
 *   AFFILIATE_EB_CODE=your_awin_code
 */

const TM_ID   = process.env.AFFILIATE_TM_ID   ?? ''
const SG_AID  = process.env.AFFILIATE_SG_AID  ?? ''
const EB_CODE = process.env.AFFILIATE_EB_CODE ?? ''

/**
 * Returns the ticket URL with affiliate tracking appended, or the original URL
 * if no affiliate ID is configured for that platform.
 */
export function affiliateUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'ticketmaster.com' && TM_ID) {
      u.searchParams.set('camefrom', `AFFIL_TM_US_${TM_ID}`)
    } else if (host === 'seatgeek.com' && SG_AID) {
      u.searchParams.set('aid', SG_AID)
    } else if (host === 'eventbrite.com' && EB_CODE) {
      u.searchParams.set('aff', EB_CODE)
    }

    return u.toString()
  } catch {
    // Malformed URL — return as-is
    return url
  }
}
