# ABQ Unplugged V2 — Next.js Dev Guide

Working inside the `v2/` Next.js app. See `../CLAUDE.md` for project overview.

## Build & dev

```bash
npm run dev    # Turbopack dev server on :3000
npm run build  # Production build — must pass before committing
npm run lint   # ESLint
```

Build must show **0 TypeScript errors** and **0 ESLint errors** before any commit.

## File layout

```
app/
  layout.tsx          — root layout, bottom nav, skip-link
  page.tsx            — homepage (hero, mood chips, sections)
  events/
    page.tsx          — events listing + FilterBar
    FilterBar.tsx     — 3-row filter (time / category / subcategory)
    [id]/page.tsx     — event detail (ICS, Google Cal, ticket CTAs)
  tonight/page.tsx    — editorial Tonight feed
  weekend/page.tsx    — editorial Weekend feed
  categories/[slug]/  — category SEO pages
  neighborhoods/[slug]/ — neighborhood SEO pages
  venues/[slug]/      — venue pages
  api/
    surprise/route.ts — random event redirect
    events/[id]/ics/  — ICS calendar download
  components/
    EventCard.tsx, AnimateIn.tsx, MoodChips.tsx, SurpriseButton.tsx, ...
lib/
  events.ts     — ALL event fetching + normalizeRow() dispatch
  ics.ts        — RFC 5545 ICS builder
  moods.ts      — 8 mood presets
  seo.ts        — buildBreadcrumbs() helper
  classify.ts   — category classifier
  supabase/server.ts  — createClient() / createServiceClient()
  cache/redis.ts      — cachedFetch()
  utils/dates.ts      — getTimeRange(), formatEventTime()
scripts/
  .env                — SUPABASE creds (gitignored)
  enrich-moods-lm.mjs — Gemma mood enrichment via LM Studio
  tag-neighborhoods.mjs — venue→neighborhood keyword mapper
  import-nhcc.mjs     — NHCC WordPress API importer
```

## Event normalizer

`lib/events.ts` → `normalizeRow()` dispatches by `source`:
- `ticketmaster` → `normalizeTM()`
- `eventbrite` → `normalizeEB()`
- `seatgeek` → `normalizeSG()`
- `local` / `volunteer` / `nhcc` → `normalizeLocal()`
- anything else → `normalizeGeneric()`

All text fields (title, venue, address) go through `decodeHtml()` to strip HTML entities.

## Design tokens (Tailwind)

```
bg:       #fbf7f1  (cream)
accent:   #9a442d  (terra)
secondary:#4f6249  (sage)
tertiary: #006a62  (turquoise)
```

Use `bg-[#fbf7f1]`, `text-[#9a442d]` etc — no CSS variables in use.

## Animations

- `AnimateIn` component: IntersectionObserver, variants fade-up/fade-in/slide-left/scale
- `scroll-hint-inner` class on FilterBar inner flex div: one-time 1.6s peek animation
- `prefers-reduced-motion` respected everywhere
- Stagger: `delay={Math.min(i * 30, 300)}`

## Common gotchas

- Supabase queries need `.schema('public')` prefix — no default schema set
- `event_date` is a Postgres **`date`** type → Supabase always returns it as a `YYYY-MM-DD` string (never a timestamp). So `new Date(event.date + 'T12:00:00')` is always valid. Time-of-day lives in the separate `time` field. (Older docs called this a "string with optional timestamp" — that's stale; verified `date` type 2026-06-06.)
- `raw` column is untyped JSONB — always cast with `as Record<string, unknown>`
- `featured` is `boolean | null` — always use `?? false`
- New API routes need `export const dynamic = 'force-dynamic'` if they can't be cached
