// Netlify Edge Function: Dynamic Open Graph meta tags for shared place/event links
// Intercepts /place/:id and /event/:id — serves rich OG tags to social crawlers,
// serves the normal SPA to real browsers.

const SUPABASE_URL = 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc';

const SITE = 'https://abqunplugged.com';
const FALLBACK_IMAGE = `${SITE}/og-image.jpg`;
const SITE_NAME = 'ABQ Unplugged';

// Bot user-agents that read OG tags (social link previews)
const BOT_RE =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot|Googlebot|bingbot|iMessageBot|Applebot|Pinterest|Tumblr|Viber|Line|Skype|Embedly|Quora|Outbrain|W3C_Validator|vkShare|redditbot|Mastodon/i;

function isBot(ua: string | null): boolean {
  return !!ua && BOT_RE.test(ua);
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function fetchPlace(placeId: string) {
  // Try by Google place_id first (most IDs are ChIJ...), then by UUID
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

  // Best available photo
  let image = FALLBACK_IMAGE;
  if (raw?.photos?.length) {
    const ref = raw.photos[0].name || raw.photos[0].photo_reference;
    if (ref) {
      image = ref.startsWith('http')
        ? ref
        : `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=1200&key=AIzaSyAJ7V0rlGJsb2KebTObW14ylEXbSirzLFM`;
    }
  }

  return { name, description: truncate(description, 200), category, image, id: placeId };
}

async function fetchEvent(eventId: string) {
  const query = `${SUPABASE_URL}/rest/v1/events?raw->>id=eq.${encodeURIComponent(eventId)}&select=raw&limit=1`;
  const res = await fetch(query, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows?.length) return null;

  const raw = rows[0].raw;
  const name = raw?.name || 'Event';
  const venue = raw?._embedded?.venues?.[0]?.name || '';
  const dateStr = raw?.dates?.start?.localDate || '';
  const timeStr = raw?.dates?.start?.localTime || '';

  // Build description from available fields
  const parts = [name];
  if (dateStr) parts.push(formatDateCompact(dateStr));
  if (timeStr) parts.push(formatTimeCompact(timeStr));
  if (venue) parts.push(`at ${venue}`);
  const description = raw?.info || raw?.description || parts.join(' · ');

  // Best image
  let image = FALLBACK_IMAGE;
  if (raw?.images?.length) {
    // Prefer 16:9 ratio images for OG
    const wide = raw.images.find(
      (img: { ratio?: string; width?: number }) => img.ratio === '16_9' && (img.width || 0) >= 640
    );
    image = wide?.url || raw.images[0]?.url || FALLBACK_IMAGE;
  }

  return { name, description: truncate(description, 200), venue, dateStr, image, id: eventId };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
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

function ogHtml({
  title,
  description,
  image,
  url,
  type = 'article',
}: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — ${SITE_NAME}</title>
  <meta name="description" content="${esc(description)}" />

  <!-- Open Graph -->
  <meta property="og:type"        content="${type}" />
  <meta property="og:url"         content="${esc(url)}" />
  <meta property="og:title"       content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image"       content="${esc(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt"   content="${esc(title)}" />
  <meta property="og:site_name"   content="${SITE_NAME}" />
  <meta property="og:locale"      content="en_US" />

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${esc(image)}" />

  <!-- Redirect real users to the SPA (bots stop here) -->
  <meta http-equiv="refresh" content="0;url=${esc(url)}" />
  <link rel="canonical" href="${esc(url)}" />
</head>
<body>
  <p>Redirecting to <a href="${esc(url)}">${esc(title)} on ABQ Unplugged</a>…</p>
</body>
</html>`;
}

// ── Edge Function handler ─────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Match /place/:id or /event/:id
  const placeMatch = path.match(/^\/place\/(.+)$/);
  const eventMatch = path.match(/^\/event\/(.+)$/);

  if (!placeMatch && !eventMatch) {
    // Not a share URL — pass through to SPA
    return;
  }

  const ua = req.headers.get('user-agent');

  if (placeMatch) {
    const placeId = decodeURIComponent(placeMatch[1]);
    const canonical = `${SITE}/place/${encodeURIComponent(placeId)}`;

    if (isBot(ua)) {
      const place = await fetchPlace(placeId);
      if (place) {
        return new Response(
          ogHtml({
            title: place.name + (place.category ? ` — ${place.category}` : ''),
            description: place.description,
            image: place.image,
            url: canonical,
          }),
          { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } }
        );
      }
    }

    // Real browser — let the SPA handle it (pass through to index.html via Netlify redirect)
    return;
  }

  if (eventMatch) {
    const eventId = decodeURIComponent(eventMatch[1]);
    const canonical = `${SITE}/event/${encodeURIComponent(eventId)}`;

    if (isBot(ua)) {
      const event = await fetchEvent(eventId);
      if (event) {
        const titleParts = [event.name];
        if (event.venue) titleParts.push(`at ${event.venue}`);
        return new Response(
          ogHtml({
            title: titleParts.join(' '),
            description: event.description,
            image: event.image,
            url: canonical,
            type: 'event',
          }),
          { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } }
        );
      }
    }

    return;
  }
}

// Tell Netlify which paths to intercept
export const config = {
  path: ['/place/*', '/event/*'],
};
