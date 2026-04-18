#!/usr/bin/env node
/**
 * ABQ Unplugged — Push Notification Sender
 *
 * Sends push notifications to all subscribed devices.
 *
 * Usage:
 *   node scripts/send-push.mjs --type=new-events   # "X new events added"
 *   node scripts/send-push.mjs --type=tonight       # "Events happening tonight"
 *   node scripts/send-push.mjs --type=upcoming      # "You're going to X tonight" (per-user)
 *   node scripts/send-push.mjs --type=custom --title="Title" --body="Body" --url="/events"
 *   node scripts/send-push.mjs --dry-run            # preview only, no sends
 *
 * Env required (scripts/.env or env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ─────────────────────────────────────────────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
  path.join(__dirname, '..', '.env.local'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:4mattcarlson@gmail.com'

if (!SUPABASE_KEY) { console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
if (!VAPID_PUBLIC || !VAPID_PRIVATE) { console.error('❌ Missing VAPID keys in env'); process.exit(1) }

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const isDryRun  = process.argv.includes('--dry-run')
const typeArg   = (process.argv.find(a => a.startsWith('--type=')) ?? '').split('=')[1] || 'tonight'
const customTitle = (process.argv.find(a => a.startsWith('--title=')) ?? '').split('=')[1]
const customBody  = (process.argv.find(a => a.startsWith('--body='))  ?? '').split('=')[1]
const customUrl   = (process.argv.find(a => a.startsWith('--url='))   ?? '').split('=')[1]

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Build notification payload by type ───────────────────────────────────────

async function buildPayload(type) {
  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric',
  })

  if (type === 'custom') {
    return {
      title: customTitle || 'ABQ Unplugged',
      body:  customBody  || 'Check out what\'s happening',
      url:   customUrl   || '/',
      tag:   'custom',
    }
  }

  if (type === 'new-events') {
    // Count events added in the last 24h
    const since = new Date(Date.now() - 86400 * 1000).toISOString()
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('hidden', false)
    const n = count ?? 0
    if (n === 0) { console.log('No new events in last 24h — skipping'); return null }
    return {
      title: `${n} new event${n !== 1 ? 's' : ''} just added 🌵`,
      body:  `See what\'s new in Albuquerque this week`,
      url:   '/events?sort=new',
      tag:   'new-events',
    }
  }

  if (type === 'tonight') {
    // Count events tonight
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('hidden', false)
      .gte('event_date', todayStr)
      .lt('event_date', todayStr + 'Z')   // today only
    const n = count ?? 0
    return {
      title: `${n > 0 ? n + ' things' : 'Things'} happening tonight 🎉`,
      body:  `${today} — tap to see what\'s on`,
      url:   '/tonight',
      tag:   'tonight',
    }
  }

  // Default fallback
  return {
    title: 'What\'s on in ABQ tonight? 🌵',
    body:  `Check out events for ${today}`,
    url:   '/tonight',
    tag:   'generic',
  }
}

// ── Send to all subscribers ───────────────────────────────────────────────────

async function main() {
  console.log(`\n🔔 ABQ Unplugged — Push Sender`)
  console.log(`   Type: ${typeArg}${isDryRun ? '  [DRY RUN]' : ''}`)

  const payload = await buildPayload(typeArg)
  if (!payload) { console.log('Nothing to send.'); return }

  console.log(`\n   Title: ${payload.title}`)
  console.log(`   Body:  ${payload.body}`)
  console.log(`   URL:   ${payload.url}\n`)

  if (isDryRun) {
    console.log('   DRY RUN — no notifications sent')
    return
  }

  // Load all subscriptions
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error) { console.error('❌ DB error:', error.message); process.exit(1) }
  if (!subs || subs.length === 0) { console.log('No subscribers yet.'); return }

  console.log(`   Sending to ${subs.length} subscriber${subs.length !== 1 ? 's' : ''}...\n`)

  const payloadStr = JSON.stringify(payload)
  let sent = 0, failed = 0, stale = 0

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }

    try {
      await webpush.sendNotification(pushSub, payloadStr, {
        TTL: 3600,   // expire after 1 hour if device is offline
      })
      sent++
    } catch (err) {
      // 410 = subscription expired/unregistered — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        stale++
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        failed++
        console.warn(`   ⚠️  Failed to send to ${sub.endpoint.slice(-20)}: ${err.message}`)
      }
    }

    // Small delay to avoid overwhelming push services
    await new Promise(r => setTimeout(r, 50))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Push sent
   Delivered : ${sent}
   Failed    : ${failed}
   Stale (removed): ${stale}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
