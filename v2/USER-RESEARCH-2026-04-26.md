# User Research — 6-persona walkthrough (2026-04-26)

Six AI persona agents tested abqunplugged.com end-to-end. Each lived in a different ABQ neighborhood with a different intent and verified accuracy by fetching source URLs.

## Personas

| Persona | Neighborhood | Intent |
|---|---|---|
| **Maria, 34** | Nob Hill | Anniversary date night, $40-100, live music or theater |
| **Jake, 22** | UNM area | Saturday night, free / under $15, social |
| **Sarah, 41** | Northeast Heights | Family weekend with 6 & 9-year-olds |
| **Carlos, 58** | North Valley | Comedy / brewery / jazz, $50-150 |
| **Aisha, 28** | Downtown / EDo | New to ABQ, looking for distinctly local |
| **Tom, 67** | Westside (Taylor Ranch) | Daytime / weekday afternoon events |

## What worked across the board

- Site loads fast, looks clean — "doesn't feel scraped" (Carlos)
- Tone has personality — "Rio Grande has been running through this valley for twelve thousand years…" (Aisha)
- Mood chips and Date Night / Family / Free top-row are exactly the lens users think in
- Neighborhood pages exist for every persona's home (Westside got Tom, North Valley got Carlos)
- Calendar export (Apple/Google) is "the killer feature" (Maria)
- Real source URLs that actually resolve (abqtodo.com confirmed in 4/6 verifications)
- IG editor at `/ig-editor.html` works (Jake)

## Accuracy validations (6 spot-checks)

| Persona | Event | Source verdict |
|---|---|---|
| Sarah | Kids Market (abqtodo) | ✅ matches; missing end time |
| Aisha | Round Dance Sunday (abqtodo) | ✅ matches; missing end time |
| Tom | Taylor Ranch Genealogy (abqtodo) | ✅ matches; missing end time + address |
| Jake | Pre-ZILLA Art Show (abqtodo) | ✅ perfect match |
| Maria | Mrs. Doubtfire (TM/SeatGeek) | ⚠️ blocked by paywall, internal dup TM 1pm vs SG 6:30pm |
| Carlos | Tim Meadows (SeatGeek) | ⚠️ flagged as "wrong date" — actually multi-night run, not a bug |

**Pattern:** abqtodo and NHCC accuracy is very high. SeatGeek/TM duplicate showtimes can confuse — the source has them too.

## Critical bugs found

| Bug | Personas | Status |
|---|---|---|
| Hyena's venue page 404'd (slug had triple-hyphen `---` from " - ") | Carlos | ✅ fixed: `venueToSlug` now collapses non-alphanum → single hyphen; `fetchVenueBySlug` resolves via top-venues lookup |
| `/surprise-me` page 404 | Aisha | ✅ fixed: route added, redirects to `/api/surprise` |
| `/neighborhood/<slug>` (singular) 404 | Tom | ✅ fixed: redirect to `/neighborhoods/<slug>` |
| `/free` 404 (probably stale cache during test) | Tom | ℹ️ already shipped earlier today; live now |
| "Multiple Locations" shown as a neighborhood label | Sarah | ✅ fixed: 41 events nullified |
| `Uptown` and `Uptown / Midtown` duplicates | Sarah | ✅ fixed: consolidated |
| `Downtown / EDo` and `East Downtown (EDo)` duplicates | Sarah | ✅ fixed: both → Downtown |
| Generated column required `neighborhood` text update, not the slug | (internal) | ✅ understood; UPDATE source field instead |
| Price not visible on event detail page when source didn't expose it | Maria, Carlos, Jake | ✅ fixed: now shows "Price on ticket page →" fallback + sage chip when free |
| Date missing from `/family-friendly`, `/free`, `/date-night` cards | Sarah | ✅ fixed: cards now show `Sat Apr 26 · 7:30 PM` |

## Open issues (not yet fixed)

| Issue | Personas | Priority |
|---|---|---|
| `/events/<slug>` URLs don't resolve (only `/events/<id>` works) | Aisha | Medium — bigger refactor |
| Search doesn't fuzzy-match ("green chile" returns 0) | Aisha | Medium |
| `/date-night` mentions Nob Hill in copy but has no neighborhood filter | Maria | Medium |
| Generic neighborhood page boilerplate (Old Town doesn't mention 1706, etc.) | Aisha | Medium — needs per-neighborhood blurb writing |
| `/welcome` is pitched at existing residents not newcomers | Aisha | Low — copy edit |
| No "Newcomer's First Month" curated path on homepage | Aisha | Low — content piece |
| No parking info on event/venue pages | Carlos, Tom | High for older audiences |
| No accessibility / hours info on venue pages | Tom | Medium |
| `text-xs` (12px) hard to read for older users | Tom | Low — bump to text-sm in places |
| No "weekday afternoon" / "daytime" time filter | Tom | Medium |
| No "walking distance from UNM" / campus filter | Jake | Low |
| Featured events skew older (casino shows, ballet) | Jake | Strategic — content curation |
| Inventory thin in some neighborhoods (Nob Hill date-night) | Maria | Strategic — broader sourcing |
| No "doors at X / show at Y" distinction | Carlos | Low |

## Headline takeaways

1. **The bones are good.** Every persona said "Maybe leaning Yes" — none said No.
2. **Bugs were real but small.** All 8 critical bugs above were fixed in the same session.
3. **The big strategic gap:** the site speaks to a 30-50-year-old date-nighter / parent. Jake (22, broke) and Tom (67, retired) both felt the inventory wasn't curated *for* them. That's a content/curation problem, not a technical one.
4. **Copy is strongest on the homepage and weakest everywhere else.** The Rio Grande line and About page have voice. Event pages, neighborhood pages, and search results read like a clean aggregator. Pushing the voice into more pages would be the cheapest win for "feels local" perception.
5. **Real-world data accuracy is high** for local sources (abqtodo, NHCC). API-sourced events (TM, SeatGeek) have edge cases around duplicate showtimes and missing prices — and the latter just got fixed.
