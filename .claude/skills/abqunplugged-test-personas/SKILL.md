---
name: abqunplugged-test-personas
description: Spawn 6 concurrent persona sub-agents to QA test abqunplugged.com from real-user perspectives. Each persona has specific goals, browsing behaviors, and critical checks. Use this skill to surface UX regressions, data quality issues, broken links, and missing information before shipping or after a major data update.
---

# ABQ Unplugged — Test Personas Skill

Spawns 6 real-user personas concurrently against https://abqunplugged.com. Each agent has a specific mission, tests 3+ events, validates URLs/data, and returns structured findings. Results are consolidated into a PASS/FAIL report grouped by issue type.

## When to use

- After any deploy that touches `lib/events.ts`, `middleware.ts`, or any normalizer
- After a bulk data import or pipeline run
- When the regression test suite passes but you want human-perspective validation
- Any time Matt says "run the personas" or "run QA"

## How to invoke

```
/abqunplugged-test-personas
```

Optional args:
- `--focus=venue` — all agents prioritize venue link + address accuracy
- `--focus=category` — all agents test category filtering
- `--focus=search` — all agents test search and keyword matching
- `--quick` — Linda + Marcus only (2 agents, faster)

---

## The 6 Personas

### 🧳 Linda — Out-of-Town Tourist
**Goal:** Find something to do in ABQ tonight or this weekend. She knows nothing about ABQ.  
**Enters via:** Homepage → clicks Tonight or This Weekend section  
**Tests:**
1. Pick an event from the homepage hero or "Tonight in ABQ" section
2. Click through to the event detail page — verify: title, date/time, venue name, address show up
3. Click the venue name link — verify it resolves (no 404)
4. Click "Get Tickets" or the source link — note if it's a valid URL (don't follow off-site)
5. Try `/free` page — verify events load and have prices showing $0 or Free
6. **Critical checks:** Does the page show a neighborhood? Does the map link look real? Is there a photo?

**Failure flags:**
- Missing address (just shows neighborhood text like "Downtown Albuquerque")
- 404 on venue link
- No event photo
- "Time TBA" on an event that clearly has a time in its title

---

### 🎸 Marcus — Local Musician / Scene Regular
**Goal:** Find upcoming shows at specific venues. He knows the venues by local names.  
**Enters via:** Direct URL: `/venues/sunshine-theater` then `/venues/el-rey`  
**Tests:**
1. `/venues/sunshine-theater` — does it load? Does it show upcoming shows?
2. `/venues/el-rey` — does this redirect properly? (should canonicalize to the full slug)
3. Try `/venues/revel-abq` — does it redirect?
4. On a Music category event, click the venue — verify the venue page loads and has ≥1 event
5. Try `?category=music` filter — verify ≥20 Music events load
6. Try `?category=nightlife` — verify it either redirects or shows sensible results (not 0)

**Failure flags:**
- `/venues/el-rey` returns 404 (alias redirect broken)
- `/venues/revel-abq` returns 404 (alias redirect broken)
- Music filter returns < 5 events
- `?category=nightlife` returns 0 results (should redirect to Community or show filtered)

---

### 👵 Betty — 68-Year-Old Native ABQer
**Goal:** Find family-friendly or arts events for her grandkids. She's skeptical of tech.  
**Enters via:** Homepage → clicks "Family" category chip or navigates to `/family-friendly`  
**Tests:**
1. `/family-friendly` — verify the page loads with ≥5 events
2. Pick 2 events from Family category — check: are they actually family appropriate? (no bars, no 21+, no wine events)
3. Click `/neighborhoods/nob-hill` — verify it loads with events
4. Click `/neighborhoods/university` — verify it loads (alias for unm-campus)
5. Try searching "kids" in the search box — verify results appear, no volunteer shifts dominate

**Failure flags:**
- Family category shows events with "21+", "Bar", "Cocktail", "Wine" in the title
- `/neighborhoods/university` 404
- Search for "kids" shows RRFB volunteer shifts
- `/family-friendly` shows < 3 events

---

### 🎓 Dr. Rivera — UNM Professor, Culture Seeker
**Goal:** Find arts, film, or academic events near campus.  
**Enters via:** `/categories/arts-theater` and `/neighborhoods/unm-campus`  
**Tests:**
1. `/categories/arts-theater` — does it load with ≥10 events?
2. Try URL `?category=arts-culture` — does it redirect to canonical Arts & Theater?
3. Try URL `?category=Arts` — does it redirect correctly (not 0 results)?
4. Pick an NHCC or Popejoy event — verify: venue address shows "Lomas Blvd" or "Cornell", category = Arts & Theater or Film
5. `/neighborhoods/unm-campus` — verify it loads and shows campus-area events
6. Try `/categories/film` — verify Film events load

**Failure flags:**
- `?category=arts-culture` shows 0 results instead of redirecting
- `?category=Arts` shows 0 results (ISR cache regression)
- `/categories/arts-theater` shows < 5 events
- NHCC events show wrong venue name or missing address

---

### 🍕 Ryan — Foodie / Nightlife Seeker (25-35)
**Goal:** Find food festivals, tastings, or evening social events this month.  
**Enters via:** `?category=food-drink` filter or `/categories/food-drink`  
**Tests:**
1. Try `?category=food-drink` — does it redirect and show Food & Drink events? (not 0 results)
2. `/categories/food-drink` — does it load properly?
3. Search "taco" or "food" — do results make sense? No volunteer shifts?
4. Try `/events?time=evening` — do evening events load?
5. Pick a food/drink event — verify: venue, address, price all show up

**Failure flags:**
- `?category=food-drink` shows 0 results (redirect broken)
- Search "food" returns RRFB volunteer shifts in top results
- Food & Drink category has < 3 events total
- `/events?time=evening` loads but shows 0 results

---

### ⚾ Dave — Sports Fan (Isotopes / Soccer / UFC)
**Goal:** Find Isotopes games and sports events this season.  
**Enters via:** `?category=sports` filter  
**Tests:**
1. `?category=sports` — do Sports events load? (should be ≥15 events in season)
2. Search "Isotopes" — do game results appear?
3. Pick an Isotopes game — verify: venue shows "Rio Grande Credit Union Field at Isotopes Park", date is correct, no duplicate (same game appearing twice from TM + SG)
4. Search "soccer" or "united" — does NM United show up?
5. Check: do any sports events show the wrong venue (e.g., Kiva Auditorium for a game)?

**Failure flags:**
- Sports filter shows < 5 events
- Duplicate Isotopes games (same date, same opponent, both visible)
- Isotopes venue name missing or wrong
- NM United not findable via search

---

## Running the skill

When this skill is invoked, the orchestrator should:

1. **Read this file** to understand persona definitions
2. **Spawn all 6 agents concurrently** using the Agent tool with `subagent_type: general-purpose`
3. Each agent prompt should include:
   - The persona section from this file (copy verbatim)
   - Instruction to use `WebFetch` to hit the live site URLs
   - Instruction to return a structured JSON result
4. **Collect all 6 results** and compile into a unified report

### Agent prompt template

```
You are testing abqunplugged.com as [PERSONA NAME]. 

[PASTE PERSONA SECTION HERE]

Instructions:
- Use WebFetch to hit each URL listed in your Tests section
- For each URL, note: HTTP status, page title (from <title> tag or <h1>), and whether the content matches expectations
- For event detail pages, also check: is there a venue name? Is there an address (not just a neighborhood)? Is there a photo?
- Do NOT click off-site ticket links
- For each test, return PASS, FAIL, or WARN with a one-line reason
- If you find a FAIL, include the exact URL that failed

Return a JSON object:
{
  "persona": "[name]",
  "passed": number,
  "warned": number,
  "failed": number,
  "results": [
    { "test": "description", "status": "PASS|FAIL|WARN", "detail": "one line" }
  ],
  "top_issue": "most critical finding in one sentence, or null if all passed"
}
```

### Consolidation format

After all 6 agents return, consolidate:

```
## ABQ Unplugged Persona QA — [date]

OVERALL: X/6 personas fully passing

### 🔴 FAILS
[list each FAIL with persona + URL + detail]

### 🟡 WARNS  
[list each WARN with persona + URL + detail]

### ✅ PASSES
[list persona names that had 0 fails]

### Issue categories
[Group failures by type: venue links, category filters, data quality, search, redirects]

### Recommended actions
[1-3 most impactful fixes, in priority order]
```

---

## Known false-positive patterns

Don't flag these as FAIL — they're known limitations:

| Pattern | Reason |
|---------|---------|
| Eventbrite events without street address | EB API hides addresses until purchase |
| TM events with ticket.cabq.gov URLs | KiMo/Popejoy use city ticketing — correct |
| Time showing "TBA" for some TM events | TM doesn't always expose time in API |
| RRFB events not appearing in search | Intentional — volunteer shifts filtered |
| `/events?time=evening` feels thin | Time-of-day filter not fully built — known |
| Venue names truncated on mobile | CSS line-clamp — intentional UX decision |

---

## Writing new personas

To add a persona, add a new `###` section following the template above:
- A clear goal and entry point
- 5-6 numbered tests with specific URLs to hit
- A "Failure flags" section with specific, actionable failure conditions
- Keep tests to things that can be verified via HTTP fetch (status codes, page content) — not visual design judgments
