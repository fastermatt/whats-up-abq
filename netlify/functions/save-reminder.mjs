/**
 * Netlify Function: POST /api/save-reminder
 *
 * Saves an event reminder to Supabase so the send-push scheduled function
 * can send push notifications even when the app isn't open.
 *
 * Body: { endpoint, eventId, eventName, eventDate, reminderDays }
 */

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method === 'DELETE') {
    // Remove a reminder
    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400, headers: corsHeaders() }); }
    const { endpoint, eventId } = body;
    if (!endpoint || !eventId) return new Response('Missing fields', { status: 400, headers: corsHeaders() });

    await fetch(
      `${SUPABASE_URL}/rest/v1/event_reminders?endpoint=eq.${encodeURIComponent(endpoint)}&event_id=eq.${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE,
          'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        },
      }
    );
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400, headers: corsHeaders() }); }

  const { endpoint, eventId, eventName, eventDate, reminderDays } = body;
  if (!endpoint || !eventId || !eventDate || !reminderDays) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  // Calculate the date to send the reminder
  const evDate = new Date(eventDate);
  evDate.setDate(evDate.getDate() - reminderDays);
  const remindOnDate = evDate.toISOString().split('T')[0];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/event_reminders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE,
      'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      endpoint,
      event_id: eventId,
      event_name: eventName,
      event_date: eventDate,
      reminder_days: reminderDays,
      remind_on_date: remindOnDate,
      sent: false,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[save-reminder] Supabase error:', text);
    return new Response(JSON.stringify({ error: 'Failed to save' }), {
      status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, remindOnDate }), {
    status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const config = { path: '/api/save-reminder' };
