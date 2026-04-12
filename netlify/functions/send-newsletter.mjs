/**
 * Netlify Scheduled Function: send-newsletter
 * Schedule: every Sunday at 9am Mountain Time (= 15:00 UTC in MDT, 16:00 MST)
 *
 * Logic:
 *  1. Fetch all users with opted_in=true from user_email_prefs
 *  2. For each user, fetch their saved event categories from user_saved_events
 *  3. Find new events added in the last 7 days that match those categories
 *  4. Format a personalized HTML email digest
 *  5. Send via Resend API
 *  6. Update last_sent_at in user_email_prefs
 */

const SUPABASE_URL     = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL       = 'ABQ Unplugged <newsletter@abqunplugged.com>';
const SITE_URL         = 'https://abqunplugged.com';

// ── Helpers ────────────────────────────────────────────────────────────────

function sbHeaders() {
  return {
    'apikey': SUPABASE_SERVICE,
    'Authorization': `Bearer ${SUPABASE_SERVICE}`,
    'Content-Type': 'application/json',
  };
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase GET error ${res.status}: ${path}`);
  return res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH error ${res.status}: ${path}`);
}

// ── Mountain Time helpers ──────────────────────────────────────────────────

function isDST() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const dstStart = nthSunday(y, 3, 2);
  const dstEnd   = nthSunday(y, 11, 1);
  return now >= dstStart && now < dstEnd;
}
function nthSunday(year, month, nth) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  const firstSun = (7 - d.getUTCDay()) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + firstSun + (nth - 1) * 7, 8));
}
function mountainHour() {
  const offset = isDST() ? -6 : -7;
  return ((new Date().getUTCHours() + offset) + 24) % 24;
}
function mountainDow() {
  const now = new Date();
  const mt  = new Date(now.getTime() + (isDST() ? -6 : -7) * 3600000);
  return mt.getUTCDay();
}

// ── Email HTML template ────────────────────────────────────────────────────

function buildEmailHtml({ displayName, events, totalSaved }) {
  const greeting = displayName ? `Hi ${displayName},` : 'Hi there,';
  const eventRows = events.slice(0, 8).map(ev => {
    const date = ev.event_date
      ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '';
    const cats = (ev.categories || []).join(', ');
    const img = ev.cached_photo_url
      ? `<img src="${ev.cached_photo_url}" alt="${escHtml(ev.name)}" width="80" height="80" style="border-radius:10px;object-fit:cover;width:80px;height:80px;flex-shrink:0;">`
      : `<div style="width:80px;height:80px;border-radius:10px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:32px;">🎉</div>`;
    const eventUrl = `${SITE_URL}/#event/${ev.id}`;
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:80px;vertical-align:top;padding-right:14px;">
                <a href="${eventUrl}">${img}</a>
              </td>
              <td style="vertical-align:top;">
                <a href="${eventUrl}" style="font-family:'Public Sans',Arial,sans-serif;font-size:15px;font-weight:700;color:#1a1a1a;text-decoration:none;line-height:1.3;">${escHtml(ev.name)}</a>
                ${date ? `<p style="margin:4px 0 0;font-family:'Public Sans',Arial,sans-serif;font-size:13px;color:#888;">📅 ${date}</p>` : ''}
                ${cats ? `<p style="margin:3px 0 0;font-family:'Public Sans',Arial,sans-serif;font-size:12px;color:var(--brand,#e85d26);">${escHtml(cats)}</p>` : ''}
                <a href="${eventUrl}" style="display:inline-block;margin-top:6px;font-family:'Public Sans',Arial,sans-serif;font-size:12px;color:#e85d26;font-weight:700;text-decoration:none;">View event →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const noEventsMsg = events.length === 0
    ? `<p style="font-family:'Public Sans',Arial,sans-serif;font-size:15px;color:#555;text-align:center;padding:24px 0;">No new matching events this week — but ABQ always has something coming up!</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your ABQ Unplugged Weekly Picks</title></head>
<body style="margin:0;padding:0;background:#f7f7f7;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f7f7;">
    <tr><td style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#e85d26;padding:28px 28px 20px;">
            <p style="margin:0;font-family:'Public Sans',Arial,sans-serif;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">ABQ Unplugged</p>
            <p style="margin:4px 0 0;font-family:'Public Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.85);">Your weekly event picks for Albuquerque</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 6px;font-family:'Public Sans',Arial,sans-serif;font-size:16px;font-weight:700;color:#1a1a1a;">${greeting}</p>
            <p style="margin:0 0 20px;font-family:'Public Sans',Arial,sans-serif;font-size:14px;color:#555;line-height:1.6;">
              Based on your ${totalSaved} saved event${totalSaved !== 1 ? 's' : ''}, here are new events this week that might interest you:
            </p>

            ${noEventsMsg}

            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${eventRows}
            </table>

            ${events.length > 0 ? `
            <div style="margin-top:24px;text-align:center;">
              <a href="${SITE_URL}/#events" style="display:inline-block;background:#e85d26;color:#fff;font-family:'Public Sans',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">See All Events in ABQ →</a>
            </div>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 28px;background:#f9f9f9;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-family:'Public Sans',Arial,sans-serif;font-size:11px;color:#aaa;text-align:center;line-height:1.6;">
              You're receiving this because you opted in at <a href="${SITE_URL}" style="color:#e85d26;text-decoration:none;">abqunplugged.com</a>.<br>
              <a href="${SITE_URL}/#discover" style="color:#aaa;">Manage preferences</a> · <a href="${SITE_URL}/#discover" style="color:#aaa;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Core: send one email via Resend ──────────────────────────────────────────

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Core: find new events matching categories ────────────────────────────────

async function findMatchingEvents(categories, sinceDate) {
  if (!categories || categories.length === 0) return [];

  // Fetch upcoming events added in the last 7 days from the events table
  // We check ai_enrichment->>'category' OR raw->>'category' fields
  const since = sinceDate.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id,raw,ai_enrichment,cached_photo_url&event_date=gte.${today}&created_at=gte.${since}&order=event_date.asc&limit=50`,
    { headers: sbHeaders() }
  );
  if (!res.ok) return [];
  const rows = await res.json();

  // Filter to events whose category matches any of the user's saved categories
  const catSet = new Set(categories.map(c => c.toLowerCase()));
  const matched = [];

  for (const row of rows) {
    const raw = row.raw || {};
    const ai  = row.ai_enrichment || {};
    const name = raw.name || ai.name || '';
    if (!name) continue;

    // Derive category from classifications
    let cat = '';
    const classifications = raw.classifications || [];
    if (classifications.length > 0) {
      const seg  = classifications[0]?.segment?.name || '';
      const genre = classifications[0]?.genre?.name  || '';
      if (/music/i.test(seg))       cat = 'Music';
      else if (/sport/i.test(seg))  cat = 'Sports';
      else if (/arts/i.test(seg))   cat = 'Arts';
      else if (/film|movie/i.test(seg)) cat = 'Movie';
      else if (genre)               cat = genre;
      else                          cat = seg;
    }
    if (!cat && raw.category) cat = raw.category;
    if (!cat && ai.category)  cat = ai.category;

    if (cat && catSet.has(cat.toLowerCase())) {
      matched.push({
        id: row.id,
        name,
        event_date: raw.event_date || raw.dates?.start?.localDate || null,
        categories: cat ? [cat] : [],
        cached_photo_url: row.cached_photo_url || null,
      });
    }
  }

  return matched.slice(0, 8);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler() {
  const hour = mountainHour();
  const dow  = mountainDow();

  console.log(`[send-newsletter] MT hour=${hour} dow=${dow}`);

  // Only run on Sunday at 9am MT
  if (dow !== 0 || hour !== 9) {
    console.log('[send-newsletter] Not newsletter time — skipping');
    return new Response(JSON.stringify({ skipped: true, reason: 'not Sunday 9am MT' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_API_KEY) {
    console.error('[send-newsletter] Missing RESEND_API_KEY');
    return new Response('Missing RESEND_API_KEY', { status: 500 });
  }

  // 1. Get all opted-in users
  const prefs = await sbGet('user_email_prefs?opted_in=eq.true&select=user_id,email,frequency,last_sent_at');
  console.log(`[send-newsletter] ${prefs.length} opted-in users`);

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);

  let sent = 0, skipped = 0, failed = 0;

  for (const pref of prefs) {
    try {
      // Skip daily users who were sent in the last 18 hours
      if (pref.frequency === 'never') { skipped++; continue; }

      // 2. Get this user's saved event categories
      const savedEvents = await sbGet(
        `user_saved_events?user_id=eq.${pref.user_id}&select=categories&limit=200`
      );

      // Flatten all categories and count occurrences
      const catCounts = {};
      for (const se of savedEvents) {
        for (const c of (se.categories || [])) {
          catCounts[c] = (catCounts[c] || 0) + 1;
        }
      }
      const topCategories = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c]) => c);

      // 3. Find matching new events
      const matchingEvents = await findMatchingEvents(topCategories, sinceDate);

      // 4. Get display name from auth.users via service role
      const usersRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${pref.user_id}`,
        { headers: sbHeaders() }
      );
      let displayName = '';
      if (usersRes.ok) {
        const userData = await usersRes.json();
        displayName = userData.user_metadata?.display_name || userData.user_metadata?.full_name?.split(' ')[0] || '';
      }

      // 5. Send email
      const subject = matchingEvents.length > 0
        ? `🎉 ${matchingEvents.length} new event${matchingEvents.length > 1 ? 's' : ''} matching your interests in ABQ`
        : `🌆 Your weekly ABQ Unplugged digest`;

      const html = buildEmailHtml({
        displayName,
        events: matchingEvents,
        totalSaved: savedEvents.length,
      });

      await sendEmail({ to: pref.email, subject, html });

      // 6. Update last_sent_at
      await sbPatch(
        `user_email_prefs?user_id=eq.${pref.user_id}`,
        { last_sent_at: new Date().toISOString() }
      );

      console.log(`[send-newsletter] Sent to ${pref.email} (${matchingEvents.length} events)`);
      sent++;

    } catch (err) {
      console.error(`[send-newsletter] Failed for ${pref.email}:`, err.message);
      failed++;
    }
  }

  console.log(`[send-newsletter] Done: sent=${sent} skipped=${skipped} failed=${failed}`);
  return new Response(JSON.stringify({ sent, skipped, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  schedule: '0 15 * * 0',  // Sunday 15:00 UTC = 9am MDT (adjust to 16:00 in winter/MST)
};
