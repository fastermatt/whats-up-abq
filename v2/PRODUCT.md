# ABQ Unplugged — Product Context

> Synthesized from BRAND.md, DESIGN.md, the Obsidian wiki, and the live codebase.
> Update this when strategic direction shifts. Do not update for individual bug fixes.

---

## Product Purpose

ABQ Unplugged is Albuquerque's cultural events aggregator. It pulls from Ticketmaster, SeatGeek, Eventbrite, NHCC, volunteer organizations, and local community sources (~1,200 events at any time) and presents them in one place. The north star: a Burqueño opens the site and finds out what's happening tonight without digging through five different ticketing platforms.

The product competes with nothing because nothing local does this. The comparison set is "Google search + time wasted" not "another events app." That framing drives every copy and UX decision.

---

## Register

**product** — This is an app UI; design serves the product. The homepage gets occasional brand-register treatment (the hero is a statement of identity, not just a navigation aid), but the default register is product.

---

## Users

Three primary audiences, in priority order:

**1. The Spontaneous Local** (highest frequency)
Burqueño, 25–45, on their phone at 5–7 PM. Not planning; reacting. "What's going on tonight / this weekend?" Scans fast, reads the headline, looks at the photo. Decision time: under 15 seconds. Doesn't fill out forms, doesn't want onboarding.

**2. The Informed Regular** (highest engagement)
Already knows the site exists and checks it weekly. Uses mood chips, neighborhood filter, or "this weekend" tab as their entry point. Saves events. Might submit local events. Reads descriptions. Has opinions about ABQ neighborhoods.

**3. The Visitor / Out-of-Towner** (SEO-driven)
Lands via Google ("things to do in Albuquerque this weekend"). No local knowledge; needs venue context, neighborhood name, price info. Reads more, bounces if the page feels thin.

---

## Brand Voice

The voice is **a Burqueño who's been to the show** — confident, slightly playful, never corporate.

- **Preferred:** "Tonight", "Worth knowing", "If you only do one thing this weekend", "Don't miss", "Make ABQ feel smaller"
- **Forbidden:** "Discover", "Unleash", "amazing", "epic", "elevate", "let's [verb]", anything that sounds like a SaaS landing page or VC pitch
- **Local markers:** Use "Burque" not "Albuquerque" in casual copy. "505" as a shorthand. Nob Hill, Old Town, the Bosque — use real neighborhood names. The city runs on sunlight, adobe, and big sky; that's the texture.
- **Tone signals:** declarative > exclamatory, specific > vague, local > generic

---

## Design Direction

**Theme sentence:** A Burqueño opening their phone during the 6 PM commute, sitting in a warm car with late afternoon sun hitting the dashboard, wondering what to do tonight.

This sentence forces **warm and light** for the primary interface — the user is in sunlight, not a dark room. The dark hero is an intentional exception: it's an identity statement ("we are of this city at night") not a functional interface choice. The rest of the product is cream-and-terra in daylight.

**Color strategy:** Restrained with committed moments. The product default is tinted neutrals + terra accent ≤15%. The hero and campaign surfaces can go Committed (terra/gradient carries 30-60%) for brand impact.

**Named anchor references:**
- *The Albuquerque Journal* — editorial authority, local specificity, warm newsprint texture
- *Pitchfork (early)* — confident curatorial voice, not algorithmic
- *Southwest Airlines boarding pass* — information density without chaos; warm and functional

**What makes the palette non-generic:** Cream (`#fbf7f1`) is not white. Terra (`#9a442d`) is not red. The palette reads as sun-baked adobe, not generic "warm." The ABQ map SVG in the hero is a geographical commitment — this site is about one specific place.

---

## Strategic Principles

**1. Specificity over coverage.** One great local event shown clearly beats 50 events shown badly. Dedup aggressively, hide junk, fix data errors at root cause.

**2. Speed of understanding.** A user should know date, venue, price, and category within 2 seconds of landing on an event card. No buried metadata.

**3. Earn the dark hero.** The dark atmospheric hero is an identity statement, not a default. It should feel earned — "this is Burque at night, and it's alive." If we ever do a light version, it should feel like the same city in daytime, not a generic light-mode rebrand.

**4. No SaaS patterns.** No hero-metric grid (big number + small label). No identical card grids. No modal-first interactions. No gradient text. No side-stripe borders. The product looks like a well-made alternative weekly digitized, not a Seed-round startup.

**5. The Terra Economy.** Terra (`#9a442d`) appears on ≤15% of any given screen at rest. It is the brand's voice, not wallpaper. When everything is terra, nothing is.

**6. ISR cache awareness.** URL normalization must be fixed in middleware, not server-side page code. Stale ISR caches survive redeploys. Category/neighborhood/venue slugs all need edge-level redirects.

---

## Anti-References

Things this product should NOT look like:

- **Eventbrite** — dense, corporate, dark navy UI, feels like a ticketing back-office
- **Ticketmaster** — commodity marketplace, no editorial voice, photo-heavy grid with no hierarchy
- **Do505.com** — the local predecessor; thin design, feels dated, no personality
- **Generic SaaS dashboards** — KPI cards, charts everywhere, "metric → trend → CTA" layout
- **Visit Albuquerque** — tourist-board tone, stock photography, "Discover the Magic of New Mexico"

---

## Key Surface Notes

**Homepage / Discover page:** The entry point for most users. Dark atmospheric hero (identity moment), then cream product. Category quick links, Tonight row, Featured, Neighborhoods, Weekend Preview. ISR-cached at 60s.

**Events listing:** The workhorse. FilterBar (3 rows: time / category / subcategory), event card grid. URL is the canonical state; filters write to query params. Edge middleware handles slug normalization.

**Event detail:** Source-truth first — whatever TM/SG/EB/etc. says. Add editorial context (What to Expect, mood, neighborhood). ICS download, Google Cal link, ticket CTA.

**IG Editor (`/admin/ig`):** Internal tool for creating Instagram posts. Konva canvas, 13 templates, 3 format sizes (1:1/4:5/9:16). Admin-only.

**Admin (/admin/*):** Analytics, event review, image approval, submissions. Dark-ish aesthetic is fine here — it's used by one person (Matt) in a focused work context.

---

## Technical Constraints for Designers

- **No dark mode required.** The system is light-mode only. DESIGN.md documents this as a load-bearing choice.
- **Next.js App Router / Tailwind 4** — no CSS variables for Tailwind utilities; use Tailwind color values directly
- **ISR on most pages** (revalidate 60). Dynamic behavior requires client components.
- **Mobile-first.** Bottom nav on mobile; sticky header on desktop. Most traffic is phone.
- **WCAG AA minimum.** `#8a7a74` (ink-muted) fails at small sizes — don't use for body copy.
- **Fonts:** Epilogue (variable, 400–900), Inter (variable), Space Grotesk (variable). All loaded via `next/font/google`.
