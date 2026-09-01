#!/usr/bin/env node

const args = new Set(process.argv.slice(2))
const forceEmpty = args.has('--force-empty')
const dryRun = args.has('--dry-run')
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function requireValue(value, name) {
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function recentEventCount() {
  if (forceEmpty) return 0
  const url = new URL('/rest/v1/analytics', requireValue(supabaseUrl, 'SUPABASE_URL'))
  url.searchParams.set('select', 'id')
  url.searchParams.set('created_at', `gt.${new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()}`)
  url.searchParams.set('limit', '1')
  const key = requireValue(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(url, {
    method: 'HEAD',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
  })
  if (!response.ok) throw new Error(`Analytics heartbeat query failed: ${response.status} ${response.statusText}`)
  const range = response.headers.get('content-range')
  const count = Number(range?.split('/')[1] ?? 0)
  if (!Number.isFinite(count)) throw new Error(`Invalid analytics count header: ${range}`)
  return count
}

async function sendAlert(message) {
  if (dryRun) {
    console.log(`[dry-run] Would send alert: ${message}`)
    return
  }
  const resendKey = requireValue(process.env.RESEND_API_KEY, 'RESEND_API_KEY')
  const alertEmail = requireValue(process.env.ALERT_EMAIL, 'ALERT_EMAIL')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'ABQ Unplugged <alerts@abqunplugged.com>',
      to: [alertEmail],
      subject: 'ABQ analytics heartbeat: no data for 26 hours',
      text: message,
    }),
  })
  if (!response.ok) throw new Error(`Heartbeat alert failed: ${response.status} ${await response.text()}`)
}

const count = await recentEventCount()
if (count > 0) {
  console.log(`Analytics heartbeat healthy: ${count} events in the last 26 hours.`)
} else {
  const message = `No public.analytics rows were recorded in the last 26 hours as of ${new Date().toISOString()}. Check the client tracker, Supabase availability, RLS insert policy, and the latest deploy.`
  await sendAlert(message)
  console.error(message)
  if (!dryRun) process.exitCode = 1
}
