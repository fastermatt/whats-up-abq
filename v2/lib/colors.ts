/**
 * Brand color constants — single source of truth for RAW hex values used in
 * contexts where Tailwind tokens don't apply: server-side image generation
 * (opengraph-image / satori), Konva canvas (IG editor), and inline SVG strokes.
 *
 * For normal UI, use the Tailwind named tokens (bg-terra, text-ink, …) defined
 * in app/globals.css @theme. These constants must stay in sync with that block.
 */
export const COLORS = {
  cream:       '#fbf7f1',
  creamRaised: '#fdf9f4',
  card:        '#fffdf9',

  terra:       '#9a442d',
  terraHover:  '#7d3725',
  terraMid:    '#c4614a',
  terraLight:  '#e8a898',

  sage:        '#4f6249',
  turq:        '#006a62',
  skyGold:     '#c99b3b',

  sandLight:   '#f0e4cc',
  sandMid:     '#ddc9a3',
  sandDark:    '#c4a97d',
  sandBorder:  '#e8ddd0',

  ink:         '#1a1614',
  inkDeep:     '#201c1a',
  inkMid:      '#4a3f3a',
  inkLight:    '#6b5d57',
} as const
