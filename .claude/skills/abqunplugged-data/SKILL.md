---
name: abqunplugged-data
description: Work with the ABQ Unplugged Supabase database — query places, events, analytics, config, and reviews. Use this skill whenever you need to read or write data for the whats-up-abq app, run database queries, check what's in the database, update config values, investigate analytics, or understand the JSONB data schema. Also use when diagnosing data quality issues, category mismatches, or missing places/events.
---

# ABQ Unplugged — Database Reference

## Connection

**Supabase project:** `bsmvfutebmbkjvlrhiyq` (region: us-west-2)
**API URL:** `https://bsmvfutebmbkjvlrhiyq.supabase.co`

To run SQL queries, use the Supabase MCP:
```
tool: mcp__ce64e878-fea0-4d71-ade6-e67670ad5742__execute_sql
project_id: bsmvfutebmbkjvlrhiyq
```

Or access via the admin panel at `https://abqunplugged.com` (logged in as Matt) using the Supabase client already initialized there.

---

## Table: `places` (~4,625 rows)

**All place data lives in the `raw` JSONB column.** The table schema is minimal:

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Google Place ID (e.g. `ChIJ...`) |
| `source` | TEXT | `'google'` for all current data |
| `raw` | JSONB | Full Google Places API response |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### Accessing place fields from `raw`:

```sql
-- Name and address:
SELECT raw->>'name', raw->>'formatted_address', raw->>'vicinity'
FROM places LIMIT 10;

-- Coordinates:
SELECT raw->'geometry'->'location'->>'lat' as lat,
       raw->'geometry'->'location'->>'lng' as lng,
       raw->>'name'
FROM places WHERE raw->>'name' ILIKE '%coffee%';

-- Google types array:
SELECT raw->>'name', raw->'types'
FROM places WHERE raw->'types' @> '["coffee_shop"]'::jsonb;

-- Photo reference (may be null for ~20% of places):
SELECT raw->>'name', raw->'photos'->0->>'photo_reference' as photo
FROM places LIMIT 5;

-- Category (computed by transformGoogleRaw, stored as raw->>'category' after transform):
-- Note: category is NOT stored in DB — it's computed at runtime by placeTypeToCategory()
```

### Category classification

Categories are NOT stored in Supabase — they're computed at runtime by `placeTypeToCategory()` in `src/lib/db.ts`. The function maps Google `types` arrays to app categories:

| App category | Google types that map to it |
|---|---|
| `coffee` | `coffee_shop`, OR (cafe/bakery/food/restaurant + "coffee" in name) |
| `restaurant` | `restaurant`, `food`, `meal_takeaway`, `meal_delivery` |
| `bar` | `bar`, `night_club` |
| `shopping` | `store`, `shopping_mall`, `clothing_store`, etc. |
| `entertainment` | `movie_theater`, `bowling_alley`, `amusement_park`, etc. |
| `fitness` | `gym`, `health`, `spa` |
| `arts` | `art_gallery`, `museum` |
| `hotel` | `lodging` |
| `outdoors` | `park`, `campground`, `natural_feature` |

If a place appears in the wrong category, check its `raw->'types'` and compare against the logic in `db.ts`.

### Useful diagnostic queries

```sql
-- Data quality: places missing coordinates
SELECT id, raw->>'name'
FROM places
WHERE raw->'geometry'->'location'->>'lat' IS NULL;

-- Potential coffee shop misclassifications
SELECT raw->>'name', raw->'types'
FROM places
WHERE (raw->>'name' ILIKE '%coffee%' OR raw->>'name' ILIKE '%cafe%')
  AND NOT (raw->'types' @> '["coffee_shop"]'::jsonb)
  AND NOT (raw->'types' @> '["cafe"]'::jsonb)
LIMIT 20;

-- Places with no photos
SELECT count(*) FROM places
WHERE raw->'photos' IS NULL OR jsonb_array_length(raw->'photos') = 0;

-- Count by neighborhood (approximate — uses coordinates)
-- Neighborhoods are computed client-side via NEIGHBORHOOD_BOUNDS bounding boxes
```

---

## Table: `events` (~622 rows)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `tm_123`, `sg_456` |
| `source` | TEXT | `'ticketmaster'`, `'seatgeek'`, etc. |
| `raw` | JSONB | Full API response |
| `event_date` | DATE | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

```sql
-- Upcoming events by source:
SELECT source, count(*), min(event_date), max(event_date)
FROM events
WHERE event_date >= CURRENT_DATE
GROUP BY source ORDER BY count DESC;

-- Find a specific event:
SELECT raw->>'name', event_date, source
FROM events
WHERE raw->>'name' ILIKE '%balloon%'
ORDER BY event_date;
```

**Note:** Events are also served from static JSON files (`/public/data/ticketmaster.json`, `/public/data/seatgeek.json`) and `src/data/events.ts`. The DB events currently have a CORS issue in production and the app falls back to JSON files. Don't rely on the DB as the only source of truth for what the app displays.

---

## Table: `config` (key/value store)

Used to configure the app from the admin panel. All values are JSONB.

| `key` | `value` shape | Purpose |
|-------|--------------|---------|
| `content` | `{ heroLines: string[], sections: {...} }` | Hero taglines + section visibility |
| `siteConfig` | `{ appName, tagline, ... }` | App name, description |
| `banners` | `{ text, color, active }[]` | Promo banners |
| `themeConfig` | `{ primaryColor, accentColor, ... }` | Theme colors |
| `refreshLog` | `{ lastRun, logs: [...] }` | Data refresh history |

```sql
-- Read all config:
SELECT key, value FROM config;

-- Read hero lines:
SELECT value->'heroLines' FROM config WHERE key = 'content';

-- Update a config value (be careful — this replaces the whole value):
UPDATE config
SET value = jsonb_set(value, '{heroLines}', '["New phrase 1", "New phrase 2"]'::jsonb)
WHERE key = 'content';
```

---

## Table: `analytics` (~1,602 rows)

Tracks user behavior events logged from the app.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `event_type` | TEXT | See event types below |
| `session_id` | TEXT | Groups events by session |
| `data` | JSONB | Event-specific payload |
| `device` | TEXT | `'ios'`, `'android'`, `'desktop'` |
| `created_at` | TIMESTAMPTZ | |

**Event types logged:**
- `pageview` — tab navigation (`data.tab`)
- `place_click` — `data.place_id`, `data.name`
- `event_click` — `data.event_id`, `data.name`
- `search` — `data.query`
- `directions_click` — `data.name`, `data.place_id`
- `share` — `data.type`
- `checkin` — `data.place_id`
- `client_error` — `data.message`, `data.source`, `data.line`, `data.stack`, `data.url`
- `a2hs_shown` / `a2hs_accepted` — Add to Home Screen prompt

```sql
-- Most clicked places (last 30 days):
SELECT data->>'name' as place, count(*) as clicks
FROM analytics
WHERE event_type = 'place_click'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY data->>'name'
ORDER BY clicks DESC LIMIT 10;

-- Recent errors:
SELECT data->>'message', data->>'source', data->>'line', created_at
FROM analytics
WHERE event_type = 'client_error'
ORDER BY created_at DESC LIMIT 20;

-- Unique sessions per day:
SELECT date_trunc('day', created_at) as day, count(DISTINCT session_id) as sessions
FROM analytics
GROUP BY day ORDER BY day DESC;
```

---

## Other tables

### `profiles`
User accounts. `check_ins TEXT[]` stores an array of place IDs the user has checked into. No join table — just an array on the profile.

### `leaderboard`
Denormalized check-in counts. `display_name TEXT`, `count INT`. Updated when a user checks in.

### `reviews`
`id UUID`, `user_id UUID`, `place_id TEXT`, `rating INT`, `text TEXT`, `flagged BOOLEAN`.

### `event_overrides`
Manual data overrides for specific events. `id TEXT`, `data JSONB`.

### AIQ tables (`aiq_rooms`, `aiq_players`, `aiq_answers`)
Trivia/quiz game. `aiq_rooms` (~3 rows), `aiq_players` (~10), `aiq_answers` (~98). Not used in the main discovery flow.

---

## API keys (for scripts and automation)

**Google Places API:** `AIzaSyC9zctmz7VcrkKOp_tFDkwfkJAS-ieJDKA`
**Ticketmaster API:** `cToI1E1qPmI71EkUHivQYvPzoLxlxqOa`
**SeatGeek Client ID:** `NDIzOTU3NHwxNzc0NTc2ODkwLjM5Mzc5NzI`
**SeatGeek Secret:** `47a44977946a37444a65e86a876fb62db9370c25f2296e75850bd34b1868b385`

**Refresh script:**
```bash
cd /Users/matt/Documents/Claude/Projects/whats-up-abq
TICKETMASTER_API_KEY=cToI1E1qPmI71EkUHivQYvPzoLxlxqOa \
SEATGEEK_CLIENT_ID=NDIzOTU3NHwxNzc0NTc2ODkwLjM5Mzc5NzI \
node scripts/fetch-data.cjs
```
Add `SKIP_PLACES=true` to skip the Google Places refresh and only update events.
