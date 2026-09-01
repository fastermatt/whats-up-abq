# AGENTS.md — ABQ Unplugged V2 (code repo)

This is the **code repo** for ABQ Unplugged V2. Live: **https://abqunplugged.com** · **Netlify**.
There is also a richer `CLAUDE.md` in this folder — read it for repo-specific detail.

> Read with the global `~/.codex/AGENTS.md` (shared-brain rules).

## Read before working (vault: `/Users/matt/Documents/ClaudeObsidian/`)
- `wiki/ABQ Unplugged V2.md` — current status, deploy info, open bugs, gotchas. **Mandatory, authoritative.**
- `Claude Brain/Infrastructure.md` — Supabase (`bsmvfutebmbkjvlrhiyq`), DeepSeek, Ticketmaster/SeatGeek/Eventbrite, IG/FB credentials, TMDb token.

## Key facts (verify against the wiki — it wins on conflict)
- Data in **Supabase**; use the **PUBLISHABLE** key (legacy JWT disabled).
- Weekly ingestion: `npm run ingest` (7 stages). Enrichment scripts call **DeepSeek** (`v2/scripts/`).
- **Image correctness:** admin reject button + `image_status` column + Supabase Storage; preserve `image_status` across ingests.
- IG editor at `/admin/ig` (canvas) — separate from legacy `/events/[id]/ig`.
- **Security:** never hardcode secrets; **never send IG/FB creds to DeepSeek**; enable RLS on new tables.

## After meaningful work
Update `wiki/ABQ Unplugged V2.md` + append to `Claude Brain/Session Log.md`, signed `(Codex)`.
