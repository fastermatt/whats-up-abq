# ABQ Unplugged — Project Context

**Project name:** ABQ Unplugged (repo: `fastermatt/whats-up-abq`, branch: `v2`)
**Live site:** https://abqunplugged.com
**Local dev:** http://localhost:3000 — run `npm run dev` from `v2/`

---

## 🔴 MANDATORY SESSION START — Read this first, every time

Before doing ANY work in this project, read the wiki page:

**`/Users/matt/Documents/ClaudeObsidian/wiki/ABQ Unplugged V2.md`**

It contains: current status, known issues, security status, recent bug fixes, deploy gotchas, and open threads. Skipping it means working blind and repeating solved problems. This is not optional and is not subject to the "lazy load" rule in the root CLAUDE.md — this project moves fast and the wiki is always more current than your training or conversation context.

After reading it, also check:
- **`/Users/matt/.claude/projects/.../memory/security_rules.md`** — never hardcode secrets, always enable RLS on new tables
- **GitHub Actions status** — CI has had recurring failures; verify it's green before assuming deploys work

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
- **`v2` is the default GitHub branch** (changed 2026-04-19). `main` branch still exists but is the abandoned V1 React SPA — never push there.
- CI uses `npm install --legacy-peer-deps`. **Always commit `package.json` AND `package-lock.json` when installing new npm packages.** If you `npm install foo` locally and don't commit the lockfile, CI will fail with "Module not found" because it checks out the old lockfile.

### ⚠️ CI GOTCHA — html-to-image incident
Every time you install a new npm package locally (`npm install X`), you MUST commit both:
1. `v2/package.json` — the new dependency entry
2. `v2/package-lock.json` — the resolved version

If only the source files are committed (without the lockfile update), CI runs `npm install` against the OLD lockfile and can't find the package. The build fails with `Module not found`. **Diagnose CI failures by checking the "Build Next.js app" step log — missing packages show up there immediately.**

---

## Key architecture decisions

- Reads from `public.events` (legacy ingestion table) — `v2.events` is empty / unused
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

## Image System

- `EventImage` component auto-routes abqtodo.com / nhccnm.org / do505.com / lovenm.org URLs through `/api/image-proxy` (server-side fetch bypasses CAPTCHA)
- Permanent CDN copies: 168 local/volunteer event images cached at `cdn.abqunplugged.com/{id}.{ext}` (2026-04-19). Run `cache-images.yml` workflow from GitHub Actions to refresh.
- Fallback chain: `cached_photo_url` → image-proxy → `PIXABAY_IMAGES` real photos (run `scripts/fetch-pixabay-fallbacks.mjs` with `PIXABAY_API_KEY`) → Midjourney category illustrations
- **workflow_dispatch triggers require the workflow file to be on the default branch.** Since `v2` IS now the default branch, all `workflow_dispatch` workflows in `.github/workflows/` work from the GitHub UI.

---

## DO NOT

- Edit anything in `src/` — that's the dead V1 React SPA (but V1 is fully retired — don't worry about it)
- Push to `main` branch — nobody uses it, V2 is the default
- Run `npm run dev` from repo root — run it from `v2/`
- Install npm packages without committing BOTH `package.json` AND `package-lock.json` — CI will break
