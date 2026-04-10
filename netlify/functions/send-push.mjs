/**
 * Netlify Scheduled Function: send-push
 * Cron: runs hourly — decides internally which notifications to fire based on
 * time-of-day (Mountain Time) and day-of-week.
 *
 * Notification schedule (Mountain Time):
 *   Daily 5 pm      → "Tonight in ABQ" (if prefs.tonight)
 *   Thu+Fri 9 am    → "Weekend Preview" (if prefs.weekend)
 *   Mon 8 am        → "Category Alerts" (if prefs.myCategories)
 *   Fri+Sat 9 am    → "Free Events" (if prefs.freeEvents)
 *   Any time        → "New Events Added" when count jumps >10 (if prefs.newEvents)
 *
 * Uses the web-push library via dynamic import (bundled by Netlify).
 */

import webpush from 'web-push';

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC     = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE    = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT    = process.env.VAPID_SUBJECT    || 'mailto:4mattcarlson@gmail.com';

// Mountain Time = UTC-7 (MDT summer) / UTC-6 (MST winter)
function mountainHour() {
  const utcHour = new Date().getUTCHours();
  const offset  = isDST() ? -6 : -7;          // MDT / MST
  return ((utcHour + offset) + 24) % 24;
}
function mountainDow() {
  const now = new Date();
  const mt  = new Date(now.getTime() + (isDST() ? -6 : -7) * 3600000);
  return mt.getUTCDay(); // 0=Sun … 6=Sat
}
function mountainDateStr() {
  const now = new Date();
  const mt  = new Date(now.getTime() + (isDST() ? -6 : -7) * 3600000);
  return mt.toISOString().split('T')[0];
}
function isDST() {
  // Rough DST check: second Sunday in March → first Sunday in November
  const now = new Date();
  const y = now.getUTCFullYear();
  const dstStart = nthSunday(y, 2, 2);  // March, 2nd Sunday
  const dstEnd   = nthSunday(y, 10, 1); // November, 1st Sunday
  return now >= dstStart && now < dstEnd;
}
function nthSunday(year, month, nth) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  const firstSun = (7 - d.getUTCDay()) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + firstSun + (nth - 1) * 7, 8));
}

async function fetchSubscriptions() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth,prefs`,
    {
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

async function fetchEventCounts() {
  // Count total upcoming events in Supabase
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id&is_past=eq.false`,
    {
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Prefer':        'count=exact',
        'Range':         '0-0',
      },
    }
  );
  const countHeader = res.headers.get('Content-Range') || '';
  const match = countHeader.match(/\/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function fetchTonightCount(dateStr) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id&start_date=eq.${dateStr}`,
    {
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Prefer':        'count=exact',
        'Range':         '0-0',
      },
    }
  );
  const ch = res.headers.get('Content-Range') || '';
  const m = ch.match(/\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function fetchWeekendCount(satStr, sunStr) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id&start_date=in.(${satStr},${sunStr})`,
    {
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Prefer':        'count=exact',
        'Range':         '0-0',
      },
    }
  );
  const ch = res.headers.get('Content-Range') || '';
  const m = ch.match(/\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function sendToSubscriber(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — delete it
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
        {
          method: 'DELETE',
          headers: {
            'apikey':        SUPABASE_SERVICE,
            'Authorization': `Bearer ${SUPABASE_SERVICE}`,
          },
        }
      );
    }
    return false;
  }
}

// ── Event Reminder Processing ──────────────────────────────────────────────
async function fetchDueReminders(dateStr) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/event_reminders?remind_on_date=lte.${dateStr}&sent=eq.false&select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
    }
  );
  if (!res.ok) { console.error('[reminders] fetch error:', res.status); return []; }
  return res.json();
}

async function markReminderSent(endpoint, eventId) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/event_reminders?endpoint=eq.${encodeURIComponent(endpoint)}&event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
      body: JSON.stringify({ sent: true }),
    }
  );
}

async function processEventReminders(todayStr) {
  const reminders = await fetchDueReminders(todayStr);
  if (!reminders.length) return 0;

  console.log(`[reminders] ${reminders.length} due reminders found`);
  let sent = 0;

  for (const rem of reminders) {
    const eventDate = new Date(rem.event_date);
    const now = new Date();
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dayText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'in ' + daysUntil + ' days';

    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(rem.endpoint)}&select=endpoint,p256dh,auth`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE,
          'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        },
      }
    );
    const subs = await subRes.json();
    if (!subs.length) {
      await markReminderSent(rem.endpoint, rem.event_id);
      continue;
    }

    const sub = subs[0];
    const payload = {
      title: '\u2764\uFE0F ' + rem.event_name + ' is ' + dayText + '!',
      body: 'Your saved event is coming up ' + dayText + '. Tap to see details.',
      tag: 'abq-reminder-' + rem.event_id,
      data: { url: '/#event/' + rem.event_id },
    };

    const ok = await sendToSubscriber(sub, payload);
    if (ok) sent++;
    await markReminderSent(rem.endpoint, rem.event_id);
  }

  console.log('[reminders] Sent ' + sent + '/' + reminders.length + ' reminder notifications');
  return sent;
}

export default async function handler() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('[send-push] Missing VAPID keys');
    return new Response('Missing VAPID keys', { status: 500 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const hour  = mountainHour();
  const dow   = mountainDow();  // 0=Sun, 1=Mon … 6=Sat
  const today = mountainDateStr();

  // Compute weekend Saturday/Sunday strings
  const satOffset = dow === 6 ? 0 : (6 - dow + 7) % 7;
  const sunOffset = dow === 0 ? 0 : (7 - dow) % 7;
  const sat = new Date(); sat.setDate(sat.getDate() + satOffset);
  const sun = new Date(); sun.setDate(sun.getDate() + sunOffset);
  const satStr = sat.toISOString().split('T')[0];
  const sunStr = sun.toISOString().split('T')[0];

  console.log(`[send-push] MT hour=${hour} dow=${dow} date=${today}`);

  // Decide which notification type to send this hour
  let notifType = null;
  if (hour === 17)                        notifType = 'tonight';    // 5 pm daily
  if ((dow === 4 || dow === 5) && hour === 9) notifType = 'weekend'; // Thu/Fri 9am
  if (dow === 1 && hour === 8)             notifType = 'categories'; // Mon 8am
  if ((dow === 5 || dow === 6) && hour === 9) notifType = 'free';   // Fri/Sat 9am

  // ── Always check event reminders regardless of notification schedule ────
  let remindersSent = 0;
  try {
    remindersSent = await processEventReminders(today);
  } catch (err) {
    console.error('[send-push] Event reminder error:', err);
  }

  if (!notifType) {
    console.log(`[send-push] No scheduled notification this hour (reminders sent: ${remindersSent})`);
    return new Response(JSON.stringify({ scheduled: null, remindersSent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subs = await fetchSubscriptions();
  console.log(`[send-push] ${subs.length} subscribers, type=${notifType}`);

  let sent = 0, skipped = 0, failed = 0;

  for (const sub of subs) {
    const prefs = sub.prefs || {};
    if (!prefs.enabled) { skipped++; continue; }

    let payload = null;

    if (notifType === 'tonight' && prefs.tonight) {
      const count = await fetchTonightCount(today);
      if (count > 0) {
        payload = {
          title: `🌆 ${count} events tonight in ABQ`,
          body:  "Tap to see what's happening in Albuquerque tonight.",
          tag:   'abq-tonight',
          data:  { url: '/#events', filter: 'Tonight' },
        };
      }
    }

    if (notifType === 'weekend' && prefs.weekend) {
      const count = await fetchWeekendCount(satStr, sunStr);
      if (count > 0) {
        payload = {
          title: `🗓️ ${count} events this weekend in ABQ`,
          body:  'Your Albuquerque weekend preview is ready — tap to explore.',
          tag:   'abq-weekend',
          data:  { url: '/#events', filter: 'This Weekend' },
        };
      }
    }

    if (notifType === 'free' && prefs.freeEvents) {
      payload = {
        title: '🆓 Free events this weekend in ABQ',
        body:  'Free things to do in Albuquerque this weekend — no ticket needed.',
        tag:   'abq-free',
        data:  { url: '/#events', filter: 'Free' },
      };
    }

    if (notifType === 'categories' && prefs.myCategories) {
      payload = {
        title: '🎸 New events in your categories this week',
        body:  'Fresh events in Albuquerque that match your interests.',
        tag:   'abq-categories',
        data:  { url: '/#events', filter: '❤️ For You' },
      };
    }

    if (!payload) { skipped++; continue; }

    const ok = await sendToSubscriber(sub, payload);
    if (ok) sent++; else failed++;
  }

  console.log(`[send-push] Done: sent=${sent} skipped=${skipped} failed=${failed}`);
  return new Response(JSON.stringify({ sent, skipped, failed, remindersSent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  schedule: '0 * * * *',  // every hour — handler decides which to send
};
