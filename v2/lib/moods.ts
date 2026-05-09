/**
 * Mood chips — curated browse shortcuts.
 *
 * Single source of truth: rendered as Lucide-icon chips on the homepage
 * (MoodChips component) AND as emoji pills in the FilterBar (events page).
 * The emoji field lets FilterBar render without pulling lucide-react.
 *
 * Category slugs match the values emitted by mapCategory() in lib/events.ts.
 */

export interface Mood {
  slug: string
  label: string
  /** Lucide icon name (PascalCase) — used by MoodChips on the homepage */
  icon: string
  /** Single-glyph emoji — used by FilterBar on the events page */
  emoji: string
  query: {
    category?: string
    free?: string
    time?: string
    price?: string
  }
}

export const MOODS: Mood[] = [
  {
    slug: 'date-night',
    label: 'Date Night',
    icon: 'Heart',
    emoji: '❤️',
    query: { category: 'Arts & Theater', time: 'tonight' },
  },
  {
    slug: 'family-fun',
    label: 'With the Kids',
    icon: 'Baby',
    emoji: '👶',
    query: { category: 'Family' },
  },
  {
    slug: 'live-music',
    label: 'Live Music',
    icon: 'Music',
    emoji: '🎵',
    query: { category: 'Music', time: 'this-weekend' },
  },
  {
    slug: 'free-tonight',
    label: 'Free Tonight',
    icon: 'Sparkles',
    emoji: '✨',
    query: { free: 'true', price: 'free', time: 'tonight' },
  },
  {
    slug: 'chill',
    label: 'Low-key',
    icon: 'Coffee',
    emoji: '☕',
    query: { category: 'Community' },
  },
  {
    slug: 'nightlife',
    label: 'Out Late',
    icon: 'Moon',
    emoji: '🌙',
    query: { category: 'Music', time: 'tonight' },
  },
  {
    slug: 'foodie',
    label: 'Foodie',
    icon: 'UtensilsCrossed',
    emoji: '🍽️',
    query: { category: 'Food & Drink' },
  },
  {
    slug: 'outdoor',
    label: 'Outdoors',
    icon: 'TreePine',
    emoji: '🌲',
    query: { category: 'Outdoor' },
  },
]
