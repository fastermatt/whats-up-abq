// Netlify Edge Function: Dynamic Open Graph meta tags for shared place/event links
// Intercepts /place/:id and /event/:id — injects the correct OG tags (title,
// description, image) into the SPA HTML so that ALL link-preview systems
// (iMessage, Slack, Twitter, Facebook, etc.) see the right card.
//
// Strategy: fetch place/event data from Supabase, then pass the request
// through to the origin (SPA index.html) and rewrite its <head> to swap in
// dynamic OG tags. No bot-detection needed — every user agent gets correct tags,
// and the SPA still boots normally for real browsers.

import type { Context } from 'https://edge.netlify.com';

const SUPABASE_URL = 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc';

const SITE = 'https://abqunplugged.com';
const FALLBACK_IMAGE = `${SITE}/og-image.jpg`;
const SITE_NAME = 'ABQ Unplugged';

// ── Supabase helpers ──────────────────────────────────────────────────────────

interface OGData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
}

async function fetchPlaceOG(placeId: string): Promise<OGData | null> {
  const isGoogleId = placeId.startsWith('ChIJ') || placeId.startsWith('Eh');
  const query = isGoogleId
    ? `${SUPABASE_URL}/rest/v1/places?raw->>place_id=eq.${encodeURIComponent(placeId)}&select=raw,enriched&limit=1`
    : `${SUPABASE_URL}/rest/v1/places?id=eq.${encodeURIComponent(placeId)}&select=raw,enriched&limit=1`;

  const res = await fetch(query, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows?.length) return null;

  const { raw, enriched } = rows[0];
  const name = raw?.name || raw?.displayName?.text || 'Place';
  const description =
    enriched?.editorial ||
    raw?.about ||
    raw?.editorialSummary?.text ||
    raw?.description ||
    `Discover ${name} in Albuquerque on ABQ Unplugged`;
  const category = raw?.primaryTypeDisplayName?.text || raw?.category || '';

  let image = FALLBACK_IMAGE;
  if (raw?.photos?.length) {
    const ref = raw.photos[0].photo_reference;
    if (ref) {
      image = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${ref}&key=AIzaSyAJ7V0rlGJsb2KebTObW14ylEXbSirzLFM`;
    }
  }

  return {
    title: name + (category ? ` — ${category}` : ''),
    description: truncate(description, 200),
    image,
    url: `${SITE}/place/${encodeURIComponent(placeId)}`,
    type: 'article',
  };
}

async function fetchEventOG(eventId: string): Promise<OGData | null> {
  // Try multiple ID formats to handle Ticketmaster, local, and static events
  // Static events may have "local-" prefix while DB stores without it
  const cleanId = eventId.replace(/^local-/, '');
  const queries = [
    `${SUPABASE_URL}/rest/v1/events?raw->>id=eq.${encodeURIComponent(eventId)}&select=raw&limit=1`,
    `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=raw&limit=1`,
    `${SUPABASE_URL}/rest/v1/events?raw->>id=eq.${encodeURIComponent(cleanId)}&select=raw&limit=1`,
    `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(cleanId)}&select=raw&limit=1`,
    // Fuzzy: match events whose ID contains core keywords from the shared ID
    `${SUPABASE_URL}/rest/v1/events?id=like.*${encodeURIComponent(cleanId.split('-').slice(0, 2).join('-'))}*&select=raw&limit=1`,
  ];

  let raw: Record<string, unknown> | null = null;
  for (const query of queries) {
    try {
      const res = await fetch(query, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (!res.ok) continue;
      const rows = await res.json();
      if (rows?.length) { raw = rows[0].raw; break; }
    } catch { continue; }
  }
  if (!raw) return null;

  const name = (raw?.name as string) || 'Event';
  const embedded = raw?._embedded as Record<string, unknown[]> | undefined;
  const venues = embedded?.venues as Array<{ name?: string }> | undefined;
  const venue = venues?.[0]?.name || (raw?.venue as string) || '';
  const dates = raw?.dates as { start?: { localDate?: string; localTime?: string } } | undefined;
  const dateStr = dates?.start?.localDate || (raw?.date as string) || '';
  const timeStr = dates?.start?.localTime || (raw?.time as string) || '';

  const parts = [name];
  if (dateStr) parts.push(formatDateCompact(dateStr));
  if (timeStr) parts.push(formatTimeCompact(timeStr));
  if (venue) parts.push(`at ${venue}`);
  const description = (raw?.info as string) || (raw?.description as string) || parts.join(' — ');

  // Image: try Ticketmaster images[] array first, then local event image field
  let image = FALLBACK_IMAGE;
  const images = raw?.images as Array<{ url?: string; ratio?: string; width?: number }> | undefined;
  if (images?.length) {
    // Prefer event-specific images (dam/a/) over generic category placeholders (dam/c/)
    const isCustom = (url: string) => !url.includes('/dam/c/');
    const custom16x9 = images
      .filter(img => img.ratio === '16_9' && (img.width || 0) >= 640 && img.url && isCustom(img.url))
      .sort((a, b) => (b.width || 0) - (a.width || 0));
    const any16x9 = images
      .filter(img => img.ratio === '16_9' && (img.width || 0) >= 640)
      .sort((a, b) => (b.width || 0) - (a.width || 0));
    image = custom16x9[0]?.url || any16x9[0]?.url || images[0]?.url || FALLBACK_IMAGE;
  } else if (raw?.image) {
    // Local event: single image string
    image = raw.image as string;
  } else if (raw?.additionalImages?.length) {
    image = (raw.additionalImages as string[])[0];
  }

  const titleParts = [name];
  if (venue) titleParts.push(`at ${venue}`);

  return {
    title: titleParts.join(' '),
    description: truncate(description, 200),
    image,
    url: `${SITE}/event/${encodeURIComponent(eventId)}`,
    type: 'event',
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateCompact(d: string): string {
  try {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

function formatTimeCompact(t: string): string {
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return t;
  }
}

/** Build the OG meta tag block to inject into <head> */
function ogMetaTags(og: OGData): string {
  return `
    <!-- Dynamic OG tags (injected by edge function) -->
    <meta property="og:type"        content="${esc(og.type)}" />
    <meta property="og:url"         content="${esc(og.url)}" />
    <meta property="og:title"       content="${esc(og.title)}" />
    <meta property="og:description" content="${esc(og.description)}" />
    <meta property="og:image"       content="${esc(og.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt"   content="${esc(og.title)}" />
    <meta property="og:site_name"   content="${SITE_NAME}" />
    <meta property="og:locale"      content="en_US" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${esc(og.title)}" />
    <meta name="twitter:description" content="${esc(og.description)}" />
    <meta name="twitter:image"       content="${esc(og.image)}" />
    <title>${esc(og.title)} — ${SITE_NAME}</title>`;
}

// ── Edge Function handler ─────────────────────────────────────────────────────

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Match /place/:id or /event/:id
  const placeMatch = path.match(/^\/place\/(.+)$/);
  const eventMatch = path.match(/^\/event\/(.+)$/);

  if (!placeMatch && !eventMatch) return;

  // Fetch OG data from Supabase (run in parallel with origin request)
  const ogPromise = placeMatch
    ? fetchPlaceOG(decodeURIComponent(placeMatch[1]))
    : fetchEventOG(decodeURIComponent(eventMatch![1]));

  // Get the SPA HTML from the origin (index.html)
  const originResponse = await context.next();

  // If we can't get OG data, just return the unmodified SPA
  const og = await ogPromise;
  if (!og) return originResponse;

  // Read the SPA HTML and inject dynamic OG tags by replacing the static ones
  let html = await originResponse.text();

  // Remove existing static OG / Twitter meta tags and title
  html = html.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '');
  html = html.replace(/<title>[^<]*<\/title>/i, '');

  // Inject dynamic tags right after <head>
  html = html.replace(/<head>/i, `<head>${ogMetaTags(og)}`);

  // Return modified HTML with same status/headers
  const headers = new Headers(originResponse.headers);
  headers.set('cache-control', 'public, max-age=300, s-maxage=3600');
  return new Response(html, {
    status: originResponse.status,
    headers,
  });
}

export const config = {
  path: ['/place/*', '/event/*'],
};
