---
name: abqunplugged-data
description: Work with the ABQ Unplugged V2 Supabase database — query events, run enrichment scripts, check neighborhood/mood coverage, update event metadata. Use this skill whenever you need to read or write data, run database queries, run import/enrichment scripts, or understand the JSONB schema.
---

# ABQ Unplugged V2 — Database Reference

## Connection

**Supabase project:** `bsmvfutebmbkjvlrhiyq` (us-west-2)
**API URL:** `https://bsmvfutebmbkjvlrhiyq.supabase.co`
**Creds:** `v2/scripts/.env` — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

Run SQL via Supabase MCP:
```
tool: mcp__ce64e878-fea0-4d71-ade6-e67670ad5742__execute_sql
project_id: bsmvfutebmbkjvlrhiyq
```

## Primary table: `public.events`

**~1,400 rows total, ~974 upcoming (hidden=false, event_date >= today)**

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `tm-123`, `sg-456`, `nhcc-789`, `local-abc` |
| `source` | TEXT | `ticketmaster`, `seatgeek`, `eventbrite`, `local`, `volunteer`, `nhcc` |
| `raw` | JSONB | Full source API response — shape varies by source |
| `event_date` | TEXT | `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS±HH:MM` |
| `category` | TEXT | `Music`, `Sports`, `Arts & Theater`, `Comedy`, `Family`, `Food & Drink`, `Community`, `Film`, `Festivals`, `Outdoor` |
| `venue_name` | TEXT | Denormalized venue name |
| `neighborhood_slug` | TEXT | e.g. `downtown`, `nob-hill`, `university`, `barelas` |
| `cached_photo_url` | TEXT | CDN image URL |
| `ai_enrichment` | JSONB | `{ about, highlights, venue_tips, mood, indoor_outdoor, age_appeal }` |
| `featured` | BOOLEAN | Admin-curated pick |
| `hidden` | BOOLEAN | Soft-delete |

## Key queries

```sql
-- Event counts by source (upcoming)
SELECT source, count(*), min(event_date), max(event_date)
FROM public.events WHERE hidden=false AND event_date >= CURRENT_DATE
GROUP BY source ORDER BY count DESC;

-- Category distribution
SELECT category, count(*) FROM public.events
WHERE hidden=false AND event_date >= CURRENT_DATE
GROUP BY category ORDER BY count DESC;

-- Neighborhood coverage
SELECT neighborhood_slug, count(*) FROM public.events
WHERE hidden=false AND event_date >= CURRENT_DATE
GROUP BY neighborhood_slug ORDER BY count DESC;

-- Mood enrichment coverage
SELECT
  count(*) FILTER (WHERE ai_enrichment->>'mood' IS NOT NULL) as with_mood,
  count(*) as total
FROM public.events WHERE hidden=false AND event_date >= CURRENT_DATE;

-- Find an event
SELECT id, category, venue_name, event_date, raw->>'name' as title
FROM public.events WHERE raw->>'name' ILIKE '%balloon%'
ORDER BY event_date;

-- Events missing neighborhood
SELECT id, venue_name, event_date FROM public.events
WHERE hidden=false AND (neighborhood_slug IS NULL OR neighborhood_slug='')
AND event_date >= CURRENT_DATE LIMIT 20;
```

## Enrichment scripts

All scripts in `v2/scripts/`, Node ESM, load creds from `v2/scripts/.env`.

```bash
# Mood + indoor/outdoor + age_appeal via Gemma (LM Studio must be running on :1234)
node v2/scripts/enrich-moods-lm.mjs --limit=200

# Keyword-based neighborhood tagging from venue names
node v2/scripts/tag-neighborhoods.mjs --dry-run

# Import NHCC community events from WordPress REST API
node v2/scripts/import-nhcc.mjs --dry-run --limit=60
```

LM Studio: `http://localhost:1234/v1/chat/completions` · Model: `google/gemma-4-e4b`

## Other tables

| Table | Purpose |
|-------|---------|
| `public.profiles` | User accounts — `check_ins TEXT[]`, `saved_events TEXT[]` |
| `public.leaderboard` | Denormalized check-in counts — `display_name`, `count` |
| `public.reviews` | `user_id`, `place_id`, `rating`, `text`, `flagged` |
| `public.analytics` | `event_type`, `session_id`, `data JSONB`, `device`, `created_at` |
