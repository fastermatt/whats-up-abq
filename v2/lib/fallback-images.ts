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
// Wide-format images for the homepage hero section
// Rotates based on day-of-year so it changes daily but is consistent for all users

const HERO_IMAGES = [
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

// ── OG Share Image ──────────────────────────────────────────────────────────
export const OG_IMAGE = `${MJ}/fb77c641-ef3a-495b-bc7c-cfb703633cf8/0_2.jpeg`

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the hero image URL for today.
 * Rotates daily based on day-of-year — consistent across all users for same day.
 */
export function getHeroImage(): string {
  const now = new Date()
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  )
  return HERO_IMAGES[dayOfYear % HERO_IMAGES.length]
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
