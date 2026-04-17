/**
 * Category-based fallback images for events without photos.
 * Generated via Midjourney — illustrated Southwest/ABQ style.
 * Served from Midjourney CDN; will migrate to R2/CDN later.
 *
 * Each category has multiple variations to avoid visual repetition.
 * Hero images rotate daily for a fresh homepage feel.
 */

const MJ = 'https://cdn.midjourney.com'

// ── Category Fallback Images ────────────────────────────────────────────────
// Multiple variations per category (all 4 Midjourney outputs preserved)

const CATEGORY_IMAGES: Record<string, string[]> = {
  music: [
    `${MJ}/432d4425-1f79-4f48-a1bf-9d84e87c5d59/0_0.jpeg`, // guitar + cactus + string lights
    `${MJ}/432d4425-1f79-4f48-a1bf-9d84e87c5d59/0_1.jpeg`,
    `${MJ}/432d4425-1f79-4f48-a1bf-9d84e87c5d59/0_2.jpeg`,
    `${MJ}/432d4425-1f79-4f48-a1bf-9d84e87c5d59/0_3.jpeg`,
  ],
  sports: [
    `${MJ}/6b9cf507-2761-47cf-894c-ff55b6249bd8/0_0.jpeg`, // baseball stadium + Sandias
    `${MJ}/6b9cf507-2761-47cf-894c-ff55b6249bd8/0_1.jpeg`,
    `${MJ}/6b9cf507-2761-47cf-894c-ff55b6249bd8/0_2.jpeg`,
    `${MJ}/6b9cf507-2761-47cf-894c-ff55b6249bd8/0_3.jpeg`,
  ],
  'arts & theater': [
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_0.jpeg`, // theater masks + paintbrushes + adobe
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_1.jpeg`,
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_2.jpeg`,
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_3.jpeg`,
  ],
  family: [
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_0.jpeg`, // hot air balloon festival
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_1.jpeg`,
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_2.jpeg`,
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_3.jpeg`,
  ],
  'food & drink': [
    `${MJ}/27a789d4-13b9-4e5f-a8d6-7008beee4e4a/0_0.jpeg`, // green chile + margaritas
    `${MJ}/27a789d4-13b9-4e5f-a8d6-7008beee4e4a/0_1.jpeg`,
    `${MJ}/27a789d4-13b9-4e5f-a8d6-7008beee4e4a/0_2.jpeg`,
    `${MJ}/27a789d4-13b9-4e5f-a8d6-7008beee4e4a/0_3.jpeg`,
  ],
  film: [
    `${MJ}/29c18ecf-0ad4-4e16-9e65-f6b0270b5d41/0_0.jpeg`, // desert drive-in theater at night
    `${MJ}/29c18ecf-0ad4-4e16-9e65-f6b0270b5d41/0_1.jpeg`,
    `${MJ}/29c18ecf-0ad4-4e16-9e65-f6b0270b5d41/0_2.jpeg`,
    `${MJ}/29c18ecf-0ad4-4e16-9e65-f6b0270b5d41/0_3.jpeg`,
    `${MJ}/09c10428-ebfe-4db4-88cd-1ceabef8a1d3/0_0.jpeg`, // vintage projector on adobe wall
    `${MJ}/09c10428-ebfe-4db4-88cd-1ceabef8a1d3/0_1.jpeg`,
    `${MJ}/09c10428-ebfe-4db4-88cd-1ceabef8a1d3/0_2.jpeg`,
    `${MJ}/09c10428-ebfe-4db4-88cd-1ceabef8a1d3/0_3.jpeg`,
    `${MJ}/c7779be8-b980-400f-9996-15fbc1761318/0_0.jpeg`, // projector on tripod in desert
    `${MJ}/c7779be8-b980-400f-9996-15fbc1761318/0_1.jpeg`,
    `${MJ}/c7779be8-b980-400f-9996-15fbc1761318/0_2.jpeg`,
    `${MJ}/c7779be8-b980-400f-9996-15fbc1761318/0_3.jpeg`,
  ],
  // Aliases — reuse existing images for new categories
  comedy: [
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_0.jpeg`, // reuse arts & theater masks
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_1.jpeg`,
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_2.jpeg`,
    `${MJ}/cea7d54e-e473-409b-8fbc-24ca50c3d626/0_3.jpeg`,
  ],
  festivals: [
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_0.jpeg`, // reuse balloon festival
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_1.jpeg`,
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_2.jpeg`,
    `${MJ}/a47a3206-8682-4d01-9e8d-a396962898ec/0_3.jpeg`,
  ],
  outdoor: [
    `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_0.jpeg`, // desert highway into Sandias
    `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_1.jpeg`,
    `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_2.jpeg`,
    `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_3.jpeg`,
  ],
  community: [
    `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_0.jpeg`, // reuse golden hour patio
    `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_1.jpeg`,
    `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_2.jpeg`,
    `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_3.jpeg`,
  ],
}

// Default fallback — used when category is unknown or missing
// Desert highway + Family (balloon) + OG panoramic — all text-free flat illustration style
// NOTE: Route 66 images (c66db325) have AI text slop — do NOT use
const DEFAULT_IMAGES = [
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_0.jpeg`, // desert highway stretching into Sandias
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_1.jpeg`,
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_2.jpeg`,
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_3.jpeg`,
  ...CATEGORY_IMAGES.family,
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_0.jpeg`, // OG panoramic (balloons + skyline)
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_1.jpeg`,
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_2.jpeg`,
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_3.jpeg`,
]

// ── Hero Images (daily rotation) ────────────────────────────────────────────
// Wide-format images for the homepage hero section.
// Local images (in /public/hero/) take priority — they rotate daily.
// CDN images serve as fallback if local files haven't been placed yet.
// Rotates based on day-of-year so it's consistent for all users on the same day.

// Local hero images — Midjourney vintage poster-style ABQ landscapes
// All 7 images placed in v2/public/hero/
// hero-1–4: bd1a40a6 batch — cream sky, terra terrain, teal accents
// hero-5–7: d72bebe5 batch — moonrise mesa road, geometric cityscape variations
const LOCAL_HERO_IMAGES = [
  '/hero/hero-1.png',
  '/hero/hero-2.png',
  '/hero/hero-3.png',
  '/hero/hero-4.png',
  '/hero/hero-5.png',
  '/hero/hero-6.png',
  '/hero/hero-7.png',
]

// CDN fallback images (Midjourney Southwest illustration style)
const CDN_HERO_IMAGES = [
  `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_0.jpeg`, // golden hour patio
  `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_1.jpeg`,
  `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_2.jpeg`,
  `${MJ}/e181e268-544e-4a60-899e-2a37cebcdb86/0_3.jpeg`,
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_0.jpeg`, // panoramic balloons + skyline
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_1.jpeg`,
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_2.jpeg`,
  `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_3.jpeg`,
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_0.jpeg`, // desert highway into Sandias
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_1.jpeg`,
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_2.jpeg`,
  `${MJ}/52417dbf-7760-49d5-9ed5-9209121b29e5/0_3.jpeg`,
]

// Interleaved: local + CDN alternate so new local images surface every other
// day for the first ~2 weeks of the cycle instead of clustering all 7 together.
// With 7 local + 12 CDN = 19 images; interleaving: L C L C L C L C L C L C L C C C C C C
const HERO_IMAGES: string[] = (() => {
  const out: string[] = []
  const max = Math.max(LOCAL_HERO_IMAGES.length, CDN_HERO_IMAGES.length)
  for (let i = 0; i < max; i++) {
    if (i < LOCAL_HERO_IMAGES.length) out.push(LOCAL_HERO_IMAGES[i])
    if (i < CDN_HERO_IMAGES.length) out.push(CDN_HERO_IMAGES[i])
  }
  return out
})()

// ── OG Share Image ──────────────────────────────────────────────────────────
// Self-hosted on Netlify CDN — never depends on Midjourney hotlink availability.
// hero-4.png is the high-contrast vintage poster landscape (1456×816, ~2.3MB).
export const OG_IMAGE = 'https://abqunplugged.com/hero/hero-4.png'

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the hero image URL for today.
 * Rotates daily — consistent across all users for the same day.
 *
 * Seeded to launch day (2026-04-17 = day 107) so the rotation starts at
 * index 0 = hero-1.png on the day these assets shipped. Before that, we use
 * the raw dayOfYear so prior snapshots show a reasonable image too.
 */
const HERO_LAUNCH_DAY = 107 // 2026-04-17 — day new local hero images landed
export function getHeroImage(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
  const offset = dayOfYear - HERO_LAUNCH_DAY
  const idx = ((offset % HERO_IMAGES.length) + HERO_IMAGES.length) % HERO_IMAGES.length
  return HERO_IMAGES[idx]
}

/**
 * Get a fallback image URL for a given event category.
 * Uses a hash of the event ID (or random) to pick a variation,
 * ensuring visual variety across the grid.
 */
export function getCategoryFallback(
  category: string | undefined,
  eventId?: string
): string {
  const images = category
    ? CATEGORY_IMAGES[category.toLowerCase()] ?? DEFAULT_IMAGES
    : DEFAULT_IMAGES

  if (!images.length) return ''

  // Use event ID to deterministically pick a variation (consistent per event)
  if (eventId) {
    const hash = simpleHash(eventId)
    return images[hash % images.length]
  }

  // Random fallback if no event ID
  return images[Math.floor(Math.random() * images.length)]
}

/**
 * Get all images for a category (for section headers, venue images, etc.)
 */
export function getCategoryImages(category: string): string[] {
  return CATEGORY_IMAGES[category.toLowerCase()] ?? DEFAULT_IMAGES
}

// Simple string hash for deterministic variation selection
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash)
}
