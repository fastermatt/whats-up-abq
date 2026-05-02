/**
 * Admin — Tools & Pipeline Reference
 *
 * Everything you need to run the site: GitHub Actions workflows,
 * terminal scripts, and admin pages — organized by when and why to use them.
 */
import Link from 'next/link'
import {
  RefreshCw, Image, Database, ExternalLink, Terminal, LayoutDashboard,
  FileText, BarChart2, AlertCircle, Clock, CheckCircle2, ChevronRight,
  Camera,
} from 'lucide-react'
import { CopyButton } from './CopyButton'

export const dynamic = 'force-dynamic'

const REPO = 'fastermatt/whats-up-abq'
const ACTIONS_BASE = `https://github.com/${REPO}/actions/workflows`

// ─── Shared sub-components (server) ──────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-8 h-8 rounded-xl bg-[#9a442d]/15 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-white" style={{ fontFamily: 'var(--font-epilogue)' }}>{title}</h2>
        <p className="text-xs text-white/40 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function CommandBlock({ cmd, flags }: { cmd: string; flags?: { flag: string; desc: string }[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-2">
        <span className="text-white/20 text-xs font-mono shrink-0">$</span>
        <code className="text-[#e8c99a] text-xs font-mono flex-1 min-w-0 break-all">{cmd}</code>
        <CopyButton text={cmd} />
      </div>
      {flags && flags.length > 0 && (
        <div className="pl-3 space-y-1">
          {flags.map(({ flag, desc }) => (
            <div key={flag} className="flex items-start gap-2">
              <div className="flex items-center gap-1.5 bg-[#0d0d0d] rounded px-2 py-1 min-w-0">
                <code className="text-white/50 text-[11px] font-mono">{flag}</code>
                <CopyButton text={`${cmd} ${flag}`} />
              </div>
              <span className="text-white/35 text-[11px] leading-relaxed pt-1">{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WorkflowCard({
  file, name, badge, badgeColor = 'gray', description, when, note, disabled,
}: {
  file: string
  name: string
  badge?: string
  badgeColor?: 'green' | 'yellow' | 'gray' | 'red' | 'blue'
  description: string
  when: string
  note?: string
  disabled?: boolean
}) {
  const badgeColors: Record<string, string> = {
    green:  'bg-green-900/40 text-green-400 border-green-800/40',
    yellow: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40',
    gray:   'bg-white/[0.07] text-white/40 border-white/10',
    red:    'bg-red-900/30 text-red-400 border-red-800/40',
    blue:   'bg-blue-900/30 text-blue-400 border-blue-800/40',
  }

  return (
    <div className={`bg-[#201c1a] border rounded-2xl p-5 ${disabled ? 'border-white/[0.04] opacity-50' : 'border-white/[0.07]'}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-white">{name}</p>
            {badge && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColors[badgeColor]}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 font-mono mt-0.5">{file}</p>
        </div>
        {!disabled && (
          <a
            href={`${ACTIONS_BASE}/${file}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
              bg-[#9a442d]/15 text-[#c4705a] border border-[#9a442d]/30
              hover:bg-[#9a442d]/25 hover:text-white transition-all"
          >
            <ExternalLink size={11} />
            Open in GitHub
          </a>
        )}
      </div>

      <p className="text-sm text-white/65 leading-relaxed mb-2">{description}</p>

      <div className="flex items-start gap-2 mt-3">
        <Clock size={12} className="text-white/30 mt-0.5 shrink-0" />
        <p className="text-xs text-white/40">{when}</p>
      </div>

      {note && (
        <div className="flex items-start gap-2 mt-2 bg-yellow-950/30 border border-yellow-900/30 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="text-yellow-500/70 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-400/70">{note}</p>
        </div>
      )}
    </div>
  )
}

function ScriptRow({ name, desc, cmd, flags }: {
  name: string
  desc: string
  cmd: string
  flags?: { flag: string; desc: string }[]
}) {
  return (
    <div className="border-b border-white/[0.05] pb-5 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm font-semibold text-white/90">{name}</p>
        <code className="text-[10px] text-white/25 font-mono shrink-0 mt-0.5">{cmd.split(' ')[2]}</code>
      </div>
      <p className="text-xs text-white/45 leading-relaxed mb-1">{desc}</p>
      <CommandBlock cmd={cmd} flags={flags} />
    </div>
  )
}

function AdminPageLink({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-[#201c1a] border border-white/[0.07] rounded-xl px-4 py-3
        hover:border-white/[0.15] hover:bg-white/[0.04] transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-[#9a442d]/12 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white group-hover:text-white">{label}</p>
        <p className="text-xs text-white/35 truncate">{sub}</p>
      </div>
      <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
    </Link>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  return (
    <div className="space-y-12 pb-16">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Tools & Pipeline
        </h1>
        <p className="text-white/40 text-sm">
          Everything you need to keep ABQ Unplugged running. Start with the weekly ritual, then dig into scripts as needed.
        </p>
      </div>

      {/* ── The Weekly Ritual ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={<RefreshCw size={16} className="text-[#9a442d]" />}
          title="The Weekly Ritual"
          sub="Do these three things every week to keep the site healthy"
        />

        <div className="space-y-3">
          {[
            {
              num: '1',
              label: 'Run the event pipeline',
              detail: 'Go to GitHub Actions → V2 Weekly Event Refresh → Run workflow. This imports fresh events from all 5 sources, runs dedup, and validates the data. Takes ~4 minutes.',
              href: `${ACTIONS_BASE}/v2-weekly-refresh.yml`,
              hrefLabel: 'Open GitHub Actions',
              color: 'terra' as const,
            },
            {
              num: '2',
              label: 'Check the dashboard',
              detail: 'After the pipeline finishes, check the Admin Dashboard. Look at the Live Events count (should stay near 1,300+), Hidden count, and any new Pending Reports.',
              href: '/admin',
              hrefLabel: 'Go to Dashboard',
              color: 'sage' as const,
            },
            {
              num: '3',
              label: 'Post to Instagram',
              detail: 'Go to Instagram Posts → find an event spotlight → download the card → use one of the 4 template captions or click "Generate with AI" for a custom caption.',
              href: '/admin/ig-captions',
              hrefLabel: 'Open Instagram Posts',
              color: 'teal' as const,
            },
          ].map(({ num, label, detail, href, hrefLabel }) => (
            <div
              key={num}
              className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 flex gap-5 items-start"
            >
              <div className="w-8 h-8 rounded-full bg-[#9a442d]/20 flex items-center justify-center shrink-0 text-sm font-black text-[#c4705a]">
                {num}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white mb-1">{label}</p>
                <p className="text-sm text-white/50 leading-relaxed mb-3">{detail}</p>
                <a
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#c4705a] hover:text-white transition-colors"
                >
                  {hrefLabel}
                  {href.startsWith('http') ? <ExternalLink size={11} /> : <ChevronRight size={11} />}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GitHub Actions ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={<RefreshCw size={16} className="text-[#9a442d]" />}
          title="GitHub Actions"
          sub='Run these from the GitHub Actions tab → select the workflow → "Run workflow" button'
        />

        <div className="mb-4 flex items-center gap-2 bg-[#111]/60 border border-white/[0.06] rounded-xl px-4 py-3">
          <Terminal size={13} className="text-white/30 shrink-0" />
          <p className="text-xs text-white/40">
            All workflows run on GitHub&apos;s servers — no local setup needed. Click &quot;Open in GitHub&quot; then hit the blue &quot;Run workflow&quot; button on the right side of the page.
          </p>
        </div>

        <div className="grid gap-4">
          <WorkflowCard
            file="v2-weekly-refresh.yml"
            name="V2 Weekly Event Refresh"
            badge="Run this weekly"
            badgeColor="green"
            description="The main pipeline. Imports events from Ticketmaster, SeatGeek, Eventbrite, NHCC, and abqtodo.com. Then runs deduplication, neighborhood tagging, and smoke tests. If it exits 0, the site is healthy."
            when="Every Tuesday morning, or whenever events seem stale. The automatic schedule is currently paused — trigger manually."
            note="Automatic cron is paused (disabled 2026-04-20). You must trigger this manually each week."
          />
          <WorkflowCard
            file="regression-tests.yml"
            name="Regression Tests"
            badge="Auto-runs on push"
            badgeColor="blue"
            description="30 data-shape invariants: no Online venues, no Rio Rancho events, no cross-source duplicates, no boilerplate descriptions, family category clean, etc. Each test catches a specific bug class that has bitten us before."
            when="Runs automatically on every push to v2/lib/ or v2/scripts/. Also runs daily at 6 AM MT. Trigger manually after a big DB change."
          />
          <WorkflowCard
            file="cache-images.yml"
            name="Cache Event Images to R2"
            description="Downloads event images from third-party sites (abqtodo.com, nhccnm.org) and uploads them to Cloudflare R2 CDN. Fixes placeholder image problems for ~121 community events. GitHub's IPs bypass CAPTCHA blocks that browser fetches hit."
            when="Run after a big import (especially abqtodo events) to ensure all images load. Also run if you notice many events with missing images."
          />
          <WorkflowCard
            file="daily-digest.yml"
            name="Daily Digest Email"
            badge="Auto-runs daily 7:30 AM MT"
            badgeColor="gray"
            description="Sends newsletter digest emails to subscribers whose digest_day matches today. Has a 6-day throttle so it never double-sends. Run manually to send a test or to catch up after an outage."
            when="Automatic daily at 7:30 AM MT. Trigger manually only if you want to force a send or test a specific user."
          />
          <WorkflowCard
            file="nightly-matcher.yml"
            name="Nightly Notification Matcher"
            badge="Auto-runs daily 5 AM MT"
            badgeColor="gray"
            description="Matches events to user preferences for the 'For You' page and push notifications. New users see matches within ~24h of saving their preferences."
            when="Automatic daily. Trigger manually after a large batch import to refresh match scores."
          />
          <WorkflowCard
            file="refresh-events.yml"
            name="Legacy V1 Refresh"
            badge="Do not use"
            badgeColor="red"
            description="Legacy V1 importer. Runs old .cjs scripts that could clobber V2 data. Kept only for the Google Places photo refresh capability."
            when="Do not run this unless you specifically need to refresh Google Places photos."
            disabled
          />
        </div>
      </section>

      {/* ── Terminal Scripts ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={<Terminal size={16} className="text-[#9a442d]" />}
          title="Terminal Scripts"
          sub="Run from inside the v2/ directory. Requires v2/scripts/.env with Supabase credentials."
        />

        <div className="mb-4 bg-[#111]/60 border border-white/[0.06] rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-white/50">Before running any script:</p>
          <div className="flex items-center gap-2 bg-[#0d0d0d] rounded-lg px-3 py-2">
            <span className="text-white/20 text-xs font-mono shrink-0">$</span>
            <code className="text-[#e8c99a] text-xs font-mono flex-1">cd /path/to/repo/v2</code>
            <CopyButton text="cd /path/to/repo/v2" />
          </div>
          <p className="text-[11px] text-white/30">
            Credentials are read from <code className="text-white/50">v2/scripts/.env</code> — must have SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
            DeepSeek scripts also need DEEPSEEK_API_KEY in that file.
          </p>
        </div>

        {/* Main Pipeline */}
        <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <p className="text-xs font-bold text-[#9a442d] uppercase tracking-widest mb-4">Main Pipeline</p>
          <div className="space-y-5">
            <ScriptRow
              name="Full Ingest (all sources)"
              desc="Imports TM, SG, EB, NHCC, abqtodo.com. Runs dedup, neighborhood tagging, smoke tests, and invariant checks. The definitive pipeline — this is what the GitHub Action runs."
              cmd="node scripts/ingest.mjs"
              flags={[
                { flag: '--dry-run', desc: 'Show what would happen, no writes' },
                { flag: '--only=nhcc', desc: 'One source only: tm | sg | eb | nhcc' },
                { flag: '--skip-imports', desc: 'Skip imports, only run enrichment + validation' },
                { flag: '--smoke-only', desc: 'Just run smoke tests' },
                { flag: '--quiet', desc: 'Print only summary + failures' },
              ]}
            />
            <ScriptRow
              name="Daily Hygiene (QA suite)"
              desc="Runs the 30-test regression suite + LLM audits (category mismatch, cancellation, wrong locations). Auto-discovers LM Studio / Ollama. If no LLM, just runs regression tests."
              cmd="node scripts/daily-hygiene.mjs"
              flags={[
                { flag: '--apply', desc: 'Auto-hide block-severity events (not just report)' },
                { flag: '--limit=80', desc: 'Larger LLM sample' },
              ]}
            />
            <ScriptRow
              name="Regression Tests only"
              desc="The 30 data-shape invariant tests. Fast (<30s). Run after any code change to lib/ or scripts/. No LLM required."
              cmd="node scripts/regression-tests.mjs"
              flags={[
                { flag: '--site=https://abqunplugged.com', desc: 'Also run live URL smoke tests' },
                { flag: '--tag=data-hygiene', desc: 'Run only tests with this tag' },
              ]}
            />
          </div>
        </div>

        {/* Per-Source Import */}
        <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Import — Individual Sources</p>
          <div className="space-y-5">
            <ScriptRow
              name="Ticketmaster"
              desc="Imports ~285 TM events. Filters out parking upsells, shell events, season passes."
              cmd="node scripts/import-ticketmaster.mjs"
              flags={[{ flag: '--dry-run', desc: 'Preview without writing' }]}
            />
            <ScriptRow
              name="SeatGeek"
              desc="Imports ~350 SG events. SeatGeek has slug-based URLs (don't expire) so it's the preferred source over TM for cross-source dupes."
              cmd="node scripts/import-seatgeek.mjs"
              flags={[{ flag: '--dry-run', desc: 'Preview without writing' }]}
            />
            <ScriptRow
              name="Eventbrite"
              desc="Imports ~108 EB events. Filters Rio Rancho zip codes, online-only events, non-ABQ events."
              cmd="node scripts/import-eventbrite.mjs"
              flags={[{ flag: '--dry-run', desc: 'Preview without writing' }]}
            />
            <ScriptRow
              name="NHCC"
              desc="Imports National Hispanic Cultural Center events from their WordPress API."
              cmd="node scripts/import-nhcc.mjs"
              flags={[
                { flag: '--dry-run', desc: 'Preview without writing' },
                { flag: '--limit=20', desc: 'Import only N events' },
              ]}
            />
            <ScriptRow
              name="ABQ Todo / Local Events"
              desc="Scrapes abqtodo.com using DeepSeek to extract events from raw HTML. Covers community events that the API sources miss. This is the richest source for local/volunteer events."
              cmd="node scripts/scrape-abqtodo.mjs"
              flags={[
                { flag: '--dry-run', desc: 'Preview without writing' },
                { flag: '--limit=50', desc: 'Process only N event pages' },
              ]}
            />
            <ScriptRow
              name="Local Venue Websites"
              desc="Scrapes individual venue websites (Launchpad, El Rey, KiMo, etc.) for events not listed on the major platforms."
              cmd="node scripts/scrape-local-venues.mjs"
              flags={[{ flag: '--dry-run', desc: 'Preview without writing' }]}
            />
          </div>
        </div>

        {/* AI Enrichment */}
        <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest">AI Enrichment</p>
            <span className="text-[10px] text-white/25 border border-white/10 rounded px-1.5 py-0.5">
              Requires DEEPSEEK_API_KEY in v2/scripts/.env
            </span>
          </div>
          <div className="space-y-5">
            <ScriptRow
              name="Mood Enrichment (DeepSeek)"
              desc="Adds mood tags (chill, adventurous, social, etc.) to events using DeepSeek. Run after a big import to keep mood coverage at 100%. Currently 100% covered."
              cmd="node scripts/enrich-deepseek.mjs"
              flags={[
                { flag: '--limit=200', desc: 'Process only N events (default: all unenriched)' },
                { flag: '--dry-run', desc: 'Preview without writing' },
              ]}
            />
            <ScriptRow
              name="About Text Enrichment (DeepSeek)"
              desc="Writes the 'About this event' paragraph shown on event detail pages. Uses DeepSeek to generate readable summaries from raw source descriptions. ~377 events intentionally null (sports games with no description)."
              cmd="node scripts/enrich-about-deepseek.mjs"
              flags={[
                { flag: '--limit=100', desc: 'Process only N events' },
                { flag: '--dry-run', desc: 'Preview without writing' },
              ]}
            />
            <ScriptRow
              name="Neighborhood Tagging"
              desc="Maps venue names to Albuquerque neighborhood slugs (nob-hill, downtown, etc.) using a keyword dictionary. ~94% coverage. Run after importing new events."
              cmd="node scripts/tag-neighborhoods.mjs"
              flags={[
                { flag: '--dry-run', desc: 'Show matches without writing' },
                { flag: '--limit=100', desc: 'Process N events' },
              ]}
            />
          </div>
        </div>

        {/* Data Quality */}
        <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Data Quality & Auditing</p>
          <div className="space-y-5">
            <ScriptRow
              name="Accuracy Audit"
              desc="Scans 500 events for category mismatches, bad titles (HTML entities, truncations, typos), wrong venues, and duplicates. Auto-applies obvious category fixes; flags others for manual review."
              cmd="node scripts/audit-accuracy.mjs"
              flags={[
                { flag: '--limit=200', desc: 'Scan fewer events (faster)' },
                { flag: '--apply', desc: 'Auto-apply obvious fixes' },
              ]}
            />
            <ScriptRow
              name="Dedup Events"
              desc="Hides cross-source duplicates (same event on Ticketmaster + SeatGeek). SeatGeek is kept (slug URLs don't expire). Sports events use a strict 1-per-venue-per-date rule."
              cmd="node scripts/dedup-events.mjs"
              flags={[{ flag: '--dry-run', desc: 'Show what would be hidden' }]}
            />
            <ScriptRow
              name="Validate Events"
              desc="Checks all events for data completeness: missing dates, missing venues, bad categories, missing images."
              cmd="node scripts/validate-events.mjs"
            />
            <ScriptRow
              name="Check Broken Links"
              desc="HEADs all ticket URLs and source links. Hides events where the URL returns 404. Stamps hide_reason=broken_url_404 in ai_enrichment."
              cmd="node scripts/check-broken-links.mjs"
              flags={[
                { flag: '--dry-run', desc: 'Report broken links without hiding' },
                { flag: '--limit=100', desc: 'Check only N events' },
              ]}
            />
            <ScriptRow
              name="Location/Time Audit (LLM)"
              desc="Uses Gemma (LM Studio) to find venue/time contradictions: events where the description says a different location or date than what's stored. Requires LM Studio running locally."
              cmd="node scripts/audit-location-time.mjs"
              flags={[
                { flag: '--limit=50', desc: 'Audit N events' },
                { flag: '--apply', desc: 'Auto-hide flagged events' },
              ]}
            />
            <ScriptRow
              name="Cleanup Events"
              desc="Hides past events, cancelled events, and other stale data. Non-destructive — hidden events can always be unhidden."
              cmd="node scripts/cleanup-events.mjs"
              flags={[{ flag: '--dry-run', desc: 'Preview without hiding' }]}
            />
            <ScriptRow
              name="Clean Venues"
              desc="Normalizes venue names: collapses variants, strips addresses used as venue names, etc."
              cmd="node scripts/clean-venues.mjs"
              flags={[{ flag: '--dry-run', desc: 'Show changes without applying' }]}
            />
          </div>
        </div>

        {/* Images */}
        <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Images</p>
          <div className="space-y-5">
            <ScriptRow
              name="Cache Local Event Images"
              desc="Downloads images from third-party sites (abqtodo.com, nhccnm.org) and uploads them to Cloudflare R2. Permanently fixes broken image problems. This is also what the 'Cache Images' GitHub Action runs."
              cmd="node scripts/cache-local-images.mjs"
              flags={[
                { flag: '--dry-run', desc: 'Show what would be cached' },
                { flag: '--limit=50', desc: 'Cache only N images' },
              ]}
            />
            <ScriptRow
              name="Host Event Images"
              desc="Uploads event images to Supabase Storage and sets cached_photo_url. Used for events where the source image may disappear."
              cmd="node scripts/host-event-images.mjs"
              flags={[{ flag: '--dry-run', desc: 'Preview without uploading' }]}
            />
            <ScriptRow
              name="Fetch Pixabay Fallbacks"
              desc="Downloads real-photo fallback images from Pixabay (4 per category, 40 total) for events with no image. Requires PIXABAY_API_KEY."
              cmd="node scripts/fetch-pixabay-fallbacks.mjs"
            />
            <ScriptRow
              name="Fetch Place Photos"
              desc="Grabs photos for the public places/venues section (parks, museums, etc.) from Google Places API."
              cmd="node scripts/fetch-place-photos.mjs"
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Notifications & Email</p>
          <div className="space-y-5">
            <ScriptRow
              name="Send Digest Email"
              desc="Sends the newsletter digest to all subscribers (or a specific user). Has a 6-day throttle. The GitHub Action calls this daily — use manually to test or force-send."
              cmd="node scripts/send-digest.mjs"
              flags={[{ flag: '--user=UUID', desc: 'Send only to one user for testing' }]}
            />
            <ScriptRow
              name="Send Push Notification"
              desc="Sends a web push notification to all subscribed users. Use for urgent announcements or new event alerts."
              cmd="node scripts/send-push.mjs"
              flags={[
                { flag: '--title="Event Alert"', desc: 'Notification title' },
                { flag: '--body="Message"', desc: 'Notification body text' },
              ]}
            />
            <ScriptRow
              name="Match Notifications"
              desc="Matches events to user preferences for the 'For You' page. The nightly GitHub Action calls this — run manually after a big import to refresh scores immediately."
              cmd="node scripts/match-notifications.mjs"
              flags={[{ flag: '--user=UUID', desc: 'Match only one user' }]}
            />
          </div>
        </div>
      </section>

      {/* ── Admin Pages ───────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={<LayoutDashboard size={16} className="text-[#9a442d]" />}
          title="Admin Pages"
          sub="All the tools built into the admin panel"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminPageLink
            href="/admin"
            icon={<BarChart2 size={16} className="text-[#9a442d]" />}
            label="Dashboard"
            sub="Live event counts, user stats, analytics, recent reports"
          />
          <AdminPageLink
            href="/admin/ig-captions"
            icon={<Camera size={16} className="text-[#9a442d]" />}
            label="Instagram Posts"
            sub="Event spotlight cards + AI captions + round-ups + site promos"
          />
          <AdminPageLink
            href="/admin/ig"
            icon={<Image size={16} className="text-[#9a442d]" />}
            label="IG Editor (Advanced)"
            sub="Drag-and-drop canvas editor for custom Instagram graphics"
          />
          <AdminPageLink
            href="/admin/events"
            icon={<Database size={16} className="text-[#9a442d]" />}
            label="Events"
            sub="Browse, filter, hide/unhide, feature events"
          />
          <AdminPageLink
            href="/admin/submissions"
            icon={<FileText size={16} className="text-[#9a442d]" />}
            label="Submissions"
            sub="Community-submitted events waiting for your approval"
          />
          <AdminPageLink
            href="/admin/reports"
            icon={<AlertCircle size={16} className="text-[#9a442d]" />}
            label="Reports"
            sub="User-flagged events needing review"
          />
          <AdminPageLink
            href="/admin/feedback"
            icon={<FileText size={16} className="text-[#9a442d]" />}
            label="Feedback"
            sub="User-submitted feedback and suggestions"
          />
          <AdminPageLink
            href="/admin/analytics"
            icon={<BarChart2 size={16} className="text-[#9a442d]" />}
            label="Analytics"
            sub="Page views, ticket clicks, session data"
          />
        </div>
      </section>

      {/* ── Quick Reference ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={<CheckCircle2 size={16} className="text-[#9a442d]" />}
          title="If Something Looks Wrong"
          sub="Most common issues and what to run"
        />

        <div className="space-y-3">
          {[
            {
              problem: 'Events are stale / missing',
              fix: 'Run the V2 Weekly Event Refresh GitHub Action. Or run ingest.mjs locally.',
              cmd: 'node scripts/ingest.mjs --quiet',
            },
            {
              problem: 'Lots of events with wrong categories',
              fix: 'Run the accuracy audit to find and auto-fix mismatches.',
              cmd: 'node scripts/audit-accuracy.mjs --apply',
            },
            {
              problem: 'Events with duplicate entries',
              fix: 'Run dedup to hide cross-source duplicates. SeatGeek is kept over Ticketmaster.',
              cmd: 'node scripts/dedup-events.mjs',
            },
            {
              problem: 'Event images not loading',
              fix: 'Run cache-local-images to upload them to R2 CDN. Or trigger the GitHub Action.',
              cmd: 'node scripts/cache-local-images.mjs',
            },
            {
              problem: 'Regression tests failing after a code change',
              fix: 'Run regression tests locally to see exact failures. Each test ID maps to a bug class in the wiki.',
              cmd: 'node scripts/regression-tests.mjs',
            },
            {
              problem: 'Events missing mood tags',
              fix: 'Run DeepSeek mood enrichment. Each call costs fractions of a cent.',
              cmd: 'node scripts/enrich-deepseek.mjs --limit=500',
            },
          ].map(({ problem, fix, cmd }) => (
            <div key={problem} className="bg-[#201c1a] border border-white/[0.07] rounded-xl p-4">
              <p className="text-sm font-semibold text-white mb-1">🔴 {problem}</p>
              <p className="text-xs text-white/50 mb-2">{fix}</p>
              <div className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-1.5">
                <span className="text-white/20 text-xs font-mono shrink-0">$</span>
                <code className="text-[#e8c99a] text-xs font-mono flex-1 min-w-0 break-all">{cmd}</code>
                <CopyButton text={cmd} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── External Links ─────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">External Tools</p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: `https://github.com/${REPO}/actions`, label: '⚡ GitHub Actions' },
            { href: 'https://app.netlify.com/projects/explore-abq', label: '🌐 Netlify Dashboard' },
            { href: 'https://supabase.com/dashboard/project/bsmvfutebmbkjvlrhiyq', label: '🗄️ Supabase' },
            { href: 'https://dash.cloudflare.com/', label: '☁️ Cloudflare R2' },
            { href: 'https://search.google.com/search-console', label: '🔍 Google Search Console' },
            { href: 'https://www.instagram.com/abqunplugged/', label: '📸 Instagram @abqunplugged' },
            { href: `https://github.com/${REPO}`, label: '📂 GitHub Repo' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#201c1a] border border-white/[0.07] rounded-xl
                text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
            >
              {label}
              <ExternalLink size={11} className="text-white/25" />
            </a>
          ))}
        </div>
      </section>

    </div>
  )
}
