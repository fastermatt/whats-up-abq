---
name: abqunplugged-edit-code
description: Edit source code in the ABQ Unplugged V2 project (Next.js 16, App Router). Use this skill whenever you need to modify app pages, components, lib/, or API routes in the v2/ directory. Covers how to read files, make precise edits, run the build, and confirm Netlify deployed successfully.
---

# ABQ Unplugged V2 — Code Editing Guide

## Project location

- **V2 app root:** `/Users/matt/Documents/ClaudeObsidian/Projects/ABQ Unplugged v2/repo/v2/`
- **Repo root:** `/Users/matt/Documents/ClaudeObsidian/Projects/ABQ Unplugged v2/repo/`
- **GitHub:** `fastermatt/whats-up-abq` — push to `v2` branch → Netlify auto-deploys
- **DO NOT** edit `src/` (dead V1) or push to `main` branch

## Reading files

Use the `Read` tool with absolute paths. Files are reasonably sized (no 9,800-line monoliths).
For searching: `Grep` tool for symbol/string search, `Glob` for file patterns.

## Making edits

Use the `Edit` tool for precise string replacements. Always:
1. Read the file first (required by Edit tool)
2. Make the smallest change that fixes the issue
3. Run `npm run build` from `v2/` to verify

## Build verification

```bash
cd /Users/matt/Documents/ClaudeObsidian/Projects/ABQ Unplugged v2/repo/v2
npm run build
```

Must produce:
- `✓ Compiled successfully`
- `Running TypeScript ...` with no errors
- All pages generated without errors

## Commit and deploy

```bash
cd /Users/matt/Documents/ClaudeObsidian/Projects/ABQ Unplugged v2/repo
git add v2/path/to/changed/file
git commit -m "fix: description"
git push origin v2
```

Netlify auto-deploys on push to `v2`. Site ID: `a0ff66c2`. ~90s build time.
Check deploy: https://app.netlify.com/projects/a0ff66c2/deploys

## Key files to know

| File | Purpose |
|------|---------|
| `v2/lib/events.ts` | All event fetching, normalizers — the data layer |
| `v2/app/page.tsx` | Homepage |
| `v2/app/events/page.tsx` | Events listing |
| `v2/app/events/[id]/page.tsx` | Event detail |
| `v2/app/events/FilterBar.tsx` | Filter UI (time/category chips) |
| `v2/app/layout.tsx` | Root layout, nav |
| `v2/app/globals.css` | Tailwind + keyframe animations |
| `v2/lib/seo.ts` | buildBreadcrumbs() helper |
| `v2/lib/ics.ts` | ICS calendar builder |

## TypeScript notes

- Supabase client is untyped — use `as any` for schema/query chain, `as Record<string, unknown>` for JSONB
- `event_date` is `string | null`
- `featured` is `boolean | null` — always use `?? false`
- New API routes need `export const dynamic = 'force-dynamic'` if not cacheable
