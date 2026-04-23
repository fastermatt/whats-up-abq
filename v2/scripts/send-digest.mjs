#!/usr/bin/env node
/**
 * send-digest.mjs — email digest for notification_matches
 *
 * Flow:
 *   1. Find users where:
 *      - user_event_preferences.enabled = true
 *      - user_event_preferences.channels contains 'email'
 *      - user_email_prefs.opted_in = true
 *      - (today's weekday == user_event_preferences.digest_day)
 *      - last_sent_at is null OR older than 6 days
 *   2. For each user, pull un-sent notification_matches (score ≥ min).
 *   3. Compose a digest email grouped by event_date.
 *   4. If RESEND_API_KEY is set, send via Resend; else print plaintext preview.
 *   5. On success, mark matches sent_at = now() and user_email_prefs.last_sent_at.
 *
 * Usage:
 *   node scripts/send-digest.mjs                    # normal daily run (picks users whose digest_day is today)
 *   node scripts/send-digest.mjs --user=UUID        # force one user
 *   node scripts/send-digest.mjs --dry-run          # don't send or mark
 *   node scripts/send-digest.mjs --force-day        # ignore digest_day filter
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   RESEND_API_KEY      (optional — without it, runs in preview mode)
 *   DIGEST_FROM         (optional — defaults to 'ABQ Unplugged <hello@abqunplugged.com>')
 *   SITE_URL            (optional — defaults to 'https://abqunplugged.com')
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_KEY   = process.env.RESEND_API_KEY
const FROM         = process.env.DIGEST_FROM || 'ABQ Unplugged <hello@abqunplugged.com>'
const SITE         = process.env.SITE_URL || 'https://abqunplugged.com'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args    = new Set(process.argv.slice(2).filter(a => a.startsWith('--') && !a.includes('=')))
const argsKV  = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v]
}))
const DRY        = args.has('--dry-run')
const FORCE_DAY  = args.has('--force-day')
const TARGET_USER = argsKV.user || null
const MIN_SCORE   = parseInt(argsKV['min-score'] || '50', 10)
const MAX_PER_DIGEST = parseInt(argsKV['max'] || '15', 10)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver' })
}

function renderEmailHTML({ displayName, items }) {
  const byDate = new Map()
  for (const it of items) {
    const k = it.event_date
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k).push(it)
  }

  const dayBlocks = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evs]) => {
      const rows = evs.map(ev => `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px solid #f0e4cc;">
            <a href="${SITE}/events/${ev.event_id}" style="color:#9a442d; text-decoration:none; font-weight:700; font-size:16px; font-family: 'Inter', sans-serif;">
              ${escape(ev.title)}
            </a>
            <div style="color:#4a3f3a; font-size:13px; margin-top:4px; font-family: 'Inter', sans-serif;">
              ${ev.time ? escape(ev.time) + ' · ' : ''}${escape(ev.venue || '')}${ev.neighborhood ? ' · ' + escape(ev.neighborhood) : ''}
            </div>
            ${ev.reasons?.length ? `<div style="color:#4f6249; font-size:11px; margin-top:4px; font-weight:600;">Matches: ${escape(ev.reasons.slice(0, 3).join(' · '))}</div>` : ''}
          </td>
        </tr>`).join('')
      return `
        <h3 style="color:#1a1614; font-size:15px; margin-top:24px; margin-bottom:4px; font-family: 'Epilogue', sans-serif; font-weight:900;">${escape(formatDate(date))}</h3>
        <table style="width:100%; border-collapse:collapse;">${rows}</table>
      `
    }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your ABQ picks</title></head>
<body style="margin:0; padding:24px; background:#fbf7f1; font-family: 'Inter', -apple-system, sans-serif; color:#1a1614;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 28px; border: 1px solid #f0e4cc;">
    <p style="font-size: 14px; color:#4a3f3a; margin: 0 0 6px 0;">${escape(displayName ? 'Hey ' + displayName + ',' : 'Hey,')}</p>
    <h1 style="font-size: 28px; margin: 0 0 10px 0; font-family: 'Epilogue', sans-serif; font-weight:900; color:#9a442d;">
      Events we picked for you
    </h1>
    <p style="font-size: 13px; color:#8a7a74; margin: 0 0 16px 0;">Based on your preferences on ABQ Unplugged. ${items.length} ${items.length === 1 ? 'match' : 'matches'}.</p>
    ${dayBlocks}
    <div style="margin-top:28px; padding-top:20px; border-top: 1px solid #f0e4cc; font-size: 12px; color:#8a7a74;">
      <a href="${SITE}/for-you" style="color:#9a442d;">See them all</a> ·
      <a href="${SITE}/profile/notifications" style="color:#9a442d;">Adjust preferences</a>
    </div>
  </div>
</body>
</html>`
}

function escape(s) {
  if (!s) return ''
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function sendViaResend({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.log(`    [preview] Would send to ${to}: ${subject}`)
    return { ok: true, previewed: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return { ok: false, error: `${res.status}: ${t}` }
  }
  return { ok: true }
}

async function main() {
  console.log('📧 Digest sender starting…')
  if (DRY) console.log('  (dry-run)')
  if (!RESEND_KEY) console.log('  (no RESEND_API_KEY — preview only)')

  const todayDow = new Date().getUTCDay()

  // 1. Find eligible users
  let prefsQuery = supabase
    .from('user_event_preferences')
    .select('user_id, digest_day, channels, days_ahead, enabled')
    .eq('enabled', true)
  if (TARGET_USER) prefsQuery = prefsQuery.eq('user_id', TARGET_USER)

  const { data: prefs, error: prefsErr } = await prefsQuery
  if (prefsErr) throw prefsErr

  const eligible = (prefs ?? []).filter(p =>
    p.channels?.includes('email') &&
    (FORCE_DAY || TARGET_USER || p.digest_day === todayDow)
  )

  if (eligible.length === 0) {
    console.log('  No users eligible today. Exiting.')
    return
  }
  console.log(`  ${eligible.length} user(s) eligible`)

  let sent = 0, skipped = 0, failed = 0

  for (const pref of eligible) {
    // Get email pref
    const { data: emailPref } = await supabase
      .from('user_email_prefs')
      .select('email, opted_in, last_sent_at')
      .eq('user_id', pref.user_id)
      .maybeSingle()
    if (!emailPref || !emailPref.opted_in || !emailPref.email) {
      skipped++
      continue
    }

    // Throttle: don't send if last_sent_at within 6 days (unless forced)
    if (!TARGET_USER && !FORCE_DAY && emailPref.last_sent_at) {
      const daysSince = (Date.now() - new Date(emailPref.last_sent_at).getTime()) / 86400000
      if (daysSince < 6) { skipped++; continue }
    }

    // Fetch un-sent matches (score ≥ MIN_SCORE)
    const { data: matches } = await supabase
      .from('notification_matches')
      .select('event_id, score, match_reasons')
      .eq('user_id', pref.user_id)
      .eq('dismissed', false)
      .is('sent_at', null)
      .gte('score', MIN_SCORE)
      .order('score', { ascending: false })
      .limit(MAX_PER_DIGEST)

    if (!matches?.length) {
      console.log(`  user=${pref.user_id.slice(0, 8)}…  no matches, skip`)
      skipped++
      continue
    }

    // Fetch event details
    const ids = matches.map(m => m.event_id)
    const today = new Date().toISOString().slice(0, 10)
    const { data: evs } = await supabase
      .from('events')
      .select('id, event_date, venue_name, neighborhood, raw')
      .in('id', ids)
      .eq('hidden', false)
      .gte('event_date', today)

    const byId = new Map((evs ?? []).map(e => [e.id, e]))
    const items = matches
      .filter(m => byId.has(m.event_id))
      .map(m => {
        const e = byId.get(m.event_id)
        return {
          event_id: m.event_id,
          event_date: e.event_date,
          title: e?.raw?.name ?? e?.raw?.title ?? '(Untitled)',
          venue: e.venue_name,
          neighborhood: e.neighborhood,
          time: e?.raw?.dates?.start?.localTime ?? null,
          reasons: (m.match_reasons || []).map(r => r.replace(/^(category|venue|nh|tag|kw|mood):/, '')),
        }
      })

    if (!items.length) { skipped++; continue }

    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('id', pref.user_id).maybeSingle()

    const subject = `${items.length} ${items.length === 1 ? 'event' : 'events'} we picked for you`
    const html    = renderEmailHTML({ displayName: profile?.display_name, items })

    console.log(`  user=${pref.user_id.slice(0, 8)}… → ${emailPref.email}  ${items.length} event(s)`)

    if (DRY) { sent++; continue }

    const res = await sendViaResend({ to: emailPref.email, subject, html })
    if (!res.ok) {
      console.error(`    ❌ send failed: ${res.error}`)
      failed++
      continue
    }

    // Mark matches as sent
    const now = new Date().toISOString()
    await supabase
      .from('notification_matches')
      .update({ sent_at: now, channels_sent: supabaseAppend('channels_sent', 'email') })
      .in('event_id', items.map(x => x.event_id))
      .eq('user_id', pref.user_id)

    // Update last_sent_at
    await supabase
      .from('user_email_prefs')
      .update({ last_sent_at: now })
      .eq('user_id', pref.user_id)

    sent++
  }

  console.log(`✅ Done. sent=${sent}  skipped=${skipped}  failed=${failed}`)
}

// supabase-js doesn't have a native array-append — use a literal to keep it simple.
// In practice we just overwrite with ['email'] since the matcher doesn't use this
// column for ordering; the sent_at timestamp is authoritative.
function supabaseAppend(_col, val) { return [val] }

main().catch(err => { console.error(err); process.exit(1) })
