---
name: abqunplugged-debug
description: Debug and fix issues in ABQ Unplugged V2 (Next.js 16, abqunplugged.com). Use this skill when something isn't working — events not loading, filter returning wrong results, build errors, Supabase errors, animation issues, or any runtime bug. Covers tracing data through Supabase → lib/events.ts → normalizeRow() → UI.
---

# ABQ Unplugged V2 — Debug Guide

**Stack:** Next.js 16.2.3 (App Router, Turbopack) · TypeScript · Tailwind 4 · Supabase (`bsmvfutebmbkjvlrhiyq`) · Netlify
**Live URL:** https://abqunplugged.com
**Repo:** `fastermatt/whats-up-abq`, branch `v2`
**V2 app:** `v2/` within the repo

## Data pipeline

```
public.events (Supabase, ~974 upcoming rows)
  → v2/lib/events.ts: fetchEvents() / fetchEventById() / fetchTonightRanked() / etc.
  → normalizeRow() dispatches by source:
      ticketmaster → normalizeTM()
      eventbrite   → normalizeEB()
      seatgeek     → normalizeSG()
      local / volunteer / nhcc → normalizeLocal()
      default → normalizeGeneric()
  → NormalizedEvent typed object
  → Next.js Server Component renders EventCard
```

## Common bugs and fixes

### Events not showing / wrong count
- Check `hidden=false` filter in fetchEvents()
- Check `event_date >= today` — stale events are hidden
- Category filter uses raw string: `"Music"`, `"Arts & Theater"`, etc.

### Wrong category on event
- Category comes from denormalized `category` DB column (set at import time)
- Classifier in `lib/classify.ts` → `mapCategory()` keyword lists
- AI enrichment can override via `ai_enrichment.category` only when DB column is null

### Image not loading
- Fallback chain: `cached_photo_url` → source-specific raw JSON field → null
- TM: `images[].url` · EB: `logo.url` · local/nhcc: `image` field

### Time showing wrong / empty
- `formatTime()` returns `''` for date-only `YYYY-MM-DD` — intentional
- Always use `formatTime(row.event_date) || null` (empty string → null)

### HTML entities in venue/title (e.g. `&#8217;`)
- `decodeHtml()` in `lib/events.ts` handles this
- Applied to: title (all normalizers), venue + address (normalizeLocal), venue_name fallback in normalizeRow

### Build failing
```bash
cd v2 && npm run build
# TypeScript errors print before page generation
# Common: missing 'use client' on a hook-using component
# Common: untyped Supabase result — cast with `as any` or `as Record<string, unknown>`
```

### Supabase query returns nothing
- All queries need `.schema('public')` — no default schema set
- Confirm `.eq('hidden', false)` and `.gte('event_date', today)` are present

### FilterBar scroll-hint not animating
- `.scroll-hint-inner` must be on the inner flex div of ScrollRow (not the wrapper)
- Keyframe: `scroll-hint 1.6s ease-in-out 0.4s 1 both` — verify in `globals.css`

## Dev server

```bash
cd v2 && npm run dev   # port 3000
# Needs v2/.env.local with:
#   NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
# Keys are in v2/scripts/.env
```

## Diagnostic queries

```sql
-- Event counts by source
SELECT source, count(*), min(event_date), max(event_date)
FROM public.events WHERE hidden=false AND event_date >= CURRENT_DATE
GROUP BY source ORDER BY count DESC;

-- Missing neighborhood tags
SELECT count(*) FROM public.events
WHERE hidden=false AND (neighborhood_slug IS NULL OR neighborhood_slug='');

-- Mood enrichment coverage
SELECT count(*) FILTER (WHERE ai_enrichment->>'mood' IS NOT NULL) as with_mood,
       count(*) as total
FROM public.events WHERE hidden=false AND event_date >= CURRENT_DATE;
```

## Netlify

- Deploy logs: https://app.netlify.com/projects/a0ff66c2/deploys
- Site ID: `a0ff66c2` — auto-deploys on push to `v2` branch (~90s)
