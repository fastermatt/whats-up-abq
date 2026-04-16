# ABQ Unplugged V2 — Code Edit Skill

This skill guides editing, building, committing, and deploying changes to ABQ Unplugged V2.

## Project overview

- **Stack**: Next.js 16.2.3 (App Router, Turbopack) · TypeScript · Tailwind 4 · Supabase · Netlify
- **V2 app root**: `v2/` within the repo
- **Live site**: https://abqunplugged.com
- **GitHub**: `fastermatt/whats-up-abq`, branch `v2`
- **Deploy**: push to `v2` branch → Netlify auto-deploys (~90s). Site ID: `a0ff66c2`

## Editing files

Use the Claude `Read` + `Edit` tools directly. Read before editing; make precise replacements.

```bash
cd v2 && npm run build   # must show 0 TypeScript errors before committing
```

## Commit and push

```bash
cd "/Users/matt/Documents/ClaudeObsidian/Projects/ABQ Unplugged v2/repo"
git add v2/path/to/file
git commit -m "feat/fix/chore: description"
git push origin v2
```

## Key files

| File | Purpose |
|------|---------|
| `v2/lib/events.ts` | All event fetching + normalizeRow() dispatch |
| `v2/app/page.tsx` | Homepage (hero, mood chips, editorial sections) |
| `v2/app/events/page.tsx` | Events listing with FilterBar |
| `v2/app/events/[id]/page.tsx` | Event detail (ICS, calendar, ticket CTAs) |
| `v2/app/events/FilterBar.tsx` | Filter UI — time / category / subcategory rows |
| `v2/app/tonight/page.tsx` | Editorial Tonight feed |
| `v2/app/weekend/page.tsx` | Editorial Weekend feed |
| `v2/app/layout.tsx` | Root layout, skip-link, bottom nav, desktop sidebar |
| `v2/app/globals.css` | Tailwind config + all keyframe animations |
| `v2/lib/seo.ts` | buildBreadcrumbs() JSON-LD helper |
| `v2/lib/ics.ts` | RFC 5545 ICS calendar builder |
| `v2/lib/moods.ts` | 8 mood presets for homepage chips |
| `v2/lib/classify.ts` | mapCategory() keyword classifier |

## Design tokens

```
Background:  #fbf7f1  (cream)
Accent:      #9a442d  (terra)
Secondary:   #4f6249  (sage)
Tertiary:    #006a62  (turquoise)
```

Use Tailwind arbitrary values: `bg-[#fbf7f1]`, `text-[#9a442d]`.

## TypeScript gotchas

- Supabase queries need `.schema('public')` and `as any` on the chain
- JSONB columns → cast as `Record<string, unknown>` before accessing properties
- `featured` is `boolean | null` — always use `?? false`
- New API routes need `export const dynamic = 'force-dynamic'` if not ISR-cacheable
- `formatTime()` returns `''` (not null) for date-only strings — use `|| null`

## Animations

- `AnimateIn` component: IntersectionObserver, variants `fade-up` / `fade-in` / `slide-left` / `scale`
- `scroll-hint-inner` class: one-time 1.6s peek on FilterBar inner flex divs
- All animations respect `prefers-reduced-motion`
- Stagger pattern: `delay={Math.min(i * 30, 300)}`
