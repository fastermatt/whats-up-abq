# Homepage redesign QA

Status: **PASSED**  
Date: 2026-09-01  
Reference: approved responsive mockup at `/Users/matt/.codex/visualizations/2026/09/02/01a06037-525f-7771-a84b-d9192c27c37f/abq-home-responsive/index.html`

## Scope

Compared the approved mockup and production implementation at identical 390×844 and 1440×900 viewports. Also exercised the implementation at 320×700. The comparison artifacts are in `/private/tmp/abq-home-qa/` for this session.

## Verification

- 390×844 mobile: no document overflow; planner updates; quick-view and editorial-picks rails respond to touch swipes; redesigned controls and mobile navigation meet 44×44px minimum targets; no application console or page errors.
- 320×700 narrow mobile: same checks passed without clipped controls, broken wrapping, or horizontal page drift.
- 1440×900 desktop: two-column hero, field-notes sheet, quick links, and editorial rows preserve the approved hierarchy; planner updates; no document overflow or application errors.
- Production build: Next.js compiled, TypeScript passed, and all 155 static pages generated.
- Source checks: touched TypeScript/TSX files are ESLint-clean and `git diff --check` passes.

## Fidelity decisions

- Static sample stops were replaced with current normalized events so the production planner never invents businesses or schedules.
- First-screen event titles are deduplicated while preserving the existing ranking order.
- Organizer photography is used when available; the established real-photo category fallback remains the only fallback.
- Liquid-glass styling is confined to navigation and controls. The cream content canvas and dark field-notes sheet stay opaque and recognizably ABQ Unplugged.
- The production navigation and lower homepage ecosystem remain connected rather than becoming visual-only mockup links.

## Accepted local-preview noise

Netlify Image CDN URLs return 404 under `next start` because `/.netlify/images` exists only in Netlify’s runtime. `EventImage` falls back to the existing source/category photo path; these local CDN misses and blocked external analytics requests were excluded from application-error assertions. No React, route, or interaction errors occurred.
