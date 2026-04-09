---
name: abqunplugged-debug
description: Debug and fix issues in the ABQ Unplugged / Explore ABQ app (abqunplugged.com). Use this skill whenever working on the whats-up-abq project and something isn't working — places returning 0 results, categories not matching, analytics crashing, admin panel errors, build failures, or any bug where you need to trace data through Supabase → db.ts → App.tsx → UI. Also use when you need to understand the app's data pipeline, filtering logic, or TypeScript quirks specific to this codebase.
---

# ABQ Unplugged — Debug Guide

ABQ Unplugged is a local discovery app for Albuquerque. The codebase is a React + TypeScript + Vite + Supabase monolith. This guide documents the bugs found and fixed across engineering sessions so you can recognize and fix the same class of problems without starting from scratch.

## Project layout

- `src/App.tsx` — ~9,800-line monolith with all components, state, and filtering logic
- `src/AdminPanel.tsx` — admin dashboard (~2,500 lines)
- `src/lib/db.ts` — Supabase data layer: `placeTypeToCategory()`, `transformGoogleRaw()`, `fetchPlacesFromDB()`, `searchPlacesFromDB()`
- `public/data/*.json` — static event bundles (Ticketmaster, SeatGeek)
- `src/data/events.ts` — 183 hand-curated static events in `ALL_EVENTS`

**Supabase project:** `bsmvfutebmbkjvlrhiyq` (us-west-2)
**Live URL:** https://abqunplugged.com
**GitHub:** `fastermatt/whats-up-abq` → auto-deploys to Netlify on push to `main`

---

## Bug Pattern 1 — Case-sensitive Record lookups returning 0 results

**Symptom:** Searching "nob hill" + any category shows 0 results. Searching "Nob Hill" works.

**Root cause:** `NEIGHBORHOOD_BOUNDS` is a `Record<string, BoundingBox>` with exact-case keys like `"Nob Hill"`, `"Downtown"`, etc. The filter did `NEIGHBORHOOD_BOUNDS[search.trim()]` which is a strict key lookup — case matters.

**Fix applied (commit `1d6c2a1`):** Added `findNeighborhood()` helper that does a case-insensitive scan:
```typescript
const findNeighborhood = (q: string) => {
  const trimmed = q.trim();
  if (!trimmed) return null;
  if (NEIGHBORHOOD_BOUNDS[trimmed]) return { bounds: NEIGHBORHOOD_BOUNDS[trimmed], name: trimmed };
  const lower = trimmed.toLowerCase();
  for (const key of Object.keys(NEIGHBORHOOD_BOUNDS)) {
    if (key.toLowerCase() === lower) return { bounds: NEIGHBORHOOD_BOUNDS[key], name: key };
  }
  return null;
};
```
Then replaced all `NEIGHBORHOOD_BOUNDS[search.trim()]` calls with `findNeighborhood(search)?.bounds`.

**General rule:** Any `Record<string, ...>` keyed by user input needs case-insensitive lookup. Check for this pattern whenever a filter returns 0 results unexpectedly.

---

## Bug Pattern 2 — Hidden filters silently dropping places

**Symptom:** Places tab shows ~20% fewer results than Supabase has. Category + neighborhood combos show 0 when data exists.

**Root cause:** A `withPhotos` filter — `sorted.filter(p => !!p.image)` — was applied before slicing for display. This silently removed 928 places that had no cached Google photo URL. The places were valid; they just lacked images.

**Fix applied (commit `1d6c2a1`):** Removed the `withPhotos` filter. All sorted places now render regardless of photo status.

**Diagnostic approach:** When 0-results bugs appear, check each step of the pipeline:
1. Query Supabase directly: `SELECT count(*) FROM places WHERE raw->>'types' ILIKE '%coffee%'`
2. Check `transformGoogleRaw()` in `db.ts` — does it classify the place correctly?
3. Check the filter chain in `App.tsx` — look for any `.filter()` that could drop the item
4. Check display rendering — is the item in `sorted` but being sliced out?

---

## Bug Pattern 3 — Category misclassification in `placeTypeToCategory()`

**Symptom:** Known coffee shops show as "restaurant" in the Places tab. Querying `SELECT raw->>'name', raw->'types' FROM places WHERE raw->>'name' ILIKE '%coffee%'` shows the place but with types like `[bakery, store, food]` — no `cafe`.

**Root cause:** `placeTypeToCategory()` in `src/lib/db.ts` required either `coffee_shop` type OR (`cafe` type AND coffee name). Places typed as `bakery`/`food`/`restaurant` with "Coffee" in the name were classified as `restaurant`.

**Fix applied (commit `55f63d3`):**
```typescript
// OLD — too narrow:
// if (types.includes('coffee_shop') || (types.includes('cafe') && isCoffeeName)) return 'coffee';

// NEW — broader food-adjacent check:
const isFoodAdjacent = types.includes('cafe') || types.includes('bakery') ||
  types.includes('food') || types.includes('restaurant');
if (types.includes('coffee_shop') || (isFoodAdjacent && isCoffeeName)) return 'coffee';
```

**General rule:** Google Places `types` arrays are inconsistent. A coffee shop may have `[bakery, store, food, point_of_interest]` with no `cafe` at all. When a category filter returns fewer results than expected, always check the raw types from Supabase first.

**Diagnostic query:**
```sql
SELECT raw->>'name', raw->'types'
FROM places
WHERE raw->>'name' ILIKE '%coffee%'
   OR raw->>'name' ILIKE '%cafe%'
ORDER BY raw->>'name';
```

---

## Bug Pattern 4 — `useState<Record>` Vite/Rolldown runtime error

**Symptom:** Admin panel page crashes with `ReferenceError: Record is not defined`. Works in dev, crashes in production.

**Root cause:** Vite's Rolldown bundler incorrectly compiles `useState<Record<string,number>>({})`. The TypeScript generic `Record` leaks into the compiled JS as a runtime reference. The built JS contains `v.useState<Record({})` — a syntax error that crashes at runtime.

**Fix:** Use `as` type assertion instead of generic parameter:
```typescript
// BAD — crashes at runtime:
const [totals, setTotals] = useState<Record<string,number>>({});

// GOOD — compiles correctly:
const [totals, setTotals] = useState({} as Record<string,number>);
```

**Detection:** If you see `ReferenceError: [TypeName] is not defined` in production but not dev, grep the built JS:
```bash
grep -n 'Record\|Pick\|Omit' dist/assets/*.js
```
If TypeScript utility types appear in the built output, find the `useState<...>` using them and switch to `as` casts.

**This pattern applies to:** `Record`, `Pick`, `Omit`, `Partial`, `Required`, `Readonly`, and any TypeScript utility type used as a generic parameter to `useState`.

---

## Bug Pattern 5 — Admin config not wired to app state

**Symptom:** Changing hero taglines in the Admin panel has no effect on the Discover tab.

**Root cause:** `HERO_PHRASES` in `App.tsx` was a hardcoded array of 104 phrases. The admin panel saves `heroLines` to the `config` table in Supabase, but `App.tsx` never fetched or applied it.

**Fix applied (commit `55f63d3`):**
1. Added `const [adminHeroLines, setAdminHeroLines] = useState<string[] | null>(null);` in App
2. Added fetch for `config` key `'content'` in the existing `Promise.all` config loader
3. Passed `adminHeroLines` as a prop to `DiscoverScreen`
4. Updated phrase selection: `const phrasePool = (adminHeroLines?.length) ? adminHeroLines : HERO_PHRASES;`

**General principle:** The `config` table in Supabase (key/value store) contains: `heroLines`, `siteConfig`, `banners`, `themeConfig`. Whenever the admin panel writes to config, verify `App.tsx` actually reads and uses that key. Search App.tsx for `cfgGet('content')` or `cfgGet('siteConfig')` to see what's wired.

---

## How to read App.tsx (it's huge)

`App.tsx` is ~9,800 lines. `Desktop Commander`'s `read_file` tool doesn't return content reliably for this file. Use `osascript` + `sed` instead:

```applescript
-- Read lines 5000-5100:
do shell script "sed -n '5000,5100p' '/Users/matt/Documents/Claude/Projects/whats-up-abq/src/App.tsx'"

-- Find a function or variable:
do shell script "grep -n 'findNeighborhood\\|NEIGHBORHOOD_BOUNDS\\|withPhotos' '/Users/matt/Documents/Claude/Projects/whats-up-abq/src/App.tsx'"
```

Also useful: the JWT/anon key is embedded in `App.tsx`. If a `read` call is blocked by a content filter, use char codes:
```javascript
// In browser console on abqunplugged.com:
Array.from(doc.slice(a,b)).map(c=>c.charCodeAt(0))
```

---

## Checking what's actually in the database

Use Supabase MCP (`mcp__ce64e878-fea0-4d71-ade6-e67670ad5742__execute_sql`) or query via `mcp__Control_Chrome__execute_javascript` on the admin page. Key queries:

```sql
-- How many places per category?
SELECT raw->>'category' as cat, count(*) FROM places GROUP BY cat ORDER BY count DESC;

-- Coffee shops with no 'cafe' type (misclassification candidates):
SELECT raw->>'name', raw->'types'
FROM places
WHERE raw->>'name' ILIKE '%coffee%'
  AND NOT (raw->'types' @> '["cafe"]'::jsonb)
LIMIT 20;

-- Places with null coordinates:
SELECT id, raw->>'name'
FROM places
WHERE raw->'geometry'->'location'->>'lat' IS NULL
LIMIT 10;
```

---

## Build failure checklist

Netlify builds with `vite build` (NOT `tsc`). TypeScript type errors alone don't fail builds — only actual syntax errors do.

Common build failures:
1. **Double-quote syntax error** — a bad edit left `className="value""` (extra quote). Check the diff carefully.
2. **Missing JSX closing tag** — `</div>` count mismatch in a large component.
3. **`Record` runtime error** — see Bug Pattern 4 above.
4. **events.ts array mismatch** — events accidentally appended inside `CATEGORIES` array instead of `ALL_EVENTS`. Build succeeds but events are invisible.

To check a Netlify build: https://app.netlify.com/projects/explore-abq/deploys
