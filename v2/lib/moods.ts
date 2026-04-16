/**
 * Mood chips — curated browse shortcuts for the homepage.
 * Category slugs match the values emitted by mapCategory() in lib/events.ts.
 */

export interface Mood {
  slug: string
  label: string
  /** Lucide icon name (PascalCase) */
  icon: string
  query: {
    category?: string
    free?: string
    time?: string
  }
}

export const MOODS: Mood[] = [
  {
    slug: 'date-night',
    label: 'Date Night',
    icon: 'Heart',
    query: { category: 'Arts & Theater', time: 'tonight' },
  },
  {
    slug: 'family-fun',
    label: 'With the Kids',
    icon: 'Baby',
    query: { category: 'Family' },
  },
  {
    slug: 'live-music',
    label: 'Live Music',
    icon: 'Music',
    query: { category: 'Music', time: 'this-weekend' },
  },
  {
    slug: 'free-tonight',
    label: 'Free Tonight',
    icon: 'Sparkles',
    query: { free: 'true', time: 'tonight' },
  },
  {
    slug: 'chill',
    label: 'Low-key',
    icon: 'Coffee',
    query: { category: 'Community' },
  },
  {
    slug: 'nightlife',
    label: 'Out Late',
    icon: 'Moon',
    query: { category: 'Music', time: 'tonight' },
  },
  {
    slug: 'foodie',
    label: 'Foodie',
    icon: 'UtensilsCrossed',
    query: { category: 'Food & Drink' },
  },
  {
    slug: 'outdoor',
    label: 'Outdoors',
    icon: 'TreePine',
    query: { category: 'Outdoor' },
  },
]
