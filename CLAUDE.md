# ABQ Unplugged — Project Context

**Project name:** ABQ Unplugged (repo: `fastermatt/whats-up-abq`, branch: `v2`)
**Live site:** https://abqunplugged.com
**Local dev:** http://localhost:3000 — run `npm run dev` from `v2/`

---

## What this is

A cultural events aggregator for Albuquerque, NM. Shows ~1,000+ upcoming events from
Ticketmaster, SeatGeek, Eventbrite, local community orgs, NHCC, and volunteer sources.

**Stack:** Next.js 16.2.3 (App Router, Turbopack) · TypeScript · Tailwind 4 · Supabase · Netlify
**Design:** cream `#fbf7f1` bg · terra `#9a442d` accent · Epilogue 900 headings · Inter body

---

## Critical paths

| What | Where |
|------|-------|
| App code | `v2/` — all development happens here |
| Event data layer | `v2/lib/events.ts` — normalizers + all fetch functions |
| Pages | `v2/app/` — Next.js App Router |
| Components | `v2/app/components/` |
| Supabase client | `v2/lib/supabase/server.ts` |
| Enrichment scripts | `v2/scripts/` — Node ESM `.mjs` files |
| DB credentials | `v2/scripts/.env` or `v2/.env.local` |
| Dev server config | `.claude/launch.json` (port 3000) |

---

## Database

**Supabase project:** `bsmvfutebmbkjvlrhiyq`
**Table:** `public.events` — all ~1,400 rows (hidden=false → ~974 upcoming)
**Key columns:** `id, source, raw (jsonb), event_date, category, venue_name, neighborhood_slug, cached_photo_url, ai_enrichment (jsonb), featured, hidden`

To query via MCP:
```
tool: mcp__ce64e878-fea0-4d71-ade6-e67670ad5742__execute_sql
project_id: bsmvfutebmbkjvlrhiyq
```

---

## Deploy

- Push to `v2` branch → GitHub Actions → Netlify auto-deploy (~90s)
- Netlify site ID: `a0ff66c2`
- **Never push to `main`** — that's the abandoned V1 React SPA

---

## Key architecture decisions

- Reads from `public.events` (v1 ingestion table) — `v2.events` is empty / unused
- Event normalization happens in `v2/lib/events.ts` → `normalizeRow()` dispatch
- Category stored in denormalized `category` column on the row (set at import time)
- Images: `cached_photo_url` first, then `raw` JSON fallback
- No ORM — raw Supabase JS client with `.schema('public')`
- Redis caching (Upstash) via `v2/lib/cache/redis.ts`
- `revalidate = 60` on most pages (ISR)

---

## Running scripts

```bash
cd v2/scripts
node enrich-moods-lm.mjs --limit=200     # Gemma mood enrichment
node tag-neighborhoods.mjs --dry-run      # neighborhood tagging
node import-nhcc.mjs --dry-run            # NHCC event import
```

Scripts load creds from `v2/scripts/.env` automatically.

---

## DO NOT

- Edit anything in `src/` — that's the dead V1 React SPA
- Push to `main` branch — V1 Netlify site, not the live site
- Run `npm run dev` from repo root — run it from `v2/`
- Add new npm packages without checking `v2/package.json` first
