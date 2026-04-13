import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from './lib/supabase';
import { fetchEventsFromDB } from './lib/db';
import { ALL_EVENTS, type Event as StaticEvent } from './data/events';
import { ABQ_VENUES, getVenueBySlug, getVenueByLocation, slugifyVenue, type Venue } from './data/venues';
import AdminPanel from './AdminPanel';
import { loadPrefs as loadNotifPrefs, savePrefs as saveNotifPrefs, requestPermission, notificationsSupported, checkAndTriggerNotifications, subscribeToPush, NOTIF_LABELS, type NotificationPrefs } from './lib/notifications';

// ─── Scroll fade-in hook ─────────────────────────────────────────────
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = `opacity 0.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms`;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'none';
        io.disconnect();
      }
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return ref as React.RefObject<any>;
}

// ── Reusable one-shot typewriter hook ──────────────────────────────────────
function useTypewriter(text: string, startDelay = 400) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let i = 0;
    let current = '';
    const speed = () => 35 + Math.random() * 45;
    const tick = () => {
      if (cancelled) return;
      if (i < text.length) {
        current += text[i];
        i++;
        setDisplay(current);
        const delay = (text[i - 1] === ' ') ? speed() * 1.5 : speed();
        setTimeout(tick, delay);
      } else {
        setTimeout(() => { if (!cancelled) setDone(true); }, 600);
      }
    };
    setTimeout(tick, startDelay);
    return () => { cancelled = true; };
  }, [text]);
  return { display, done };
}


// Inject global keyframe for card fade-in (CSS-only, no JS observers)
if (typeof document !== 'undefined' && !document.getElementById('card-fade-style')) {
  const s = document.createElement('style');
  s.id = 'card-fade-style';
  s.textContent = '@keyframes cardFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes hoodBubble0 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-4px,2px)} 50%{transform:translate(3px,-1px)} 75%{transform:translate(-2px,-2px)} } @keyframes hoodBubble1 { 0%,100%{transform:translate(0,0)} 20%{transform:translate(3px,-3px)} 55%{transform:translate(-3px,2px)} 80%{transform:translate(2px,1px)} } @keyframes hoodBubble2 { 0%,100%{transform:translate(0,0)} 30%{transform:translate(-3px,-2px)} 60%{transform:translate(4px,1px)} 85%{transform:translate(-1px,3px)} } @keyframes hoodBubble3 { 0%,100%{transform:translate(0,0)} 35%{transform:translate(2px,3px)} 65%{transform:translate(-4px,-1px)} 90%{transform:translate(3px,-2px)} } @keyframes hoodBubble4 { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-2px,-3px)} 45%{transform:translate(3px,2px)} 70%{transform:translate(-3px,1px)} } @keyframes hoodBubble5 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(4px,-2px)} 70%{transform:translate(-2px,3px)} 85%{transform:translate(1px,-1px)} } @keyframes ptrSweep { 0%{background-position:-200% center} 100%{background-position:200% center} } @keyframes ptrDots { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} } @keyframes kenBurns0 { from { transform: scale(1.05) translate(0%,0%); } to { transform: scale(1.18) translate(-2%,-1%); } } @keyframes kenBurns1 { from { transform: scale(1.1) translate(-1%,1%); } to { transform: scale(1.2) translate(2%,-2%); } } @keyframes kenBurns2 { from { transform: scale(1.08) translate(1%,-1%); } to { transform: scale(1.18) translate(-1%,2%); } } @keyframes kenBurns3 { from { transform: scale(1.12) translate(-2%,0%); } to { transform: scale(1.05) translate(1%,-1%); } } @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } } @keyframes reminderSlideIn { from { opacity: 0; transform: translateY(-8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes heartPop { 0% { transform: scale(1); } 15% { transform: scale(1.35); } 30% { transform: scale(0.9); } 45% { transform: scale(1.15); } 60% { transform: scale(0.97); } 75% { transform: scale(1.05); } 100% { transform: scale(1); } } @keyframes heartParticles { 0% { opacity: 1; transform: scale(0.5); } 50% { opacity: 0.8; } 100% { opacity: 0; transform: scale(2.5); } } .like-btn-pop { animation: heartPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; } .like-btn-particles::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; background: radial-gradient(circle, var(--brand) 0%, transparent 70%); animation: heartParticles 0.5s ease-out forwards; pointer-events: none; z-index: -1; } .nav-press-btn:active { top: 4px !important; box-shadow: 0 1px 0 #0a0a0a, 0 0px 2px rgba(0,0,0,0.1) !important; } .haptic-switch { position:fixed; top:-9999px; left:-9999px; opacity:0; pointer-events:none; } @keyframes heroCardReveal { from { opacity:0; transform:translateY(10px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } } @keyframes heroImgZoom { from { transform:scale(1.08); } to { transform:scale(1.18); } } @keyframes heroTextSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } } @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }';
  document.head.appendChild(s);
}

// ─── Error Boundary ───────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error('[ABQ Error]', e.message, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error.message;
      return (
        <div style={{padding:'24px',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',background:'#F2F2F7',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{maxWidth:'480px',width:'100%',background:'#fff',borderRadius:'4px',padding:'28px',boxShadow:'4px 4px 0 rgba(0,0,0,0.12)'}}>
            <div style={{fontSize:'38px',marginBottom:'12px'}}>{'⚠️'}</div>
            <div style={{fontSize:'20px',fontWeight:700,color:'#1C1C1E',marginBottom:'8px'}}>Something went wrong</div>
            <div style={{fontSize:'13px',color:'#FF3B30',fontFamily:'monospace',background:'#FFF5F5',borderRadius:'10px',padding:'12px',overflowX:'auto',marginBottom:'16px',wordBreak:'break-word'}}>{msg}</div>
            <button onClick={() => window.location.reload()} style={{width:'100%',padding:'14px 24px',background:'#007AFF',color:'#fff',border:'none',borderRadius:'12px',fontSize:'17px',fontWeight:600,cursor:'pointer',minHeight:'50px'}}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Supabase compat helpers (replace Firebase Firestore API)
const _fbGetDoc = async (table: string, id: string, idField = 'id') => {
  const { data } = await (supabase.from as any)(table).select('*').eq(idField, id).single();
  return { data: () => data, exists: () => data !== null, id };
};
const _fbGetDocsByField = async (table: string, field: string, value: any) => {
  const { data } = await (supabase.from as any)(table).select('*').eq(field, value);
  return { docs: (data || []).map((d: any) => ({ id: d.id, data: () => d })), empty: !data?.length, size: data?.length || 0 };
};
const _fbGetAllDocs = async (table: string, orderCol?: string, orderAsc = true) => {
  let q = (supabase.from as any)(table).select('*');
  if (orderCol) q = q.order(orderCol, { ascending: orderAsc });
  const { data } = await q;
  return { docs: (data || []).map((d: any) => ({ id: d.id, data: () => d })), empty: !data?.length, size: data?.length || 0 };
};
const _fbSetDoc = async (table: string, id: string, docData: any, _opts?: any) => {
  await (supabase.from as any)(table).upsert({ id, ...docData }, { onConflict: 'id', ignoreDuplicates: false });
};
const _fbSetConfigDoc = async (key: string, value: any) => {
  await (supabase.from as any)('config').upsert({ key, value });
};
const _fbUpdateDoc = async (table: string, id: string, docData: any) => {
  await (supabase.from as any)(table).update(docData).eq('id', id);
};
const _fbAddDoc = async (table: string, docData: any) => {
  const { data } = await (supabase.from as any)(table).insert(docData).select().single();
  return { id: (data as any)?.id };
};
const _fbDeleteDoc = async (table: string, id: string, idField = 'id') => {
  await (supabase.from as any)(table).delete().eq(idField, id);
};


// ─── Analytics ───────────────────────────────────────────────────────────────
// Fire-and-forget: never awaited, never blocks render.

function getSessionId(): string {
  const KEY = 'abq_session_id';
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem(KEY, sid); } catch {}
  }
  return sid;
}

function getDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return 'tablet';
  if (/iPhone|Android.*Mobile/.test(ua)) return 'mobile';
  return 'desktop';
}

function playHaptic() {
  // Android / standard vibration API
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
  // iOS 18 switch trick — uses a hidden checkbox toggle to trigger haptic
  else {
    const label = document.getElementById('haptic-label');
    if (label) label.click();
  }
}

function trackEvent(eventType: string, data: Record<string, unknown> = {}) {
  try {
    (supabase.from as any)('analytics').insert({
      event_type: eventType,
      session_id: getSessionId(),
      data,
      device: getDevice(),
    }).then(() => {/* fire-and-forget */}).catch(() => {/* silent */});
  } catch {}
}

// ─── Global Error Tracking ──────────────────────────────────────────────────
// Captures unhandled errors and promise rejections to Supabase for debugging
(function initErrorTracking() {
  let errorCount = 0;
  const MAX_ERRORS_PER_SESSION = 20; // prevent runaway loops from flooding DB

  window.addEventListener('error', (e) => {
    if (++errorCount > MAX_ERRORS_PER_SESSION) return;
    trackEvent('client_error', {
      message: e.message || 'Unknown error',
      source: e.filename || '',
      line: e.lineno || 0,
      col: e.colno || 0,
      stack: e.error?.stack?.slice(0, 500) || '',
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    if (++errorCount > MAX_ERRORS_PER_SESSION) return;
    const reason = e.reason;
    trackEvent('client_error', {
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack?.slice(0, 500) || '',
      type: 'unhandledrejection',
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });
})();


// ─── Types ──────────────────────────────────────────────────────────────────


interface TMImage {
  url: string;
  width?: number;
  height?: number;
  ratio?: string;
  fallback?: boolean;
}

interface TMEvent {
  id: string;
  name: string;
  url?: string;
  _source?: string;
  _isAdult?: boolean;   // flagged as 21+ / adult content — hidden by default
  info?: string;        // event description / additional info from Ticketmaster
  pleaseNote?: string;  // important notices (age, bags, weather policy, etc.)
  ticketLinks?: Array<{ source: string; url: string }>;
  images?: TMImage[];
  dates?: {
    start?: { localDate?: string; localTime?: string };
  };
  seatmap?: { staticUrl?: string };
  ageRestrictions?: { legalAgeEnforced?: boolean };
  accessibility?: { ticketLimit?: number };
  promoter?: { name?: string };
  _embedded?: {
    venues?: Array<{
      name?: string;
      url?: string;
      address?: { line1?: string };
      city?: { name?: string };
      location?: { longitude?: string; latitude?: string };
      generalInfo?: { childRule?: string; generalRule?: string };
      boxOfficeInfo?: {
        phoneNumberDetail?: string;
        openHoursDetail?: string;
        willCallDetail?: string;
        acceptedPaymentDetail?: string;
      };
      parkingDetail?: string;
      accessibleSeatingDetail?: string;
    }>;
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
  }>;
  _aiEnrichment?: {
    about?: string;          // 1-2 sentence blurb about the artist/event
    highlights?: string[];   // 2-3 interesting facts / what to expect
    venue_tips?: string;     // parking, transit, arrival tips
    local_tips?: string;     // ABQ-specific before/after tips
  } | null;
  _movieMeta?: {
    rating?: string;     // MPAA rating: G, PG, PG-13, R, NC-17
    runtime?: string;    // "2h 15m"
    genre?: string;      // "Horror / Comedy"
    theaters?: string[]; // ABQ theater names where it's showing
    endDate?: string;    // last day showing
  };
}

interface GeoCoords { lat: number; lng: number; }

interface Review {
  id: string;
  placeId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: Timestamp | null;
  helpful: number;
}

// ─── Adult / junk content detection ─────────────────────────────────────────
const ADULT_NAME_KEYWORDS = [
  'drag', 'burlesque', '21+', '18+', 'adults only', 'adult comedy',
  'late night', 'hookah', 'bar crawl', 'girls night out', 'hunks',
  'strip', 'cabaret', 'bingo loco', 'sochial', 'speakeasy', 'nude',
];
const ADULT_VENUE_KEYWORDS = [
  'albuquerque social club', 'abq social club',
];
// Ticketmaster sometimes inserts garbage placeholder / parking entries
const JUNK_NAME_PATTERNS = [
  /pss vip parking/i, /non-manifested shell event/i,
  /gift cards?$/i, /replica game ball/i,
  // Season-ticket / deposit placeholder events (not real discrete events)
  /\bseason\s+(ticket|pass)\b/i, /\bdeposits?\b/i,
  /\b(amp\.?|amphitheater)\s+series\b/i,
  /\bpremium\s+season\b/i,
  // Souvenir-only listings (not a real event entry)
  /souvenir\s+ticket/i,
  // VIP upgrade listings that duplicate the main event
  /\bvip\s+upgrade\b/i, /\bvip\s+package\b/i,
];

function tagAdultEvent(ev: TMEvent): TMEvent {
  const name  = (ev.name || '').toLowerCase();
  const venue = (ev._embedded?.venues?.[0]?.name || '').toLowerCase();
  if (
    ADULT_NAME_KEYWORDS.some(k => name.includes(k)) ||
    ADULT_VENUE_KEYWORDS.some(k => venue.includes(k))
  ) {
    return { ...ev, _isAdult: true };
  }
  return ev;
}
function isJunkEvent(ev: TMEvent): boolean {
  return JUNK_NAME_PATTERNS.some(p => p.test(ev.name || ''));
}

// ─── Static event → TMEvent adapter ────────────────────────────────────────
// Generic/search-page URLs that don't link to a specific event.
// When detected, we replace with a Google search so users land on the real event page.
const GENERIC_URL_PATTERNS = [
  /^https?:\/\/[^/]+\/?$/,                        // root domain only (bandsintown.com, casadebenavidez.com)
  /eventbrite\.com\/d\//,                          // Eventbrite search/directory pages
  /fandango\.com\/.*_movietimes/,                  // Fandango generic showtimes
  /\/events\/?$/,                                  // generic /events/ listing pages
];
function resolveEventUrl(raw: string | undefined, title: string, location?: string): string | undefined {
  if (!raw) return undefined;
  if (GENERIC_URL_PATTERNS.some(p => p.test(raw))) {
    // Replace with a targeted Google search that will find the specific event
    const q = [title, location, 'Albuquerque', 'tickets'].filter(Boolean).join(' ');
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }
  return raw;
}

function staticEventToTMEvent(ev: StaticEvent): TMEvent {
  const toLocal24h = (t?: string): string | undefined => {
    if (!t) return undefined;
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return undefined;
    let h = parseInt(m[1]);
    const min = m[2];
    const period = m[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${min}`;
  };
  // Determine ticket link label based on source
  const isFreeInfo = ['ABQToDo', 'City of ABQ', 'ABQ365', 'Visit ABQ', 'Old Town ABQ', 'Downtown ABQ'].includes(ev.source || '');
  const resolvedUrl = resolveEventUrl(ev.ticketUrl || ev.website, ev.title, ev.location);
  const tm: TMEvent = {
    id: ev.id,
    name: ev.title,
    url: resolvedUrl,
    _source: isFreeInfo ? 'local' : (ev.source || '').toLowerCase().replace(/\s+/g, ''),
    _isAdult: ev.is21Plus === true || undefined,
    info: ev.description || undefined,
    pleaseNote: ev.pleaseNote || undefined,
    images: ev.image
      ? [{ url: ev.image, width: 1600, height: 900 }, ...(ev.additionalImages ?? []).map(u => ({ url: u }))]
      : undefined,
    dates: {
      start: {
        localDate: ev.date,
        localTime: toLocal24h(ev.time),
      },
    },
    _embedded: {
      venues: [{
        name: ev.location || undefined,
        address: ev.address ? { line1: ev.address } : undefined,
        city: { name: 'Albuquerque' },
      }],
    },
    classifications: ev.category ? [{ segment: { name: ev.category }, genre: { name: ev.category } }] : undefined,
    priceRanges: (ev.priceNum !== undefined && ev.priceNum > 0)
      ? [{ min: ev.priceNum, max: ev.priceNum, currency: 'USD' }]
      : undefined,
    _movieMeta: (ev.movieRating || ev.movieRuntime || ev.movieGenre || ev.theaters)
      ? { rating: ev.movieRating, runtime: ev.movieRuntime, genre: ev.movieGenre, theaters: ev.theaters, endDate: ev.endDate }
      : undefined,
  };
  return tm;
}

// Pre-convert all static events once (filter out today-or-past at load time)
const TODAY = new Date().toISOString().split('T')[0];
const STATIC_TM_EVENTS: TMEvent[] = ALL_EVENTS
  .filter(ev => (ev.endDate ?? ev.date) >= TODAY)
  .map(staticEventToTMEvent);

// ─── Utilities ──────────────────────────────────────────────────────────────


// ─── Yelp Photo Map (loaded once at startup) ────────────────────────────────
// Keyed by place name → { source, bizUrl, photos[] }
// Stored separately from Google "image" field so neither source overwrites the other.



function decodeEntities(str: string): string {
  if (!str || !str.includes('&')) return str;
  // textarea safely decodes HTML entities without executing any markup
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

function hiResUrl(url: string): string {
  if (!url) return url;
  // Fix Google Places photo URLs missing their API key
  
  
  return url
    .replace(/maxHeightPx=\d+/, 'maxHeightPx=1600')
    .replace(/maxWidthPx=\d+/, 'maxWidthPx=2000');
}

function getBestEventImage(images?: TMImage[], preferThumbnail = false): string {
  if (!images || images.length === 0) return '';
  const nonFallback = images.filter(img => !img.fallback);
  const pool = nonFallback.length > 0 ? nonFallback : images;
  if (preferThumbnail) {
    // For list views: pick smallest image >= 200px wide to save bandwidth
    const small = pool.filter(i => (i.width || 0) >= 200 && (i.width || 0) <= 500);
    if (small.length > 0) return small[0].url || '';
  }
  // For detail views: pick largest image
  let best = pool[0];
  for (let i = 1; i < pool.length; i++) {
    if (((pool[i].width || 0) * (pool[i].height || 0)) > ((best.width || 0) * (best.height || 0))) {
      best = pool[i];
    }
  }
  return best?.url || '';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':').map(Number);
  const h = parts[0]; const m = parts[1] ?? 0;
  if (isNaN(h) || h < 0 || h > 23) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getEventCategory(event: TMEvent): string {
  // Events are pre-classified in Supabase with one of 10 canonical categories:
  // Concerts, Music, Dance, Theatre, Comedy, Sports, Arts, Family, Free, Community
  const seg = (event.classifications?.[0]?.segment?.name || '').trim();
  const VALID_CATS = ['Concerts', 'Music', 'Dance', 'Theatre', 'Comedy', 'Sports', 'Arts', 'Family', 'Free', 'Community'];
  if (VALID_CATS.includes(seg)) return seg;
  // Legacy fallback for any events not yet reclassified
  if (seg === 'Arts & Theatre') return 'Arts';
  if (seg === 'Volunteer' || seg === 'Outdoor') return 'Community';
  if (seg === 'Film') return 'Community';
  if (seg === 'Concert' || seg === 'Music') return 'Concerts';
  if (seg === 'Sports') return 'Sports';
  return 'Community';
}

function getEventSubGenre(event: TMEvent): string {
  return (event.classifications?.[0]?.genre?.name || '').trim() || 'Other';
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(miles: number): string {
  if (miles < 0.1) return 'Here!';
  if (miles < 1) return `${(Math.round(miles * 10) / 10).toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function getLevel(count: number): { label: string; emoji: string; next: number } {
  if (count >= 50) return { label: 'Legend',     emoji: '★',  next: count }; // max level
  if (count >= 35) return { label: 'Pioneer',    emoji: '◆',  next: 50 };
  if (count >= 20) return { label: 'Trailblazer',emoji: '◇',  next: 35 };
  if (count >= 10) return { label: 'Adventurer', emoji: '✦',  next: 20 };
  if (count >= 5)  return { label: 'Explorer',   emoji: '⚡', next: 10 };
  return                 { label: 'Newcomer',    emoji: '✿',  next: 5 };
}

// ─── Profanity Filter ────────────────────────────────────────────────────────

// Each entry: [regex pattern, [funny alt1, funny alt2, funny alt3]]
// Alternatives are chosen to be genuinely funny while staying PG
const PROFANITY_ALTS: Array<[RegExp, string[]]> = [
  [/\bf+u+c+k+\b/gi,           ['fudge', 'forget', 'flip']],
  [/\bsh[i1!]+t+\b/gi,         ['shoot', 'sugar', 'shucks']],
  [/\ba+s+h+o+l+e+\b/gi,       ['armadillo', 'ankle', 'aardvark']],
  [/\ba+s+s+\b/gi,              ['donkey', 'bottom', 'bum']],
  [/\bb+i+t+c+h+\b/gi,         ['witch', 'beach', 'bench']],
  [/\bd+a+m+n+\b/gi,            ['darn', 'dang', 'drat']],
  [/\bh+e+l+l+\b/gi,            ['heck', 'the bad place', 'Hades']],
  [/\bc+r+a+p+\b/gi,            ['crud', 'garbage', 'rubbish']],
  [/\bs+u+c+k+s?\b/gi,          ['stinks', 'disappoints', 'bums me out']],
  [/\bb+a+s+t+a+r+d+\b/gi,     ['rascal', 'scoundrel', 'rapscallion']],
  [/\bp+i+s+s+\b/gi,            ['tinkle', 'mist', 'sprinkle']],
  [/\bd+i+c+k+\b/gi,            ['pickle', 'dude', 'Richard']],
  [/\bc+o+c+k+\b/gi,            ['rooster', 'cockatoo', 'weathervane']],
  [/\bb+u+l+l+s+h+i+t+\b/gi,   ['baloney', 'hogwash', 'poppycock']],
  [/\bm+o+t+h+e+r+f+\w+\b/gi,  ['motherfudger', 'full of malarkey', 'incredibly frustrated person']],
  [/\bw+t+f+\b/gi,              ['what the fudge', 'wow that\'s fishy', 'well that\'s funny']],
  [/\bstfu\b/gi,                ['zip it please', 'kindly hush', 'shhh friend']],
  [/\bpos\b/gi,                  ['not great', 'lacking', 'a bit rubbish']],
  [/\bffs\b/gi,                  ['for fudge\'s sake', 'oh come on', 'really though']],
  [/\bomfg\b/gi,                 ['oh my goodness', 'oh my gosh', 'oh my gravy']],
];

interface ProfanityMatch { found: string; alts: string[]; }

function checkProfanity(text: string): ProfanityMatch | null {
  for (const [pattern, alts] of PROFANITY_ALTS) {
    const match = text.match(pattern);
    if (match) return { found: match[0], alts };
  }
  return null;
}

// ─── Geolocation Hook ────────────────────────────────────────────────────────

const GEO_GRANTED_KEY = 'abq_geo_granted';

function useGeolocation() {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  // True while silently re-fetching on page load for a user who already granted.
  // During this window we hide the banner entirely instead of flashing "Enable".
  const [silentPending, setSilentPending] = useState(() => {
    try { return localStorage.getItem(GEO_GRANTED_KEY) === 'true'; } catch { return false; }
  });

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }
    setRequested(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSilentPending(false);
        try { localStorage.setItem(GEO_GRANTED_KEY, 'true'); } catch {}
        trackEvent('location_granted');
      },
      err => {
        setSilentPending(false);
        setError(err.message);
        // Clear saved grant if user denied / revoked
        if (err.code === 1 /* PERMISSION_DENIED */) {
          try { localStorage.removeItem(GEO_GRANTED_KEY); } catch {}
          trackEvent('location_denied');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Auto-request on mount if user previously granted permission
  useEffect(() => {
    const previouslyGranted = (() => {
      try { return localStorage.getItem(GEO_GRANTED_KEY) === 'true'; } catch { return false; }
    })();
    if (previouslyGranted) {
      // Use Permissions API if available for a faster no-prompt check
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(result => {
          if (result.state === 'granted') request();
          else if (result.state === 'denied') {
            try { localStorage.removeItem(GEO_GRANTED_KEY); } catch {}
          }
        }).catch(() => request()); // fallback: just try
      } else {
        request();
      }
    }
  }, [request]);

  return { coords, error, requested, silentPending, request };
}

// ─── Check-In Storage ────────────────────────────────────────────────────────


// ─── Typographic Logo — Urban Curator style ──────────────────────────────────
// "ABQ" on neon-moss lime block  +  "UNPLUGGED" in heavy Epilogue caps
// Matches the brutalist mockup: boxed accent word + uppercase tracking label

function ABQUnpluggedLogo({ size = 43 }: { size?: number }) {
  const blockH   = Math.round(size * 0.72);          // height of the ABQ block
  const abqSize  = Math.round(blockH * 0.62);        // ABQ font size
  const unplSize = Math.round(blockH * 0.38);        // UNPLUGGED font size
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
      {/* Lime accent block */}
      <div style={{
        background: 'var(--brand)',
        padding: `2px ${Math.round(blockH * 0.28)}px`,
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid rgba(0,0,0,0.12)',
      }}>
        <span style={{
          fontFamily: 'Public Sans, sans-serif',
          fontWeight: 900,
          fontSize: `${abqSize}px`,
          color: 'var(--ink)',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>ABQ</span>
      </div>
      {/* Wordmark */}
      <span style={{
        fontFamily: 'Public Sans, sans-serif',
        fontWeight: 900,
        fontSize: `${unplSize}px`,
        color: 'var(--ink)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>UNPLUGGED</span>
    </div>
  );
}

// ─── ImageWithFallback ──────────────────────────────────────────────────────

const FALLBACK_GRADIENTS = [
  'var(--brand-gradient)',
  'linear-gradient(135deg,#1a3a2a,#2d8659)',
  'linear-gradient(135deg,#1a2a4a,#3b82f6)',
  'linear-gradient(135deg,#4a1a3a,#c026d3)',
  'linear-gradient(135deg,#3a2a1a,#d97706)',
  'linear-gradient(135deg,#1a3a3a,#0d9488)',
];

function hashGradient(name?: string): string {
  if (!name) return FALLBACK_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return FALLBACK_GRADIENTS[Math.abs(h) % FALLBACK_GRADIENTS.length];
}

function ImageWithFallback({
  src, alt, className, gradient, showLabel,
}: {
  src?: string; alt?: string; className?: string; gradient?: string; showLabel?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const resolvedSrc = src ? hiResUrl(src) : '';
  const bg = gradient || hashGradient(alt);

  // Category-specific fallback icons
  const fallbackIcon = (() => {
    const n = (alt || '').toLowerCase();
    if (n.includes('park') || n.includes('trail') || n.includes('bosque')) return '🌳';
    if (n.includes('coffee') || n.includes('cafe')) return '☕';
    if (n.includes('restaurant') || n.includes('food') || n.includes('grill')) return '🍽️';
    if (n.includes('bar') || n.includes('brewery') || n.includes('taproom')) return '🍸';
    if (n.includes('museum') || n.includes('gallery')) return '🏛️';
    if (n.includes('gym') || n.includes('fitness')) return '💪';
    return '📍';
  })();

  if (!resolvedSrc || error) {
    return (
      <div
        className={className}
        style={{ background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
        aria-label={alt}
      >
        <span style={{ fontSize: '32px', opacity: 0.3 }}>{fallbackIcon}</span>
        {showLabel && alt && (
          <span style={{ position: 'absolute', bottom: 8, left: 8, right: 8, color: 'rgba(255,255,255,0.7)', fontFamily: 'Public Sans, sans-serif', fontWeight: 700, fontSize: '12px', textAlign: 'center', lineHeight: 1.2 }}>
            {alt}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', background: bg }}>
      {/* Skeleton shimmer while loading */}
      {!loaded && (
        <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      )}
      <img
        src={resolvedSrc}
        alt={alt || ''}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(1.05)',
          filter: loaded ? 'blur(0)' : 'blur(8px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease',
        }}
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          const img = e.currentTarget;
          // Google returns a tiny map-tile placeholder (~100×100) when the
          // photo_reference is expired or invalid. Treat anything under 150px
          // wide as a broken image so the gradient fallback shows instead.
          if (img.naturalWidth > 0 && img.naturalWidth < 150) {
            setError(true);
          } else {
            setLoaded(true);
          }
        }}
        onError={() => setError(true)}
      />
    </div>
  );
}

// ─── Category Data ──────────────────────────────────────────────────────────


// Category display name mapping (shows friendlier labels to users)


// Category badge color mapping


const EVENT_GENRES = [
  'All', 'Tonight', 'This Weekend', '❤️ For You', 'Concerts', 'Music', 'Dance', 'Theatre', 'Comedy', 'Sports', 'Arts', 'Family', 'Free', 'Community',
];

const FOLLOWING_KEY = 'abq_following_genres';
function getFollowedGenres(): string[] {
  try { const raw = localStorage.getItem(FOLLOWING_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveFollowedGenres(genres: string[]) {
  try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(genres)); } catch {}
}

// Canonical category colors (used for sub-genre pill row and section headers)
const CAT_COLORS_MAP: Record<string, string> = {
  'Concerts': '#7C3AED', 'Music': '#8B3A0F', 'Dance': '#BE185D',
  'Theatre': '#6D28D9', 'Comedy': '#B45309', 'Sports': '#1D4ED8',
  'Arts': '#7C2D12', 'Family': '#047857', 'Free': '#0F766E',
  'Community': '#0E7490',
};

// Per-category icon and gradient for event cards
const EVENT_TYPE_META: Record<string, { icon: string; bg: string }> = {
  'Music':          { icon: 'music',         bg: 'linear-gradient(135deg,#8B3A0F,#c0552a)' },
  'Concerts':       { icon: 'concert',       bg: 'linear-gradient(135deg,#5B21B6,#7C3AED)' },
  'Dance':          { icon: 'dance',         bg: 'linear-gradient(135deg,#9D174D,#DB2777)' },
  'Theatre':        { icon: 'theatre',       bg: 'linear-gradient(135deg,#4C1D95,#7C3AED)' },
  'Sports':         { icon: 'sports',        bg: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
  'Arts':           { icon: 'art',           bg: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
  'Arts & Theatre': { icon: 'theatre',       bg: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
  'Comedy':         { icon: 'comedy',        bg: 'linear-gradient(135deg,#b45309,#d97706)' },
  'Family':         { icon: 'family',        bg: 'linear-gradient(135deg,#047857,#10b981)' },
  'Outdoor':        { icon: 'outdoor',       bg: 'linear-gradient(135deg,#065f46,#059669)' },
  'Community':      { icon: 'community',     bg: 'linear-gradient(135deg,#0e7490,#06b6d4)' },
  'Festival':       { icon: 'festival',      bg: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  'Film':           { icon: 'film',          bg: 'linear-gradient(135deg,#1f2937,#4b5563)' },
  'Movie':          { icon: 'film',          bg: 'linear-gradient(135deg,#1f2937,#4b5563)' },
  'Free':           { icon: 'free',          bg: 'linear-gradient(135deg,#047857,#10b981)' },
  'Volunteer':      { icon: 'volunteer',     bg: 'linear-gradient(135deg,#be185d,#ec4899)' },
  'Event':          { icon: 'event',         bg: 'linear-gradient(135deg,var(--ink),#374151)' },
};

function getEventTypeMeta(event: TMEvent): { icon: string; bg: string } {
  const cat = getEventCategory(event);
  if (EVENT_TYPE_META[cat]) return EVENT_TYPE_META[cat];
  const name = event.name.toLowerCase();
  if (name.includes('comedy') || name.includes('stand-up')) return EVENT_TYPE_META['Comedy'];
  if (name.includes('family') || name.includes('kids')) return EVENT_TYPE_META['Family'];
  if (name.includes('outdoor') || name.includes('hike') || name.includes('trail') || name.includes('run')) return EVENT_TYPE_META['Outdoor'];
  if (name.includes('festival') || name.includes('fiesta')) return EVENT_TYPE_META['Festival'];
  if (name.includes('film') || name.includes('movie') || name.includes('cinema')) return EVENT_TYPE_META['Film'];
  if (name.includes('art') || name.includes('gallery') || name.includes('museum')) return EVENT_TYPE_META['Arts'];
  return EVENT_TYPE_META['Event'];
}

// ─── Flat SVG Icon System ─────────────────────────────────────────────────────
const FlatIcon = React.memo(function FlatIcon({
  name, size = 14, color = 'var(--ink)',
}: { name: string; size?: number; color?: string }) {
  const S = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  const F = { fill: color, stroke: 'none' as const };
  const map: Record<string, React.ReactNode> = {
    // Event type icons
    music:         <><polyline points="7.5,12 7.5,4 13,4 13,10" {...S}/><circle cx="5.5" cy="12" r="2" {...F}/><circle cx="11" cy="10" r="2" {...F}/></>,
    concert:       <><rect x="5.5" y="1.5" width="5" height="7" rx="2.5" {...S}/><path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" {...S}/><line x1="8" y1="13" x2="8" y2="14.5" {...S}/><line x1="5.5" y1="14.5" x2="10.5" y2="14.5" {...S}/></>,
    sports:        <><path d="M5 3h6v4c0 2.8-1.3 4-3 4s-3-1.2-3-4Z" {...S}/><path d="M5 5H3.5a1.5 1.5 0 0 0 0 3H5" {...S}/><path d="M11 5h1.5a1.5 1.5 0 0 1 0 3H11" {...S}/><line x1="8" y1="11" x2="8" y2="13.5" {...S}/><line x1="5.5" y1="13.5" x2="10.5" y2="13.5" {...S}/></>,
    comedy:        <><circle cx="8" cy="8" r="6" {...S}/><path d="M5.5 9.5Q8 12 10.5 9.5" {...S}/><circle cx="6" cy="7" r="0.8" {...F}/><circle cx="10" cy="7" r="0.8" {...F}/></>,
    art:           <><path d="M8 2a6 6 0 1 0 5.2 9" {...S}/><path d="M13.5 9.5c1.5-1 1.5-2.5 0-2.5s-1.5 2.5 0 2.5Z" {...F}/><circle cx="5.5" cy="6.5" r="1" {...F}/><circle cx="9.5" cy="5" r="1" {...F}/><circle cx="11" cy="9" r="1" {...F}/></>,
    theatre:       <><path d="M2 5.5c0 2.5 2 4.5 4.5 4.5S11 8 11 5.5L6.5 3Z" {...S}/><path d="M5 7.5c.5.7 1.5.7 2 0" {...S}/><circle cx="12" cy="10.5" r="3" {...S}/><path d="M10.5 12c.5-.8 1.5-.8 2 0" {...S}/></>,
    dance:         <><circle cx="8" cy="2.5" r="1.5" {...S}/><line x1="8" y1="4" x2="8" y2="9" {...S}/><path d="M5 6.5l3 1.5 4.5-1" {...S}/><line x1="8" y1="9" x2="5.5" y2="13.5" {...S}/><line x1="8" y1="9" x2="11" y2="12.5" {...S}/></>,
    family:        <><circle cx="4.5" cy="4" r="1.5" {...S}/><path d="M2.5 8.5c0-2 4-2 4 0" {...S}/><circle cx="11.5" cy="4" r="1.5" {...S}/><path d="M9.5 8.5c0-2 4-2 4 0" {...S}/><circle cx="8" cy="6.5" r="1.2" {...S}/><path d="M6 11c0-1.8 4-1.8 4 0" {...S}/></>,
    outdoor:       <><path d="M1 14L6 6l5 8Z" {...S}/><path d="M6 14l4-6 4 6Z" {...S}/><circle cx="13.5" cy="3.5" r="1.5" {...S}/></>,
    community:     <><circle cx="8" cy="5" r="2" {...S}/><path d="M4 14c0-2.5 8-2.5 8 0" {...S}/><circle cx="3" cy="7" r="1.5" {...S}/><path d="M1 13c0-2 4-2 4 0" {...S}/><circle cx="13" cy="7" r="1.5" {...S}/><path d="M11 13c0-2 4-2 4 0" {...S}/></>,
    festival:      <><path d="M8 2l1.6 4.5H15l-4 2.9 1.5 4.6L8 11.2l-4.5 2.8L5 9.4 1 6.5h5.4Z" {...S}/></>,
    film:          <><rect x="2" y="4" width="12" height="8" rx="1" {...S}/><line x1="2" y1="6.5" x2="14" y2="6.5" {...S}/><line x1="2" y1="9.5" x2="14" y2="9.5" {...S}/><line x1="4.5" y1="4" x2="4.5" y2="6.5" {...S}/><line x1="11.5" y1="4" x2="11.5" y2="6.5" {...S}/><line x1="4.5" y1="9.5" x2="4.5" y2="12" {...S}/><line x1="11.5" y1="9.5" x2="11.5" y2="12" {...S}/></>,
    free:          <><rect x="2" y="4" width="12" height="8" rx="1" {...S}/><path d="M5.5 7v3M5.5 7h2c.8 0 .8 2 0 2H5.5" {...S}/><line x1="10.5" y1="7" x2="10.5" y2="10" {...S}/></>,
    volunteer:     <><path d="M6 9V5.5a1 1 0 0 1 2 0V9" {...S}/><path d="M8 8V5a1 1 0 0 1 2 0v3" {...S}/><path d="M10 8.5V6.5a1 1 0 0 1 2 0v2c0 3-2 5-4 5s-4-2-4-5V7a1 1 0 0 1 2 0v2" {...S}/></>,
    event:         <><rect x="2" y="3" width="12" height="11" rx="1" {...S}/><line x1="2" y1="7" x2="14" y2="7" {...S}/><line x1="5" y1="1.5" x2="5" y2="4.5" {...S}/><line x1="11" y1="1.5" x2="11" y2="4.5" {...S}/><circle cx="5" cy="10.5" r="0.8" {...F}/><circle cx="8" cy="10.5" r="0.8" {...F}/><circle cx="11" cy="10.5" r="0.8" {...F}/></>,
    // Place category icons
    food:          <><line x1="5.5" y1="2" x2="5.5" y2="8" {...S}/><path d="M4 3v4a1.5 1.5 0 0 0 3 0V3" {...S}/><line x1="5.5" y1="8" x2="5.5" y2="14" {...S}/><line x1="11" y1="2" x2="11" y2="14" {...S}/><path d="M9 2L13 5M9 8h4" {...S}/></>,
    coffee:        <><path d="M4 5h8l-1 7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" {...S}/><path d="M12 7h1.5a1.5 1.5 0 0 1 0 3H12" {...S}/><path d="M7 2q1-1.5 2 0" {...S}/></>,
    beer:          <><path d="M4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4Z" {...S}/><path d="M12 7h1.5a1.5 1.5 0 0 1 0 3H12" {...S}/><line x1="4" y1="6" x2="12" y2="6" {...S}/></>,
    park:          <><circle cx="8" cy="6.5" r="4" {...S}/><line x1="8" y1="10.5" x2="8" y2="14" {...S}/><line x1="5.5" y1="14" x2="10.5" y2="14" {...S}/></>,
    fitness:       <><line x1="4.5" y1="8" x2="11.5" y2="8" {...S}/><rect x="1.5" y="6" width="3" height="4" rx="0.5" {...S}/><rect x="11.5" y="6" width="3" height="4" rx="0.5" {...S}/><rect x="4.5" y="5" width="2" height="6" rx="0.5" {...S}/><rect x="9.5" y="5" width="2" height="6" rx="0.5" {...S}/></>,
    shop:          <><rect x="3" y="6" width="10" height="8" rx="1" {...S}/><path d="M5.5 6C5.5 3.5 10.5 3.5 10.5 6" {...S}/><line x1="5.5" y1="9.5" x2="10.5" y2="9.5" {...S}/></>,
    entertainment: <><path d="M8 2l1.6 4.5H15l-4 2.9 1.5 4.6L8 11.2l-4.5 2.8L5 9.4 1 6.5h5.4Z" {...S}/></>,
    museum:        <><path d="M2 6L8 2l6 4" {...S}/><line x1="2" y1="6" x2="14" y2="6" {...S}/><line x1="2" y1="14" x2="14" y2="14" {...S}/><line x1="4.5" y1="6" x2="4.5" y2="14" {...S}/><line x1="8" y1="6" x2="8" y2="14" {...S}/><line x1="11.5" y1="6" x2="11.5" y2="14" {...S}/></>,
    hotel:         <><rect x="3" y="2" width="10" height="12" {...S}/><line x1="3" y1="9" x2="13" y2="9" {...S}/><rect x="7" y="9" width="2" height="5" {...S}/><rect x="5" y="4" width="1.5" height="2" {...S}/><rect x="9.5" y="4" width="1.5" height="2" {...S}/><rect x="5" y="6.5" width="1.5" height="2" {...S}/><rect x="9.5" y="6.5" width="1.5" height="2" {...S}/></>,
    grid:          <><rect x="2" y="2" width="5" height="5" rx="0.5" {...S}/><rect x="9" y="2" width="5" height="5" rx="0.5" {...S}/><rect x="2" y="9" width="5" height="5" rx="0.5" {...S}/><rect x="9" y="9" width="5" height="5" rx="0.5" {...S}/></>,
    // ABQ fact & quote icons
    mountain:      <><path d="M1 14L7 5l6 9Z" {...S}/><path d="M7 14l4-5.5 4 5.5Z" {...S}/></>,
    sun:           <><circle cx="8" cy="8" r="3" {...S}/><line x1="8" y1="1.5" x2="8" y2="3.5" {...S}/><line x1="8" y1="12.5" x2="8" y2="14.5" {...S}/><line x1="1.5" y1="8" x2="3.5" y2="8" {...S}/><line x1="12.5" y1="8" x2="14.5" y2="8" {...S}/><line x1="3.4" y1="3.4" x2="4.8" y2="4.8" {...S}/><line x1="11.2" y1="11.2" x2="12.6" y2="12.6" {...S}/><line x1="12.6" y1="3.4" x2="11.2" y2="4.8" {...S}/><line x1="4.8" y1="11.2" x2="3.4" y2="12.6" {...S}/></>,
    balloon:       <><ellipse cx="8" cy="7" rx="4.5" ry="5" {...S}/><rect x="6.5" y="12.5" width="3" height="1.5" rx="0.3" {...S}/><line x1="7" y1="12.5" x2="6.5" y2="10.5" {...S}/><line x1="9" y1="12.5" x2="9.5" y2="10.5" {...S}/></>,
    history:       <><path d="M5 2.5v11c0 0 2-1 6 0V2.5c-4-1-6 0-6 0Z" {...S}/><line x1="7" y1="5.5" x2="9" y2="5.5" {...S}/><line x1="7" y1="7.5" x2="9" y2="7.5" {...S}/><line x1="7" y1="9.5" x2="9" y2="9.5" {...S}/></>,
    wave:          <><path d="M1 7.5C3 5.5 5 10 7 8c2-2 4 2.5 6 .5 1.5-1.5 2-1 2-1" {...S}/><path d="M1 11C3 9 5 13.5 7 11.5c2-2 4 2.5 6 .5 1.5-1.5 2-1 2-1" {...S}/></>,
    bird:          <><path d="M1 8C4 7 7 9 8 9C9 9 12 7 15 7" {...S}/><path d="M8 9v5" {...S}/><path d="M1.5 6.5C2.5 5.5 4.5 5.5 5.5 6" {...S}/></>,
    road:          <><path d="M4 14L6 2h4l2 12Z" {...S}/><line x1="8" y1="4" x2="8" y2="6.5" {...S}/><line x1="8" y1="8.5" x2="8" y2="11" {...S}/></>,
    gem:           <><path d="M4 6L8 2l4 4-4 8Z" {...S}/><line x1="4" y1="6" x2="12" y2="6" {...S}/></>,
    science:       <><circle cx="8" cy="8" r="2.5" {...S}/><ellipse cx="8" cy="8" rx="6.5" ry="2.5" {...S}/><ellipse cx="8" cy="8" rx="2.5" ry="6.5" {...S}/></>,
    rocket:        <><path d="M8 2c-2 3-3 6.5-3 9l3 3 3-3c0-2.5-1-6-3-9Z" {...S}/><circle cx="8" cy="7.5" r="1.5" {...S}/><path d="M5 11L3 13" {...S}/><path d="M11 11l2 2" {...S}/></>,
    leaf:          <><path d="M3 13C3 13 5 6 13 3c0 0-3 8-10 10Z" {...S}/><line x1="3" y1="13" x2="11" y2="5" {...S}/></>,
    book:          <><path d="M4 2v11.5s3-1 4 0V2C6 1 4 2 4 2Z" {...S}/><path d="M8 2v11.5s3-1 4 0V2C10 1 8 2 8 2Z" {...S}/></>,
    bicycle:       <><circle cx="4.5" cy="10.5" r="2.5" {...S}/><circle cx="11.5" cy="10.5" r="2.5" {...S}/><path d="M4.5 10.5L7.5 5l4 5.5" {...S}/><line x1="7.5" y1="5" x2="9.5" y2="5" {...S}/></>,
    moon:          <><path d="M12.5 10C10 13.5 4 13 3 9a6 6 0 0 1 9.5-7A5 5 0 0 0 12.5 10Z" {...F}/></>,
    cactus:        <><line x1="8" y1="14" x2="8" y2="3" {...S}/><path d="M8 7H5v3" {...S}/><path d="M8 9h3v3" {...S}/></>,
    building:      <><rect x="3" y="2" width="10" height="12" {...S}/><line x1="3" y1="7" x2="13" y2="7" {...S}/><line x1="7" y1="2" x2="7" y2="14" {...S}/><line x1="11" y1="2" x2="11" y2="14" {...S}/><rect x="7" y="10" width="2" height="4" {...S}/></>,
    sprout:        <><line x1="8" y1="14" x2="8" y2="6" {...S}/><path d="M8 10C8 7 5 5 2 6" {...S}/><path d="M8 8C8 5 11 3 14 4" {...S}/></>,
    compass:       <><circle cx="8" cy="8" r="6" {...S}/><circle cx="8" cy="8" r="1.5" {...F}/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14" {...S}/></>,
    volcano:       <><path d="M2 14L6 8l2 2 2-2 4 6Z" {...S}/><path d="M7 5L8 2l1 3" {...S}/></>,
    snowflake:     <><line x1="8" y1="2" x2="8" y2="14" {...S}/><line x1="2" y1="8" x2="14" y2="8" {...S}/><line x1="4" y1="4" x2="12" y2="12" {...S}/><line x1="12" y1="4" x2="4" y2="12" {...S}/></>,
    star:          <><path d="M8 2l1.5 4.5H15l-4 3 1.5 4.5L8 11.5l-4.5 2.5L5 9.5 1 6.5h5.5Z" {...S}/></>,
    heart:         <><path d="M8 13L3.5 8.5A3 3 0 0 1 8 4a3 3 0 0 1 4.5 4.5Z" {...F}/></>,
    bolt:          <><path d="M10 2L5 9h4l-3 5 7-8H9Z" {...F}/></>,
    pin:           <><circle cx="8" cy="7" r="3" {...S}/><path d="M8 10c0 0-4 3.5-4 5h8c0-1.5-4-5-4-5Z" {...S}/></>,
    // Southwest-themed icons
    chile:         <><path d="M8 3c-1 0-2 1.5-2 4s1 5.5 2 7c1-1.5 2-4.5 2-7s-1-4-2-4Z" {...S}/><path d="M8 3V1" {...S}/><path d="M6.5 2C7 1 9 1 9.5 2" {...S}/></>,
    zia:           <><circle cx="8" cy="8" r="2.5" {...S}/><line x1="8" y1="1" x2="8" y2="4" {...S}/><line x1="8" y1="12" x2="8" y2="15" {...S}/><line x1="1" y1="8" x2="4" y2="8" {...S}/><line x1="12" y1="8" x2="15" y2="8" {...S}/><line x1="6.5" y1="1" x2="6.5" y2="4" {...S}/><line x1="9.5" y1="1" x2="9.5" y2="4" {...S}/><line x1="6.5" y1="12" x2="6.5" y2="15" {...S}/><line x1="9.5" y1="12" x2="9.5" y2="15" {...S}/><line x1="1" y1="6.5" x2="4" y2="6.5" {...S}/><line x1="1" y1="9.5" x2="4" y2="9.5" {...S}/><line x1="12" y1="6.5" x2="15" y2="6.5" {...S}/><line x1="12" y1="9.5" x2="15" y2="9.5" {...S}/></>,
    adobe:         <><rect x="2" y="6" width="5" height="8" rx="0.5" {...S}/><rect x="9" y="4" width="5" height="10" rx="0.5" {...S}/><rect x="3.5" y="9" width="2" height="2.5" rx="0.3" {...S}/><rect x="10.5" y="7" width="2" height="2.5" rx="0.3" {...S}/><rect x="10.5" y="11" width="2" height="1.5" rx="0.3" {...S}/><line x1="2" y1="6" x2="7" y2="6" {...S}/><line x1="9" y1="4" x2="14" y2="4" {...S}/></>,
    spa:           <><circle cx="8" cy="5" r="3" {...S}/><path d="M4.5 8Q8 12 11.5 8" {...S}/><circle cx="4" cy="10" r="2" {...S}/><circle cx="12" cy="10" r="2" {...S}/></>,
  };
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" style={{ display: 'block', flexShrink: 0 }}>
      {map[name] ?? map.star}
    </svg>
  );
});

// ─── Geo Banner ──────────────────────────────────────────────────────────────

function GeoBanner({
  coords, error, requested, silentPending, onRequest,
}: {
  coords: GeoCoords | null;
  error: string | null;
  requested: boolean;
  silentPending: boolean;
  onRequest: () => void;
}) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('abq_geo_dismissed') === '1'; } catch { return false; } });
  if (coords) return null;
  // Silently re-fetching for a returning user — don't flash the Enable prompt
  if (silentPending && !error) return null;
  if (dismissed && !error) return null;

  if (error) return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: 'var(--ink)', fontSize: '20px' }}>location_off</span>
      <p className="text-xs font-bold flex-1" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>
        Enable location to see distances &amp; sort by nearby
      </p>
      <button
        onClick={onRequest}
        className="text-xs font-black px-3 py-1.5 flex-shrink-0"
        style={{ background: 'var(--brand)', color: 'white', border: 'none', fontFamily: 'Public Sans, sans-serif' }}
      >
        Retry
      </button>
    </div>
  );

  if (requested) return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: 'var(--ink)', fontSize: '20px' }}>my_location</span>
      <p className="text-xs font-bold flex-1" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>Getting your location…</p>
    </div>
  );

  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{ background: 'var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
    >
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: 'var(--ink)', fontSize: '20px' }}>near_me</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>Find things near you</p>
        <p className="text-xs" style={{ color: 'rgba(0,0,0,0.6)', fontFamily: 'Public Sans, sans-serif' }}>Share location for distances &amp; "Near Me"</p>
      </div>
      <button
        onClick={onRequest}
        className="text-xs font-black px-3 py-1.5 flex-shrink-0"
        style={{ background: 'var(--brand)', color: 'white', border: 'none', fontFamily: 'Public Sans, sans-serif' }}
      >
        Enable
      </button>
      <button
        onClick={() => { setDismissed(true); try { localStorage.setItem('abq_geo_dismissed', '1'); } catch {} }}
        className="flex-shrink-0"
        style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', padding: '8px 10px', opacity: 0.6 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ─── Place Card ─────────────────────────────────────────────────────────────


// ─── Event Card Image Slider ─────────────────────────────────────────────────
function EventCardImageSlider({ event }: { event: TMEvent }) {
  const typeMeta = getEventTypeMeta(event);
  const category = getEventCategory(event);

  const initialPhotos = useMemo(() => {
    const imgs = event.images ?? [];
    const nonFallback = imgs.filter(img => !img.fallback);
    const pool = nonFallback.length > 0 ? nonFallback : imgs;
    const seen = new Set<string>();
    return pool
      .filter(img => { if (seen.has(img.url)) return false; seen.add(img.url); return true; })
      .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))
      .slice(0, 5)
      .map(img => hiResUrl(img.url));
  }, [event.images]);

  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const allPhotos = initialPhotos.filter(url => !brokenUrls.has(url));
  const handleImgError = useCallback((url: string) => {
    setBrokenUrls(prev => { const n = new Set(prev); n.add(url); return n; });
  }, []);
  // Only mark as broken on actual load error — don't reject small images
  // (Eventbrite URLs may have small dimensions but render fine at card size)
  const handleImgLoad = useCallback((_url: string, _e: React.SyntheticEvent<HTMLImageElement>) => {
    // no-op: removed naturalWidth < 150 filter that was incorrectly rejecting Eventbrite images
  }, []);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = allPhotos.length;

  const scheduleNext = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current);
    if (count > 1) autoRef.current = setTimeout(() => setIdx(i => (i + 1) % count), 4200);
  }, [count]);

  useEffect(() => {
    if (!paused) scheduleNext();
    return () => { if (autoRef.current) clearTimeout(autoRef.current); };
  }, [idx, paused, scheduleNext]);

  const goTo = (i: number, pauseMs = 0) => {
    setIdx(i);
    if (pauseMs) { setPaused(true); setTimeout(() => setPaused(false), pauseMs); }
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; setPaused(true); };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? (idx + 1) % count : (idx - 1 + count) % count, 3000);
    else setTimeout(() => setPaused(false), 500);
    touchStartX.current = null;
  };

  if (allPhotos.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{ background: typeMeta.bg }}>
        <FlatIcon name={typeMeta.icon} size={32} color="white" />
        <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: 'Public Sans, sans-serif' }}>{category}</span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {allPhotos.map((src, i) => (
        <div key={src} className="absolute inset-0" style={{ opacity: i === idx ? 1 : 0, transition: 'opacity 0.65s ease', overflow: 'hidden' }}>
          <img
            src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
            onLoad={(e) => handleImgLoad(src, e)}
            onError={() => handleImgError(src)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', animation: i === idx ? `kenBurns${i % 4} 8s ease-in-out forwards` : 'none', transformOrigin: 'center center', willChange: 'transform' }}
          />
        </div>
      ))}
      {count > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1" style={{ zIndex: 2 }}>
          {allPhotos.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); goTo(i, 3000); }}
              style={{ width: i === idx ? '14px' : '5px', height: '5px', borderRadius: '3px', background: i === idx ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', padding: 0, minHeight: 0, cursor: 'pointer', transition: 'width 0.3s ease, background 0.3s ease' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Event Card ─────────────────────────────────────────────────────────────

const EventCard = React.memo(function EventCard({ event, onClick }: { event: TMEvent; onClick: () => void }) {
  const venue = event._embedded?.venues?.[0];
  const category = getEventCategory(event);
  const price = event.priceRanges?.[0];
  const typeMeta = getEventTypeMeta(event);
  const fadeRef = useFadeIn();
  const isMovie = category === 'Movie';
  const movieMeta = event._movieMeta;

  return (
    <button
      ref={fadeRef}
      onClick={onClick}
      className="bg-white overflow-hidden text-left w-full"
      style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', borderRadius: '10px', animation: 'cardFadeIn 0.3s ease both' }}
    >
      <div className="relative overflow-hidden" style={{ paddingTop: '75%' }}>
        <div className="absolute inset-0">
          <EventCardImageSlider event={event} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1 }}>
          <FlatIcon name={typeMeta.icon} size={10} color="white" />
          <span style={{ fontSize: 9, fontWeight: 800, color: 'white', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'Public Sans, sans-serif' }}>{category}</span>
        </div>
        {isMovie && movieMeta?.rating && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 3, zIndex: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'white', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em' }}>{movieMeta.rating}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p
          className="font-black text-sm leading-snug text-gray-900"
          style={{ fontFamily: 'Public Sans, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {event.name}
        </p>
        {isMovie ? (
          <div className="mt-1.5 flex flex-col gap-1">
            {movieMeta?.genre && (
              <p className="text-xs font-bold truncate" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}>{movieMeta.genre}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {movieMeta?.rating && (
                  <span className="font-black" style={{ fontSize: 9, padding: '1px 4px', border: '1.5px solid #9ca3af', borderRadius: 2, color: '#6b7280', fontFamily: 'Public Sans, sans-serif', lineHeight: 1.6 }}>{movieMeta.rating}</span>
                )}
                {movieMeta?.runtime && (
                  <span className="text-xs text-gray-500" style={{ fontFamily: 'Public Sans, sans-serif' }}>{movieMeta.runtime}</span>
                )}
              </div>
              {movieMeta?.theaters && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>theaters</span>
                  {movieMeta.theaters.length} {movieMeta.theaters.length === 1 ? 'theater' : 'theaters'}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                {event.dates?.start?.localDate ? formatDate(event.dates.start.localDate) : 'Date TBD'}
                {event.dates?.start?.localTime ? ' · ' + formatTime(event.dates.start.localTime) : ''}
              </p>
              {venue && (
                <p className="text-xs text-gray-500 flex items-center gap-0.5 truncate mt-0.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>location_on</span>
                  {venue.name}
                </p>
              )}
            </div>
            {price && (
              <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--ink)' }}>
                {(price.min ?? 0) === 0 ? 'Free' : `From $${Math.round(price.min || 0)}`}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
});

// ─── Place Detail Modal ──────────────────────────────────────────────────────


// ─── Feedback Widget ──────────────────────────────────────────────────────────
function FeedbackWidget({ contextType, contextId, contextName }: { contextType: 'event' | 'general'; contextId?: string; contextName?: string }) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<'bug'|'suggestion'|'compliment'|'general'>('general');
  const [message, setMessage] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await (supabase.from as any)('user_feedback').insert({
        url: window.location.href,
        context_type: contextType,
        context_id: contextId || null,
        context_name: contextName || null,
        category,
        message: message.trim(),
      });
      setSent(true);
      setMessage('');
      setTimeout(() => { setSent(false); setOpen(false); }, 2500);
    } catch (e) { console.error(e); }
    setSending(false);
  };

  return (
    <div className="px-5 pb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontFamily: 'Public Sans, sans-serif', padding: '4px 0' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ccc' }}>flag</span>
          Report an issue or give feedback
        </button>
      ) : (
        <div style={{ background: '#f8f8f8', borderRadius: 12, padding: '14px 16px', border: '1px solid #eee' }}>
          {sent ? (
            <p className="text-sm text-center font-bold" style={{ color: '#059669', fontFamily: 'Public Sans, sans-serif' }}>✓ Thanks for your feedback!</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', color: '#555', letterSpacing: '0.08em' }}>Feedback</p>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div className="flex gap-2 mb-3 flex-wrap">
                {(['bug','suggestion','compliment','general'] as const).map(c => (
                  <button key={c} onClick={() => setCategory(c)} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${category === c ? '#1a1a1a' : '#ddd'}`,
                    background: category === c ? '#1a1a1a' : 'white',
                    color: category === c ? 'white' : '#555',
                    fontFamily: 'Public Sans, sans-serif',
                  }}>
                    {c === 'bug' ? '🐛 Bug' : c === 'suggestion' ? '💡 Idea' : c === 'compliment' ? '🌟 Love it' : '💬 Other'}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                rows={3}
                className="w-full rounded-lg border text-sm p-3 resize-none focus:outline-none"
                style={{ fontFamily: 'Public Sans, sans-serif', borderColor: '#e5e7eb', background: 'white' }}
              />
              <button
                onClick={submit}
                disabled={sending || !message.trim()}
                className="mt-2 w-full py-2.5 rounded-lg text-sm font-black text-white"
                style={{ background: sending || !message.trim() ? '#ccc' : 'var(--brand)', fontFamily: 'Public Sans, sans-serif', border: 'none', cursor: sending || !message.trim() ? 'default' : 'pointer' }}
              >
                {sending ? 'Sending…' : 'Send Feedback'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Review Components ───────────────────────────────────────────────────────

function OutletRating({
  value, onChange, size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const px = { sm: '18px', md: '24px', lg: '30px' }[size];
  const display = hovered || value;
  return (
    <div className="flex gap-0.5" role="group" aria-label="Rate this place">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          role={onChange ? 'button' : 'img'}
          aria-label={`${i} outlet${i !== 1 ? 's' : ''}`}
          className="material-symbols-outlined select-none transition-all"
          style={{
            fontSize: px,
            color: i <= display ? 'var(--brand)' : '#d1d5db',
            cursor: onChange ? 'pointer' : 'default',
            fontVariationSettings: i <= display ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 300",
            transform: onChange && i <= display ? 'scale(1.1)' : 'scale(1)',
          }}
          onMouseEnter={() => onChange && setHovered(i)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange?.(i)}
        >
          outlet
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = review.createdAt?.toDate?.();
  const dateStr = date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Just now';
  const initials = review.userName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="bg-white rounded-lg p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
          style={{ background: 'var(--brand-gradient)', fontFamily: 'Public Sans, sans-serif' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-black text-gray-900 truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>
              {review.userName}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{dateStr}</span>
          </div>
          <OutletRating value={review.rating} size="sm" />
        </div>
      </div>
      {review.text && (
        <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          {review.text}
        </p>
      )}
    </div>
  );
}


// ─── Calendar / Share helpers ────────────────────────────────────────────────

/** Escape special chars for iCal text fields (RFC 5545 §3.3.11) */
function icsEscape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Fold long lines per RFC 5545 §3.1 (max 75 octets per line) */
function icsFoldLines(ics: string): string {
  return ics.split('\r\n').map(line => {
    if (line.length <= 75) return line;
    const parts: string[] = [];
    parts.push(line.substring(0, 75));
    let rest = line.substring(75);
    while (rest.length > 0) {
      parts.push(' ' + rest.substring(0, 74));
      rest = rest.substring(74);
    }
    return parts.join('\r\n');
  }).join('\r\n');
}

function makeCalendarICS(event: TMEvent): string {
  const venue = event._embedded?.venues?.[0];
  const start = event.dates?.start;
  if (!start?.localDate) return '';

  const dateStr = start.localDate.replace(/-/g, '');
  const timeStr = start.localTime ? start.localTime.replace(/:/g, '').substring(0, 6) : '120000';
  const startMS = new Date(`${start.localDate}T${start.localTime || '12:00:00'}`).getTime();
  const endDate = new Date(startMS + 2 * 60 * 60 * 1000);
  const endDateStr = endDate.toISOString().substring(0, 10).replace(/-/g, '');
  const endTimeStr = endDate.toTimeString().substring(0, 8).replace(/:/g, '');

  const ticketUrl = event.ticketLinks?.[0]?.url || event.url || '';
  const locationStr = [venue?.name, venue?.address?.line1, 'Albuquerque, NM'].filter(Boolean).join(', ');

  // Build description with event details
  const descParts: string[] = [];
  if (venue?.name) descParts.push(`Venue: ${venue.name}`);
  if (start.localTime) descParts.push(`Time: ${formatTime(start.localTime)}`);
  if (ticketUrl) descParts.push(`Tickets: ${ticketUrl}`);
  descParts.push('', 'Found on ABQ Unplugged — abqunplugged.com');
  const description = descParts.join('\\n');

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ABQ Unplugged//abqunplugged.com//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // VTIMEZONE for America/Denver (MST/MDT) — required for TZID references
    'BEGIN:VTIMEZONE',
    'TZID:America/Denver',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0700',
    'TZNAME:MST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0600',
    'TZNAME:MDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${event.id}@abqunplugged.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Denver:${dateStr}T${timeStr}`,
    `DTEND;TZID=America/Denver:${endDateStr}T${endTimeStr}`,
    `SUMMARY:${icsEscape(event.name)}`,
    locationStr ? `LOCATION:${icsEscape(locationStr)}` : '',
    ticketUrl ? `URL:${ticketUrl}` : '',
    `DESCRIPTION:${description}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return icsFoldLines(lines);
}

function addToCalendar(event: TMEvent) {
  const ics = makeCalendarICS(event);
  if (!ics) return;

  // iOS Safari doesn't support blob: downloads or the download attribute.
  // Use a data: URI opened in a new window — Safari recognizes text/calendar
  // and hands it off to the Calendar app.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isIOS || isSafari) {
    // data: URI approach — Safari intercepts text/calendar and opens Calendar.app
    const dataUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    window.open(dataUri, '_blank');
  } else {
    // Standard blob download for Chrome, Firefox, etc.
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.name.replace(/[^a-z0-9]/gi, '_').substring(0, 40)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function shareEvent(event: TMEvent) {
  const venue = event._embedded?.venues?.[0];
  const deepLink = `https://abqunplugged.com/event/${encodeURIComponent(event.id)}`;
  const dateStr = event.dates?.start?.localDate
    ? formatDate(event.dates.start.localDate) + (event.dates.start.localTime ? ' · ' + formatTime(event.dates.start.localTime) : '')
    : '';
  const text = [event.name, dateStr, venue?.name ? `at ${venue.name}` : ''].filter(Boolean).join(' — ');
  trackEvent('share_click', { type: 'event', event_id: event.id, name: event.name });
  if (navigator.share) {
    try { await navigator.share({ title: event.name, text, url: deepLink }); return; } catch { /* fall through */ }
  }
  // Fallback: copy deep-link to clipboard
  try { await navigator.clipboard.writeText(deepLink); } catch { /* ignore */ }
}

// ─── Instagram / Share Card ──────────────────────────────────────────────────

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const words = text.split(' ');
  let line = '';
  let linesDrawn = 0;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      if (linesDrawn >= maxLines - 1) {
        let truncated = line.trim();
        while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) truncated = truncated.slice(0, -1);
        ctx.fillText(truncated + '…', x, y + linesDrawn * lineHeight);
        return linesDrawn + 1;
      }
      ctx.fillText(line.trim(), x, y + linesDrawn * lineHeight);
      line = words[i] + ' ';
      linesDrawn++;
    } else {
      line = testLine;
    }
  }
  if (line.trim() && linesDrawn < maxLines) {
    ctx.fillText(line.trim(), x, y + linesDrawn * lineHeight);
    linesDrawn++;
  }
  return linesDrawn;
}

interface ShareCardData {
  title: string;
  category: string;
  metaLines: string[];
  slug: string; // for download filename + analytics
  deepLink: string; // canonical URL for this event/place
}

interface CardAdjustments {
  zoom: number;       // 0.5–2.0, default 1.0
  darkness: number;   // 0.0–1.0, default 0.5 (maps to overlay strength)
  offsetX: number;    // -0.5–0.5 as fraction of W, default 0
  offsetY: number;    // -0.5–0.5 as fraction of H, default 0
}

const DEFAULT_ADJUSTMENTS: CardAdjustments = { zoom: 1, darkness: 0.5, offsetX: 0, offsetY: 0 };

function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  format: 'story' | 'square',
  photo: HTMLImageElement | null,
  photoFit: 'cover' | 'contain',
  adj: CardAdjustments = DEFAULT_ADJUSTMENTS
): void {
  const W = 1080;
  const H = format === 'story' ? 1920 : 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const ox = adj.offsetX * W;
  const oy = adj.offsetY * H;

  // ── Background ────────────────────────────────────────────────
  if (photo) {
    if (photoFit === 'contain') {
      // Cross-browser blur: scale down to tiny canvas then scale back up.
      const BLUR_SCALE = 24;
      const tiny = document.createElement('canvas');
      tiny.width = Math.ceil(W / BLUR_SCALE);
      tiny.height = Math.ceil(H / BLUR_SCALE);
      const tinyCtx = tiny.getContext('2d')!;
      const bgScale = Math.max(tiny.width / photo.naturalWidth, tiny.height / photo.naturalHeight) * adj.zoom;
      tinyCtx.drawImage(photo,
        (tiny.width - photo.naturalWidth * bgScale) / 2 + ox / BLUR_SCALE,
        (tiny.height - photo.naturalHeight * bgScale) / 2 + oy / BLUR_SCALE,
        photo.naturalWidth * bgScale, photo.naturalHeight * bgScale);
      ctx.drawImage(tiny, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      // Full photo contained, centered + user offset
      const fitScale = Math.min(W / photo.naturalWidth, H / photo.naturalHeight) * 0.88 * adj.zoom;
      const fw = photo.naturalWidth * fitScale;
      const fh = photo.naturalHeight * fitScale;
      ctx.drawImage(photo, (W - fw) / 2 + ox, (H - fh) / 2 + oy, fw, fh);
    } else {
      // Cover fill + user zoom/offset
      const scale = Math.max(W / photo.naturalWidth, H / photo.naturalHeight) * adj.zoom;
      ctx.drawImage(photo,
        (W - photo.naturalWidth * scale) / 2 + ox,
        (H - photo.naturalHeight * scale) / 2 + oy,
        photo.naturalWidth * scale, photo.naturalHeight * scale);
    }
  } else {
    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, '#0d1b2a'); bg.addColorStop(0.5, '#1a3a5c'); bg.addColorStop(1, '#566500');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Dark overlay — driven by adj.darkness (0=light, 1=dark) ──
  // darkness=0.5 matches the old hardcoded defaults
  const overlayStart = photo ? 0.25 : 0.4;
  const midAlpha  = photo ? (adj.darkness * 0.8)        : (0.2 + adj.darkness * 0.5);
  const endAlpha  = photo ? (0.55 + adj.darkness * 0.45) : (0.5 + adj.darkness * 0.45);
  const bottomOverlay = ctx.createLinearGradient(0, H * overlayStart, 0, H);
  bottomOverlay.addColorStop(0, 'rgba(0,0,0,0)');
  bottomOverlay.addColorStop(0.35, `rgba(0,0,0,${midAlpha.toFixed(2)})`);
  bottomOverlay.addColorStop(1,    `rgba(0,0,0,${endAlpha.toFixed(2)})`);
  ctx.fillStyle = bottomOverlay;
  ctx.fillRect(0, 0, W, H);

  // Top vignette
  if (photo) {
    const topStrength = 0.3 + adj.darkness * 0.35;
    const topV = ctx.createLinearGradient(0, 0, 0, H * 0.22);
    topV.addColorStop(0, `rgba(0,0,0,${topStrength.toFixed(2)})`);
    topV.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topV;
    ctx.fillRect(0, 0, W, H * 0.22);
  }

  // ── Lime accent bar at bottom ─────────────────────────────────
  ctx.fillStyle = '#d4ef4d';
  ctx.fillRect(0, H - 16, W, 16);

  // ── ABQ Unplugged badge (top-left) ────────────────────────────
  const BADGE_X = 72;
  const BADGE_Y = format === 'story' ? 160 : 72;
  const dotR = 16;
  ctx.fillStyle = '#d4ef4d';
  ctx.beginPath(); ctx.arc(BADGE_X + dotR, BADGE_Y + dotR, dotR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${format === 'story' ? 48 : 40}px "Public Sans", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('ABQ', BADGE_X + dotR * 2 + 12, BADGE_Y);
  ctx.fillStyle = '#d4ef4d';
  ctx.font = `900 ${format === 'story' ? 32 : 28}px "Public Sans", sans-serif`;
  ctx.fillText('UNPLUGGED', BADGE_X + dotR * 2 + 12, BADGE_Y + (format === 'story' ? 50 : 43));

  // ── Content block (bottom-up) ─────────────────────────────────
  const PAD = 72; const CONTENT_W = W - PAD * 2; const BOTTOM_PAD = 80;
  const tagFontSize = 28;
  ctx.font = `800 ${tagFontSize}px "Public Sans", sans-serif`;
  const tagText = data.category.toUpperCase();
  const tagPadX = 28; const tagH = 56;
  const tagW = ctx.measureText(tagText).width + tagPadX * 2;
  const titleFontSize = format === 'story' ? 88 : 76;
  const titleLineH = titleFontSize * 1.15;
  const metaLineH = 52;
  const metaBlockH = data.metaLines.length * metaLineH;
  const totalContentH = tagH + 24 + 2 * titleLineH + 24 + metaBlockH;
  const contentTop = H - BOTTOM_PAD - totalContentH;

  // Tag pill
  const tagY = contentTop;
  ctx.fillStyle = '#566500'; ctx.beginPath();
  if ('roundRect' in ctx) {
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(PAD, tagY, tagW, tagH, tagH / 2);
  } else { ctx.rect(PAD, tagY, tagW, tagH); }
  ctx.fill();
  ctx.fillStyle = '#d4ef4d'; ctx.font = `800 ${tagFontSize}px "Public Sans", sans-serif`;
  ctx.textBaseline = 'middle'; ctx.fillText(tagText, PAD + tagPadX, tagY + tagH / 2);

  // Title
  ctx.fillStyle = '#ffffff'; ctx.font = `900 ${titleFontSize}px "Public Sans", sans-serif`;
  ctx.textBaseline = 'top';
  const titleY = tagY + tagH + 24;
  const linesDrawn = wrapCanvasText(ctx, data.title, PAD, titleY, CONTENT_W, titleLineH, 2);

  // Meta lines
  const metaY = titleY + linesDrawn * titleLineH + 24;
  data.metaLines.forEach((item, i) => {
    const y = metaY + i * metaLineH;
    ctx.fillStyle = '#d4ef4d'; ctx.beginPath(); ctx.arc(PAD + 10, y + 17, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `400 34px "Public Sans", sans-serif`;
    ctx.textBaseline = 'top'; ctx.fillText(item, PAD + 30, y);
  });
}

// Shared modal UI — used by both EventShareCardModal and PlaceShareCardModal
function ShareCardModal({ data, photoUrl, onClose, analyticsType }: {
  data: ShareCardData;
  photoUrl: string;
  onClose: () => void;
  analyticsType: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const [format, setFormat] = useState<'story' | 'square'>('story');
  const [photoFit, setPhotoFit] = useState<'cover' | 'contain'>('cover');
  const [adj, setAdj] = useState<CardAdjustments>(DEFAULT_ADJUSTMENTS);
  const [shareState, setShareState] = useState<'idle' | 'saved' | 'shared'>('idle');
  // Drag state (ref so it doesn't trigger re-renders mid-drag)
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });

  const W = 1080;
  const H = format === 'story' ? 1920 : 1080;
  const previewScale = format === 'story' ? 0.22 : 0.34;
  const previewW = Math.round(W * previewScale);
  const previewH = Math.round(H * previewScale);

  // Redraw whenever any parameter changes
  const redraw = useCallback((overrideAdj?: CardAdjustments) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawShareCard(canvas, data, format, photoRef.current, photoFit, overrideAdj ?? adj);
  }, [data, format, photoFit, adj]);

  // Load photo once, then redraw on every param change
  useEffect(() => {
    if (!photoUrl) { redraw(); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { photoRef.current = img; redraw(); };
    img.onerror = () => { photoRef.current = null; redraw(); };
    img.src = photoUrl;
  }, [photoUrl]); // only reload image when URL changes

  useEffect(() => { redraw(); }, [redraw]);

  // Drag handlers — reposition photo by dragging the preview
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!photoUrl) return;
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setAdj(prev => {
      const next = {
        ...prev,
        offsetX: Math.max(-0.5, Math.min(0.5, prev.offsetX + dx / (W * previewScale))),
        offsetY: Math.max(-0.5, Math.min(0.5, prev.offsetY + dy / (H * previewScale))),
      };
      // Redraw immediately with next value so it feels live
      const canvas = canvasRef.current;
      if (canvas) drawShareCard(canvas, data, format, photoRef.current, photoFit, next);
      return next;
    });
  };
  const onPointerUp = () => { dragRef.current.active = false; };

  const updateAdj = (key: keyof CardAdjustments, value: number) =>
    setAdj(prev => ({ ...prev, [key]: value }));

  const sliderStyle: React.CSSProperties = {
    width: '100%', height: 36, cursor: 'pointer', accentColor: '#d4ef4d',
    WebkitAppearance: 'none', appearance: 'none', background: 'transparent',
  };
  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'Public Sans, sans-serif',
    fontWeight: 800, letterSpacing: '0.06em', whiteSpace: 'nowrap', minWidth: 24,
  };

  const getBlob = (): Promise<Blob | null> => new Promise(res => canvasRef.current?.toBlob(res, 'image/png'));

  const handleDownload = async () => {
    const blob = await getBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${data.slug}-abq-unplugged.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    trackEvent('instagram_card_download', { type: analyticsType, format });
    setShareState('saved'); setTimeout(() => setShareState('idle'), 2000);
  };

  const handleShare = async () => {
    const blob = await getBlob();
    if (!blob) return;
    const file = new File([blob], `${data.slug}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: data.title, text: `Check out ${data.title} on ABQ Unplugged!\n${data.deepLink}` });
        trackEvent('instagram_card_share', { type: analyticsType, format, method: 'web_share' });
        setShareState('shared'); setTimeout(() => setShareState('idle'), 2000);
      } catch { /* user cancelled */ }
    } else { handleDownload(); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#1a1a1a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <button onClick={onClose} className="flex items-center gap-1"
          style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Public Sans, sans-serif', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          Back
        </button>
        <span className="font-black text-white text-sm" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em' }}>CREATE CARD</span>
        {photoUrl ? (
          <button onClick={() => { setPhotoFit(f => f === 'cover' ? 'contain' : 'cover'); setAdj(DEFAULT_ADJUSTMENTS); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#d4ef4d', cursor: 'pointer', padding: '4px 10px', fontFamily: 'Public Sans, sans-serif', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' }}>
            {photoFit === 'cover' ? 'FIT' : 'FILL'}
          </button>
        ) : <div style={{ width: 44 }} />}
      </div>

      {/* Format tabs */}
      <div className="flex mx-4 mt-2 mb-2" style={{ border: '2px solid rgba(255,255,255,0.15)', borderRadius: 6, overflow: 'hidden' }}>
        {(['story', 'square'] as const).map(f => (
          <button key={f} onClick={() => setFormat(f)} className="flex-1 py-2 text-xs font-black"
            style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em', background: format === f ? '#d4ef4d' : 'transparent', color: format === f ? '#1a1a1a' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
            {f === 'story' ? 'STORY 9:16' : 'POST 1:1'}
          </button>
        ))}
      </div>

      {/* Canvas preview — drag to reposition photo */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4"
        style={{ touchAction: 'none', cursor: photoUrl ? 'grab' : 'default' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ width: previewW, height: previewH, display: 'block', border: '2px solid rgba(255,255,255,0.15)', borderRadius: 4, userSelect: 'none' }} />
      </div>

      {photoUrl && (
        <p className="text-center" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Public Sans, sans-serif', margin: '2px 0' }}>
          Drag to reposition photo
        </p>
      )}

      {/* Adjustments */}
      {photoUrl && (
        <div className="px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, paddingBottom: 4 }}>
          {/* Zoom */}
          <div className="flex items-center gap-2">
            <span style={labelStyle}>ZOOM</span>
            <input type="range" min={0.5} max={2} step={0.01} value={adj.zoom}
              onChange={e => updateAdj('zoom', parseFloat(e.target.value))}
              style={sliderStyle} />
            <span style={{ ...labelStyle, minWidth: 32, textAlign: 'right' }}>{Math.round(adj.zoom * 100)}%</span>
          </div>
          {/* Darkness */}
          <div className="flex items-center gap-2">
            <span style={labelStyle}>DARK</span>
            <input type="range" min={0} max={1} step={0.01} value={adj.darkness}
              onChange={e => updateAdj('darkness', parseFloat(e.target.value))}
              style={sliderStyle} />
            <span style={{ ...labelStyle, minWidth: 32, textAlign: 'right' }}>{Math.round(adj.darkness * 100)}%</span>
          </div>
          {/* Reset */}
          {(adj.zoom !== 1 || adj.darkness !== 0.5 || adj.offsetX !== 0 || adj.offsetY !== 0) && (
            <button onClick={() => setAdj(DEFAULT_ADJUSTMENTS)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontFamily: 'Public Sans, sans-serif', fontSize: 10, cursor: 'pointer', padding: '2px 0', letterSpacing: '0.05em' }}>
              ↺ Reset adjustments
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 px-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-3 font-black text-sm"
          style={{ border: '2px solid #d4ef4d', color: '#d4ef4d', background: 'transparent', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.05em', borderRadius: 6, cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
          {shareState === 'saved' ? 'SAVED!' : 'SAVE IMAGE'}
        </button>
        <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 py-3 font-black text-sm"
          style={{ background: '#d4ef4d', color: '#1a1a1a', border: 'none', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.05em', borderRadius: 6, cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>ios_share</span>
          {shareState === 'shared' ? 'SHARED!' : 'SHARE'}
        </button>
      </div>
    </div>
  );
}

function EventShareCardModal({ event, onClose }: { event: TMEvent; onClose: () => void }) {
  const rawGenre = event.classifications?.[0]?.genre?.name;
  const rawSegment = event.classifications?.[0]?.segment?.name;
  const category = (rawGenre && rawGenre !== 'Undefined' ? rawGenre : rawSegment) || 'Event';
  const metaLines = [
    event.dates?.start?.localDate
      ? [formatDate(event.dates.start.localDate), event.dates.start.localTime ? formatTime(event.dates.start.localTime) : ''].filter(Boolean).join(' · ')
      : '',
    event._embedded?.venues?.[0]?.name || '',
  ].filter(Boolean);
  const data: ShareCardData = {
    title: event.name, category, metaLines,
    slug: event.name.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
    deepLink: `https://abqunplugged.com/event/${encodeURIComponent(event.id)}`,
  };
  return <ShareCardModal data={data} photoUrl={getBestEventImage(event.images)} onClose={onClose} analyticsType="event" />;
}


// ─── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({ event, onClose, isSaved, onToggleSave, mapProvider }: { event: TMEvent; onClose: () => void; isSaved?: boolean; onToggleSave?: () => void; mapProvider?: 'google' | 'apple' }) {
  const [shared, setShared] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [venueExpanded, setVenueExpanded] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagText, setFlagText] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagDone, setFlagDone] = useState(false);
  const venue = event._embedded?.venues?.[0];
  const category = getEventCategory(event);
  const price = event.priceRanges?.[0];
  const mapsQuery = encodeURIComponent(
    (venue?.address?.line1 || venue?.name || event.name) + ' Albuquerque NM'
  );
  const directionsUrl = (mapProvider === 'apple')
    ? `https://maps.apple.com/?q=${mapsQuery}`
    : `https://maps.google.com/?q=${mapsQuery}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
    {showShareCard && <EventShareCardModal event={event} onClose={() => setShowShareCard(false)} />}
    {!showShareCard && <div className="fixed inset-0 z-[150] flex justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="flex flex-col overflow-y-auto w-full" style={{ maxWidth: '480px', background: 'white' }} onClick={e => e.stopPropagation()}>
      <div className="relative flex-shrink-0" style={{ height: '280px' }}>
        <EventCardImageSlider event={event} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
        {/* Top bar: back + share — padded for PWA safe area */}
        <div className="absolute left-4 right-4 flex items-center justify-between" style={{ zIndex: 3, top: 'max(16px, env(safe-area-inset-top, 16px))' }}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%', aspectRatio: '1', minHeight: 'unset' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>close</span>
          </button>
          <div className="flex items-center gap-2">
            {onToggleSave && (
              <button
                onClick={onToggleSave}
                className="w-10 h-10 flex items-center justify-center shrink-0"
                style={{ background: isSaved ? 'var(--brand)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%', aspectRatio: '1', minHeight: 'unset' }}
                title={isSaved ? 'Remove from plan' : 'Save to plan'}
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: '20px', fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
              </button>
            )}
            <button
              onClick={async () => { await shareEvent(event); setShared(true); setTimeout(() => setShared(false), 2000); }}
              className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%', aspectRatio: '1', minHeight: 'unset' }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>
                {shared ? 'check' : 'share'}
              </span>
            </button>
            <button
              onClick={() => setShowShareCard(true)}
              className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%', aspectRatio: '1', minHeight: 'unset' }}
              title="Create Instagram card"
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>photo_camera</span>
            </button>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4" style={{ zIndex: 3, pointerEvents: 'none' }}>
          <span
            className="text-xs font-bold text-white px-2.5 py-1 rounded"
            style={{ background: 'var(--brand)', pointerEvents: 'auto' }}
          >
            {category}
          </span>
          <h2
            className="text-white font-black text-xl mt-2 leading-tight"
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          >
            {event.name}
          </h2>
        </div>
      </div>

      <div className="px-5 py-4 pb-10">

        {/* ── WHEN + WHERE ─────────────────────────────────── */}
        <div className="flex gap-3 mb-3">
          {/* When: date + time combined */}
          <div className="flex-1 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>calendar_today</span>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#999', letterSpacing: '0.07em' }}>When</p>
            </div>
            <p className="font-black text-sm leading-snug" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--brand)' }}>
              {event.dates?.start?.localDate ? formatDate(event.dates.start.localDate) : 'Date TBD'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {event.dates?.start?.localTime ? formatTime(event.dates.start.localTime) : 'Time TBD'}
            </p>
          </div>
          {/* Price */}
          {price ? (
            <div className="flex-1 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>sell</span>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#999', letterSpacing: '0.07em' }}>Price</p>
              </div>
              <p className="font-black text-sm" style={{ fontFamily: 'Public Sans, sans-serif', color: '#1a1a1a' }}>
                {(price.min || 0) === 0 && (price.max || 0) === 0 ? 'Free' : price.min === price.max ? `$${Math.round(price.min || 0)}` : `$${Math.round(price.min || 0)} – $${Math.round(price.max || 0)}`}
              </p>
              {price.currency && price.currency !== 'USD' && <p className="text-xs text-gray-400 mt-0.5">{price.currency}</p>}
            </div>
          ) : (
            /* Age restriction badge if no price */
            event.ageRestrictions?.legalAgeEnforced ? (
              <div className="flex-1 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#dc2626' }}>18_up_rating</span>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#999', letterSpacing: '0.07em' }}>Age</p>
                </div>
                <p className="font-black text-sm" style={{ fontFamily: 'Public Sans, sans-serif', color: '#dc2626' }}>21+ Event</p>
              </div>
            ) : null
          )}
        </div>

        {/* ── MOVIE INFO BAR (rating / runtime / genre) ──── */}
        {category === 'Movie' && event._movieMeta && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2.5 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0', borderRadius: 0 }}>
            {event._movieMeta.rating && (
              <span className="font-black flex-shrink-0" style={{ fontSize: 12, padding: '2px 7px', border: '2px solid #374151', borderRadius: 3, color: '#374151', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.05em' }}>{event._movieMeta.rating}</span>
            )}
            {event._movieMeta.runtime && (
              <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif' }}>{event._movieMeta.runtime}</span>
            )}
            {event._movieMeta.genre && (
              <span className="text-sm truncate" style={{ color: '#6b7280', fontFamily: 'Public Sans, sans-serif' }}>{event._movieMeta.genre}</span>
            )}
          </div>
        )}
        {/* Venue card — tappable to open in maps */}
        {venue && (
          <a
            href={directionsUrl}
            target="_blank" rel="noopener noreferrer"
            onClick={() => trackEvent('directions_click', { type: 'event', event_id: event.id, name: venue.name || event.name })}
            className="flex items-start gap-3 mb-3 bg-white p-3 w-full"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0', textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '18px', color: 'var(--brand)' }}>location_on</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-gray-900 truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.name}</p>
              {venue.address?.line1 && <p className="text-xs text-gray-500 mt-0.5">{venue.address.line1}{venue.city?.name ? `, ${venue.city.name}` : ''}</p>}
              <p className="text-xs font-bold mt-1" style={{ color: 'var(--brand)' }}>Open in {mapProvider === 'apple' ? 'Apple Maps' : 'Google Maps'} →</p>
            </div>
          </a>
        )}

        {/* ── PLEASE NOTE callout (amber warning) ──────────── */}
        {event.pleaseNote && (
          <div className="flex gap-3 mb-3 p-3" style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderLeft: '4px solid #f59e0b' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px', color: '#d97706', marginTop: '1px' }}>warning</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide mb-1" style={{ color: '#92400e', letterSpacing: '0.06em' }}>Please Note</p>
              <p className="text-xs text-amber-900 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{event.pleaseNote}</p>
            </div>
          </div>
        )}

        {/* ── ABOUT THIS EVENT ─────────────────────────────── */}
        {event.info && (
          <div className="mb-3 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
            <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: 'var(--brand)', letterSpacing: '0.07em' }}>About This Event</p>
            <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{event.info}</p>
          </div>
        )}

        {/* ── NOW PLAYING AT (movie theaters) ──────────────── */}
        {category === 'Movie' && event._movieMeta?.theaters && event._movieMeta.theaters.length > 0 && (
          <div className="mb-3 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
            <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--brand)' }}>theaters</span>
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--brand)', letterSpacing: '0.07em' }}>Now Playing At</p>
            </div>
            <div className="flex flex-col">
              {event._movieMeta.theaters.map((theater, i) => (
                <a
                  key={theater}
                  href={`https://www.fandango.com/search?q=${encodeURIComponent(theater)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-3"
                  style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined, textDecoration: 'none' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px', color: '#9ca3af' }}>movie</span>
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif' }}>{theater}</span>
                  </div>
                  <span className="text-xs font-black flex-shrink-0 ml-3" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}>SHOWTIMES →</span>
                </a>
              ))}
            </div>
            <div className="px-3 pb-3 pt-1">
              <a
                href={`https://www.fandango.com/search?q=${encodeURIComponent(event.name + ' Albuquerque')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 font-black text-sm text-white"
                style={{ borderRadius: 6, background: 'linear-gradient(135deg, #ff6000, #ff8c00)', fontFamily: 'Public Sans, sans-serif' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>confirmation_number</span>
                ALL SHOWTIMES ON FANDANGO →
              </a>
            </div>
          </div>
        )}
        {/* ── KNOW BEFORE YOU GO (expandable) ─────────────── */}
        {(venue?.boxOfficeInfo?.phoneNumberDetail || venue?.parkingDetail || venue?.generalInfo?.childRule || venue?.accessibleSeatingDetail || venue?.boxOfficeInfo?.openHoursDetail || venue?.boxOfficeInfo?.acceptedPaymentDetail) && (
          <div className="mb-3" style={{ border: '1.5px solid #e5e7eb' }}>
            <button
              onClick={() => setVenueExpanded(v => !v)}
              className="w-full flex items-center justify-between p-3 bg-white"
              style={{ fontFamily: 'Public Sans, sans-serif' }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--brand)' }}>info</span>
                <span className="font-black text-sm" style={{ color: '#1a1a1a' }}>Know Before You Go</span>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#9ca3af', transform: venueExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>expand_more</span>
            </button>
            {venueExpanded && (
              <div className="px-3 pb-3 flex flex-col gap-3" style={{ background: '#fafafa', borderTop: '1px solid #e5e7eb' }}>

                {/* Box office phone */}
                {venue?.boxOfficeInfo?.phoneNumberDetail && (
                  <div className="pt-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>phone</span>
                      <p className="text-xs font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.06em' }}>Box Office</p>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.boxOfficeInfo.phoneNumberDetail}</p>
                  </div>
                )}

                {/* Box office hours */}
                {venue?.boxOfficeInfo?.openHoursDetail && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>schedule</span>
                      <p className="text-xs font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.06em' }}>Box Office Hours</p>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.boxOfficeInfo.openHoursDetail}</p>
                  </div>
                )}

                {/* Parking */}
                {venue?.parkingDetail && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>local_parking</span>
                      <p className="text-xs font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.06em' }}>Parking</p>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.parkingDetail}</p>
                  </div>
                )}

                {/* Kids policy */}
                {venue?.generalInfo?.childRule && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>child_care</span>
                      <p className="text-xs font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.06em' }}>Kids Policy</p>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.generalInfo.childRule}</p>
                  </div>
                )}

                {/* Accessibility */}
                {venue?.accessibleSeatingDetail && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>accessible</span>
                      <p className="text-xs font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.06em' }}>Accessibility</p>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.accessibleSeatingDetail}</p>
                  </div>
                )}

                {/* Payment */}
                {venue?.boxOfficeInfo?.acceptedPaymentDetail && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)' }}>credit_card</span>
                      <p className="text-xs font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.06em' }}>Accepted Payment</p>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{venue.boxOfficeInfo.acceptedPaymentDetail}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MAP ──────────────────────────────────────────── */}
        {venue?.address?.line1 && (
          <div className="overflow-hidden mb-4" style={{ height: '150px', border: '1.5px solid #e5e7eb' }}>
            <iframe
              title={`Map for ${venue.name}`}
              width="100%" height="150" style={{ border: 0 }}
              src={`https://www.google.com/maps?q=${mapsQuery}&output=embed&z=15`}
              referrerPolicy="no-referrer"
              loading="lazy"
              allowFullScreen
            />
          </div>
        )}

        {/* ── AI ENRICHMENT ────────────────────────────────── */}
        {event._aiEnrichment && (
          <div className="mb-3">
            {/* About the artist/event */}
            {event._aiEnrichment.about && (
              <div className="mb-2 p-3 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0', borderLeft: '3px solid var(--brand)' }}>
                <p className="text-xs font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand)', letterSpacing: '0.07em' }}>About</p>
                <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{event._aiEnrichment.about}</p>
              </div>
            )}
            {/* Highlights / what to expect */}
            {event._aiEnrichment.highlights && event._aiEnrichment.highlights.length > 0 && (
              <div className="mb-2 p-3 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
                <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: 'var(--brand)', letterSpacing: '0.07em' }}>What to Expect</p>
                <ul className="flex flex-col gap-1.5">
                  {event._aiEnrichment.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-snug" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                      <span style={{ color: 'var(--brand)', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>·</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Venue / parking tips */}
            {event._aiEnrichment.venue_tips && (
              <div className="mb-2 p-3 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--brand)' }}>local_parking</span>
                  <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--brand)', letterSpacing: '0.07em' }}>Getting There</p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{event._aiEnrichment.venue_tips}</p>
              </div>
            )}
            {/* Local ABQ tips */}
            {event._aiEnrichment.local_tips && (
              <div className="mb-2 p-3" style={{ background: 'var(--brand-bg-subtle)', border: '1.5px solid var(--brand-tint-border)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>🌶️</span>
                  <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--brand)', letterSpacing: '0.07em' }}>Local Tip</p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{event._aiEnrichment.local_tips}</p>
              </div>
            )}
          </div>
        )}

        {/* ── UNPLUGGING TIP (subtle, only if no real info) ── */}
        {!event.info && !event.pleaseNote && (
          <div className="flex gap-3 mb-4 p-3" style={{ background: 'var(--brand-bg-subtle)', border: '1.5px solid var(--brand-tint-border)' }}>
            <span style={{ fontSize: '16px', lineHeight: 1.4 }}>⚡</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide mb-0.5" style={{ color: 'var(--brand)', letterSpacing: '0.06em' }}>Unplugging Tip</p>
              <p className="text-xs text-gray-600 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>Put your phone away for the first 30 minutes. Let yourself fully arrive before documenting.</p>
            </div>
          </div>
        )}

        {/* ── ADD TO CALENDAR ───────────────────────────────── */}
        {event.dates?.start?.localDate && (
          <button
            onClick={() => addToCalendar(event)}
            className="flex items-center justify-center gap-2 w-full py-3 mb-2 font-black text-sm"
            style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 6, background: 'white', color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_add_on</span>
            ADD TO CALENDAR
          </button>
        )}

        {/* ── GET TICKETS / MORE INFO ───────────────────────── */}
        {event.ticketLinks && event.ticketLinks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {event.ticketLinks.map((link) => (
              <a key={link.source + link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-5 py-3 text-white font-black text-sm"
                style={{ borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  background: link.source === 'Ticketmaster' ? 'linear-gradient(135deg, #026cdf, #02a7f0)' : link.source === 'Eventbrite' ? 'linear-gradient(135deg, #f05537, #ff7a5c)' : link.source === 'SeatGeek' ? 'linear-gradient(135deg, #d4184a, #ff5c5c)' : 'var(--brand-gradient)',
                  fontFamily: 'Public Sans, sans-serif' }}
              >
                <span>{link.source}</span>
                <span>{link.source === 'SeatGeek' ? 'GET SEATS →' : 'GET TICKETS →'}</span>
              </a>
            ))}
          </div>
        ) : event.url ? (
          <a href={event.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 text-center text-white font-black text-sm"
            style={{ borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              background: event._source === 'seatgeek' ? 'linear-gradient(135deg, #d4184a, #ff5c5c)' : event._source === 'local' ? 'linear-gradient(135deg, #0369a1, #38bdf8)' : event._source === 'fandango' ? 'linear-gradient(135deg, #ff6000, #ff8c00)' : 'var(--brand-gradient)',
              fontFamily: 'Public Sans, sans-serif' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{event._source === 'local' ? 'info' : event._source === 'fandango' ? 'theaters' : 'confirmation_number'}</span>
            {event._source === 'local' ? 'MORE INFO →' : event._source === 'seatgeek' ? 'GET SEATS →' : event._source === 'fandango' ? 'ALL FANDANGO SHOWTIMES →' : 'GET TICKETS →'}
          </a>
        ) : (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => trackEvent('directions_click', { type: 'event', event_id: event.id, name: event.name })}
            className="flex items-center justify-center gap-2 w-full py-4 text-center text-white font-black text-sm"
            style={{ borderRadius: 6, background: 'var(--brand-gradient)', fontFamily: 'Public Sans, sans-serif' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>directions</span>
            GET DIRECTIONS →
          </a>
        )}
      </div>

        {/* ── SUGGEST AN UPDATE ────────────────────────────── */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          {!flagDone ? (
            <>
              <button
                onClick={() => setShowFlagForm(f => !f)}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: '#bbb', fontFamily: 'Public Sans, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flag</span>
                {showFlagForm ? 'Cancel' : 'Suggest an update'}
              </button>
              {showFlagForm && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={flagText}
                    onChange={e => setFlagText(e.target.value)}
                    placeholder="e.g. wrong date, venue has changed, missing details…"
                    rows={3}
                    maxLength={500}
                    autoFocus
                    className="w-full text-sm p-2.5 resize-none"
                    style={{ fontFamily: 'Public Sans, sans-serif', border: '1.5px solid #e5e7eb', borderRadius: 8, outline: 'none', color: '#374151', background: '#fafafa' }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: '#ccc' }}>{flagText.length}/500</span>
                    <button
                      disabled={!flagText.trim() || flagSubmitting}
                      onClick={async () => {
                        if (!flagText.trim()) return;
                        setFlagSubmitting(true);
                        try {
                          await (supabase.from as any)('event_flags').insert({
                            event_id: event.id,
                            event_name: event.name,
                            message: flagText.trim(),
                            submitted_by: null,
                          });
                          setFlagDone(true);
                          setShowFlagForm(false);
                        } catch { /* silent fail — flag it anyway from user POV */ }
                        setFlagSubmitting(false);
                      }}
                      className="text-xs px-3 py-1.5 text-white font-bold"
                      style={{ background: 'var(--brand)', borderRadius: 6, border: 'none', cursor: 'pointer', opacity: (!flagText.trim() || flagSubmitting) ? 0.5 : 1, fontFamily: 'Public Sans, sans-serif' }}
                    >{flagSubmitting ? 'Sending…' : 'Submit'}</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs flex items-center gap-1.5" style={{ color: '#059669', fontFamily: 'Public Sans, sans-serif' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              Thanks! We'll review it.
            </p>
          )}
        </div>

      <FeedbackWidget contextType="event" contextId={event.id} contextName={event.name} />
    </div>
  </div>}
    </>
  );
}

// ─── Why Unplug? Rotating Research Quotes ────────────────────────────────────

const BLOCKED_VENUES = ['Hooters', 'Twin Peaks', 'Twin Peaks Restaurant', 'Coyote Ugly', 'Tilted Kilt'];

const UNPLUG_QUOTES = [
  // Social connection & health
  { text: "People with strong social ties have a 50% increased likelihood of survival compared to those with weaker ties.", source: "Holt-Lunstad et al., PLOS Medicine", icon: "community" },
  { text: "Loneliness is as harmful to health as smoking 15 cigarettes a day.", source: "Holt-Lunstad, Brigham Young University", icon: "community" },
  { text: "Face-to-face contact is the bread and butter of social life — it's how we evolved to connect.", source: "Robin Dunbar, Oxford University", icon: "community" },
  { text: "Just 10 minutes of conversation with another person can improve memory and mental performance.", source: "Ybarra et al., University of Michigan", icon: "community" },
  { text: "People who feel more connected report 3× more daily joy than those who feel isolated.", source: "Journal of Happiness Studies", icon: "community" },
  { text: "Having five or more in-person friends reduces your risk of depression by 70%.", source: "Melbourne Institute of Applied Economic Research", icon: "community" },
  // Experiences vs objects
  { text: "People over-estimate happiness from buying things, and underestimate it from experiences.", source: "Van Boven & Gilovich, Cornell University", icon: "star" },
  { text: "Experiences get better every time you think about them. Objects don't.", source: "Thomas Gilovich, Cornell Psychology", icon: "star" },
  { text: "Novel real-world experiences create richer, more detailed memories than screen-based ones.", source: "Maguire et al., Nature Neuroscience", icon: "star" },
  { text: "Shared experiences — even with strangers — make us happier than having them alone.", source: "Boothby et al., Psychological Science", icon: "star" },
  { text: "You can't get the same neurological hit from watching something as from being in the room.", source: "Dr. Paul Zak, Claremont Graduate University", icon: "star" },
  // Urban exploration
  { text: "Walking through new neighborhoods activates the hippocampus — the brain's exploration center.", source: "O'Keefe & Moser, Nobel Prize in Medicine 2014", icon: "building" },
  { text: "People who explore local culture report significantly higher life satisfaction.", source: "American Journal of Community Psychology", icon: "building" },
  { text: "Exploring your own city produces the same mood boost as traveling far away.", source: "Nawijn et al., Applied Research in Quality of Life", icon: "building" },
  { text: "Local exploration builds place identity — a key predictor of resilience and belonging.", source: "Lewicka, Journal of Environmental Psychology", icon: "building" },
  { text: "Cities with vibrant arts and live events see measurably lower rates of depression.", source: "World Health Organization, 2019", icon: "building" },
  // Presence & phones
  { text: "A wandering mind is an unhappy mind. Being present is one of the strongest predictors of happiness.", source: "Killingsworth & Gilbert, Harvard — Science 2010", icon: "star" },
  { text: "People who put their phones away during meals enjoy both the food and company significantly more.", source: "Dwyer et al., Journal of Experimental Social Psychology", icon: "star" },
  { text: "The mere presence of a smartphone — even face down — reduces available cognitive capacity.", source: "Ward et al., Journal of Consumer Research", icon: "star" },
  { text: "Brief moments of undivided attention with another person build real trust and emotional closeness.", source: "Turkle, MIT Media Lab", icon: "star" },
  { text: "Screen-free time directly correlates with increased creativity and cognitive flexibility.", source: "Leroy, University of Washington", icon: "star" },
  // Health & longevity
  { text: "Community engagement is one of the strongest predictors of longevity — stronger than diet or exercise alone.", source: "Blue Zones research, National Geographic", icon: "heart" },
  { text: "Going to live events and performances is associated with a 14% lower risk of early death.", source: "Fancourt & Finn, BMJ 2019", icon: "heart" },
  { text: "Physical presence activates oxytocin — the bonding hormone — in ways video calls cannot replicate.", source: "Dunbar, Evolutionary Psychology", icon: "heart" },
  { text: "Social activities lower cortisol levels as effectively as meditation.", source: "Post, International Journal of Service Learning", icon: "heart" },
  // Belonging & community
  { text: "Brief interactions with cashiers, neighbors, and café regulars improve mood more than most people predict.", source: "Epley & Schroeder, Journal of Experimental Psychology", icon: "star" },
  { text: "Feeling you belong to a place is associated with 40% higher reported wellbeing.", source: "Knight Foundation, Soul of the Community study", icon: "star" },
  { text: "Attending community events 3+ times a month doubles your sense of belonging.", source: "Pew Research Center, Community Connections Study", icon: "star" },
  { text: "People who regularly attend local events have stronger support networks in times of crisis.", source: "Putnam, Bowling Alone, Harvard University Press", icon: "star" },
  { text: "Even watching live sports alongside strangers creates real feelings of tribal belonging.", source: "Wann, Journal of Sport Behavior", icon: "star" },
  // Science bonus
  { text: "The brain produces far more dopamine from live, unpredictable experiences than from pre-recorded content.", source: "Schultz, Annual Review of Neuroscience", icon: "bolt" },
  { text: "Live music physically synchronizes heartbeats across audience members — a measurable form of group bonding.", source: "Vickhoff et al., Frontiers in Psychology", icon: "bolt" },
  { text: "Attending a cultural event even once a month is associated with a 31% increase in reported happiness.", source: "ONS Wellbeing Study, UK Office for National Statistics", icon: "bolt" },
  { text: "Humans who belong to meaningful community groups recover from illness faster.", source: "Cohen & Wills, Psychological Bulletin", icon: "bolt" },
  { text: "Children who play outside with others develop stronger empathy than screen-first peers.", source: "Gray, American Journal of Play", icon: "bolt" },
];

function WhyUnplugCard() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * UNPLUG_QUOTES.length));
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (!document.getElementById('unplug-anim-styles')) {
      const s = document.createElement('style');
      s.id = 'unplug-anim-styles';
      s.textContent = `
        @keyframes unplugIn {
          0%   { opacity:0; transform:translateX(-44px) skewX(-5deg); filter:blur(8px); }
          55%  { filter:blur(0); }
          100% { opacity:1; transform:translateX(0) skewX(0); filter:blur(0); }
        }
        @keyframes unplugOut {
          0%   { opacity:1; transform:translateX(0) skewX(0); filter:blur(0); }
          100% { opacity:0; transform:translateX(52px) skewX(5deg); filter:blur(6px); }
        }
        .unplug-in .unplug-label {
          animation: unplugIn 0.5s cubic-bezier(0.16,1,0.3,1) 0ms both;
        }
        .unplug-in .unplug-quote {
          animation: unplugIn 0.6s cubic-bezier(0.16,1,0.3,1) 75ms both;
        }
        .unplug-in .unplug-source {
          animation: unplugIn 0.55s cubic-bezier(0.16,1,0.3,1) 155ms both;
        }
        .unplug-out .unplug-label {
          animation: unplugOut 0.28s cubic-bezier(0.4,0,1,1) 0ms forwards;
        }
        .unplug-out .unplug-quote {
          animation: unplugOut 0.28s cubic-bezier(0.4,0,1,1) 40ms forwards;
        }
        .unplug-out .unplug-source {
          animation: unplugOut 0.28s cubic-bezier(0.4,0,1,1) 80ms forwards;
        }
      `;
      document.head.appendChild(s);
    }
    const t = setInterval(() => {
      setPhase('out');
      setTimeout(() => {
        setIdx(prev => {
          let next: number;
          do { next = Math.floor(Math.random() * UNPLUG_QUOTES.length); } while (next === prev);
          return next;
        });
        setPhase('in');
      }, 420);
    }, 20000);
    return () => clearInterval(t);
  }, []);

  const q = UNPLUG_QUOTES[idx];
  return (
    <div className={`mx-5 mb-28 unplug-${phase}`} style={{ minHeight: '88px' }}>
      <div className="unplug-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <FlatIcon name={q.icon} size={18} color="var(--ink)" />
        <span style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '10px', fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#d4450a' }}>
          Why Unplug?
        </span>
      </div>
      <p className="unplug-quote" style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: 1.5, color: '#1a1a1a', marginBottom: '8px', marginTop: 0 }}>
        "{q.text}"
      </p>
      <p className="unplug-source" style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '11px', fontStyle: 'italic', color: '#888', margin: 0 }}>
        — {q.source}
      </p>
    </div>
  );
}
const ABQ_FACTS = [
  { icon: 'mountain',  fact: 'ABQ sits at 5,312 ft elevation — higher than Denver, CO.' },
  { icon: 'sun',       fact: 'Albuquerque averages 310+ days of sunshine per year — one of the sunniest cities in the US.' },
  { icon: 'balloon',   fact: 'The Albuquerque International Balloon Fiesta draws 900,000+ visitors every October and is the largest hot air balloon event on Earth.' },
  { icon: 'history',   fact: 'Old Town Albuquerque was founded in 1706, making it one of the oldest European settlements in New Mexico.' },
  { icon: 'film',      fact: 'Breaking Bad was filmed almost entirely in ABQ — you can tour real filming locations around the city.' },
  { icon: 'food',      fact: 'New Mexico is the only US state with an official state question: "Red or green?" — referring to chile sauce.' },
  { icon: 'mountain',  fact: 'The Sandia Mountains turn vivid watermelon-pink at sunset — locals call the phenomenon "the watermelon."' },
  { icon: 'mountain',  fact: 'The Sandia Peak Tramway climbs 2,600 feet in just 15 minutes, offering a jaw-dropping view of the city below.' },
  { icon: 'wave',      fact: 'The Rio Grande Bosque in ABQ is one of the largest cottonwood riparian forests in North America.' },
  { icon: 'bird',      fact: 'The Rio Grande Bosque is a critical flyway for 400+ bird species, including sandhill cranes every winter.' },
  { icon: 'history',   fact: 'Petroglyph National Monument protects 20,000+ ancient rock carvings made by Ancestral Puebloans 400–700 years ago.' },
  { icon: 'road',      fact: 'Historic Route 66 runs right through Central Avenue in ABQ — cruise it for retro diners, neon signs, and local flavor.' },
  { icon: 'theatre',   fact: 'The KiMo Theatre, built in 1927, is a stunning example of Pueblo Deco architecture and a National Historic Landmark.' },
  { icon: 'beer',      fact: 'New Mexico has one of the highest concentrations of craft breweries per capita in the western US.' },
  { icon: 'cactus',    fact: 'ABQ sits in the high Chihuahuan Desert — expect warm sunny days and surprisingly cool evenings year-round.' },
  { icon: 'leaf',      fact: "The International Rattlesnake Museum in Old Town holds the world's largest collection of live rattlesnake species." },
  { icon: 'gem',       fact: "New Mexico's official state gem is turquoise — and the Turquoise Museum in ABQ has the world's largest private collection." },
  { icon: 'volcano',   fact: 'The Albuquerque Volcanoes — a line of five cinder cones on the West Mesa — are visible from much of the city and are under 150,000 years old.' },
  { icon: 'book',      fact: 'New Mexico has more PhD holders per capita than almost any other US state.' },
  { icon: 'science',   fact: "The world's first atomic bomb was detonated at Trinity Site, just 90 miles south of ABQ, on July 16, 1945." },
  { icon: 'food',      fact: 'The green chile cheeseburger is an unofficial state dish of New Mexico — and dozens of ABQ spots make an exceptional one.' },
  { icon: 'leaf',      fact: "New Mexico's state reptile is the New Mexico whiptail lizard — and it's all-female, reproducing without males." },
  { icon: 'park',      fact: 'The ABQ BioPark complex includes a world-class zoo, botanic garden, aquarium, and Tingley Beach — all connected by a scenic rail.' },
  { icon: 'museum',    fact: 'The National Museum of Nuclear Science and History in ABQ is the only congressionally chartered museum of its kind in the US.' },
  { icon: 'art',       fact: 'Meow Wolf was founded in Santa Fe, NM — the original House of Eternal Return is just an hour up I-25 and worth the trip.' },
  { icon: 'balloon',   fact: 'The Balloon Fiesta has been held every October since 1972 — it started with just 13 balloons; now it attracts 500+.' },
  { icon: 'rocket',    fact: "Spaceport America, the world's first purpose-built commercial spaceport, is just 2.5 hours south of ABQ." },
  { icon: 'sun',       fact: '"Sandia" means watermelon in Spanish — the mountains were named for the deep pink glow they cast at dusk.' },
  { icon: 'building',  fact: 'ABQ is nicknamed "The Duke City" after the Duke of Alburquerque (Spain) — an extra "r" was dropped over the centuries.' },
  { icon: 'leaf',      fact: 'Green chile season in late summer fills ABQ with the unmistakable smoky-sweet aroma of roasting chiles on street corners.' },
  { icon: 'art',       fact: 'New Mexico is said to have more registered artists per capita than any other US state.' },
  { icon: 'sun',       fact: "ABQ's West Mesa is thought to be one of the best spots in the state to watch the sunset — especially during Balloon Fiesta." },
  { icon: 'bicycle',   fact: 'The Paseo del Bosque Trail runs 16 miles along the Rio Grande and is entirely car-free — great for biking, jogging, or walking.' },
  { icon: 'bird',      fact: "New Mexico's state bird is the Greater Roadrunner — and yes, they really do run fast (up to 20 mph)." },
  { icon: 'food',      fact: 'The biscochito is the official state cookie of New Mexico — an anise-flavored shortbread traditionally made with lard.' },
  { icon: 'building',  fact: 'The University of New Mexico was founded in 1889 and is known for its Pueblo Revival architecture.' },
  { icon: 'community', fact: "About 38% of ABQ residents speak Spanish at home, reflecting the city's deep Hispanic roots." },
  { icon: 'compass',   fact: 'ABQ is at the crossroads of Interstates 25 and 40 — roughly the geographic center of New Mexico.' },
  { icon: 'food',      fact: 'The Frontier Restaurant near UNM has been serving students since 1971 and is famous for its cinnamon rolls.' },
  { icon: 'building',  fact: 'New Mexico became the 47th US state on January 6, 1912.' },
  { icon: 'snowflake', fact: 'It snows in ABQ — usually a few times a winter, but it rarely lasts more than a day or two at lower elevations.' },
  { icon: 'bird',      fact: 'Rio Grande Nature Center is a 270-acre state park within the city that protects wetlands and native wildlife.' },
  { icon: 'history',   fact: "ABQ's Maxwell Museum of Anthropology at UNM holds artifacts spanning 12,000+ years of human history in the region." },
  { icon: 'mountain',  fact: 'Kasha-Katuwe Tent Rocks National Monument — famous for its cone-shaped volcanic rock formations — is only 45 min from ABQ.' },
  { icon: 'star',      fact: "Kirtland Air Force Base on ABQ's south side is one of the largest military installations in New Mexico and a major local employer." },
  { icon: 'festival',  fact: 'Old Town ABQ hosts festive markets throughout the year, including Luminaria Night every December.' },
  { icon: 'museum',    fact: 'The Albuquerque Museum was founded in 1967 and its permanent collection spans 400 years of Rio Grande history.' },
  { icon: 'bicycle',   fact: 'ABQ has over 400 miles of bicycle routes — one of the most bike-friendly cities in the Southwest.' },
  { icon: 'science',   fact: 'Sandia National Laboratories in ABQ employs 14,000+ scientists and engineers and drives cutting-edge research.' },
  { icon: 'moon',      fact: "ABQ's clear skies and high elevation make it one of the best cities in the US for amateur stargazing." },
  { icon: 'star',      fact: 'The original spelling of the city was "Alburquerque" — matching the Spanish town. The extra "r" disappeared in the 1800s.' },
  { icon: 'volcano',   fact: 'The Albuquerque Volcanoes are a row of five cinder cones that erupted 150,000 years ago — their lava flow forms the West Mesa.' },
  { icon: 'music',     fact: 'The National Hispanic Cultural Center in ABQ is one of the largest institutions dedicated to Hispanic arts and culture in the world.' },
  { icon: 'community', fact: 'ABQ has a vibrant Día de los Muertos celebration every November — one of the largest outside of Mexico.' },
  { icon: 'leaf',      fact: "Bosque Preserve's cottonwoods turn golden every fall, creating a brilliant canopy that draws thousands of visitors." },
  { icon: 'festival',  fact: 'The New Mexico State Fair (held in ABQ every September) is one of the top 10 largest state fairs in the US.' },
  { icon: 'sports',    fact: 'ABQ is home to the Isotopes, the AAA Minor League affiliate of the Colorado Rockies — a beloved local team.' },
  { icon: 'sprout',    fact: 'New Mexico leads the US in production of chiles, piñon nuts, and pinto beans.' },
  { icon: 'art',       fact: "The original Nob Hill neighborhood was inspired by San Francisco's wealthy Nob Hill and became ABQ's eclectic arts & dining hub." },
  { icon: 'leaf',      fact: "Coyotes are commonly spotted in the Rio Grande Bosque and even in ABQ's urban neighborhoods — especially at dawn and dusk." },
  { icon: 'music',     fact: "ABQ's cultural scene includes the New Mexico Symphony, the Albuquerque Repertory Theatre, and dozens of live music venues." },
  { icon: 'road',      fact: 'The Turquoise Trail — a scenic byway from ABQ to Santa Fe — passes through ghost towns including Madrid, once a coal-mining hub.' },
  { icon: 'road',      fact: "ABQ's Rail Runner Express connects the city to Santa Fe — a 90-minute train ride through stunning high-desert scenery." },
  { icon: 'wave',      fact: 'The Rio Grande has flowed through New Mexico for over a million years, carving river valleys that Puebloans called home.' },
  { icon: 'leaf',      fact: "New Mexico's state reptile is the western box turtle — commonly found in the scrublands around ABQ." },
  { icon: 'music',     fact: 'ABQ has a thriving local music scene spanning indie rock, mariachi, flamenco, and hip-hop.' },
  { icon: 'science',   fact: 'Los Alamos National Lab (90 min from ABQ) employs more PhDs per capita than almost any city in the world.' },
  { icon: 'wave',      fact: 'The Adobe Bar at Taos Inn (2 hrs north of ABQ) has been pouring margaritas since 1936 — a legendary NM bucket list stop.' },
  { icon: 'food',      fact: "New Mexico's Official State Vegetables are the chile and the pinto bean — both officially adopted in 1965." },
];

// ─── User Preferences ─────────────────────────────────────────────────────────
interface UserPrefs {
  hiddenSections: string[];
  preferredInterests: string[];
}
const PREF_DEFAULT: UserPrefs = { hiddenSections: [], preferredInterests: [] };
const getPrefs = (): UserPrefs => {
  try { return { ...PREF_DEFAULT, ...JSON.parse(localStorage.getItem('abq_user_prefs') || '{}') }; }
  catch { return { ...PREF_DEFAULT }; }
};
const savePrefs = (p: UserPrefs) => { try { localStorage.setItem('abq_user_prefs', JSON.stringify(p)); } catch {} };

const PROFANITY_BLOCKED = ['fuck','shit','bitch','cunt','cock','pussy','nigger','nigga','faggot','retard','whore','slut'];
const hasProfanity = (s: string) => { const c = s.toLowerCase().replace(/[^a-z]/g, ''); return PROFANITY_BLOCKED.some(w => c.includes(w)); };

const DISCOVER_SECTIONS = [
  { id: 'thisWeek',      label: 'This Week Events',  emoji: 'calendar_month' },
  { id: 'nearYou',       label: 'Near You',          emoji: 'near_me' },
  { id: 'hiddenGems',    label: 'Hidden Gems',       emoji: 'auto_awesome' },
  { id: 'vibes',         label: 'Explore by Vibe',   emoji: 'tune' },
  { id: 'planWeekend',   label: 'Plan Your Weekend', emoji: 'map' },
  { id: 'todayPlan',     label: "Today's Plan",      emoji: 'assignment' },
  { id: 'wishlist',      label: 'My Wishlist',       emoji: 'favorite' },
];

const INTEREST_OPTIONS = [
  { id: 'music',    label: 'Music',            categories: ['entertainment'] },
  { id: 'sports',   label: 'Sports',           categories: ['fitness', 'park'] },
  { id: 'arts',     label: 'Arts',             categories: ['arts', 'museum'] },
  { id: 'outdoor',  label: '🌿 Outdoor',      categories: ['park'] },
  { id: 'family',   label: '👨‍👩‍👧 Family',     categories: ['entertainment', 'park'] },
  { id: 'active',   label: 'Active',           categories: ['fitness'] },
  { id: 'coffee',   label: '☕ Coffee',       categories: ['restaurant'] },
  { id: 'food',     label: '🍽️ Food & Drink', categories: ['restaurant'] },
  { id: 'bars',     label: 'Bars',             categories: ['bar'] },
  { id: 'parks',    label: '🌳 Parks',        categories: ['park'] },
  { id: 'shopping', label: '🛍️ Shopping',    categories: ['shopping'] },
  { id: 'museums',  label: '🏛️ Museums',     categories: ['arts', 'museum'] },
];

const placeMatchesInterests = (category: string, interests: string[]) =>
  interests.some(id => INTEREST_OPTIONS.find(o => o.id === id)?.categories.includes(category.toLowerCase()));

const sortByInterests = <T extends { category: string }>(items: T[], interests: string[]): T[] => {
  if (!interests.length) return items;
  return [...items].sort((a, b) =>
    (placeMatchesInterests(b.category, interests) ? 1 : 0) - (placeMatchesInterests(a.category, interests) ? 1 : 0)
  );
};

const EVENT_INTEREST_GENRES: Record<string, string[]> = {
  music: ['music'], sports: ['sports', 'sport'], arts: ['arts', 'theatre'], family: ['family'], outdoor: ['outdoor'],
};
const eventMatchesInterests = (event: TMEvent, interests: string[]) =>
  interests.some(id => EVENT_INTEREST_GENRES[id]?.some(g =>
    (event.classifications?.[0]?.segment?.name || '').toLowerCase().includes(g)
  ));

// ─── Wishlist localStorage helpers (with reminder support) ────────────────────
interface WishlistItem {
  id: string;
  name: string;
  type: string;
  category: string;
  eventDate?: string;       // ISO date string of the event
  reminderDays?: number;    // days before event to remind (0 = none)
  reminderSent?: boolean;   // whether reminder was already triggered
}
const getWishlist = (): WishlistItem[] => {
  try { return JSON.parse(localStorage.getItem('abq_wishlist') || '[]'); }
  catch { return []; }
};
const saveWishlist = (items: WishlistItem[]) => {
  localStorage.setItem('abq_wishlist', JSON.stringify(items));
  window.dispatchEvent(new Event('abq_wishlist_changed'));
};
const toggleWishlist = (item: WishlistItem) => {
  const current = getWishlist();
  const exists = current.some(w => w.id === item.id);
  trackEvent(exists ? 'wishlist_remove' : 'wishlist_add', { item_id: item.id, name: item.name, type: item.type });
  saveWishlist(exists ? current.filter(w => w.id !== item.id) : [...current, item]);
};
const setWishlistReminder = (id: string, reminderDays: number) => {
  const items = getWishlist();
  const idx = items.findIndex(w => w.id === id);
  if (idx >= 0) {
    items[idx].reminderDays = reminderDays;
    items[idx].reminderSent = false;
    saveWishlist(items);
  }
};
const isWishlisted = (id: string) => getWishlist().some(w => w.id === id);
const getWishlistItem = (id: string) => getWishlist().find(w => w.id === id);

// Sync reminder to server for background push notifications
async function syncReminderToServer(eventId: string, eventName: string, eventDate: string, reminderDays: number) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return; // No push subscription — can't send server push
    if (reminderDays === 0) {
      // Remove server-side reminder
      fetch('/api/save-reminder', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, eventId }),
      }).catch(() => {});
    } else {
      fetch('/api/save-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, eventId, eventName, eventDate, reminderDays }),
      }).catch(() => {});
    }
  } catch {}
}

// ─── Animated Like Button with Reminder Picker ──────────────────────────────
const REMINDER_OPTIONS = [
  { days: 0, label: 'No reminder' },
  { days: 1, label: '1 day before' },
  { days: 3, label: '3 days before' },
  { days: 7, label: '1 week before' },
];

function LikeButton({ id, type, name, category, eventDate }: { id: string; type: 'event'; name: string; category: string; eventDate?: string }) {
  const liked = isWishlisted(id);
  const [animating, setAnimating] = React.useState(false);
  const [showReminder, setShowReminder] = React.useState(false);
  const [selectedReminder, setSelectedReminder] = React.useState(() => {
    const item = getWishlistItem(id);
    return item?.reminderDays ?? 3;
  });
  const prevLiked = React.useRef(liked);
  const pickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (liked && !prevLiked.current) {
      setAnimating(true);
      // Show reminder picker when liking an event (not a place)
      if (type === 'event' && eventDate) {
        setTimeout(() => setShowReminder(true), 400);
      }
      const t = setTimeout(() => setAnimating(false), 550);
      return () => clearTimeout(t);
    }
    prevLiked.current = liked;
  }, [liked, type, eventDate]);

  // Close picker on outside click
  React.useEffect(() => {
    if (!showReminder) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowReminder(false);
      }
    };
    document.addEventListener('mousedown', handler);
    // Auto-close after 8 seconds
    const autoClose = setTimeout(() => setShowReminder(false), 8000);
    return () => { document.removeEventListener('mousedown', handler); clearTimeout(autoClose); };
  }, [showReminder]);

  const handleReminderSelect = (days: number) => {
    setSelectedReminder(days);
    setWishlistReminder(id, days);
    setShowReminder(false);
    if (days > 0) {
      trackEvent('reminder_set', { item_id: id, name, days });
    }
    // Sync to server for background push
    if (eventDate) syncReminderToServer(id, name, eventDate, days);
  };

  return (
    <>
      <button
        className={animating ? 'like-btn-pop like-btn-particles' : ''}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          background: liked ? 'var(--brand)' : 'rgba(255,255,255,0.90)',
          border: 'none', borderRadius: '50%', width: 44, height: 44, minHeight: 0, aspectRatio: '1', flexShrink: 0,
          color: liked ? 'white' : 'var(--brand)', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'background 0.2s ease, color 0.2s ease',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (liked && type === 'event' && eventDate) {
            // If already liked, toggle reminder picker
            setShowReminder(s => !s);
          } else if (liked) {
            toggleWishlist({ id, type, name, category, eventDate });
          } else {
            toggleWishlist({ id, type, name, category, eventDate, reminderDays: 3 });
            // Sync default 3-day reminder to server
            if (eventDate) syncReminderToServer(id, name, eventDate, 3);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          // Double-click always unlikes
          if (liked) toggleWishlist({ id, type, name, category, eventDate });
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: '18px',
            fontVariationSettings: liked ? "'FILL' 1, 'wght' 700" : "'FILL' 0, 'wght' 400",
            transition: 'font-variation-settings 0.2s ease',
          }}
        >
          favorite
        </span>
      </button>

      {/* Reminder Day Picker Popup */}
      {showReminder && (
        <div
          ref={pickerRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 56, right: 4, zIndex: 20,
            background: 'white', borderRadius: 12, padding: '12px 4px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            minWidth: 180, fontFamily: 'Public Sans, sans-serif',
            animation: 'reminderSlideIn 0.2s ease-out',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 8px', margin: 0 }}>
            Remind me
          </p>
          {REMINDER_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => handleReminderSelect(opt.days)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 10px', border: 'none', borderRadius: 8,
                background: selectedReminder === opt.days ? 'var(--brand)' : 'transparent',
                color: selectedReminder === opt.days ? 'white' : '#333',
                cursor: 'pointer', fontSize: 13, fontWeight: selectedReminder === opt.days ? 700 : 500,
                fontFamily: 'Public Sans, sans-serif', transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                {opt.days === 0 ? 'notifications_off' : 'notifications_active'}
              </span>
              {opt.label}
            </button>
          ))}
          <div style={{ padding: '8px 10px 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
            <button
              onClick={() => { toggleWishlist({ id, type, name, category, eventDate }); setShowReminder(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 0', border: 'none', background: 'none',
                color: '#c62828', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: 'Public Sans, sans-serif',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>heart_minus</span>
              Remove from saved
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Day Plan localStorage helpers ────────────────────────────────────────────
const getDayPlan = (): { date: string; items: { id: string; text: string; done: boolean }[] } => {
  const today = new Date().toDateString();
  try {
    const s = JSON.parse(localStorage.getItem('abq_day_plan') || 'null');
    return s?.date === today ? s : { date: today, items: [] };
  } catch { return { date: today, items: [] }; }
};
const saveDayPlan = (plan: { date: string; items: { id: string; text: string; done: boolean }[] }) => {
  localStorage.setItem('abq_day_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('abq_plan_changed'));
};
const addToDayPlan = (steps: string[]) => {
  const plan = getDayPlan();
  const newItems = steps.map(text => ({ id: Date.now().toString() + Math.random(), text, done: false }));
  saveDayPlan({ ...plan, items: [...plan.items, ...newItems] });
};

// ─── Streak tracker ────────────────────────────────────────────────────────────
const STREAK_KEY = 'abq_streak';
function getStreak(): { count: number; lastVisit: string } {
  try { const raw = localStorage.getItem(STREAK_KEY); if (!raw) return { count: 0, lastVisit: '' }; return JSON.parse(raw); }
  catch { return { count: 0, lastVisit: '' }; }
}
function tickStreak(): { count: number; isNew: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const s = getStreak();
  if (s.lastVisit === today) return { count: s.count, isNew: false };
  const newCount = s.lastVisit === yesterday ? s.count + 1 : 1;
  try { localStorage.setItem(STREAK_KEY, JSON.stringify({ count: newCount, lastVisit: today })); } catch {}
  return { count: newCount, isNew: true };
}

function StreakBanner() {
  const [info] = useState(() => tickStreak());
  const [visible, setVisible] = useState(true);
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!visible || info.count < 2) return;
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [visible, info.count]);
  if (!visible || info.count < 2) return null;
  const emoji = info.count >= 7 ? 'local_fire_department' : info.count >= 3 ? 'bolt' : 'waving_hand';
  const label = info.count >= 7
    ? `${info.count}-day streak!`
    : info.count >= 3
    ? `${info.count} days in a row`
    : `Welcome back! Day ${info.count}`;
  return (
    <div style={{
      position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 56px)', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: '#1a1a1a', color: 'white', borderRadius: '20px',
      padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)', animation: 'streakToastIn 0.3s ease, streakToastOut 0.4s ease 3.6s forwards',
      fontFamily: 'Public Sans, sans-serif', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <style>{`
        @keyframes streakToastIn { from { opacity:0; transform:translateX(-50%) translateY(-16px) scale(0.92); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
        @keyframes streakToastOut { from { opacity:1; transform:translateX(-50%) translateY(0); } to { opacity:0; transform:translateX(-50%) translateY(-12px); } }
      `}</style>
      <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1", color: info.count >= 7 ? '#ff6b35' : info.count >= 3 ? '#fbbf24' : 'var(--brand)' }}>{emoji}</span>
      {label}
    </div>
  );
}

// ─── Daily Gem (date-seeded spot of the day) ──────────────────────────────────

// ─── Featured Event Banner ───────────────────────────────────────────────────
// Time-limited override: shows a specific event prominently on Discover.
// After the expiry date, falls through to DailyGem automatically.
const FEATURED_EVENT_ID = 'easter-sunrise-abq-2026';
const FEATURED_EVENT_EXPIRY = '2026-04-06'; // Show through Sunday April 5

function FeaturedEventBanner({ events, onSelect }: { events: TMEvent[]; onSelect: (e: TMEvent) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  if (today >= FEATURED_EVENT_EXPIRY) return null;
  // Try filtered events first. If missing (race condition: Supabase's copy lacks
  // a URL so hasActionableLink removes it, while the static copy was already deduped
  // against it), fall back directly to raw static data so the banner never vanishes.
  let ev = events.find(e => e.id === FEATURED_EVENT_ID);
  if (!ev) {
    const staticSrc = ALL_EVENTS.find(e => e.id === FEATURED_EVENT_ID);
    if (!staticSrc) return null;
    ev = staticEventToTMEvent(staticSrc);
  }
  const img = ev.images?.[0]?.url || '';
  const venue = ev._embedded?.venues?.[0]?.name || '';
  const dateStr = ev.dates?.start?.localDate || '';
  const timeStr = ev.dates?.start?.localTime || '';
  const fmtDate = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const fmtTime = timeStr ? (() => { const [h, m] = timeStr.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; })() : '';

  return (
    <div className="px-5 pb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black uppercase flex items-center gap-1.5" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--brand)', borderRadius: 2, flexShrink: 0 }} />
          Featured Event
        </h2>
        <span className="text-xs font-black uppercase" style={{ color: '#666', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '3px' }}>star</span>
          This Weekend
        </span>
      </div>
      <button onClick={() => onSelect(ev)} className="w-full relative overflow-hidden text-left"
        style={{ height: '220px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.12)', animation: 'cardFadeIn 0.45s ease both', borderRadius: '10px' }}>
        <img src={img} alt={ev.name} className="w-full h-full object-cover" style={{ filter: 'brightness(0.75)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(194,99,74,0.2) 0%, rgba(0,0,0,0.78) 100%)' }} />
        <div className="absolute top-3 left-3">
          <span className="text-xs font-black px-3 py-1.5"
            style={{ background: 'linear-gradient(135deg, #E8A838, #C2634A)', color: 'white', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            ★ FEATURED EVENT
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-sm font-black w-8 h-8 flex items-center justify-center"
            style={{ background: 'var(--brand)', color: 'white', borderRadius: 6 }}>→</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-black text-xl leading-tight" style={{ fontFamily: 'Public Sans, sans-serif', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{ev.name}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {fmtDate && <span className="text-white/90 text-xs font-bold" style={{ fontFamily: 'Public Sans, sans-serif' }}>{fmtDate}</span>}
            {fmtTime && <><span className="text-white/40 text-xs">·</span><span className="text-white/90 text-xs font-bold">{fmtTime}</span></>}
            {venue && <><span className="text-white/40 text-xs">·</span><span className="text-white/80 text-xs font-semibold">{venue}</span></>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-black px-2 py-0.5" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 4, backdropFilter: 'blur(4px)' }}>FREE</span>
            <span className="text-white/60 text-xs">No tickets required</span>
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Ko-fi Support Banner ─────────────────────────────────────────────────────
function KoFiBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('abq_kofi_dismissed') === '1'; } catch { return false; }
  });
  if (dismissed) return null;
  return (
    <div className="mx-5 mb-6 rounded-lg overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1a00 100%)', animation: 'cardFadeIn 0.5s ease both' }}>
      <div className="px-4 py-4 flex items-center gap-3">
        <span style={{ fontSize: '28px', lineHeight: 1 }}>☕</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm" style={{ fontFamily: 'Public Sans, sans-serif' }}>Built for ABQ, by ABQ</p>
          <p className="text-white/60 text-xs mt-0.5" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            Free forever. If it helped you find something great — buy us a coffee.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="https://ko-fi.com/stopscrolling" target="_blank" rel="noopener noreferrer"
            className="text-xs font-black px-3 py-2 rounded-lg text-white"
            style={{ background: '#FF5E5B', fontFamily: 'Public Sans, sans-serif', whiteSpace: 'nowrap' }}>
            Support ♥
          </a>
          <button onClick={() => { try { localStorage.setItem('abq_kofi_dismissed','1'); } catch {} setDismissed(true); }}
            className="text-white/40" style={{ fontSize:'18px', lineHeight:1 }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── AnimatedFact component ────────────────────────────────────────────────────

function AnimatedFact() {
  const [facts] = useState(() => [...ABQ_FACTS].sort(() => Math.random() - 0.5).slice(0, 3));
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % facts.length); setVisible(true); }, 350);
    }, 5500);
    return () => clearInterval(t);
  }, [facts.length]);
  const next = () => {
    setVisible(false);
    setTimeout(() => { setIdx(i => (i + 1) % facts.length); setVisible(true); }, 250);
  };
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)', marginBottom: '12px' }}>
        <p className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>Did You Know?</p>
      </div>
      <div className="px-5">
        <button onClick={next} className="w-full p-5 text-left" style={{ background: 'var(--brand)', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', minHeight: 96, borderRadius: 6 }}>
          <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}>
            <FlatIcon name={facts[idx].icon} size={28} color="var(--ink)" />
            <p className="text-sm mt-2 leading-relaxed font-semibold" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>{facts[idx].fact}</p>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {[0,1,2,3,4].map(d => (
                <div key={d} className="w-1.5 h-1.5 transition-colors" style={{ backgroundColor: d === idx % 5 ? 'var(--ink)' : 'rgba(0,0,0,0.2)' }} />
              ))}
            </div>
            <span className="text-xs font-black" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)', letterSpacing: '0.05em' }}>TAP FOR NEXT ›</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── DayPlanner component ──────────────────────────────────────────────────────
function DayPlanner() {
  const [plan, setPlan] = useState(getDayPlan);
  const [input, setInput] = useState('');
  useEffect(() => {
    const handler = () => setPlan(getDayPlan());
    window.addEventListener('abq_plan_changed', handler);
    return () => window.removeEventListener('abq_plan_changed', handler);
  }, []);
  const save = (next: ReturnType<typeof getDayPlan>) => { setPlan(next); saveDayPlan(next); };
  const addItem = (text: string) => {
    if (!text.trim()) return;
    save({ ...plan, items: [...plan.items, { id: Date.now().toString(), text: text.trim(), done: false }] });
    setInput('');
  };
  const toggle = (id: string) => save({ ...plan, items: plan.items.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  const remove = (id: string) => save({ ...plan, items: plan.items.filter(i => i.id !== id) });
  const done = plan.items.filter(i => i.done).length;
  return (
    <div className="mx-5 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-black tracking-widest text-gray-400 uppercase" style={{ fontFamily: 'Public Sans, sans-serif' }}>MY ABQ</p>
        <span className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #f3f4f6' }}>
        {plan.items.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round((done / plan.items.length) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>{done}/{plan.items.length}</span>
          </div>
        )}
        {plan.items.length === 0 && (
          <div className="py-5 text-center">
            <span className="text-2xl">📋</span>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>Add things to do in ABQ today</p>
          </div>
        )}
        {plan.items.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #f9fafb' }}>
            <button onClick={() => toggle(item.id)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors" style={{ border: `2px solid ${item.done ? '#22c55e' : '#d1d5db'}`, backgroundColor: item.done ? '#22c55e' : 'transparent' }}>
              {item.done && <span className="text-white text-xs font-bold">✓</span>}
            </button>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(item.text + ' Albuquerque NM')}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm" style={{ fontFamily: 'Public Sans, sans-serif', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#9ca3af' : '#111827', display: 'flex', alignItems: 'center' }}>{item.text}</a>
            <button onClick={() => remove(item.id)} className="text-gray-200 hover:text-gray-400 text-sm ml-2">✕</button>
          </div>
        ))}
        <div className="flex gap-2 p-3">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem(input)} placeholder="Add something to do..." className="flex-1 text-sm rounded-lg px-3 py-2 outline-none" style={{ fontFamily: 'Public Sans, sans-serif', backgroundColor: '#f9fafb' }} />
          <button onClick={() => addItem(input)} className="text-white rounded-lg px-4 py-2 text-sm font-bold" style={{ backgroundColor: '#f97316', fontFamily: 'Public Sans, sans-serif' }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ─── MyWishlist component ──────────────────────────────────────────────────────
function MyWishlist() {
  const [items, setItems] = useState(getWishlist);
  useEffect(() => {
    const handler = () => setItems(getWishlist());
    window.addEventListener('abq_wishlist_changed', handler);
    return () => window.removeEventListener('abq_wishlist_changed', handler);
  }, []);
  const remove = (id: string) => {
    const next = items.filter(i => i.id !== id);
    saveWishlist(next);
  };
  return (
    <div className="mx-5 mb-6">
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-xs font-black tracking-widest text-gray-400 uppercase" style={{ fontFamily: 'Public Sans, sans-serif' }}>MY WISHLIST</p>
        {items.length > 0 && <span className="text-xs font-bold" style={{ color: '#f97316', fontFamily: 'Public Sans, sans-serif' }}>{items.length} saved</span>}
      </div>
      {items.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-5 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🤍</span>
          <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>Tap ♡ on any event to save it here for later</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg p-4 flex items-center gap-3" style={{ border: '1px solid #f3f4f6' }}>
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '20px', color: 'var(--brand)', fontVariationSettings: "'FILL' 1" }}>{item.type === 'event' ? 'calendar_month' : 'location_on'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>{item.name}</p>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>{item.category}</p>
              </div>
              <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0 transition-colors">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── JSON-LD Event Schema for SEO ────────────────────────────────────────────
function generateEventJsonLd(event: TMEvent): string {
  const venue = event._embedded?.venues?.[0];
  const image = getBestEventImage(event.images);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: event.dates?.start?.dateTime || event.dates?.start?.localDate || '',
    description: event.info || event.name,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };
  if (image) schema.image = image;
  if (event.url) schema.url = event.url;
  if (venue) {
    schema.location = {
      '@type': 'Place',
      name: venue.name || 'Venue',
      address: {
        '@type': 'PostalAddress',
        streetAddress: venue.address?.line1 || '',
        addressLocality: venue.city?.name || 'Albuquerque',
        addressRegion: venue.state?.stateCode || 'NM',
        postalCode: venue.postalCode || '',
        addressCountry: 'US',
      },
    };
    if (venue.location?.latitude && venue.location?.longitude) {
      schema.location.geo = {
        '@type': 'GeoCoordinates',
        latitude: venue.location.latitude,
        longitude: venue.location.longitude,
      };
    }
  }
  // Price info
  const priceRanges = event.priceRanges;
  if (priceRanges && priceRanges.length > 0) {
    schema.offers = {
      '@type': 'Offer',
      price: priceRanges[0].min || 0,
      priceCurrency: priceRanges[0].currency || 'USD',
      availability: 'https://schema.org/InStock',
      url: event.url || '',
    };
  }
  return JSON.stringify(schema);
}

// ─── Skeleton Screen ─────────────────────────────────────────────────────────
function EventCardSkeleton() {
  return (
    <div className="animate-pulse" style={{ width: '280px', minWidth: '280px', borderRadius: '16px', overflow: 'hidden', background: 'white', border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
      <div style={{ height: '160px', background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)' }} />
      <div style={{ padding: '14px' }}>
        <div style={{ height: '14px', background: '#e5e7eb', borderRadius: '4px', width: '75%', marginBottom: '10px' }} />
        <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '4px', width: '50%', marginBottom: '8px' }} />
        <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '4px', width: '30%' }} />
      </div>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div style={{ padding: '0 20px' }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} className="animate-pulse" style={{ display: 'flex', gap: '12px', padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: '14px', background: '#e5e7eb', borderRadius: '4px', width: '70%', marginBottom: '8px' }} />
            <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '4px', width: '40%', marginBottom: '6px' }} />
            <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '4px', width: '25%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Small thumbnail for calendar day list — shows image with fallback to category icon
function CalEventThumb({ img, typeMeta, onClick }: { img: string; typeMeta: { bg: string; icon: string }; onClick: () => void }) {
  const [broken, setBroken] = React.useState(false);
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', flexShrink: 0, width: 50, height: 50, borderRadius: 8, overflow: 'hidden', background: typeMeta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {img && !broken
        ? <img src={img} alt="" style={{ width: 50, height: 50, objectFit: 'cover', display: 'block' }} onError={() => setBroken(true)} />
        : <FlatIcon name={typeMeta.icon} size={22} color="white" />
      }
    </div>
  );
}

function DiscoverScreen({
  events, eventsLoading, onEventSelect,
  coords, geoRequested, geoSilentPending, geoError, onRequestGeo,
  onNavigateEvents, prefs, adminHeroLines,
}: {
  events: TMEvent[];
  eventsLoading?: boolean;
  onEventSelect: (e: TMEvent) => void;
  coords: GeoCoords | null;
  geoRequested: boolean;
  geoSilentPending: boolean;
  geoError: string | null;
  onRequestGeo: () => void;
  onNavigateEvents?: (genre?: string) => void;
  prefs?: UserPrefs;
  adminHeroLines?: string[] | null;
}) {
  const hidden = prefs?.hiddenSections ?? [];
  const interests = prefs?.preferredInterests ?? [];
  // ── One-shot typing animation for hero ────────────────────────────────────
  const HERO_PHRASES = [
    // Motivational / get moving
    'Go Do Something', 'Time to Get Outside', 'Stop Doomscrolling', 'Put the Phone Down',
    'Touch Some Grass', 'Go See People', 'Time to Unplug', 'Get Out of the House',
    'Close the Laptop', 'Your Couch Can Wait', 'The City Is Calling', 'Life Is Short',
    'Be a Local', 'Get Off the Wifi', 'The Sun Is Out', 'No More Excuses',
    'Adventure Awaits', 'Go Find Trouble', 'Say Yes to Fun', 'Make Some Memories',
    // ABQ-specific
    'Go Explore ABQ', 'The Duke City Awaits', 'Hatch Chile Season', 'Route 66 Vibes',
    'Balloon Fiesta Mode', 'Old Town Is Calling', 'Sandia Peak Sunset', 'Bosque Trail Time',
    'Rio Grande Vibes', 'Nob Hill Stroll', 'Find Your Spot', 'Go Be a Tourist',
    'Sawmill District', 'Barelas Calling', 'South Valley Gems', 'East Mountains Trip',
    'Petroglyph Hike', 'Tram Ride Day', 'Tingley Beach Walk', 'BioPark Day',
    // Food & drink
    'Grab a Bite', 'Coffee Run Time', 'Brunch O\'Clock', 'Happy Hour Somewhere',
    'Taco Tuesday Vibes', 'Brewery Crawl Time', 'Try Something New', 'Eat Local',
    'Chile Verde or Rojo?', 'Sopapilla Weather', 'Go Get Breakfast', 'Food Truck Hunt',
    'Date Night Dinner', 'Rooftop Drinks', 'Dessert First', 'Pizza Night Out',
    // Music & culture
    'See Live Music', 'Gallery Night Out', 'Find Some Art', 'Go See a Show',
    'Open Mic Night', 'Support Local Music', 'Catch a Comedy Set', 'Poetry Slam Night',
    'Museum Day Trip', 'Street Art Walk', 'Indie Film Night', 'Go See a Band',
    // Weekend / chill
    'Weekend Mode On', 'Sunday Funday', 'Lazy Day Over', 'No Plans? Fix That',
    'What Are You Doing?', 'Plans Tonight?', 'Let\'s Go Already', 'You Deserve Fun',
    'Treat Yourself', 'Main Character Energy', 'Be Spontaneous', 'Just Go',
    'Touch Grass Now', 'Explore Something', 'Pick a Vibe', 'Try a New Spot',
    // Seasonal / time of day
    'Sunset Chase Time', 'Golden Hour Walk', 'Morning Hike?', 'Late Night ABQ',
    'Stargazing Tonight', 'Perfect Patio Weather', 'Farmers Market Day', 'Festival Season',
    // Playful / weird
    'Your Dog Needs This', 'Bring Your Friends', 'Text the Group Chat', 'Rally the Crew',
    'Cancel Netflix', 'Delete the App', 'Swipe Right on ABQ', 'Log Off Already',
    'Fresh Air Exists', 'The Wi-Fi Is Bad Here', 'Nature Is Free', 'Grass Is Real',
    'Go Touch a Cactus', 'Find a Mural', 'Wander Around', 'Get Wonderfully Lost',
  ];
  const [heroDisplay, setHeroDisplay] = useState('');
  const [heroDone, setHeroDone] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(true);
  const [discoverFilter, setDiscoverFilter] = useState<'Tonight' | 'This Weekend' | 'Free' | 'Volunteer'>('Tonight');
  useEffect(() => {
    let cancelled = false;
    const phrasePool = (adminHeroLines?.length) ? adminHeroLines : HERO_PHRASES;
    const target = phrasePool[Math.floor(Math.random() * phrasePool.length)];
    let charIdx = 0;
    let current = '';
    const typeSpeed = () => 45 + Math.random() * 55;
    const shouldTypo = () => Math.random() < 0.08;
    const TYPO_NEARBY: Record<string, string> = { a:'s',s:'d',d:'f',f:'g',g:'h',h:'j',t:'r',i:'o',o:'p',e:'r',n:'m',l:'k' };

    const tick = () => {
      if (cancelled) return;
      if (charIdx < target.length) {
        const ch = target[charIdx];
        if (shouldTypo() && charIdx > 2 && charIdx < target.length - 2 && TYPO_NEARBY[ch.toLowerCase()]) {
          const wrongChar = ch === ch.toUpperCase() ? TYPO_NEARBY[ch.toLowerCase()].toUpperCase() : TYPO_NEARBY[ch.toLowerCase()];
          current += wrongChar;
          setHeroDisplay(current);
          setTimeout(() => {
            if (cancelled) return;
            current = current.slice(0, -1);
            setHeroDisplay(current);
            setTimeout(() => {
              if (cancelled) return;
              current += ch;
              charIdx++;
              setHeroDisplay(current);
              setTimeout(tick, typeSpeed());
            }, 80 + Math.random() * 40);
          }, 150 + Math.random() * 100);
          return;
        }
        current += ch;
        charIdx++;
        setHeroDisplay(current);
        const delay = (ch === ' ' || ch === ',') ? typeSpeed() * 1.8 : typeSpeed();
        setTimeout(tick, delay);
      } else {
        // Done — hide cursor after a beat
        setTimeout(() => { if (!cancelled) setHeroDone(true); }, 800);
      }
    };
    setTimeout(tick, 600);
    return () => { cancelled = true; };
  }, []);

  // Use local date (Mountain Time friendly) for today comparisons
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  // Weekend date range helpers
  const weekendRange = useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun,6=Sat
    // Days until Saturday (day 6). If today is Sun(0), that's 6 days; Sat(6) → 0; etc.
    const daysToSat = dow === 0 ? 6 : 6 - dow;
    const sat = new Date(now); sat.setDate(now.getDate() + daysToSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return { sat: sat.toLocaleDateString('en-CA'), sun: sun.toLocaleDateString('en-CA') };
  }, []);

  // Full pool for the active filter (unsampled) — used for count in subtitle
  const filterPool = useMemo(() => {
    if (discoverFilter === 'Tonight') {
      return events.filter(e => (e.dates?.start?.localDate || '') === todayStr && !e._isAdult);
    } else if (discoverFilter === 'This Weekend') {
      return events.filter(e => {
        const d = e.dates?.start?.localDate || '';
        return (d === weekendRange.sat || d === weekendRange.sun) && !e._isAdult;
      });
    } else if (discoverFilter === 'Free') {
      const sevenDays = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA');
      return events.filter(e => e.isFree && !e._isAdult && (e.dates?.start?.localDate || '') >= todayStr && (e.dates?.start?.localDate || '') <= sevenDays);
    } else { // Volunteer
      const sevenDays = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA');
      return events.filter(e => {
        const cats = e.classifications?.[0];
        const name = (e.name || '').toLowerCase();
        const d = e.dates?.start?.localDate || '';
        return !e._isAdult && d >= todayStr && d <= sevenDays && (
          name.includes('volunteer') || name.includes('community') ||
          cats?.segment?.name?.toLowerCase().includes('volunteer') ||
          cats?.genre?.name?.toLowerCase().includes('volunteer') ||
          cats?.segment?.name?.toLowerCase().includes('community')
        );
      });
    }
  }, [events, discoverFilter, todayStr, weekendRange]);

  // Sampled list for the section (3–5, shuffled), sorted by time for Tonight
  const filteredDiscoverEvents = useMemo(() => {
    const shuffled = [...filterPool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(filterPool.length, 5));
    if (discoverFilter === 'Tonight') {
      return picked.sort((a, b) => (a.dates?.start?.localTime || '').localeCompare(b.dates?.start?.localTime || ''));
    }
    return picked;
  }, [filterPool, discoverFilter]);

  // Fallback week events when filterPool is empty
  const thisWeekEvents = useMemo(() => {
    const sevenDays = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA');
    const pool = events.filter(e => {
      const d = e.dates?.start?.localDate || '';
      return d > todayStr && d <= sevenDays && !e._isAdult;
    });
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  }, [events, todayStr]);

  // Hero event — one random event from the same filter pool
  const heroEvent = useMemo(() => {
    const pool = filterPool.length > 0
      ? filterPool
      : events.filter(e => (e.dates?.start?.localDate || '') >= todayStr && !e._isAdult);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [filterPool, events, todayStr]);

  // Section metadata per filter
  const filterMeta = useMemo(() => ({
    'Tonight':      { label: "Tonight's Events",       seeAllFilter: 'Tonight',      subtitle: (n: number) => n > 0 ? `${n} event${n !== 1 ? 's' : ''} happening tonight` : `${events.length.toLocaleString()} upcoming events in Albuquerque` },
    'This Weekend': { label: 'This Weekend',            seeAllFilter: 'This Weekend', subtitle: (n: number) => n > 0 ? `${n} event${n !== 1 ? 's' : ''} this weekend`      : `${events.length.toLocaleString()} upcoming events in Albuquerque` },
    'Free':         { label: 'Free Events',             seeAllFilter: 'Free',         subtitle: (n: number) => n > 0 ? `${n} free event${n !== 1 ? 's' : ''} this week`     : `${events.length.toLocaleString()} upcoming events in Albuquerque` },
    'Volunteer':    { label: 'Volunteer Opportunities', seeAllFilter: 'Volunteer',    subtitle: (n: number) => n > 0 ? `${n} volunteer opportunit${n !== 1 ? 'ies' : 'y'} this week` : `${events.length.toLocaleString()} upcoming events in Albuquerque` },
  } as Record<string, { label: string; seeAllFilter: string; subtitle: (n: number) => string }>), [events.length]);

  return (
    <div className="w-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      {/* Streak Banner */}
      <StreakBanner />

      {/* Hero — value prop + filter pills + featured event card */}
      <div style={{ background: "url('/hero-texture.webp') center/cover no-repeat, var(--bg)", borderTop: '3px solid var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs font-black uppercase mb-2" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.12em' }}>
            Greater ABQ Metro
          </p>
          <h1 className="font-black leading-none mt-1 mb-1" style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '40px', letterSpacing: '-0.04em', color: 'var(--ink)', minHeight: '48px' }}>
            {heroDisplay}{!heroDone && <span style={{ display: 'inline-block', width: '3px', height: '0.85em', background: 'var(--ink)', marginLeft: '2px', verticalAlign: 'baseline', animation: 'cursorBlink 0.8s step-end infinite' }} />}
          </h1>
          <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '12px', color: 'var(--ink)', opacity: 0.65, fontWeight: 500, marginBottom: '14px' }}>
            {filterMeta[discoverFilter].subtitle(filterPool.length)}
          </p>
        </div>
        {/* Filter pills — control the hero event card, don't navigate away */}
        <div className="flex px-5 pb-3 gap-2" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
          {([
            { label: '🌙 Tonight',    value: 'Tonight'      as const },
            { label: 'This Weekend',  value: 'This Weekend' as const },
            { label: 'Free Events',   value: 'Free'         as const },
            { label: 'Volunteer',     value: 'Volunteer'    as const },
          ]).map(chip => {
            const active = discoverFilter === chip.value;
            return (
              <button key={chip.value} onClick={() => setDiscoverFilter(chip.value)}
                style={{
                  flexShrink: 0,
                  height: active ? '36px' : '30px',
                  padding: active ? '0 18px' : '0 14px',
                  background: active ? 'var(--brand)' : 'rgba(255,255,255,0.85)',
                  border: active ? 'none' : '1px solid rgba(194,99,74,0.3)',
                  fontFamily: 'Public Sans, sans-serif',
                  fontSize: active ? '13px' : '12px',
                  fontWeight: active ? 800 : 700,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  borderRadius: 6,
                  whiteSpace: 'nowrap' as const,
                  color: active ? 'white' : 'var(--ink)',
                  boxShadow: active ? '0 2px 8px rgba(185,92,67,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}>
                {chip.label}
              </button>
            );
          })}
        </div>
        {/* Hero event card — full bleed image, animated entrance */}
        {heroEvent && (() => {
          // Pick best image regardless of ratio/width — supports both TM and Eventbrite
          const hImg = heroEvent.images?.find((im: any) => (im.ratio === '16_9' || im.ratio === '3_2') && (im.width || 0) > 400)?.url
            || heroEvent.images?.find((im: any) => !im.fallback)?.url
            || heroEvent.images?.[0]?.url || '';
          const hDate = heroEvent.dates?.start?.localDate;
          const hTime = heroEvent.dates?.start?.localTime;
          const hVenue = heroEvent._embedded?.venues?.[0];
          const hVenueName = hVenue?.name || '';
          const hDateFmt = hDate ? new Date(hDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
          const hTimeFmt = hTime ? formatTime(hTime) : '';
          return (
            <button
              onClick={() => onEventSelect(heroEvent)}
              className="w-full text-left"
              style={{ display: 'block', marginBottom: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', animation: 'heroCardReveal 0.45s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              <div style={{ position: 'relative', paddingTop: '54%', overflow: 'hidden' }}>
                {hImg
                  ? <img src={hImg} alt={heroEvent.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', animation: 'heroImgZoom 8s ease-out forwards' }} />
                  : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--brand) 0%, #7c3a0f 100%)' }} />
                }
                {/* Multi-layer gradient for cinematic look */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 60%)' }} />
                {/* Filter badge top-left */}
                <div style={{ position: 'absolute', top: 10, left: 12, background: 'var(--brand)', padding: '3px 8px', borderRadius: 4 }}>
                  <span style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 9, fontWeight: 900, color: 'white', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
                    {discoverFilter === 'Tonight' ? '🌙 Tonight' : discoverFilter === 'This Weekend' ? 'This Weekend' : discoverFilter === 'Free' ? 'Free Event' : 'Volunteer'}
                  </span>
                </div>
                {/* Text content — slides up on mount */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 14px 12px', animation: 'heroTextSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}>
                  <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '19px', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 5, letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 4px rgba(0,0,0,0.4)' } as React.CSSProperties}>
                    {heroEvent.name}
                  </p>
                  <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.03em' }}>
                    {[hDateFmt, hTimeFmt, hVenueName].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {/* Tap to view pill */}
                <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'white', borderRadius: 20, padding: '5px 12px 5px 10px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.3)', animation: 'heroTextSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.2s both' }}>
                  <span style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 11, fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.02em' }}>View event</span>
                  <span style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 900 }}>→</span>
                </div>
              </div>
            </button>
          );
        })()}
      </div>

      {/* Geo Banner */}
      <GeoBanner
        coords={coords}
        error={geoError}
        requested={geoRequested}
        silentPending={geoSilentPending}
        onRequest={onRequestGeo}
      />

      {/* Filtered Events List — controlled by discoverFilter pills */}
      {!hidden.includes('thisWeek') && (() => {
        const meta = filterMeta[discoverFilter];
        const usingFallback = filteredDiscoverEvents.length === 0 && thisWeekEvents.length > 0;
        const displayEvents = filteredDiscoverEvents.length > 0 ? filteredDiscoverEvents : thisWeekEvents;
        return (
          <>
            {eventsLoading && displayEvents.length === 0 && (
              <div className="mb-5 mx-5" style={{ border: '1px solid var(--brand-tint-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'var(--bg)' }}>
                  <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em' }}>{meta.label}</h2>
                  <span className="text-xs font-black" style={{ color: '#aaa' }}>Loading…</span>
                </div>
                {[0,1,2].map(i => (
                  <div key={i} className="flex" style={{ borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.08)' : 'none', height: 64 }}>
                    <div style={{ width: 62, backgroundColor: '#e8e8e8' }} />
                    <div className="flex-1 px-3 py-2" style={{ backgroundColor: '#f5f5f5', opacity: 0.7 }} />
                    <div style={{ width: 48, backgroundColor: '#e8e8e8', borderLeft: '1px solid #ccc' }} />
                  </div>
                ))}
              </div>
            )}
            {displayEvents.length > 0 && (
              <div className="mb-5 mx-5" style={{ border: '1px solid var(--brand-tint-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'var(--bg)' }}>
                  <div>
                    <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>
                      {usingFallback ? 'Events This Week' : meta.label}
                    </h2>
                    {usingFallback && (
                      <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 10, color: '#aaa', fontWeight: 600, marginTop: 1 }}>
                        Nothing found — here's this week's picks
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onNavigateEvents?.(meta.seeAllFilter)}
                    className="text-xs font-black uppercase"
                    style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)', letterSpacing: '0.06em' }}
                  >
                    SEE ALL →
                  </button>
                </div>
                {/* Rows */}
                {displayEvents.map((event, idx, arr) => {
                  const dateStr = event.dates?.start?.localDate;
                  const timeStr = event.dates?.start?.localTime;
                  const venue = event._embedded?.venues?.[0];
                  const d = dateStr ? new Date(dateStr + 'T12:00:00') : null;
                  const month = d ? d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
                  const day = d ? d.getDate() : '';
                  const time = timeStr ? formatTime(timeStr) : '';
                  const venueName = venue?.name ? venue.name.toUpperCase() : '';
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventSelect(event)}
                      className="flex w-full text-left"
                      style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(0,0,0,0.10)' : 'none', backgroundColor: 'var(--bg)' }}
                    >
                      {/* Date block */}
                      <div className="flex flex-col items-center justify-center flex-shrink-0"
                        style={{ width: 52, backgroundColor: 'var(--brand)', minHeight: 52 }}>
                        <span className="font-black uppercase" style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em', lineHeight: 1 }}>
                          {month}
                        </span>
                        <span className="font-black" style={{ fontSize: 22, color: '#fff', fontFamily: 'Public Sans, sans-serif', lineHeight: 1.1 }}>
                          {day}
                        </span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 px-3 py-2 flex flex-col justify-center overflow-hidden">
                        <p className="font-black text-sm leading-tight" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {event.name}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.02em' }}>
                          {[time, venueName].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {/* Arrow */}
                      <div className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 38, backgroundColor: 'var(--brand)', borderLeft: '1px solid rgba(0,0,0,0.08)' }}>
                        <span className="font-black" style={{ fontSize: 14, color: 'var(--ink)' }}>→</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {/* Featured Event (time-limited) — shows above Daily Gem when active */}
      <FeaturedEventBanner events={events} onSelect={onEventSelect} />

      {/* Browse by Category — unified section with preview card */}
      {!hidden.includes('vibes') && (() => {
        const CATS = [
          { genre: 'Concerts',  icon: 'concert',   color: '#7C3AED' },
          { genre: 'Music',     icon: 'music',     color: '#8B3A0F' },
          { genre: 'Dance',     icon: 'dance',     color: '#BE185D' },
          { genre: 'Theatre',   icon: 'theatre',   color: '#6D28D9' },
          { genre: 'Comedy',    icon: 'comedy',    color: '#B45309' },
          { genre: 'Sports',    icon: 'sports',    color: '#1D4ED8' },
          { genre: 'Arts',      icon: 'art',       color: '#7C2D12' },
          { genre: 'Family',    icon: 'family',    color: '#047857' },
          { genre: 'Free',      icon: 'free',      color: '#0F766E' },
          { genre: 'Community', icon: 'community', color: '#0E7490' },
        ];
        const [activeGenre, setActiveGenre] = React.useState(CATS[0].genre);
        const activeCat = CATS.find(c => c.genre === activeGenre) || CATS[0];
        // Pick a random preview event for the active genre
        const sevenDays = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA');
        const genrePool = events.filter(e => {
          if (e._isAdult) return false;
          const d = e.dates?.start?.localDate || '';
          if (d < todayStr || d > sevenDays) return false;
          const cat = getEventCategory(e);
          if (activeGenre === 'Free') return e.isFree;
          if (activeGenre === 'Community') return cat === 'Community' || cat === 'Volunteer';
          return cat === activeGenre || cat === activeGenre.replace('Concerts', 'Concert');
        });
        const previewEvent = genrePool.length > 0 ? genrePool[Math.floor(Date.now() / 3600000) % genrePool.length] : null;
        const pImg = previewEvent?.images?.find((im: any) => !im.fallback)?.url || previewEvent?.images?.[0]?.url || '';
        const pVenue = previewEvent?._embedded?.venues?.[0]?.name || '';
        const pDate = previewEvent?.dates?.start?.localDate;
        const pDateFmt = pDate ? new Date(pDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';

        return (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginBottom: 4 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <p className="text-xs font-black uppercase flex items-center gap-2" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>
                <FlatIcon name="zia" size={12} color="var(--brand)" /> Browse by Category
              </p>
              <button onClick={() => { trackEvent('category_click', { genre: activeGenre }); onNavigateEvents?.(activeGenre); }}
                style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase' as const }}>
                SEE ALL →
              </button>
            </div>
            {/* Scrollable category pills */}
            <div style={{ position: 'relative' }}>
              <div className="flex gap-2 px-5 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {CATS.map(({ genre, icon, color }) => {
                  const isActive = genre === activeGenre;
                  return (
                    <button key={genre} onClick={() => setActiveGenre(genre)}
                      className="flex-shrink-0 flex items-center active:scale-95 transition-all"
                      style={{
                        padding: isActive ? '6px 14px 6px 10px' : '5px 12px 5px 9px',
                        borderRadius: '20px',
                        background: isActive ? color : color + '12',
                        border: isActive ? 'none' : '1.5px solid ' + color + '40',
                        cursor: 'pointer', outline: 'none', gap: '5px', whiteSpace: 'nowrap' as const,
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? `0 2px 8px ${color}40` : 'none',
                      }}>
                      <FlatIcon name={icon} size={12} color={isActive ? 'white' : color} />
                      <span style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: isActive ? 'white' : 'var(--ink)', letterSpacing: '0.01em' }}>{genre}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40px', background: 'linear-gradient(to right, transparent, var(--bg))', pointerEvents: 'none', zIndex: 1 }} />
            </div>
            {/* Preview event card for active genre */}
            {previewEvent ? (
              <button onClick={() => onEventSelect(previewEvent)}
                className="w-full text-left mx-5 active:opacity-80"
                style={{ display: 'flex', gap: 12, alignItems: 'center', background: activeCat.color + '08', border: `1.5px solid ${activeCat.color}30`, borderRadius: 10, padding: '10px 12px', marginBottom: 12, width: 'calc(100% - 40px)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Thumbnail */}
                <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: activeCat.color + '22', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pImg
                    ? <img src={pImg} alt="" style={{ width: 52, height: 52, objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                    : <FlatIcon name={activeCat.icon} size={24} color={activeCat.color} />
                  }
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{previewEvent.name}</p>
                  <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 11, color: '#888', marginTop: 2 }}>{[pDateFmt, pVenue].filter(Boolean).join(' · ')}</p>
                  <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 10, fontWeight: 700, color: activeCat.color, marginTop: 3, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{genrePool.length} {activeGenre.toLowerCase()} event{genrePool.length !== 1 ? 's' : ''} this week</p>
                </div>
                {/* Arrow */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: activeCat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'white', fontSize: 14, fontWeight: 900 }}>→</span>
                </div>
              </button>
            ) : (
              <div style={{ padding: '8px 20px 12px', fontSize: 12, color: '#aaa', fontFamily: 'Public Sans, sans-serif' }}>
                No {activeGenre.toLowerCase()} events this week
              </div>
            )}
          </div>
        );
      })()}

      {/* Daily Gem — spot of the day, date-seeded */}

      {/* Trending Bento Grid */}
      



      {/* Neighborhoods removed — events-only pivot */}

      {/* Did You Know - animated rotating card */}
      <AnimatedFact />

      {/* Browse by Date — Collapsible Event Calendar */}
      <button
        onClick={() => setShowCalendar(c => !c)}
        className="flex items-center justify-between w-full px-5 py-3"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)', background: 'none', cursor: 'pointer' }}
      >
        <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif' }}>Events Calendar</h2>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--brand)', transition: 'transform 0.2s ease', transform: showCalendar ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
      </button>
      {showCalendar && (
        <EventCalendar
          events={events}
          selectedDate={calendarDate}
          onSelectDate={setCalendarDate}
        />
      )}

      {/* Day Events — shown when a date is selected in the calendar */}
      {calendarDate && (() => {
        const _calFmt = new Date(calendarDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const _calEvts = events
          .filter(e => e.dates?.start?.localDate === calendarDate && !e._isAdult)
          .sort((a, b) => (a.dates?.start?.localTime || '').localeCompare(b.dates?.start?.localTime || ''));
        return (
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Public Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink)', margin: 0 }}>{_calFmt}</h2>
              <span style={{ fontSize: 12, color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif', fontWeight: 700 }}>{_calEvts.length} event{_calEvts.length !== 1 ? 's' : ''}</span>
            </div>
            {_calEvts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 20px', color: 'rgba(0,0,0,0.3)', fontSize: 13, fontFamily: 'Public Sans, sans-serif' }}>No events — try a nearby date</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {_calEvts.slice(0, 8).map(event => {
                  const _t = event.dates?.start?.localTime ? new Date(`2000-01-01T${event.dates.start.localTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                  const _v = (event as any)._embedded?.venues?.[0]?.name || '';
                  // Pick best available image — no width/ratio requirement for Eventbrite events
                  const _img = event.images?.find((im: any) => (im.ratio === '16_9' || im.ratio === '3_2') && (im.width || 0) > 300)?.url
                    || event.images?.find((im: any) => !im.fallback)?.url
                    || event.images?.[0]?.url || '';
                  const _about = event._aiEnrichment?.about;
                  const _typeMeta = getEventTypeMeta(event);
                  return (
                    <div key={event.id}
                      style={{ display: 'flex', gap: 12, padding: '10px 20px', alignItems: 'flex-start', borderTop: '1px solid rgba(0,0,0,0.04)' }}
                    >
                      <CalEventThumb img={_img} typeMeta={_typeMeta} onClick={() => onEventSelect(event)} />
                      <div style={{ flex: 1, minWidth: 0 }} onClick={() => onEventSelect(event)} className="cursor-pointer">
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontFamily: 'Public Sans, sans-serif', marginTop: 2 }}>{_t}{_t && _v ? ' · ' : ''}{_v}</div>
                        {_about && <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', fontFamily: 'Public Sans, sans-serif', marginTop: 3, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{_about}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCalendar(event); }}
                          style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-bg-subtle)', border: '1px solid var(--brand-tint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Add to iCal"
                          aria-label="Add to calendar"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--brand)' }}>calendar_add_on</span>
                        </button>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(0,0,0,0.2)', cursor: 'pointer' }} onClick={() => onEventSelect(event)}>chevron_right</span>
                      </div>
                    </div>
                  );
                })}
                {_calEvts.length > 8 && (
                  <button onClick={() => onNavigateEvents?.()} style={{ textAlign: 'center', fontSize: 12, color: '#C2634A', padding: '12px 20px', fontFamily: 'Public Sans, sans-serif', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    +{_calEvts.length - 8} more events →
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Why Unplug */}
      <WhyUnplugCard />
    </div>
  );
}

// ─── Event Calendar ────────────────────────────────────────────────────────────────────────────
function EventCalendar({
  events,
  selectedDate,
  onSelectDate,
  compact = false,
}: {
  events: TMEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  compact?: boolean;
}) {
  const _ecToday = new Date();
  const [viewYear, setViewYear] = useState(_ecToday.getFullYear());
  const [viewMonth, setViewMonth] = useState(_ecToday.getMonth());

  const densityMap = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => {
      const d = e.dates?.start?.localDate;
      if (d) map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [events]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(densityMap)), [densityMap]);

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = _ecToday.toISOString().slice(0, 10);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const ecPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const ecNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const EC_BRAND = '#C2634A';

  // Density fill: terracotta background intensity scales with event count
  const getCellBg = (count: number, isSel: boolean): string => {
    if (isSel) return EC_BRAND;
    if (count === 0) return 'transparent';
    const intensity = 0.08 + (count / maxCount) * 0.62;
    return `rgba(194,99,74,${intensity.toFixed(2)})`;
  };

  const cells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  const hpad = compact ? '12px' : '20px';

  return (
    <div style={{ background: 'var(--bg)', borderTop: '1px solid rgba(0,0,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ padding: `14px ${hpad} 10px` }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={ecPrevMonth} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--ink)', fontSize: 20, cursor: 'pointer', lineHeight: 1, fontFamily: 'Public Sans, sans-serif' }}>&#8249;</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '-0.02em' }}>{monthLabel}</span>
            {selectedDate && (
              <button onClick={() => onSelectDate(null)} style={{ fontSize: 10, color: EC_BRAND, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Public Sans, sans-serif', fontWeight: 700 }}>✕ Clear date</button>
            )}
          </div>
          <button onClick={ecNextMonth} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--ink)', fontSize: 20, cursor: 'pointer', lineHeight: 1, fontFamily: 'Public Sans, sans-serif' }}>&#8250;</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 8, fontWeight: 800, color: 'rgba(0,0,0,0.22)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.04em', paddingBottom: 2 }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((cell, i) => {
            if (!cell) return <div key={`ec${i}`} />;
            const { day, dateStr } = cell;
            const count = densityMap[dateStr] || 0;
            const isSel = selectedDate === dateStr;
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(isSel ? null : dateStr)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  aspectRatio: '1', borderRadius: 8, padding: 0,
                  border: isSel ? `2px solid ${EC_BRAND}` : isToday ? `2px solid ${EC_BRAND}` : '2px solid transparent',
                  background: getCellBg(count, isSel),
                  cursor: 'pointer',
                  opacity: isPast && count === 0 && !isSel ? 0.22 : 1,
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: isSel || isToday || count > 0 ? 700 : 400, color: isSel ? '#fff' : 'var(--ink)', lineHeight: 1.1, fontFamily: 'Public Sans, sans-serif' }}>
                  {day}
                </span>
              </button>
            );
          })}
        </div>

        {/* Density legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.28)', fontFamily: 'Public Sans, sans-serif' }}>Quiet</span>
          {([0.10, 0.24, 0.40, 0.58, 0.70] as number[]).map((intensity, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: `rgba(194,99,74,${intensity})`, border: '1px solid rgba(194,99,74,0.25)', flexShrink: 0 }} />
          ))}
          <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.28)', fontFamily: 'Public Sans, sans-serif' }}>Packed</span>
        </div>
      </div>
    </div>
  );
}

// ─── Events Screen ────────────────────────────────────────────────────────────

function EventsScreen({
  events,
  eventsLoading = false,
  onEventSelect,
  initialSearch = '',
  initialGenre = '',
}: {
  events: TMEvent[];
  eventsLoading?: boolean;
  onEventSelect: (e: TMEvent) => void;
  initialSearch?: string;
  initialGenre?: string;
}) {
  const eventsHero = useTypewriter("What's Happening", 300);
  const [search, setSearch] = useState('');
  const [gridCols, setGridCols] = useState(2);
  // Each session gets a fresh random seed so category sections appear in a different order
  const [catShuffleSeed] = useState(() => Math.random());
  const pillRow1Ref = useRef<HTMLDivElement>(null);
  const pillRow2Ref = useRef<HTMLDivElement>(null);
  // Scroll-peek: slide pill rows right then snap back so users see they can swipe for more
  useEffect(() => {
    const peek = (el: HTMLDivElement | null, delay: number) => {
      if (!el) return;
      setTimeout(() => {
        el.scrollTo({ left: 80, behavior: 'smooth' });
        setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 520);
      }, delay);
    };
    peek(pillRow1Ref.current, 500);
    peek(pillRow2Ref.current, 750);
  }, []);
  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre || 'Tonight');
  const [selectedSubGenre, setSelectedSubGenre] = useState<string>('All');
  // Reset genre when initialGenre changes (e.g. from "Free Events" chip on Discover)
  useEffect(() => { setSelectedGenre(initialGenre || 'Tonight'); setSelectedSubGenre('All'); }, [initialGenre]);
  // Auto-fallback: if events load and there are zero events today, fall back to All
  const tonightFallbackDone = useRef(false);
  useEffect(() => {
    if (initialGenre || tonightFallbackDone.current || events.length === 0 || selectedGenre !== 'Tonight') return;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = events.filter(e => (e.dates?.start?.localDate || '') === todayStr && !e._isAdult).length;
    if (todayCount === 0) { setSelectedGenre('All'); tonightFallbackDone.current = true; }
  }, [events, initialGenre, selectedGenre]);
  const [followedGenres, setFollowedGenres] = useState<string[]>(() => getFollowedGenres());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarSelDate, setCalendarSelDate] = useState<string | null>(null);
  const [wishlistVersion, setWishlistVersion] = useState(0);
  useEffect(() => {
    const handler = () => setWishlistVersion(v => v + 1);
    window.addEventListener('abq_wishlist_changed', handler);
    return () => window.removeEventListener('abq_wishlist_changed', handler);
  }, []);

  function toggleFollowGenre(genre: string) {
    setFollowedGenres(prev => {
      const next = prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre];
      saveFollowedGenres(next);
      return next;
    });
  }

  const filtered = useMemo(() => {
    // ── Date helpers ──
    const todayStr = new Date().toISOString().split('T')[0];
    // This Weekend = Saturday + Sunday of the current week
    const nowDay = new Date().getDay(); // 0=Sun, 6=Sat
    const satOffset = nowDay === 6 ? 0 : (6 - nowDay + 7) % 7; // if today IS Saturday, offset=0
    const sunOffset = nowDay === 0 ? 0 : (7 - nowDay) % 7;    // if today IS Sunday, offset=0
    const sat = new Date(); sat.setDate(sat.getDate() + satOffset);
    const sun = new Date(); sun.setDate(sun.getDate() + sunOffset);
    const satStr = sat.toISOString().split('T')[0];
    const sunStr = sun.toISOString().split('T')[0];

    const hasTextSearch = search.trim() !== '';

    // 90-day horizon cap: only apply when no search/filter is active so that
    // searching for a future event (e.g. a comedian in October) still works.
    const isSearchActive = hasTextSearch || selectedGenre !== 'All';
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + 90);
    const horizonStr = horizonDate.toISOString().split('T')[0];
    let result = events.filter(e => {
      if (e._isAdult) return false;
      // Always hide events that have already passed
      const d = e.dates?.start?.localDate;
      if (d && d < todayStr) return false;
      if (!isSearchActive && d && d > horizonStr) return false;
      return true;
    });

    // ── Text search: when the user is typing a query, search ALL upcoming
    // events by name, venue, description, info, and genre — regardless of
    // which date/genre pill is selected. This ensures "easter" finds
    // Easter events even when the "Tonight" pill is active. ──
    if (hasTextSearch) {
      const q = search.toLowerCase().trim();
      // Split into words for multi-word matching ("isotopes game", "red rocks concert", etc.)
      // Each word must appear somewhere — handles out-of-order and partial phrase searches.
      const words = q.split(/\s+/).filter(w => w.length >= 2);
      result = result.filter(e => {
        const haystack = [
          e.name,
          e._embedded?.venues?.[0]?.name || '',
          e.info || '',
          e.description || '',
          e.classifications?.[0]?.segment?.name || '',
          e.classifications?.[0]?.genre?.name || '',
          e.classifications?.[0]?.subGenre?.name || '',
        ].join(' ').toLowerCase();
        return words.length > 0 ? words.every(w => haystack.includes(w)) : haystack.includes(q);
      });
      return result;
    }

    // ── Date quick-filters (only applied when NO text search) ──
    if (selectedGenre === 'Tonight') {
      return result.filter(e => (e.dates?.start?.localDate || '') === todayStr);
    }
    if (selectedGenre === 'This Weekend') {
      return result.filter(e => {
        const d = e.dates?.start?.localDate || '';
        return d === satStr || d === sunStr;
      });
    }

    // "For You" = union of all followed genres
    if (selectedGenre === '❤️ For You') {
      if (followedGenres.length === 0) return []; // nothing followed — show setup prompt instead
      const matchesAny = (e: TMEvent) => followedGenres.some(g => getEventCategory(e) === g);
      return result.filter(matchesAny);
    }
    if (selectedGenre !== 'All') {
      result = result.filter(e => {
        // Events are pre-classified with canonical categories in segment.name
        const cat = getEventCategory(e);
        return cat === selectedGenre;
      });
    }
    // Sub-genre filter (applies on top of category filter)
    if (selectedSubGenre !== 'All') {
      result = result.filter(e => getEventSubGenre(e) === selectedSubGenre);
    }

    // ── Date range filter (applies on top of genre/search) ──
    if (dateFrom || dateTo) {
      result = result.filter(e => {
        const d = e.dates?.start?.localDate || '';
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }

    return result;
  }, [events, selectedGenre, selectedSubGenre, search, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    // Base: sort everything by date ascending
    const arr = [...filtered].sort((a, b) =>
      (a.dates?.start?.localDate || '9999').localeCompare(b.dates?.start?.localDate || '9999')
    );
    // "All" view: cap same-venue/category repeats in the first 50 slots so that
    // a single sports team's games don't flood the entire default feed.
    // After slot 50 everything shows in natural date order.
    if (selectedGenre !== 'All') return arr;
    const venueSegCount = new Map<string, number>();
    const front: typeof arr = [];
    const overflow: typeof arr = [];
    for (const e of arr) {
      const venue = (e._embedded?.venues?.[0]?.name || 'unknown').toLowerCase().slice(0, 40);
      const seg   = (e.classifications?.[0]?.segment?.name || '').toLowerCase();
      const key   = `${seg}::${venue}`;
      const count = venueSegCount.get(key) ?? 0;
      const cap   = seg === 'sports' ? 3 : 8; // sports capped hard; others more lenient
      if (front.length < 50 && count < cap) {
        front.push(e);
        venueSegCount.set(key, count + 1);
      } else {
        overflow.push(e);
      }
    }
    return [...front, ...overflow];
  }, [filtered, selectedGenre]);

  // Deduplicate same-title + same-date events (e.g. multiple TM showtimes for the
  // same movie listed as separate events). Keep only the first (earliest showtime).
  // A "showtimes" count badge is shown for collapsed duplicates.
  const { deduped, showtimeCounts } = useMemo(() => {
    const seen = new Map<string, number>(); // key → count
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    sorted.forEach(e => {
      const key = norm(e.name) + '|' + (e.dates?.start?.localDate || '') + '|' + (e._embedded?.venues?.[0]?.name || '');
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    const usedKeys = new Set<string>();
    const deduped = sorted.filter(e => {
      const key = norm(e.name) + '|' + (e.dates?.start?.localDate || '') + '|' + (e._embedded?.venues?.[0]?.name || '');
      if (usedKeys.has(key)) return false;
      usedKeys.add(key);
      // Show all events — those without photos get a category icon fallback
      return true;
    });
    return { deduped, showtimeCounts: seen };
  }, [sorted]);

  const getShowtimeCount = (e: TMEvent) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    const key = norm(e.name) + '|' + (e.dates?.start?.localDate || '') + '|' + (e._embedded?.venues?.[0]?.name || '');
    return showtimeCounts.get(key) || 1;
  };

  return (
    <div className="w-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="px-5 pt-5 pb-4" style={{ background: "url('/hero-texture.webp') center/cover no-repeat, var(--bg)", borderTop: '3px solid var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}
        >
          What's Happening
        </p>
        <h1
          className="font-black leading-none mt-1"
          style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '40px', letterSpacing: '-0.04em', color: 'var(--ink)', minHeight: '48px' }}
        >
          {eventsHero.display}{!eventsHero.done && <span style={{ display: 'inline-block', width: '3px', height: '0.85em', background: 'var(--ink)', marginLeft: '2px', verticalAlign: 'baseline', animation: 'cursorBlink 0.8s step-end infinite' }} />}
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          {selectedGenre === 'Tonight'
            ? <>{deduped.length.toLocaleString()} event{deduped.length !== 1 ? 's' : ''} happening today</>
            : (search || selectedGenre !== 'All' || dateFrom || dateTo)
              ? <>{deduped.length.toLocaleString()} <span style={{ color: '#bbb' }}>of {events.length.toLocaleString()}</span> events</>
              : eventsLoading
                ? <span style={{ display: 'inline-block', width: 140, height: 14, background: 'linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%)', backgroundSize: '200% 100%', borderRadius: 6, animation: 'shimmer 1.2s infinite', verticalAlign: 'middle' }} />
                : <>{events.length.toLocaleString()} upcoming events in ABQ</>}
        </p>
      </div>

      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div
          className="flex items-center gap-2 bg-white px-4 py-3"
          style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search events, artists, venues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
          <button onClick={() => setShowDatePicker(v => !v)} style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: (dateFrom || dateTo) ? 'var(--brand)' : '#9ca3af' }}>calendar_month</span>
            {(dateFrom || dateTo) && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)' }} />}
          </button>
        </div>
      </div>

      {/* Quick filter pills — Row 1: time-based + For You */}
      <div style={{ position: 'sticky', top: 'calc(var(--sat) + 58px)', zIndex: 30, background: 'var(--bg)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {/* Row 1: All / Tonight / This Weekend / ❤️ For You */}
        <div style={{ position: 'relative' }}>
        <div ref={pillRow1Ref} className="flex px-4 gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingTop: '8px', paddingBottom: '6px' }}>
          {(['All', 'Tonight', 'This Weekend', '\u2764\ufe0f For You'] as const).map(genre => {
            const isForYou = genre === '\u2764\ufe0f For You';
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-black uppercase transition-all"
                style={{
                  fontFamily: 'Public Sans, sans-serif',
                  letterSpacing: '0.1em',
                  background: isSelected ? 'var(--brand)' : isForYou && followedGenres.length > 0 ? 'var(--brand-bg-subtle)' : 'var(--bg)',
                  color: isSelected ? 'white' : 'var(--ink)',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50px', background: 'linear-gradient(to right, transparent, var(--bg))', pointerEvents: 'none', zIndex: 1 }} />
        </div>
        {/* Row 2: Category chips — single unified pill, heart inside */}
        <div style={{ position: 'relative' }}>
        <div ref={pillRow2Ref} className="flex px-4 gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingTop: '4px', paddingBottom: '8px' }}>
          {([
            { genre: 'Concerts',  icon: 'concert',   color: '#7C3AED' },
            { genre: 'Music',     icon: 'music',     color: '#8B3A0F' },
            { genre: 'Dance',     icon: 'dance',     color: '#BE185D' },
            { genre: 'Theatre',   icon: 'theatre',   color: '#6D28D9' },
            { genre: 'Comedy',    icon: 'comedy',    color: '#B45309' },
            { genre: 'Sports',    icon: 'sports',    color: '#1D4ED8' },
            { genre: 'Arts',      icon: 'art',       color: '#7C2D12' },
            { genre: 'Family',    icon: 'family',    color: '#047857' },
            { genre: 'Free',      icon: 'free',      color: '#0F766E' },
            { genre: 'Community', icon: 'community', color: '#0E7490' },
          ] as { genre: string; icon: string; color: string }[]).map(({ genre, icon, color }) => {
            const isSelected = selectedGenre === genre;
            const isFollowed = followedGenres.includes(genre);
            return (
              <button
                key={genre}
                onClick={() => { setSelectedGenre(isSelected ? 'All' : genre); setSelectedSubGenre('All'); }}
                className="flex-shrink-0 flex items-center transition-all active:scale-95"
                style={{
                  padding: 0,
                  borderRadius: '20px',
                  background: isSelected ? color + '22' : isFollowed ? color + '12' : 'var(--bg)',
                  border: isSelected ? `1.5px solid ${color}70` : isFollowed ? `1.5px solid ${color}45` : '1.5px solid rgba(0,0,0,0.12)',
                  cursor: 'pointer',
                  outline: 'none',
                  overflow: 'hidden',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Label area */}
                <span className="flex items-center gap-1.5" style={{ padding: '5px 8px 5px 10px', whiteSpace: 'nowrap' }}>
                  <FlatIcon name={icon} size={13} color={isSelected || isFollowed ? color : '#999'} />
                  <span style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: isSelected ? color : 'var(--ink)', letterSpacing: '0.01em' }}>
                    {genre}
                  </span>
                </span>
                {/* Heart — thin internal divider + icon, stopPropagation so it doesn't trigger genre select */}
                <span
                  onClick={(e) => { e.stopPropagation(); toggleFollowGenre(genre); playHaptic(); }}
                  className="flex items-center justify-center"
                  style={{
                    padding: '5px 9px 5px 7px',
                    borderLeft: `1px solid ${isSelected || isFollowed ? color + '30' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '12px',
                      lineHeight: 1,
                      display: 'block',
                      color: isFollowed ? color : 'rgba(0,0,0,0.22)',
                      fontVariationSettings: isFollowed ? "'FILL' 1" : "'FILL' 0",
                      transition: 'font-variation-settings 0.15s ease, color 0.15s ease',
                    }}
                  >
                    favorite
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50px', background: 'linear-gradient(to right, transparent, var(--bg))', pointerEvents: 'none', zIndex: 1 }} />
        </div>
      </div>
      {/* Row 3: Sub-genre chips — shown when a category is selected */}
      {selectedGenre !== 'All' && selectedGenre !== 'Tonight' && selectedGenre !== 'This Weekend' && selectedGenre !== '❤️ For You' && (() => {
        // Compute available sub-genres from the filtered events (before sub-genre filter)
        const catEvents = events.filter(e => getEventCategory(e) === selectedGenre);
        const subGenreCounts: Record<string, number> = {};
        catEvents.forEach(e => {
          const sg = getEventSubGenre(e);
          subGenreCounts[sg] = (subGenreCounts[sg] || 0) + 1;
        });
        // Sort by count descending, filter out "Other" unless it's the only one
        const subGenres = Object.entries(subGenreCounts)
          .filter(([sg]) => sg !== 'Other' || Object.keys(subGenreCounts).length === 1)
          .sort((a, b) => b[1] - a[1])
          .map(([sg]) => sg);
        // Only show if there are 2+ sub-genres
        if (subGenres.length < 2) return null;
        const catColor = CAT_COLORS_MAP[selectedGenre] || 'var(--brand)';
        return (
          <div className="flex px-4 gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: '6px' }}>
            <button
              onClick={() => setSelectedSubGenre('All')}
              className="flex-shrink-0 transition-all active:scale-95"
              style={{
                padding: '4px 12px',
                borderRadius: '14px',
                background: selectedSubGenre === 'All' ? catColor : 'transparent',
                border: selectedSubGenre === 'All' ? 'none' : '1px solid rgba(0,0,0,0.1)',
                cursor: 'pointer',
                fontFamily: 'Public Sans, sans-serif',
                fontSize: '10px',
                fontWeight: 700,
                color: selectedSubGenre === 'All' ? 'white' : '#888',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
              }}
            >All</button>
            {subGenres.map(sg => (
              <button
                key={sg}
                onClick={() => setSelectedSubGenre(selectedSubGenre === sg ? 'All' : sg)}
                className="flex-shrink-0 transition-all active:scale-95"
                style={{
                  padding: '4px 12px',
                  borderRadius: '14px',
                  background: selectedSubGenre === sg ? catColor : 'transparent',
                  border: selectedSubGenre === sg ? 'none' : '1px solid rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  fontFamily: 'Public Sans, sans-serif',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: selectedSubGenre === sg ? 'white' : '#888',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                }}
              >{sg} <span style={{ opacity: 0.6, fontSize: '9px' }}>{subGenreCounts[sg]}</span></button>
            ))}
          </div>
        );
      })()}
      {/* Skeleton cards — shown while live data loads and no events available yet */}
      {deduped.length === 0 && eventsLoading && (
        <div style={{ padding: '16px 16px 0' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <div style={{ width: 80, height: 80, borderRadius: 8, background: 'linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s infinite', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                <div style={{ height: 14, borderRadius: 6, background: 'linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s infinite', width: '75%' }} />
                <div style={{ height: 11, borderRadius: 6, background: 'linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%)', backgroundSize: '200% 100%', animation: `shimmer 1.2s ${i * 0.1}s infinite`, width: '55%' }} />
                <div style={{ height: 11, borderRadius: 6, background: 'linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%)', backgroundSize: '200% 100%', animation: `shimmer 1.2s ${i * 0.15}s infinite`, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Empty state — shown when filters return zero results */}
      {deduped.length === 0 && !eventsLoading && (
        <div className="flex flex-col items-center justify-center px-8 text-center" style={{ paddingTop: '80px', paddingBottom: '60px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '56px', color: '#d0d8d0', marginBottom: '16px' }}>event_busy</span>
          <h2 className="font-black text-lg mb-2" style={{ fontFamily: 'Public Sans, sans-serif', color: '#1a1a1a' }}>
            {selectedGenre === 'Tonight' ? 'Nothing scheduled for tonight' :
             selectedGenre === 'This Weekend' ? 'Nothing found this weekend' :
             `No ${selectedGenre.toLowerCase()} events found`}
          </h2>
          <p className="text-sm mb-5" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', lineHeight: 1.6 }}>
            {selectedGenre === 'Tonight'
              ? `Check back later, or browse all upcoming events.`
              : selectedGenre !== 'All'
                ? `Try "This Weekend" or browse all events.`
                : 'Try a different search term or check back soon.'}
          </p>
          {selectedGenre !== 'All' && (
            <button
              onClick={() => setSelectedGenre('All')}
              className="px-5 py-2.5 font-black text-sm uppercase"
              style={{ background: 'var(--ink)', color: 'white', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(185,92,67,0.25)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              Browse all events
            </button>
          )}
        </div>
      )}

      {/* For You setup prompt — shown when For You is selected but nothing followed */}
      {/* Calendar filter — shown below genre pills when calendar icon tapped */}
      {showDatePicker && (
        <div style={{ animation: 'cardFadeIn 0.2s ease both' }}>
          <EventCalendar
            events={events}
            selectedDate={calendarSelDate}
            onSelectDate={(d) => { setCalendarSelDate(d); setDateFrom(d || ''); setDateTo(d || ''); }}
            compact
          />
        </div>
      )}

      {selectedGenre === '❤️ For You' && followedGenres.length === 0 && (
        <div className="px-5 py-4 flex items-start gap-3" style={{ background: 'var(--brand-bg-subtle)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>❤️</span>
          <div>
            <p className="text-sm font-black" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>Build your For You feed</p>
            <p className="text-xs mt-0.5" style={{ fontFamily: 'Public Sans, sans-serif', color: '#555', lineHeight: 1.5 }}>
              Tap the <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}><span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--brand)' }}>favorite</span></span> next to any category above. Events from saved categories will appear here.
            </p>
          </div>
        </div>
      )}
      {selectedGenre === '❤️ For You' && followedGenres.length > 0 && (
        <div className="px-5 py-2 flex items-center gap-2" style={{ background: 'var(--brand-bg-subtle)', borderBottom: '1px solid #eee' }}>
          <span style={{ fontSize: '13px' }}>❤️</span>
          <p className="text-xs font-semibold" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--brand)' }}>
            Showing: {followedGenres.join(' · ')}
          </p>
        </div>
      )}

      <div className="px-5 pb-2 flex items-center justify-between" style={{ borderBottom: '1px solid #eee', paddingTop: 10, paddingBottom: 10 }}>
        <p className="text-sm font-semibold text-gray-500" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          {deduped.length} event{deduped.length !== 1 ? 's' : ''}
          {deduped.length < sorted.length && (
            <span className="ml-2 text-xs text-gray-400">({sorted.length - deduped.length} duplicate showtimes hidden)</span>
          )}
          {((selectedGenre !== 'All' && selectedGenre !== 'Tonight') || search || dateFrom || dateTo) && (
            <button
              onClick={() => { setSelectedGenre('Tonight'); setSearch(''); setDateFrom(''); setDateTo(''); }}
              className="ml-2 text-xs font-bold"
              style={{ color: 'var(--brand)' }}
            >
              Clear filters
            </button>
          )}
        </p>
      </div>

      {(() => {
        if (deduped.length === 0) {
          return (
            <div className="text-center py-16 text-gray-400">
              <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>event_busy</span>
              <p className="font-semibold text-sm" style={{ fontFamily: 'Public Sans, sans-serif' }}>No events found</p>
            </div>
          );
        }
        const CAT_COLORS: Record<string, string> = {
          'Concerts': '#7C3AED', 'Music': '#8B3A0F', 'Dance': '#BE185D',
          'Theatre': '#6D28D9', 'Comedy': '#B45309', 'Sports': '#1D4ED8',
          'Arts': '#7C2D12', 'Family': '#047857', 'Free': '#0F766E',
          'Community': '#0E7490',
        };
        // When a specific genre is selected, show events in a flat date-sorted list
        // When "All", group by category and shuffle section order per session
        const catGroups: Record<string, TMEvent[]> = {};
        if (selectedGenre !== 'All') {
          // Single group — all filtered events under the selected genre
          catGroups[selectedGenre] = deduped;
        } else {
          for (const evt of deduped) {
            const cat = getEventCategory(evt);
            if (!catGroups[cat]) catGroups[cat] = [];
            catGroups[cat].push(evt);
          }
        }
        // Seeded shuffle — different order every session so users discover new categories
        let _rng = catShuffleSeed;
        const _lcg = () => { _rng = (_rng * 9301 + 49297) % 233280; return _rng / 233280; };
        const shuffledGroups = selectedGenre !== 'All'
          ? Object.entries(catGroups)
          : [...Object.entries(catGroups)].sort(() => _lcg() - 0.5);
        return (
          <div style={{ padding: '0 16px 112px' }}>
            {/* Column picker */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '12px 0 4px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>View</span>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setGridCols(n)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${gridCols === n ? 'var(--ink)' : 'rgba(0,0,0,0.15)'}`, background: gridCols === n ? 'var(--ink)' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 }}>
                  {Array.from({ length: n }).map((_, i) => (
                    <div key={i} style={{ flex: 1, height: '14px', borderRadius: 2, background: gridCols === n ? 'white' : 'rgba(0,0,0,0.25)' }} />
                  ))}
                </button>
              ))}
            </div>
            {shuffledGroups.map(([cat, events]) => {
              const color = CAT_COLORS[cat] || 'var(--brand)';
              const tMeta = getEventTypeMeta(events[0]);
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 10px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FlatIcon name={tMeta.icon} size={12} color="white" />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--ink)', fontFamily: 'Public Sans, sans-serif' }}>{cat}</span>
                    <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'Public Sans, sans-serif', fontWeight: 500 }}>{events.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(gridCols, events.length)}, 1fr)`, gap: Math.min(gridCols, events.length) === 1 ? 12 : 10 }}>
                    {events.map(event => {
                      const count = getShowtimeCount(event);
                      return (
                        <div key={event.id} style={{ position: 'relative', minWidth: 0, overflow: 'hidden' }}>
                          <EventCard event={event} onClick={() => onEventSelect(event)} />
                          {count > 1 && (
                            <div style={{ position: 'absolute', bottom: 8, left: 6, background: 'rgba(0,0,0,0.62)', color: 'white', fontSize: '8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '2px 5px', borderRadius: 3, pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
                              {count} shows
                            </div>
                          )}
                          <LikeButton id={event.id} type="event" name={event.name} category={getEventCategory(event)} eventDate={event.dates?.start?.localDate} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Places Screen ────────────────────────────────────────────────────────────


// ─── Auth Modal ──────────────────────────────────────────────────────────────

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'choose' | 'email'>('choose');
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      // Flag tells onAuthStateChange to redirect to Profile after OAuth completes
      sessionStorage.setItem('abq_post_auth_redirect', 'profile');
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (authError) {
        sessionStorage.removeItem('abq_post_auth_redirect');
        throw new Error('Login is having issues right now, sorry!');
      }
      onClose();
    } catch (e: any) { setError(e.message || 'Login is having issues right now, sorry!'); }
    setLoading(false);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isSignUp) {
        const { data: cred, error: signUpError } = await supabase.auth.signUp({ email: email, password: password, options: { captchaToken } });
        if (signUpError) throw signUpError;
        if (displayName) await supabase.auth.updateUser({ data: { display_name: displayName } });
        // Create email prefs row for new user (opted in by default)
        if (cred?.user) {
          await supabase.from('user_email_prefs').upsert({
            user_id: cred.user.id,
            email: email,
            opted_in: true,
            frequency: 'weekly',
          }, { onConflict: 'user_id' });
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: email, password: password, options: { captchaToken } });
        if (signInError) throw signInError;
        // Ensure email prefs row exists for existing users signing in
        if (signInData?.user) {
          await supabase.from('user_email_prefs').upsert({
            user_id: signInData.user.id,
            email: email,
            opted_in: true,
            frequency: 'weekly',
          }, { onConflict: 'user_id', ignoreDuplicates: true });
        }
      }
      onClose();
    } catch (e: any) { setError(e.message || 'Auth failed'); }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10"
        style={{ background: '#fff', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black uppercase tracking-tighter" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            {mode === 'choose' ? 'Sign In' : (isSignUp ? 'Create Account' : 'Sign In')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          Sign in to save events, get personalized email newsletters, and appear on the leaderboard.
        </p>

        {mode === 'choose' ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full rounded-lg py-3.5 font-bold text-sm border border-gray-200"
              style={{ fontFamily: 'Public Sans, sans-serif', background: '#fff' }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.58-13.47-8.71l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <button
              onClick={() => setMode('email')}
              className="w-full rounded-lg py-3.5 font-bold text-sm text-white"
              style={{ fontFamily: 'Public Sans, sans-serif', background: 'var(--brand)' }}
            >
              Continue with Email
            </button>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          </div>
        ) : (
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <div className="flex gap-2 mb-1">
              {['Sign In', 'Sign Up'].map((t, i) => (
                <button key={t} type="button"
                  onClick={() => setIsSignUp(i === 1)}
                  className="flex-1 rounded-lg py-2 text-sm font-bold transition-all"
                  style={{ background: isSignUp === (i === 1) ? 'var(--brand)' : '#f5f5f5', color: isSignUp === (i === 1) ? 'white' : '#666', fontFamily: 'Public Sans, sans-serif' }}
                >{t}</button>
              ))}
            </div>
            {isSignUp && (
              <input
                type="text" placeholder="Display name (e.g. xplorer_abq)" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none"
                style={{ fontFamily: 'Public Sans, sans-serif' }}
              />
            )}
            <input
              type="email" placeholder="Email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none"
              style={{ fontFamily: 'Public Sans, sans-serif' }}
            />
            <input
              type="password" placeholder="Password (min 6 chars)" required value={password}
              onChange={e => setPassword(e.target.value)} minLength={6}
              className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none"
              style={{ fontFamily: 'Public Sans, sans-serif' }}
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <HCaptcha
              ref={captchaRef}
              sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY}
              onVerify={tok => setCaptchaToken(tok)}
              onExpire={() => setCaptchaToken('')}
            />
            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg py-3.5 font-bold text-sm text-white"
              style={{ background: 'var(--brand)', fontFamily: 'Public Sans, sans-serif', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Please wait…' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            <button type="button" onClick={() => setMode('choose')}
              className="text-xs text-gray-400 text-center mt-1"
              style={{ fontFamily: 'Public Sans, sans-serif' }}
            >← Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Username Setup Modal (shown once right after first login) ────────────────
function UsernameSetupModal({ user, onDone }: { user: User | null; onDone: (name?: string) => void }) {
  const [input, setInput] = useState(
    user?.user_metadata?.full_name?.split(' ')[0] || ''
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const t = input.trim();
    if (!t) { setError("Username can't be empty"); return; }
    if (t.length < 3) { setError('Too short (min 3 chars)'); return; }
    if (t.length > 20) { setError('Too long (max 20 chars)'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(t)) { setError('Letters, numbers, and underscores only'); return; }
    if (hasProfanity(t)) { setError('Please choose a different username'); return; }
    setError(''); setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { display_name: t } });
    } catch { /* continue — server may have accepted even if client throws */ }
    try {
      // Verify via getUser() — Supabase logs confirm server returns 200
      // even when the JS client throws due to implicit-flow token refresh quirks
      const { data: { user: fresh } } = await supabase.auth.getUser();
      if (fresh?.user_metadata?.display_name === t) {
        setSaved(true);
        setTimeout(() => onDone(t), 900);
      } else {
        setError('Failed to save — try again');
      }
    } catch { setError('Failed to save — try again'); }
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Public Sans, sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', padding: '32px 28px',
        width: '100%', maxWidth: '380px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>👋</div>
        <h2 style={{ fontFamily: 'Public Sans, sans-serif', fontWeight: 900, fontSize: '22px', margin: '0 0 6px' }}>
          Pick your username
        </h2>
        <p style={{ color: '#777', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.5 }}>
          This shows up on the leaderboard and your profile. You can always change it later.
        </p>
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. xplorer_abq"
          maxLength={20}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1.5px solid ${error ? '#e53935' : '#e0e0e0'}`,
            borderRadius: '12px', padding: '12px 14px', fontSize: '16px',
            fontFamily: 'Public Sans, sans-serif', outline: 'none', marginBottom: '8px',
          }}
        />
        {error && <p style={{ color: '#e53935', fontSize: '13px', margin: '0 0 8px' }}>{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
            background: saved ? '#2e7d32' : 'var(--brand)', color: 'white',
            fontSize: '15px', fontWeight: 700, cursor: saving || saved ? 'default' : 'pointer',
            fontFamily: 'Public Sans, sans-serif', marginBottom: '10px',
            transition: 'background 0.2s',
          }}
        >
          {saved ? '✓ All set!' : saving ? 'Saving…' : 'Set Username'}
        </button>
        <button
          onClick={() => onDone()}
          style={{
            background: 'none', border: 'none', color: '#aaa', fontSize: '13px',
            cursor: 'pointer', fontFamily: 'Public Sans, sans-serif',
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Profile Settings Pane ────────────────────────────────────────────────────
function NotificationSettingsPane() {
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(loadNotifPrefs);
  const [perm, setPerm] = React.useState<string>(() => notificationsSupported() ? Notification.permission : 'unsupported');
  const [open, setOpen] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);

  const update = (next: NotificationPrefs) => { setPrefs(next); saveNotifPrefs(next); };

  const handleEnable = async () => {
    setRequesting(true);
    const granted = await requestPermission();
    setPerm(Notification.permission);
    if (granted) {
      const next = { ...prefs, enabled: true };
      update(next);
      // Register for server-sent background push notifications
      subscribeToPush(next).catch(() => {});
      checkAndTriggerNotifications(next, { forceAll: true });
    }
    setRequesting(false);
  };

  const notifKeys = Object.keys(NOTIF_LABELS) as (keyof typeof NOTIF_LABELS)[];

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white rounded-lg px-4 py-3"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontFamily: 'Public Sans, sans-serif' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '16px' }}>&#128276;</span>
          <span className="font-bold text-sm text-gray-800">Notifications</span>
        </div>
        <div className="flex items-center gap-2">
          {perm === 'granted' && prefs.enabled && (
            <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>ON</span>
          )}
          <span style={{ fontSize: '12px', color: '#999' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-lg p-4 flex flex-col gap-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          {perm === 'unsupported' ? (
            <p className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>Push notifications are not supported in this browser.</p>
          ) : perm !== 'granted' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                Get notified about tonight&apos;s events, weekend previews, and more. Customize exactly what you want to hear about.
              </p>
              <button
                onClick={handleEnable}
                disabled={requesting || perm === 'denied'}
                className="w-full py-3 rounded-lg text-white font-black text-sm"
                style={{ background: perm === 'denied' ? '#9e9e9e' : 'var(--brand)', fontFamily: 'Public Sans, sans-serif', cursor: perm === 'denied' ? 'default' : 'pointer' }}
              >
                {requesting ? 'Requesting…' : perm === 'denied' ? 'Blocked — enable in browser settings' : 'Enable Notifications'}
              </button>
            </div>
          ) : (
            <>
              {/* Master toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Public Sans, sans-serif' }}>All Notifications</p>
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>Master switch for all ABQ Unplugged alerts</p>
                </div>
                <button onClick={() => update({ ...prefs, enabled: !prefs.enabled })}>
                  <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-colors" style={{ background: prefs.enabled ? 'var(--brand)' : '#d1d5db' }}>
                    <div className="w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: prefs.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
                  </div>
                </button>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0' }} />

              {/* Per-type toggles */}
              {notifKeys.map(key => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif', opacity: prefs.enabled ? 1 : 0.45 }}>{NOTIF_LABELS[key]}</p>
                  </div>
                  <button
                    onClick={() => update({ ...prefs, [key]: !prefs[key] })}
                    disabled={!prefs.enabled}
                  >
                    <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-colors" style={{ background: prefs.enabled && prefs[key] ? 'var(--brand)' : '#d1d5db', opacity: prefs.enabled ? 1 : 0.45 }}>
                      <div className="w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: prefs.enabled && prefs[key] ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Event Reminder Checker ──────────────────────────────────────────────────
function checkEventReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const items = getWishlist();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let changed = false;

  items.forEach(item => {
    if (item.type !== 'event' || !item.eventDate || !item.reminderDays || item.reminderDays === 0 || item.reminderSent) return;

    const eventDate = new Date(item.eventDate);
    const reminderDate = new Date(eventDate);
    reminderDate.setDate(reminderDate.getDate() - item.reminderDays);
    const reminderDateStr = reminderDate.toISOString().split('T')[0];

    if (todayStr >= reminderDateStr && todayStr <= item.eventDate) {
      // Time to send reminder!
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const dayText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(`\u2764\uFE0F ${item.name} is ${dayText}!`, {
            body: `Your saved event is coming up ${dayText}. Tap to see details.`,
            tag: `abq-reminder-${item.id}`,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            vibrate: [100, 50, 100],
            data: { url: `/#event/${item.id}` },
          });
        });
      } else {
        new Notification(`\u2764\uFE0F ${item.name} is ${dayText}!`, {
          body: `Your saved event is coming up ${dayText}. Tap to see details.`,
          tag: `abq-reminder-${item.id}`,
          icon: '/icons/icon-192.png',
        });
      }

      item.reminderSent = true;
      changed = true;
    }
  });

  if (changed) saveWishlist(items);
}
// ─── User Color Picker Component ──────────────────────────────────────────────
const USER_THEME_KEY = 'abq_user_theme';
const USER_ACCENT_PRESETS = [
  { name: 'Terracotta',   color: '#C2634A', light: '#D4845E' },
  { name: 'Desert Sage',  color: '#6B8F71', light: '#8AAD87' },
  { name: 'Turquoise',    color: '#2B9EB3', light: '#45C4D6' },
  { name: 'Sunset',       color: '#E07C3E', light: '#F0A060' },
  { name: 'Lavender',     color: '#7B68AE', light: '#9B87CE' },
  { name: 'Rio Grande',   color: '#2D6A4F', light: '#52B788' },
  { name: 'Chile Red',    color: '#C62828', light: '#EF5350' },
  { name: 'Sandia Pink',  color: '#D4649A', light: '#E890B6' },
  { name: 'Mesa Gold',    color: '#B8860B', light: '#DAA520' },
  { name: 'Adobe Brown',  color: '#8D6E63', light: '#A1887F' },
];

function applyUserTheme(brand: string, brandLight: string) {
  const root = document.documentElement;
  root.style.setProperty('--brand', brand);
  root.style.setProperty('--brand-light', brandLight);
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${brand} 0%, ${brandLight} 100%)`);
  root.style.setProperty('--brand-bg-subtle', brand + '1a');
  root.style.setProperty('--brand-ring-color', brand);
  root.style.setProperty('--brand-tint-bg', brand + '26');
  root.style.setProperty('--brand-tint-border', brand + '80');
}

function loadUserTheme(): { brand: string; brandLight: string } | null {
  try {
    const raw = localStorage.getItem(USER_THEME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveUserTheme(brand: string, brandLight: string) {
  localStorage.setItem(USER_THEME_KEY, JSON.stringify({ brand, brandLight }));
}

function clearUserTheme() {
  localStorage.removeItem(USER_THEME_KEY);
}

function UserColorPicker() {
  const [selectedColor, setSelectedColor] = useState(() => {
    const saved = loadUserTheme();
    return saved?.brand || '';
  });
  const [customColor, setCustomColor] = useState(() => {
    const saved = loadUserTheme();
    const isPreset = USER_ACCENT_PRESETS.some(p => p.color === saved?.brand);
    return (!isPreset && saved?.brand) ? saved.brand : '#C2634A';
  });
  const [showCustom, setShowCustom] = useState(() => {
    const saved = loadUserTheme();
    return saved ? !USER_ACCENT_PRESETS.some(p => p.color === saved.brand) : false;
  });

  const handlePreset = (preset: typeof USER_ACCENT_PRESETS[0]) => {
    setSelectedColor(preset.color);
    setShowCustom(false);
    saveUserTheme(preset.color, preset.light);
    applyUserTheme(preset.color, preset.light);
  };

  const handleCustom = (hex: string) => {
    setCustomColor(hex);
    setSelectedColor(hex);
    // Generate a lighter variant by blending with white
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, r + Math.round((255 - r) * 0.35));
    const lg = Math.min(255, g + Math.round((255 - g) * 0.35));
    const lb = Math.min(255, b + Math.round((255 - b) * 0.35));
    const light = `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
    saveUserTheme(hex, light);
    applyUserTheme(hex, light);
  };

  const handleReset = () => {
    setSelectedColor('');
    setShowCustom(false);
    clearUserTheme();
    // Reload admin theme or defaults
    const root = document.documentElement;
    root.style.removeProperty('--brand');
    root.style.removeProperty('--brand-light');
    root.style.removeProperty('--brand-gradient');
    root.style.removeProperty('--brand-bg-subtle');
    root.style.removeProperty('--brand-ring-color');
    root.style.removeProperty('--brand-tint-bg');
    root.style.removeProperty('--brand-tint-border');
    window.location.reload();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {USER_ACCENT_PRESETS.map(preset => (
          <button
            key={preset.color}
            onClick={() => handlePreset(preset)}
            title={preset.name}
            style={{
              width: 36, height: 36, minHeight: 36, borderRadius: '50%', aspectRatio: '1', flexShrink: 0,
              background: `linear-gradient(135deg, ${preset.color}, ${preset.light})`,
              border: selectedColor === preset.color ? '3px solid #222' : '3px solid transparent',
              outline: selectedColor === preset.color ? '2px solid white' : 'none',
              cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: selectedColor === preset.color ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
            }}
          />
        ))}
        {/* Custom color button */}
        <button
          onClick={() => setShowCustom(s => !s)}
          title="Custom color"
          style={{
            width: 36, height: 36, minHeight: 36, borderRadius: '50%', aspectRatio: '1', flexShrink: 0,
            background: showCustom ? `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` : '#e5e7eb',
            border: showCustom ? '3px solid #222' : '3px solid transparent',
            outline: showCustom ? '2px solid white' : 'none',
            cursor: 'pointer', transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', color: showCustom ? 'white' : '#999',
          }}
        >
          {!showCustom && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>palette</span>}
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg" style={{ background: '#f9fafb' }}>
          <input
            type="color"
            value={customColor}
            onChange={e => handleCustom(e.target.value)}
            style={{ width: 44, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0, background: 'none' }}
          />
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-600" style={{ fontFamily: 'Public Sans, sans-serif' }}>Custom Color</p>
            <p className="text-xs text-gray-400 font-mono">{customColor}</p>
          </div>
          <div className="w-20 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${customColor}, ${customColor}88)` }} />
        </div>
      )}

      {selectedColor && (
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          style={{ fontFamily: 'Public Sans, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Reset to default colors
        </button>
      )}
    </div>
  );
}

function ProfileSettingsPane({ user, onUsernameChange, onSignIn, isDark, onToggleDark }: { user: User | null; onUsernameChange?: (name: string) => void; onSignIn?: () => void; isDark?: boolean; onToggleDark?: () => void }) {
  const [prefs, setPrefs] = useState<UserPrefs>(getPrefs);
  const [open, setOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState(
    user?.user_metadata?.display_name || user?.user_metadata?.full_name?.split(' ')[0] || ''
  );
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaved, setUsernameSaved] = useState(false);
  // Email newsletter prefs
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [emailFreq, setEmailFreq] = useState<'weekly' | 'daily' | 'never'>('weekly');
  const [emailPrefsLoaded, setEmailPrefsLoaded] = useState(false);
  const [emailPrefsSaving, setEmailPrefsSaving] = useState(false);
  const [emailPrefsSaved, setEmailPrefsSaved] = useState(false);

  // Load email prefs from Supabase when user is logged in
  useEffect(() => {
    if (!user) { setEmailPrefsLoaded(false); return; }
    supabase.from('user_email_prefs').select('opted_in, frequency').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEmailOptIn(data.opted_in ?? false);
          setEmailFreq((data.frequency as any) ?? 'weekly');
        } else {
          setEmailOptIn(false);
          setEmailFreq('weekly');
        }
        setEmailPrefsLoaded(true);
      });
  }, [user?.id]);

  const saveEmailPrefs = async (optIn: boolean, freq: 'weekly' | 'daily' | 'never') => {
    if (!user) return;
    setEmailPrefsSaving(true);
    const userEmail = user.email ?? '';
    await supabase.from('user_email_prefs').upsert({
      user_id: user.id,
      email: userEmail,
      opted_in: optIn,
      frequency: freq,
    }, { onConflict: 'user_id' });
    setEmailPrefsSaving(false);
    setEmailPrefsSaved(true);
    setTimeout(() => setEmailPrefsSaved(false), 2000);
  };

  const updatePrefs = (next: UserPrefs) => { setPrefs(next); savePrefs(next); window.dispatchEvent(new Event('abq_prefs_changed')); };

  const toggleSection = (id: string) => {
    const hidden = prefs.hiddenSections.includes(id)
      ? prefs.hiddenSections.filter(s => s !== id)
      : [...prefs.hiddenSections, id];
    updatePrefs({ ...prefs, hiddenSections: hidden });
  };

  const toggleInterest = (id: string) => {
    const next = prefs.preferredInterests.includes(id)
      ? prefs.preferredInterests.filter(i => i !== id)
      : [...prefs.preferredInterests, id];
    updatePrefs({ ...prefs, preferredInterests: next });
  };

  const handleUsernameSave = async () => {
    const t = usernameInput.trim();
    if (!t) { setUsernameError("Username can't be empty"); return; }
    if (t.length < 3) { setUsernameError('Too short (min 3 chars)'); return; }
    if (t.length > 20) { setUsernameError('Too long (max 20 chars)'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(t)) { setUsernameError('Letters, numbers, and underscores only'); return; }
    if (hasProfanity(t)) { setUsernameError('Please choose a different username'); return; }
    setUsernameError('');
    try {
      await supabase.auth.updateUser({ data: { display_name: t } });
    } catch { /* continue — server may have accepted even if client throws */ }
    try {
      // Verify via getUser() rather than trusting client return value
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (freshUser?.user_metadata?.display_name === t) {
        onUsernameChange?.(t);
        setUsernameInput(t);
        setUsernameSaved(true);
        setTimeout(() => setUsernameSaved(false), 2500);
      } else {
        setUsernameError('Failed to save — try again');
      }
    } catch { setUsernameError('Failed to save — try again'); }
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white rounded-lg px-4 py-3"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontFamily: 'Public Sans, sans-serif' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '16px' }}>⚙️</span>
          <span className="font-bold text-sm text-gray-800">Customize Your Experience</span>
        </div>
        <span style={{ fontSize: '12px', color: '#999' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-3">

          {/* Appearance — Dark Mode + Color Scheme */}
          <div className="bg-white rounded-lg p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'Public Sans, sans-serif' }}>Appearance</p>
            <button onClick={onToggleDark} className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--brand)', fontVariationSettings: isDark ? "'FILL' 1" : "'FILL' 0" }}>dark_mode</span>
                <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif' }}>Dark Mode</span>
              </div>
              <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-colors" style={{ background: isDark ? 'var(--brand)' : '#d1d5db' }}>
                <div className="w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: isDark ? 'translateX(20px)' : 'translateX(0)' }} />
              </div>
            </button>

            {/* Accent Color Picker */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>Accent Color</p>
              <p className="text-xs text-gray-400 mb-3" style={{ fontFamily: 'Public Sans, sans-serif' }}>Choose a color that makes ABQ Unplugged yours</p>
              <UserColorPicker />
            </div>
          </div>

          {/* Username */}
          {user ? (
            <div className="bg-white rounded-lg p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>Username</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value); setUsernameError(''); setUsernameSaved(false); }}
                  placeholder="e.g. xplorer_abq"
                  maxLength={20}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  style={{ fontFamily: 'Public Sans, sans-serif', outline: 'none' }}
                />
                <button
                  onClick={handleUsernameSave}
                  className="px-4 py-2 rounded-lg text-white text-sm font-bold flex-shrink-0"
                  style={{ background: usernameSaved ? '#2e7d32' : 'var(--brand)', fontFamily: 'Public Sans, sans-serif', minWidth: 64 }}
                >
                  {usernameSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              {usernameError && <p className="text-xs mt-1.5" style={{ color: '#c62828', fontFamily: 'Public Sans, sans-serif' }}>{usernameError}</p>}
              <p className="text-xs text-gray-400 mt-1.5" style={{ fontFamily: 'Public Sans, sans-serif' }}>Shown on the leaderboard. Letters, numbers & underscores only.</p>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="w-full bg-white rounded-lg p-4 flex items-center gap-3 text-left"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontFamily: 'Public Sans, sans-serif' }}
            >
              <span style={{ fontSize: '20px' }}>🏷️</span>
              <div>
                <p className="text-sm font-bold text-gray-800">Set your username</p>
                <p className="text-xs text-gray-400 mt-0.5">Sign in to pick a name for your profile & leaderboard</p>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--brand)', fontWeight: 700, fontSize: '13px' }}>Sign in →</span>
            </button>
          )}

          {/* Email Newsletter */}
          {user ? (
            <div className="bg-white rounded-lg p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>Email Newsletter</p>
              <p className="text-xs text-gray-400 mb-3" style={{ fontFamily: 'Public Sans, sans-serif' }}>Get personalized event picks based on what you've saved</p>
              {!emailPrefsLoaded ? (
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>Loading…</p>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const next = !emailOptIn;
                      setEmailOptIn(next);
                      saveEmailPrefs(next, emailFreq);
                    }}
                    className="flex items-center justify-between w-full mb-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--brand)', fontVariationSettings: emailOptIn ? "'FILL' 1" : "'FILL' 0" }}>mail</span>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif' }}>Receive Newsletter</span>
                    </div>
                    <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-colors" style={{ background: emailOptIn ? 'var(--brand)' : '#d1d5db' }}>
                      <div className="w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: emailOptIn ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                  </button>
                  {emailOptIn && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>Frequency</p>
                      <div className="flex gap-2">
                        {(['weekly', 'daily'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => { setEmailFreq(f); saveEmailPrefs(emailOptIn, f); }}
                            className="flex-1 rounded-lg py-2 text-sm font-bold transition-all"
                            style={{
                              background: emailFreq === f ? 'var(--brand)' : '#f5f5f5',
                              color: emailFreq === f ? 'white' : '#666',
                              fontFamily: 'Public Sans, sans-serif',
                            }}
                          >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {emailPrefsSaved && (
                    <p className="text-xs mt-2" style={{ color: '#2e7d32', fontFamily: 'Public Sans, sans-serif' }}>✓ Saved</p>
                  )}
                  {emailPrefsSaving && (
                    <p className="text-xs mt-2 text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>Saving…</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>Sent to {user.email}</p>
                </>
              )}
            </div>
          ) : null}

          {/* Homescreen Sections */}
          <div className="bg-white rounded-lg p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'Public Sans, sans-serif' }}>Homescreen Sections</p>
            <div className="flex flex-col gap-3">
              {DISCOVER_SECTIONS.map(sec => {
                const visible = !prefs.hiddenSections.includes(sec.id);
                return (
                  <button key={sec.id} onClick={() => toggleSection(sec.id)} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--brand)', fontVariationSettings: "'FILL' 1" }}>{sec.emoji}</span>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif' }}>{sec.label}</span>
                    </div>
                    <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-colors" style={{ background: visible ? 'var(--brand)' : '#d1d5db' }}>
                      <div className="w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: visible ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interests */}
          <div className="bg-white rounded-lg p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>Your Interests</p>
            <p className="text-xs text-gray-400 mb-3" style={{ fontFamily: 'Public Sans, sans-serif' }}>Selected interests appear first in your feed</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(opt => {
                const active = prefs.preferredInterests.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleInterest(opt.id)}
                    className="px-3 py-1.5 rounded text-sm font-semibold transition-all"
                    style={{ fontFamily: 'Public Sans, sans-serif', background: active ? 'var(--brand)' : '#f3f4f6', color: active ? 'white' : '#374151', boxShadow: active ? '2px 2px 0 var(--brand)' : 'none' }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Profile Screen ────────────────────────────────────────────────────────────

// No seed data — leaderboard starts empty and grows with real check-ins


// Legacy component stub — superseded by InstallPrompt below
function AddToHomePrompt() { return null; }

// ─── Pull-to-Refresh ────────────────────────────────────────────────────────
// Custom PTR since overscroll-behavior:contain blocks the native browser PTR.
// Triggers a full page reload (clears SW cache for fresh data).
function PullToRefresh() {
  const [pullY, setPullY] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startY = React.useRef<number | null>(null);
  const threshold = 72;

  const onTouchStart = React.useCallback((e: TouchEvent) => {
    // Only activate when scrolled to top
    if (window.scrollY !== 0) return;
    // Don't activate PTR if the touch starts inside a horizontally-scrollable
    // container (filter pills, carousels, etc.) to avoid conflicting with
    // horizontal scrolling of the category filter row.
    let el = e.target as HTMLElement | null;
    while (el) {
      const style = window.getComputedStyle(el);
      const oxv = style.overflowX;
      if ((oxv === 'auto' || oxv === 'scroll') && el.scrollWidth > el.clientWidth + 2) return;
      if (el.classList.contains('overflow-x-auto')) return;
      el = el.parentElement;
    }
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = React.useCallback((e: TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullY(Math.min(dy * 0.45, threshold + 20)); // dampen
    }
  }, [threshold]);

  const onTouchEnd = React.useCallback(() => {
    if (pullY >= threshold) {
      setRefreshing(true);
      // Clear SW cache then reload
      if ('caches' in window) {
        caches.keys().then(names => {
          Promise.all(names.map(n => caches.delete(n))).then(() => window.location.reload());
        });
      } else {
        window.location.reload();
      }
    } else {
      setPullY(0);
      startY.current = null;
    }
  }, [pullY, threshold]);

  React.useEffect(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  if (pullY === 0 && !refreshing) return null;

  const progress = Math.min(pullY / threshold, 1);
  const ready = pullY >= threshold;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top, 0px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        height: refreshing ? 52 : Math.max(pullY, 0),
        background: 'var(--brand, #D4EF4D)',
        zIndex: 9999,
        transition: refreshing ? 'height 0.2s ease' : 'none',
        overflow: 'hidden',
        paddingBottom: 10,
        gap: 6,
      }}
    >
      {refreshing ? (
        <>
          {/* Animated shimmer bar */}
          <div style={{
            width: '80px',
            height: '3px',
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent 0%, var(--ink) 40%, var(--ink) 60%, transparent 100%)',
            backgroundSize: '200% auto',
            animation: 'ptrSweep 1s linear infinite',
          }} />
          {/* Animated dots */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--ink)',
                animation: `ptrDots 1.2s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        </>
      ) : (
        <div style={{
          width: `${progress * 60 + 12}px`,
          height: 3,
          borderRadius: 2,
          background: 'var(--ink)',
          opacity: Math.min(progress * 2, 1),
          transition: 'width 0.1s ease',
        }} />
      )}
    </div>
  );
}


// ─── Install Prompt — brutalist design (iOS + Android unified) ──────────────
// Shows on 2nd visit or after 30s. Dismissed for 7 days.

const INSTALL_DISMISSED_KEY = 'abq_install_dismissed';
const INSTALL_DISMISS_DAYS = 7;
const INSTALL_VISIT_KEY = 'abq_install_visits';

function _isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isInStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari && !isInStandalone;
}

function shouldShowPrompt(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return false;
  if (('standalone' in window.navigator) && (window.navigator as any).standalone) return false;
  const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
  if (dismissed) {
    const age = Date.now() - parseInt(dismissed, 10);
    if (age < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [androidPrompt, setAndroidPrompt] = useState<Event | null>(null);
  const ios = _isIosSafari();

  useEffect(() => {
    if (!shouldShowPrompt()) return;

    // Track visit count
    const visits = parseInt(localStorage.getItem(INSTALL_VISIT_KEY) || '0', 10) + 1;
    localStorage.setItem(INSTALL_VISIT_KEY, String(visits));

    // Android: wait for beforeinstallprompt
    if (!ios) {
      const handler = (e: Event) => {
        e.preventDefault();
        setAndroidPrompt(e);
        // Show on 2nd+ visit immediately, otherwise after 30s
        const delay = visits >= 2 ? 4000 : 30000;
        setTimeout(() => setVisible(true), delay);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }

    // iOS: no event, just show after delay
    const delay = visits >= 2 ? 3000 : 30000;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [ios]);

  const dismiss = () => {
    setHiding(true);
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setTimeout(() => setVisible(false), 380);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes abqPromptSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes abqPromptSlideDown {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(100%); }
        }
        @keyframes abqBounce {
          0%, 100% { transform: translateY(0); }
          40%       { transform: translateY(-10px); }
          60%       { transform: translateY(-5px); }
        }
        @keyframes abqArrowPulse {
          0%, 100% { opacity: 0.6; transform: translateY(0) scaleY(1); }
          50%       { opacity: 1;   transform: translateY(4px) scaleY(1.1); }
        }
      `}</style>

      {/* Backdrop tap-to-dismiss */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.35)',
          animation: hiding ? 'abqPromptSlideDown 0.38s ease forwards' : 'none',
          opacity: hiding ? 0 : 1, transition: hiding ? 'opacity 0.38s' : 'none',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        padding: '20px 24px calc(28px + env(safe-area-inset-bottom))',
        fontFamily: 'Manrope, -apple-system, sans-serif',
        animation: hiding
          ? 'abqPromptSlideDown 0.38s ease forwards'
          : 'abqPromptSlideUp 0.44s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e0e0e0', margin: '0 auto 18px' }} />

        {/* Dismiss X */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: 18, right: 20,
            width: 32, height: 32, borderRadius: '50%',
            background: '#f2f2f2', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#666', lineHeight: 1,
          }}
          aria-label="Dismiss"
        >✕</button>

        {/* Icon + headline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <img
            src="/apple-touch-icon-180.png"
            alt="ABQ Unplugged"
            style={{ width: 56, height: 56, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#1c1c1e', lineHeight: 1.2 }}>
              Add to Home Screen
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
              Get the full-screen app experience
            </div>
          </div>
        </div>

        {/* Steps */}
        {[
          {
            num: '1',
            icon: (
              /* Share icon SVG */
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke='var(--brand)' strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            ),
            text: <>Tap the <strong>Share</strong> button in Safari's bottom bar</>,
          },
          {
            num: '2',
            icon: (
              /* Plus-in-square icon */
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke='var(--brand)' strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            ),
            text: <>Scroll down and tap <strong>"Add to Home Screen"</strong></>,
          },
        ].map(({ num, icon, text }) => (
          <div key={num} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px', borderRadius: 4,
            background: '#faf8f6', marginBottom: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--brand)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, flexShrink: 0,
            }}>{num}</div>
            <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</div>
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.4 }}>{text}</div>
          </div>
        ))}

        {/* Bouncing arrow pointing down (toward Safari toolbar) */}
        <div style={{
          textAlign: 'center', marginTop: 10,
          animation: 'abqBounce 1.6s ease-in-out infinite',
          fontSize: 26, color: 'var(--brand)',
          lineHeight: 1,
        }}>↓</div>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 4 }}>
          The Share button is in Safari's bottom toolbar
        </div>
      </div>
    </>
  );
}


// --- Android / Chrome Install Prompt ----------------------------------------
// Captures the beforeinstallprompt event and shows a polished install banner.

const ANDROID_DISMISSED_KEY = 'abq_android_install_dismissed';
const ANDROID_DISMISSED_DAYS = 14;

function AndroidInstallPrompt() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const dismissed = localStorage.getItem(ANDROID_DISMISSED_KEY);
    if (dismissed) {
      const age = Date.now() - parseInt(dismissed, 10);
      if (age < ANDROID_DISMISSED_DAYS * 24 * 60 * 60 * 1000) return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => {
        setVisible(true);
        trackEvent('a2hs_shown');
      }, 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setHiding(true);
    localStorage.setItem(ANDROID_DISMISSED_KEY, String(Date.now()));
    setTimeout(() => { setVisible(false); setPrompt(null); }, 380);
  };

  const install = async () => {
    if (!androidPrompt) return;
    (androidPrompt as any).prompt();
    const { outcome } = await (androidPrompt as any).userChoice;
    if (outcome === 'accepted') {
      trackEvent('a2hs_accepted');
      setVisible(false);
      setAndroidPrompt(null);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;
  if (!ios && !androidPrompt) return null;

  const slideAnim: React.CSSProperties = {
    animation: hiding
      ? 'abqSlideDown 0.3s ease forwards'
      : 'abqSlideUp 0.35s ease forwards',
  };

  return (
    <>
      <style>{`
        @keyframes abqSlideUp   { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes abqSlideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)' }}
      />

      {/* Brutalist panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: '#fff',
        border: '3px solid #000',
        borderBottom: 'none',
        padding: '0 0 calc(env(safe-area-inset-bottom) + 4px)',
        fontFamily: 'Public Sans, sans-serif',
        ...slideAnim,
      }}>
        {/* Header bar */}
        <div style={{
          background: '#000', color: '#fff',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ABQ Unplugged
          </span>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: '2px solid #fff', color: '#fff', width: 28, height: 28, cursor: 'pointer', fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            aria-label="Dismiss"
          >✕</button>
        </div>

        <div style={{ padding: '20px 20px 16px' }}>
          {/* Headline */}
          <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '-0.5px', marginBottom: 6 }}>
            INSTALL ABQ UNPLUGGED
          </div>
          <div style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 14, color: '#444', marginBottom: 20, lineHeight: 1.4 }}>
            Add to your home screen. No app store. No BS.
          </div>

          {ios ? (
            // iOS instructions
            <div style={{ border: '2px solid #000', padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                How to install on iPhone
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { step: '1', text: 'Tap the Share button', icon: '↑' },
                  { step: '2', text: 'Scroll down and tap "Add to Home Screen"', icon: '＋' },
                  { step: '3', text: 'Tap "Add" in the top right', icon: '✓' },
                ].map(({ step, text, icon }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 32, height: 32, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16 }}>{icon}</div>
                    <span style={{ fontFamily: 'Public Sans, sans-serif', fontSize: 14, color: '#1a1a1a' }}>{text}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={dismiss}
                style={{ marginTop: 16, width: '100%', padding: '14px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Public Sans, sans-serif', fontWeight: 900, fontSize: 15, letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >GOT IT</button>
            </div>
          ) : (
            // Android install button
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={dismiss}
                style={{ flex: 1, padding: '14px', background: '#fff', border: '2px solid #000', cursor: 'pointer', fontFamily: 'Public Sans, sans-serif', fontWeight: 900, fontSize: 14, textTransform: 'uppercase' }}
              >NOT NOW</button>
              <button
                onClick={install}
                style={{ flex: 2, padding: '14px', background: '#000', color: '#fff', border: '2px solid #000', cursor: 'pointer', fontFamily: 'Public Sans, sans-serif', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >INSTALL NOW</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


// --- Offline Banner ----------------------------------------------------------
// Shows a non-intrusive top banner when the device loses connectivity.

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline  = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (!navigator.onLine) setIsOffline(true);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: '#1c1c1e',
        color: '#fff',
        textAlign: 'center',
        fontSize: 13,
        fontFamily: 'Public Sans, sans-serif',
        fontWeight: 600,
        padding: 'calc(env(safe-area-inset-top) + 8px) 16px 10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        letterSpacing: 0.1,
      }}
    >
      📡 You’re offline — showing cached content
    </div>
  );
}

// ─── Loading Screen ────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Loading fun…',
  'Asking Albuquerque what there is to do…',
  'Loading stuff to do…',
  'Just a sec…',
  'Gimme a sec…',
  'ABQ weather is the best',
  'Not a long wait longer…',
  'Finding your next adventure…',
  'Green chile is always the answer 🌶️',
  'Scanning the Duke City…',
];

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  // Don't show anything for the first 800 ms. Fast connections and cache hits
  // will finish loading before this fires, so the screen is never visible.
  // Only slow/first-time connections will ever see the loading UI.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length);
        setFadeIn(true);
      }, 280);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes abqLogoEntry {
          0%   { opacity: 0; transform: scale(0.72) translateY(24px); }
          55%  { opacity: 1; transform: scale(1.06) translateY(-5px); }
          75%  { transform: scale(0.97) translateY(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes loadingShimmer {
          0%   { transform: translateX(-200%); }
          100% { transform: translateX(500%); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes msgOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-8px); }
        }
      `}</style>
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'var(--brand-bg-screen)' }}
      >
        <video
          key="splash-video"
          autoPlay
          muted
          playsInline
          style={{ width: '280px', height: 'auto', display: 'block' }}
        >
          <source src="/logo-animation.webm" type="video/webm" />
          <source src="/logo-animation.mp4" type="video/mp4" />
        </video>
        <p
          key={msgIdx}
          className="text-sm text-gray-400 mt-4"
          style={{
            fontFamily: 'Public Sans, sans-serif',
            minHeight: '22px',
            textAlign: 'center',
            maxWidth: '260px',
            animation: fadeIn ? 'msgIn 0.28s ease forwards' : 'msgOut 0.28s ease forwards',
          }}
        >
          {LOADING_MESSAGES[msgIdx]}
        </p>
        <div
          className="mt-5 rounded-full overflow-hidden"
          style={{ width: '120px', height: '3px', background: '#e8e8e8', position: 'relative' }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, var(--brand) 40%, var(--brand-light) 60%, transparent 100%)',
              animation: 'loadingShimmer 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Site Banner ─────────────────────────────────────────────────────────────

const ADMIN_EMAIL = '4mattcarlson@gmail.com';

interface BannerConfig { message: string; type: 'info' | 'success' | 'warning' | 'promo'; active: boolean; linkUrl?: string; linkText?: string; bgColor?: string; textColor?: string; }

function SiteBanner({ banner }: { banner: BannerConfig | null }) {
  if (!banner?.active || !banner.message) return null;
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    info:    { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  text: '#1d4ed8' },
    success: { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',   text: '#15803d' },
    warning: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  text: '#92400e' },
    promo:   { bg: 'var(--brand)',               border: 'rgba(0,0,0,0.12)',                text: 'var(--ink)' },
  };
  const typeColor = colorMap[banner.type] ?? colorMap.info;
  const bg   = banner.bgColor   || typeColor.bg;
  const text = banner.textColor || typeColor.text;
  const border = banner.bgColor || typeColor.border;
  return (
    <div style={{ background: bg, borderBottom: `2px solid ${border}`, padding: '10px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: text, fontFamily: 'Public Sans, sans-serif', lineHeight: 1.4 }}>
        {banner.message}
        {banner.linkUrl && banner.linkText && (
          <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 8, textDecoration: 'underline', fontWeight: 800, color: text }}
          >{banner.linkText} →</a>
        )}
      </p>
    </div>
  );
}

// ─── Admin (see AdminPanel.tsx) ───────────────────────────────────────────────
// The full admin panel is in src/AdminPanel.tsx.
// The types below are kept here only for the existing DashboardTab/PlacesTab helpers
// that are still referenced; they will be removed once full migration is complete.

type AdminTab = 'dashboard' | 'events' | 'flags' | 'tagrules' | 'settings';


interface LbEntry {
  uid: string;
  displayName: string;
  count: number;
}

interface EventOverrideDoc {
  eventId: string;
  customTags: string[];
  eventName?: string;
  venueName?: string;
  notes?: string;
}

interface TagRulesConfig {
  outdoorKeywords: string[];
  indoorKeywords: string[];
  categoryKeywords: Record<string, string[]>;
}

const ADMIN_ACCENT = '#b45309';


const EVENT_TAG_OPTIONS = [
  'outdoor','indoor','family-friendly','free','live-music',
  'sports','art','comedy','festival','dance','film',
  'food','kids','nightlife','theater',
];

const DEFAULT_RULES: TagRulesConfig = {
  outdoorKeywords: ['outdoor','amphitheater','park','field','arena','stadium','garden','trail','wilderness','lake','river','mountain'],
  indoorKeywords: ['theater','theatre','cinema','gallery','museum','hall','auditorium','studio','lounge'],
  categoryKeywords: {
    'family-friendly': ['family','kids','children','youth','junior'],
    'live-music': ['music','concert','band','jazz','blues','rock','symphony'],
    'arts': ['art','gallery','museum','exhibit','artist'],
    'sports': ['sport','game','match','tournament','league'],
    'food': ['food','dining','restaurant','chef','culinary','tasting'],
    'festival': ['festival','fair','carnival','fiesta','celebration'],
    'nightlife': ['bar','club','lounge','cocktail','nightlife'],
  },
};

// ── Shared mini-components ────────────────────────────────────────────────────

const TagPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
      border: '1px solid ' + (active ? ADMIN_ACCENT : '#d1d5db'),
      backgroundColor: active ? ADMIN_ACCENT : 'white',
      color: active ? 'white' : '#374151',
    }}
  >{label}</button>
);

const FlashMsg = ({ msg }: { msg: string }) => msg ? (
  <div style={{ padding: '10px 14px', backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, marginBottom: 12, fontSize: 14, color: '#065f46' }}>{msg}</div>
) : null;

const inputSty = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const,
};
const cardSty = {
  backgroundColor: 'white', borderRadius: 12, padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};
const btnPrim = {
  padding: '8px 18px', borderRadius: 8, border: 'none' as const,
  backgroundColor: ADMIN_ACCENT, color: 'white', cursor: 'pointer' as const,
  fontSize: 14, fontWeight: 600 as const,
};
const btnSec = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db',
  background: 'white', cursor: 'pointer' as const, fontSize: 14,
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

// ── Places ────────────────────────────────────────────────────────────────────

// ── Event Tag Overrides ───────────────────────────────────────────────────────
function EventsTab() {
  const [overrides, setOverrides] = useState<EventOverrideDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list'|'add'>('list');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const EMPTY_FORM = { eventId:'', eventName:'', venueName:'', customTags:[] as string[], notes:'' };
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    _fbGetAllDocs('eventOverrides').then(snap => {
      setOverrides(snap.docs.map(d => ({ eventId: d.id, ...d.data() } as EventOverrideDoc)));
      setLoading(false);
    });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const saveOverride = async () => {
    if (!form.eventId.trim()) { flash('Event ID is required'); return; }
    setSaving(true);
    try {
      const data = { customTags: form.customTags, eventName: form.eventName, venueName: form.venueName, notes: form.notes };
      await _fbSetDoc('event_overrides', form.eventId.trim(), data);
      setOverrides(prev => {
        const i = prev.findIndex(o => o.eventId === form.eventId.trim());
        const item = { eventId: form.eventId.trim(), ...data };
        if (i >= 0) { const n = [...prev]; n[i] = item; return n; }
        return [...prev, item];
      });
      setForm(EMPTY_FORM); setMode('list'); flash('Override saved ✓');
    } catch (e) { flash('Error: ' + (e as Error).message); }
    setSaving(false);
  };

  const deleteOverride = async (id: string) => {
    await _fbDeleteDoc('event_overrides', id);
    setOverrides(prev => prev.filter(o => o.eventId !== id));
    flash('Deleted ✓');
  };

  const toggleTag = (tag: string) => setForm(f => ({
    ...f, customTags: f.customTags.includes(tag) ? f.customTags.filter(t => t !== tag) : [...f.customTags, tag]
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', flex: 1 }}>Event Tag Overrides</h2>
        {mode === 'list' && <button style={btnPrim} onClick={() => setMode('add')}>+ Add Override</button>}
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Manually tag specific Ticketmaster events. Find the event ID in the TM URL
        (e.g. <code style={{ backgroundColor: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>G5vYZ9fIjbfBo</code>).
        The app will apply these tags instead of the auto-detected ones.
      </p>
      <FlashMsg msg={msg} />

      {mode === 'add' && (
        <div style={{ ...cardSty, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>New Event Override</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {([['eventId','Ticketmaster Event ID *'],['eventName','Event Name (for reference)'],['venueName','Venue Name (for reference)'],['notes','Notes']] as [string,string][]).map(([k,l]) => (
              <div key={k}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{l}</label>
                <input value={(form as Record<string,unknown>)[k] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputSty} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tags to apply</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EVENT_TAG_OPTIONS.map(tag => <TagPill key={tag} label={tag} active={form.customTags.includes(tag)} onClick={() => toggleTag(tag)} />)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={btnSec} onClick={() => setMode('list')}>Cancel</button>
            <button style={{ ...btnPrim, opacity: saving ? 0.7 : 1 }} onClick={saveOverride} disabled={saving}>
              {saving ? 'Saving…' : 'Save Override'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {overrides.map(o => (
            <div key={o.eventId} style={{ ...cardSty, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{o.eventName || '(unnamed event)'}</div>
                {o.venueName && <div style={{ fontSize: 12, color: '#6b7280' }}>{o.venueName}</div>}
                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>ID: {o.eventId}</div>
                {o.notes && <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 2 }}>{o.notes}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {o.customTags.map(t => <span key={t} style={{ fontSize: 11, backgroundColor: '#ede9e0', color: '#6b4c2a', padding: '2px 8px', borderRadius: 999 }}>{t}</span>)}
                </div>
              </div>
              <button onClick={() => deleteOverride(o.eventId)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
            </div>
          ))}
          {overrides.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No overrides yet. Add one above to manually tag specific events.</p>}
        </div>
      )}
    </div>
  );
}

// ── Flags ─────────────────────────────────────────────────────────────────────
interface EventFlag {
  id: string;
  event_id: string;
  event_name: string | null;
  message: string;
  submitted_by: string | null;
  status: 'pending' | 'valid' | 'invalid';
  admin_note: string | null;
  created_at: string;
}

function FlagsTab() {
  const [flags, setFlags]           = useState<EventFlag[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'all'|'pending'|'valid'|'invalid'>('pending');
  const [notes, setNotes]           = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<Record<string, boolean>>({});
  const [msg, setMsg]               = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  useEffect(() => {
    setLoading(true);
    (supabase.from as any)('event_flags')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }: { data: EventFlag[] | null; error: unknown }) => {
        if (!error && data) setFlags(data);
        setLoading(false);
      });
  }, []);

  const updateFlag = async (id: string, updates: Partial<EventFlag>) => {
    setSaving(s => ({ ...s, [id]: true }));
    const { error } = await (supabase.from as any)('event_flags')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setFlags(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      flash('Updated ✓');
    } else {
      flash('Error saving');
    }
    setSaving(s => ({ ...s, [id]: false }));
  };

  const deleteFlag = async (id: string) => {
    await (supabase.from as any)('event_flags').delete().eq('id', id);
    setFlags(prev => prev.filter(f => f.id !== id));
    flash('Deleted ✓');
  };

  const pendingCount = flags.filter(f => f.status === 'pending').length;
  const shown = filter === 'all' ? flags : flags.filter(f => f.status === filter);

  const statusBadge = (s: EventFlag['status']) => {
    const cfg = {
      pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      valid:    { bg: '#d1fae5', color: '#065f46', label: '✓ Valid' },
      invalid:  { bg: '#fee2e2', color: '#991b1b', label: '✗ Invalid' },
    }[s];
    return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', flex: 1 }}>
          User Flags
          {pendingCount > 0 && <span style={{ marginLeft: 8, fontSize: 13, background: '#b45309', color: 'white', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>{pendingCount} pending</span>}
        </h2>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Reports submitted by users when event details look wrong or outdated. Mark as Valid to acknowledge, Invalid to dismiss.
      </p>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['pending','valid','invalid','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, border: '1px solid',
            fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
            borderColor: filter === f ? ADMIN_ACCENT : '#e5e7eb',
            background: filter === f ? ADMIN_ACCENT : 'white',
            color: filter === f ? 'white' : '#374151',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({flags.filter(x => x.status === f).length})</span>}
          </button>
        ))}
      </div>

      <FlashMsg msg={msg} />

      {loading ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No {filter === 'all' ? '' : filter} flags yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(flag => (
            <div key={flag.id} style={{ ...cardSty, borderLeft: `3px solid ${flag.status === 'valid' ? '#10b981' : flag.status === 'invalid' ? '#ef4444' : '#f59e0b'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{flag.event_name || 'Unknown Event'}</span>
                    {statusBadge(flag.status)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                    {new Date(flag.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {flag.submitted_by && <> · {flag.submitted_by}</>}
                  </div>
                  {/* User's message */}
                  <div style={{ fontSize: 13, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>
                    "{flag.message}"
                  </div>
                </div>
                <button onClick={() => deleteFlag(flag.id)} title="Delete"
                  style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>
                  Delete
                </button>
              </div>

              {/* Admin note */}
              <div style={{ marginBottom: 10 }}>
                <input
                  value={notes[flag.id] ?? (flag.admin_note || '')}
                  onChange={e => setNotes(n => ({ ...n, [flag.id]: e.target.value }))}
                  placeholder="Admin note (optional)…"
                  style={{ ...inputSty, fontSize: 12 }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => updateFlag(flag.id, { status: 'valid', admin_note: notes[flag.id] ?? flag.admin_note ?? null })}
                  disabled={saving[flag.id]}
                  style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1.5px solid #10b981', background: flag.status === 'valid' ? '#10b981' : 'white', color: flag.status === 'valid' ? 'white' : '#10b981', cursor: 'pointer' }}>
                  {saving[flag.id] ? '…' : '✓ Valid'}
                </button>
                <button
                  onClick={() => updateFlag(flag.id, { status: 'invalid', admin_note: notes[flag.id] ?? flag.admin_note ?? null })}
                  disabled={saving[flag.id]}
                  style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1.5px solid #ef4444', background: flag.status === 'invalid' ? '#ef4444' : 'white', color: flag.status === 'invalid' ? 'white' : '#ef4444', cursor: 'pointer' }}>
                  {saving[flag.id] ? '…' : '✗ Invalid'}
                </button>
                {(notes[flag.id] !== undefined && notes[flag.id] !== (flag.admin_note || '')) && (
                  <button
                    onClick={() => updateFlag(flag.id, { admin_note: notes[flag.id] })}
                    disabled={saving[flag.id]}
                    style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer' }}>
                    Save Note
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tag Rules ─────────────────────────────────────────────────────────────────
function TagRulesTab() {
  const [rules, setRules] = useState<TagRulesConfig>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    _fbGetDoc('config', 'tagRules', 'key').then(snap => {
      if (snap.exists()) setRules({ ...DEFAULT_RULES, ...(snap.data() as TagRulesConfig) });
      setLoading(false);
    });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const saveRules = async () => {
    setSaving(true);
    try {
      await _fbSetConfigDoc('tagRules', rules);
      flash('Tag rules saved ✓ — reload the app to apply changes');
    } catch (e) { flash('Error: ' + (e as Error).message); }
    setSaving(false);
  };

  const setList = (key: 'outdoorKeywords' | 'indoorKeywords', val: string) =>
    setRules(r => ({ ...r, [key]: val.split(',').map((s: string) => s.trim()).filter(Boolean) }));

  const setCatKw = (cat: string, val: string) =>
    setRules(r => ({ ...r, categoryKeywords: { ...r.categoryKeywords, [cat]: val.split(',').map((s: string) => s.trim()).filter(Boolean) } }));

  const addCat = () => {
    const name = prompt('New tag category name (e.g. "nightlife"):');
    if (name && name.trim()) setRules(r => ({ ...r, categoryKeywords: { ...r.categoryKeywords, [name.trim()]: [] } }));
  };

  const removeCat = (cat: string) => setRules(r => {
    const kw = { ...r.categoryKeywords };
    delete kw[cat];
    return { ...r, categoryKeywords: kw };
  });

  if (loading) return <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', flex: 1 }}>Tag Detection Rules</h2>
        <button style={{ ...btnPrim, opacity: saving ? 0.7 : 1 }} onClick={saveRules} disabled={saving}>
          {saving ? 'Saving…' : 'Save Rules'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Keywords matched case-insensitively against event and venue names to auto-assign tags.
        Separate with commas. Changes apply on next page reload.
      </p>
      <FlashMsg msg={msg} />

      {/* Outdoor */}
      <div style={{ ...cardSty, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>~</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Outdoor Keywords</h3>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          If a venue OR event name contains any of these words, the event is tagged "outdoor".
          Add words like "park", "wilderness", "trail" to catch outdoor venues.
        </p>
        <textarea
          value={rules.outdoorKeywords.join(', ')}
          onChange={e => setList('outdoorKeywords', e.target.value)}
          rows={3}
          style={{ ...inputSty, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {rules.outdoorKeywords.map(k => <span key={k} style={{ fontSize: 11, backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 999 }}>{k}</span>)}
        </div>
      </div>

      {/* Indoor */}
      <div style={{ ...cardSty, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>B</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Indoor Keywords</h3>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          If a venue name contains any of these words, the event is tagged "indoor".
        </p>
        <textarea
          value={rules.indoorKeywords.join(', ')}
          onChange={e => setList('indoorKeywords', e.target.value)}
          rows={3}
          style={{ ...inputSty, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {rules.indoorKeywords.map(k => <span key={k} style={{ fontSize: 11, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 999 }}>{k}</span>)}
        </div>
      </div>

      {/* Category keywords */}
      <div style={{ ...cardSty }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>T</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', flex: 1 }}>Category Tag Keywords</h3>
          <button style={{ ...btnSec, fontSize: 13, padding: '5px 12px' }} onClick={addCat}>+ Add Category</button>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Keywords that auto-assign events to tag categories. Comma-separated.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(rules.categoryKeywords).map(([cat, words]) => (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', flex: 1 }}>{cat}</label>
                <button onClick={() => removeCat(cat)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕ remove</button>
              </div>
              <textarea
                value={words.join(', ')}
                onChange={e => setCatKw(cat, e.target.value)}
                rows={2}
                style={{ ...inputSty, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsTab() {
  const [bannerMsg, setBannerMsg] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerColor, setBannerColor] = useState('#b45309');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    _fbGetDoc('config', 'siteConfig', 'key').then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setBannerMsg(d.banner?.message || '');
        setBannerActive(d.banner?.active ?? false);
        setBannerColor(d.banner?.color || '#b45309');
      }
      setLoading(false);
    });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const save = async () => {
    setSaving(true);
    try {
      await _fbSetConfigDoc('siteConfig', { banner: { message: bannerMsg, active: bannerActive, color: bannerColor } },
        { merge: true }
      );
      flash('Saved ✓');
    } catch (e) { flash('Error: ' + (e as Error).message); }
    setSaving(false);
  };

  if (loading) return <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 16 }}>Site Settings</h2>
      <FlashMsg msg={msg} />
      <div style={{ ...cardSty }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 14 }}>Site Banner</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={bannerActive} onChange={e => setBannerActive(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 600 }}>Show banner to all users</span>
        </label>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Message</label>
          <textarea
            value={bannerMsg}
            onChange={e => setBannerMsg(e.target.value)}
            rows={3}
            placeholder="e.g. ABQ Balloon Fiesta is this weekend! Check the Events tab."
            style={{ ...inputSty, resize: 'vertical' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Banner color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={bannerColor} onChange={e => setBannerColor(e.target.value)}
              style={{ width: 48, height: 36, borderRadius: 8, border: '1px solid #d1d5db', cursor: 'pointer', padding: 2 }} />
            <div style={{ flex: 1, backgroundColor: bannerColor, color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 13, minHeight: 36, display: 'flex', alignItems: 'center' }}>
              {bannerMsg || 'Banner preview'}
            </div>
          </div>
        </div>
        <button style={{ ...btnPrim, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── AdminScreen (root) ────────────────────────────────────────────────────────
function AdminScreen({ user, onBack }: { user: User | null; onBack: () => void }) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [places, setPlaces] = useState<PlaceDoc[]>([]);
  const [lbEntries, setLbEntries] = useState<LbEntry[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      _fbGetAllDocs('places'),
      _fbGetAllDocs('leaderboard', 'count', false),
    ]).then(([plSnap, lbSnap]) => {
      setPlaces(plSnap.docs.map(d => ({ id: d.id, tags: [], ...d.data() } as PlaceDoc)));
      setLbEntries(
        lbSnap.docs
          .map(d => ({ uid: d.id, displayName: '', count: 0, ...d.data() } as LbEntry))
          .sort((a, b) => b.count - a.count)
      );
      setDataLoaded(true);
    });
  }, []);

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '#' },
    
    { key: 'events',    label: 'Events',    icon: '~' },
    { key: 'flags',     label: 'Flags',     icon: '🚩' },
    { key: 'tagrules',  label: 'Tag Rules', icon: 'T' },
    { key: 'settings',  label: 'Settings',  icon: '*' },
  ];

  const setPlacesFn = (fn: (prev: PlaceDoc[]) => PlaceDoc[]) => setPlaces(fn);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#faf7f4' }}>
      {/* Header */}
      <div style={{ backgroundColor: ADMIN_ACCENT, color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', padding: '6px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>ABQ Unplugged Admin</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{user?.email}</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 12px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', position: 'sticky', top: 56, zIndex: 99 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, whiteSpace: 'nowrap',
            fontWeight: tab === t.key ? 700 : 400,
            backgroundColor: tab === t.key ? ADMIN_ACCENT : 'transparent',
            color: tab === t.key ? 'white' : '#374151',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
        {(tab === 'dashboard') && !dataLoaded ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 60 }}>Loading data…</p>
        ) : (
          <>
            {tab === 'events'    && <EventsTab />}
            {tab === 'flags'     && <FlagsTab />}
            {tab === 'tagrules'  && <TagRulesTab />}
            {tab === 'settings'  && <SettingsTab />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Plan Screen ──────────────────────────────────────────────────────────────

type SavedPlanItem = { type: 'place'; data: Place } | { type: 'event'; data: TMEvent };

function PlanScreen({
  savedPlan, onPlaceSelect, onEventSelect, onRemovePlace, onRemoveEvent, onClearAll,
}: {
  savedPlan: SavedPlanItem[];
  onPlaceSelect: (p: Place) => void;
  onEventSelect: (e: TMEvent) => void;
  onRemovePlace: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onClearAll: () => void;
}) {
  const places = savedPlan.filter(i => i.type === 'place') as { type: 'place'; data: Place }[];
  const events = savedPlan.filter(i => i.type === 'event') as { type: 'event'; data: TMEvent }[];

  const handleSharePlan = async () => {
    const lines: string[] = ['My ABQ Weekend — abqunplugged.com', ''];
    if (events.length) {
      lines.push('Events:');
      events.forEach(({ data: e }) => {
        const d = e.dates?.start?.localDate ? new Date(e.dates.start.localDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        const t = e.dates?.start?.localTime ? ` · ${e.dates.start.localTime.slice(0,5)}` : '';
        lines.push(`• ${e.name}${d ? ' (' + d + t + ')' : ''}`);
      });
      lines.push('');
    }
    if (places.length) {
      lines.push('Places to check out:');
      places.forEach(({ data: p }) => lines.push(`• ${p.name}${p.address ? ' — ' + p.address.split(',')[0] : ''}`));
      lines.push('');
    }
    lines.push('Find yours at abqunplugged.com');
    const text = lines.join('\n');
    if (navigator.share) {
      try { await navigator.share({ title: 'My ABQ Weekend', text }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  if (savedPlan.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 text-center" style={{ paddingTop: '100px', paddingBottom: '60px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#d0d8d0', marginBottom: '16px' }}>bookmark</span>
        <h2 className="font-black text-xl mb-2" style={{ fontFamily: 'Public Sans, sans-serif', color: '#1a1a1a' }}>Nothing saved yet</h2>
        <p className="text-sm" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', lineHeight: 1.6 }}>
          Bookmark events as you browse — they'll show up here so you can plan your next outing.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white border-b-2 border-black">
        <div>
          <h1 className="font-black text-xl leading-tight" style={{ fontFamily: 'Public Sans, sans-serif' }}>My ABQ</h1>
          <p className="text-xs mt-0.5" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif' }}>{savedPlan.length} {savedPlan.length === 1 ? 'stop' : 'stops'} saved</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSharePlan}
            className="flex items-center gap-1 text-xs font-black px-3 py-1.5"
            style={{ border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'Public Sans, sans-serif', background: '#1a1a1a', color: 'white' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>share</span>
            Share
          </button>
          <button onClick={onClearAll} className="text-xs font-bold px-3 py-1.5" style={{ border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'Public Sans, sans-serif', color: '#dc2626' }}>
            Clear
          </button>
        </div>
      </div>

      {/* Places section */}
      {places.length > 0 && (
        <div className="px-5 pt-5">
          <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif' }}>
            📍 Places ({places.length})
          </h2>
          <div className="flex flex-col gap-3">
            {places.map(({ data: p }) => (
              <div key={p.id} className="flex items-stretch gap-3 bg-white" style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <button onClick={() => onPlaceSelect(p)} className="flex items-center gap-3 flex-1 p-3 text-left">
                  <div className="flex-shrink-0 rounded overflow-hidden" style={{ width: 56, height: 56, background: '#f0f0f0' }}>
                    <img src={p.thumbnail || p.image} alt={p.name || ''} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>{p.name}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif' }}>{p.category}</p>
                    {p.address && <p className="text-xs mt-0.5 truncate" style={{ color: '#aaa', fontFamily: 'Public Sans, sans-serif' }}>{p.address.split(',')[0]}</p>}
                  </div>
                </button>
                <div className="flex flex-col border-l-2 border-black">
                  {p.address && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(p.address + ' Albuquerque NM')}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex flex-col items-center justify-center px-3 gap-0.5" style={{ background: 'var(--brand)', color: 'white', textDecoration: 'none', minWidth: '60px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>directions</span>
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ fontFamily: 'Public Sans, sans-serif' }}>Go</span>
                    </a>
                  )}
                  <button onClick={() => onRemovePlace(p.id)} className="flex items-center justify-center px-3 py-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)', background: 'white' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#dc2626' }}>close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events section */}
      {events.length > 0 && (
        <div className="px-5 pt-5">
          <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif' }}>
            🎟 Events ({events.length})
          </h2>
          <div className="flex flex-col gap-3">
            {events.map(({ data: ev }) => {
              const { month, day } = fmtLocalDate(ev.dates?.start?.localDate || '');
              const img = getBestEventImage(ev.images);
              const venue = ev._embedded?.venues?.[0];
              const mapsQ = encodeURIComponent((venue?.address?.line1 || venue?.name || ev.name) + ' Albuquerque NM');
              return (
                <div key={ev.id} className="flex items-stretch gap-3 bg-white" style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <button onClick={() => onEventSelect(ev)} className="flex items-center gap-3 flex-1 p-3 text-left">
                    <div className="flex-shrink-0 rounded overflow-hidden" style={{ width: 56, height: 56, background: '#1a1a1a' }}>
                      {img ? <img src={img} alt={e?.name || ''} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>confirmation_number</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>{ev.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif', fontWeight: 700 }}>{month} {day}</p>
                      {venue && <p className="text-xs mt-0.5 truncate" style={{ color: '#aaa', fontFamily: 'Public Sans, sans-serif' }}>{venue.name}</p>}
                    </div>
                  </button>
                  <div className="flex flex-col border-l-2 border-black">
                    <a href={`https://maps.google.com/?q=${mapsQ}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex flex-col items-center justify-center px-3 gap-0.5" style={{ background: '#0057c2', color: 'white', textDecoration: 'none', minWidth: '60px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>directions</span>
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ fontFamily: 'Public Sans, sans-serif' }}>Go</span>
                    </a>
                    <button onClick={() => onRemoveEvent(ev.id)} className="flex items-center justify-center px-3 py-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)', background: 'white' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#dc2626' }}>close</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share plan hint */}
      <div className="mx-5 mt-6 p-4 text-center" style={{ background: 'var(--bg)', border: '1.5px dashed #ccc' }}>
        <p className="text-xs" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', lineHeight: 1.6 }}>
          💡 Tap <strong>Go</strong> on any item to get directions, or tap the card to see full details and check in when you arrive.
        </p>
      </div>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: 'explore' },
  { id: 'events',   label: 'Events',   icon: 'confirmation_number' },
  { id: 'plan',     label: 'Saved',    icon: 'bookmark' },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];


const fmtLocalTime = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2,'0')} ${ampm}`;
};
const getEventVenue = (ev: TMEvent) => ev._embedded?.venues?.[0]?.name || '';
const getEventCity  = (ev: TMEvent) => ev._embedded?.venues?.[0]?.city?.name || '';
const getEventGenre = (ev: TMEvent) => ev.classifications?.[0]?.segment?.name || ev.classifications?.[0]?.genre?.name || '';
const getEventPrice = (ev: TMEvent) => {
  const pr = ev.priceRanges?.[0];
  if (!pr) return ev._source === 'local' ? 'FREE' : null;
  return pr.min === 0 ? 'FREE' : `From $${Math.round(pr.min)}`;
};
const getEventImage = (ev: TMEvent) => ev.images?.find(i => i.ratio === '16_9' && i.width > 400)?.url || ev.images?.[0]?.url || '';
const GENRE_COLORS: Record<string, string> = {
  Music: '#0057c2', Sports: '#c2570a', Arts: '#7c3aed',
  Family: '#166534', Comedy: '#b45309', Miscellaneous: '#374151',
};
const genreColor = (ev: TMEvent) => GENRE_COLORS[getEventGenre(ev)] || '#374151';

const dBLUE  = { background: '#0057c2' } as const;
const dGREEN = { background: 'var(--brand)' } as const;
const dDARK  = { background: '#1a1a1a' } as const;


// ─── useIsDesktop hook ────────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

// Tracks the live window width so layouts can adapt within the desktop range
function useWindowWidth() {
  const [width, setWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}


// ─── VenuePage ────────────────────────────────────────────────────────────────
// Full-screen venue page shown when navigating to /venue/:slug.
// Displays rich venue info + filtered upcoming events at that space.
function VenuePage({
  slug,
  events,
  onEventClick,
  onBack,
}: {
  slug: string;
  events: TMEvent[];
  onEventClick: (e: TMEvent) => void;
  onBack: () => void;
}) {
  const venue = getVenueBySlug(slug);

  const venueEvents = useMemo(() => {
    if (!venue) return [];
    const today = new Date().toISOString().slice(0, 10);
    return events
      .filter(e => {
        const d = e.dates?.start?.localDate ?? '';
        if (d && d < today) return false;
        const loc = (e._embedded?.venues?.[0]?.name ?? '').toLowerCase();
        return venue.locationAliases.some(alias => loc.includes(alias.toLowerCase()));
      })
      .sort((a, b) => {
        const da = a.dates?.start?.localDate ?? '';
        const db = b.dates?.start?.localDate ?? '';
        return da < db ? -1 : da > db ? 1 : 0;
      });
  }, [venue, events]);

  if (!venue) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: 'Public Sans, sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎭</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1814', marginBottom: 8 }}>Venue not found</div>
        <button onClick={onBack} style={{ padding: '10px 24px', background: '#b95c43', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
          ← Back
        </button>
      </div>
    );
  }

  const formatDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (t?: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const heroImg = venue.image;
  const heroBg = heroImg
    ? `url(${heroImg}) center/cover no-repeat`
    : venue.gradient;

  return (
    <div style={{ fontFamily: 'Public Sans, sans-serif', background: '#F9F5F2', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 220, background: heroBg, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, color: '#fff', padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back
        </button>
        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 4 }}>
            {venue.neighborhood}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {venue.name}
          </h1>
          {venue.capacity && (
            <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              Capacity: {venue.capacity}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 16px 100px' }}>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#b95c43', color: '#fff', borderRadius: 20, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>language</span>
              Official Site
            </a>
          )}
          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(venue.name + ' ' + venue.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#fff', color: '#1C1814', border: '1.5px solid #e5e0da', borderRadius: 20, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>map</span>
            Directions
          </a>
        </div>

        {/* Address */}
        <div style={{ fontSize: 13, color: '#6b6460', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, marginTop: 1, color: '#b95c43' }}>location_on</span>
          {venue.address}
        </div>

        {/* Description */}
        <p style={{ fontSize: 15, color: '#3d3532', lineHeight: 1.65, margin: '0 0 20px' }}>
          {venue.description}
        </p>

        {/* Highlights */}
        {venue.highlights.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px', marginBottom: 20, border: '1px solid #ede8e3' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#b95c43', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              What to know
            </div>
            {venue.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < venue.highlights.length - 1 ? 8 : 0 }}>
                <span style={{ color: '#b95c43', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                <span style={{ fontSize: 14, color: '#3d3532', lineHeight: 1.5 }}>{h}</span>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Events */}
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1814', marginBottom: 14 }}>
          Upcoming Events
          {venueEvents.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: '#9a8f8a' }}>
              {venueEvents.length} show{venueEvents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {venueEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', background: '#fff', borderRadius: 12, border: '1px solid #ede8e3' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎭</div>
            <div style={{ fontSize: 15, color: '#6b6460' }}>No upcoming events found for this venue.</div>
            <div style={{ fontSize: 13, color: '#9a8f8a', marginTop: 4 }}>Check back soon — events are updated daily.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {venueEvents.map(event => {
              const img = event.images?.find((i: any) => i.ratio === '16_9' && i.width > 200)?.url ?? event.images?.[0]?.url;
              const date = event.dates?.start?.localDate;
              const time = event.dates?.start?.localTime;
              const genre = event.classifications?.[0]?.genre?.name ?? event.classifications?.[0]?.segment?.name ?? '';
              const minPrice = event.priceRanges?.[0]?.min;
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  style={{ display: 'flex', gap: 12, padding: 12, background: '#fff', borderRadius: 12, border: '1px solid #ede8e3', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  {img ? (
                    <img src={img} alt={event.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 8, background: venue.gradient, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 28 }}>music_note</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1814', marginBottom: 3, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.name}
                    </div>
                    {(date || time) && (
                      <div style={{ fontSize: 13, color: '#b95c43', fontWeight: 600, marginBottom: 3 }}>
                        {formatDate(date)}{time ? ` · ${formatTime(time)}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {genre && (
                        <span style={{ fontSize: 12, color: '#6b6460', background: '#f3eeea', borderRadius: 4, padding: '2px 7px' }}>
                          {genre}
                        </span>
                      )}
                      {minPrice !== undefined && (
                        <span style={{ fontSize: 12, color: '#6b6460' }}>
                          {minPrice === 0 ? 'Free' : `From $${minPrice}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: '#c9c0ba', fontSize: 20, flexShrink: 0, alignSelf: 'center' }}>chevron_right</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace('#', '').split('/')[0];
    const validTabs: TabId[] = ['discover', 'events', 'plan'];
    return validTabs.includes(hash as TabId) ? (hash as TabId) : 'discover';
  });
  // Mobile-first: always use mobile layout (desktop layout disabled for now)
  const isDesktop = false;

  // ── Dark mode ──
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('abq-dark') === '1'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('abq-dark', isDark ? '1' : '0'); } catch {}
  }, [isDark]);

  const [showSearch, setShowSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  // Places are not loaded in the app — kept on the server only.
  // Initialize with static bundled events so cards render immediately on load.
  // Supabase live data merges in and replaces these once fetched.
  const [events, setEvents] = useState<TMEvent[]>(() =>
    STATIC_TM_EVENTS.filter(e => !isJunkEvent(e)).map(tagAdultEvent)
      .map(e => e.name?.includes('&') ? { ...e, name: decodeEntities(e.name) } : e)
  );
  const [eventsNavSearch, setEventsNavSearch] = useState('');
  const [eventsNavGenre, setEventsNavGenre] = useState('');
  // Deep-link: capture event or place ID from URL on mount (supports both hash and path-based URLs)
  const pendingDeepLinkId = useRef<string | null>(
    (() => {
      // Path-based: /event/{id} (from shared links with OG tags)
      const pm = window.location.pathname.match(/^\/event\/(.+)$/);
      if (pm) return decodeURIComponent(pm[1]);
      // Hash-based: #event/{id} (legacy)
      const hm = window.location.hash.match(/^#event\/(.+)$/);
      return hm ? decodeURIComponent(hm[1]) : null;
    })()
  );
  // Deep-link: capture place ID from URL on mount (path-based or hash-based)
  const pendingPlaceDeepLinkId = useRef<string | null>(
    (() => {
      const pm = window.location.pathname.match(/^\/place\/(.+)$/);
      if (pm) return decodeURIComponent(pm[1]);
      const hm = window.location.hash.match(/^#place\/(.+)$/);
      return hm ? decodeURIComponent(hm[1]) : null;
    })()
  );
  // Venue page: slug from /venue/:slug URL
  const [venuePageSlug, setVenuePageSlug] = useState<string | null>(() => {
    const pm = window.location.pathname.match(/^\/venue\/(.+)$/);
    return pm ? decodeURIComponent(pm[1]) : null;
  });
  // Never block on a loading screen — show the app shell immediately.
  // Data populates in the background; sections gracefully show when ready.
  const [loading, setLoading] = useState(false);
  // Start as false — static events render immediately; live fetch runs in background.
  const [eventsLoading, setEventsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TMEvent | null>(null);

  // ── Plan / Saved Items ──
  const [savedPlan, setSavedPlan] = useState<SavedPlanItem[]>(() => {
    try { const s = localStorage.getItem('abq-saved-plan'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const savePlanToStorage = (items: SavedPlanItem[]) => {
    try { localStorage.setItem('abq-saved-plan', JSON.stringify(items)); } catch { /* ignore */ }
  };
  const toggleSavedPlace = (place: Place) => {
    setSavedPlan(prev => {
      const exists = prev.some(p => p.type === 'place' && (p.data as Place).id === place.id);
      const next = exists ? prev.filter(p => !(p.type === 'place' && (p.data as Place).id === place.id)) : [...prev, { type: 'place' as const, data: place }];
      savePlanToStorage(next); return next;
    });
  };
  const toggleSavedEvent = (event: TMEvent) => {
    setSavedPlan(prev => {
      const exists = prev.some(p => p.type === 'event' && (p.data as TMEvent).id === event.id);
      const next = exists ? prev.filter(p => !(p.type === 'event' && (p.data as TMEvent).id === event.id)) : [...prev, { type: 'event' as const, data: event }];
      savePlanToStorage(next);
      // Sync to Supabase when logged in
      if (user) {
        if (!exists) {
          // Save: upsert into user_saved_events
          const eventDate = event.dates?.start?.localDate ?? null;
          const category = getEventCategory(event);
          const imageUrl = getBestEventImage(event) ?? null;
          supabase.from('user_saved_events').upsert({
            user_id: user.id,
            event_id: event.id,
            event_source: event._source ?? 'unknown',
            event_name: event.name,
            event_date: eventDate,
            categories: category ? [category] : [],
            image_url: imageUrl,
          }, { onConflict: 'user_id,event_id' }).then(({ error }) => {
            if (error) console.error('Save event sync error:', error);
          });
        } else {
          // Unsave: delete from user_saved_events
          supabase.from('user_saved_events')
            .delete()
            .eq('user_id', user.id)
            .eq('event_id', event.id)
            .then(({ error }) => {
              if (error) console.error('Unsave event sync error:', error);
            });
        }
      }
      return next;
    });
  };
  const isPlaceSaved = (id: string) => savedPlan.some(p => p.type === 'place' && (p.data as Place).id === id);
  const isEventSaved = (id: string) => savedPlan.some(p => p.type === 'event' && (p.data as TMEvent).id === id);

  // ── Firebase Auth ──
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>(getPrefs);
  // Re-sync prefs state when ProfileSettingsPane saves changes
  useEffect(() => {
    const handler = () => setPrefs(getPrefs());
    window.addEventListener('abq_prefs_changed', handler);
    return () => window.removeEventListener('abq_prefs_changed', handler);
  }, []);



  useEffect(() => {
    const fn = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
          // Find nearest vertically-scrollable ancestor and scroll it
          let p = el.parentElement;
          while (p && p !== document.body) {
            const ps = getComputedStyle(p);
            if ((ps.overflowY === 'auto' || ps.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
              e.preventDefault();
              p.scrollBy({ top: e.deltaY });
              return;
            }
            p = p.parentElement;
          }
          e.preventDefault();
          window.scrollBy({ top: e.deltaY });
          return;
        }
        el = el.parentElement;
      }
    };
    window.addEventListener('wheel', fn, { passive: false });
    return () => window.removeEventListener('wheel', fn);
  }, []);

  // ── Guaranteed session pickup on mount (fallback for PKCE race condition) ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setAuthReady(true);
        const pendingTab = sessionStorage.getItem('abq_post_auth_redirect') as TabId | null;
        if (pendingTab) {
          sessionStorage.removeItem('abq_post_auth_redirect');
          if ((pendingTab as string) === 'admin') {
            window.history.replaceState({}, '', window.location.pathname + '#admin');
            setCurrentHash('#admin');
          } else {
            // Clean up ?code= from URL after OAuth exchange
            if (window.location.search.includes('code=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
            setActiveTab(pendingTab);
            if (!session.user.user_metadata?.display_name) setShowUsernameSetup(true);
          }
        }
      } else {
        setAuthReady(true);
      }
    });
  }, []);

  useEffect(() => {
    const { data: { subscription: unsub } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Don't sign the user out on a transient token-refresh failure (e.g. brief network drop).
      // The client will retry; we just keep the current user state.
      if (event === 'TOKEN_REFRESH_FAILED') return;
      const u = session?.user ?? null;
      setUser(u);
      if (!u) setAuthReady(true);
      if (u) {
        setAuthReady(true);
        // If a Google OAuth sign-in just completed, redirect to Profile and show
        // the username setup modal if needed. The flag was set before the redirect
        // so it works regardless of which event Supabase fires (SIGNED_IN vs INITIAL_SESSION).
        const pendingTab = sessionStorage.getItem('abq_post_auth_redirect') as TabId | null;
        if (pendingTab) {
          sessionStorage.removeItem('abq_post_auth_redirect');
          if ((pendingTab as string) === 'admin') {
            // Admin Google sign-in — navigate to #admin, clean up ?code= from OAuth
            window.history.replaceState({}, '', window.location.pathname + '#admin');
            setCurrentHash('#admin');
          } else {
            // Clean up ?code= from URL after OAuth exchange
            if (window.location.search.includes('code=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
            setActiveTab(pendingTab);
            const hasUsername = !!(u.user_metadata?.display_name);
            if (!hasUsername) setShowUsernameSetup(true);
          }
        }
      }
      if (u) {
        // Sync saved events from Supabase on sign-in
        if (loadedUserIdRef.current !== u.id) {
          loadedUserIdRef.current = u.id;
          try {
            const { data: savedRows } = await supabase
              .from('user_saved_events')
              .select('event_id, event_name, event_source, event_date, categories, image_url')
              .eq('user_id', u.id)
              .order('saved_at', { ascending: false })
              .limit(200);
            if (savedRows && savedRows.length > 0) {
              // Merge remote saves into local savedPlan (remote wins, dedup by event_id)
              setSavedPlan(prev => {
                const localIds = new Set(prev.filter(p => p.type === 'event').map(p => (p.data as TMEvent).id));
                const remoteEvents: SavedPlanItem[] = savedRows
                  .filter((r: any) => !localIds.has(r.event_id))
                  .map((r: any) => ({
                    type: 'event' as const,
                    data: {
                      id: r.event_id,
                      name: r.event_name,
                      _source: r.event_source,
                      dates: r.event_date ? { start: { localDate: r.event_date } } : undefined,
                    } as TMEvent,
                  }));
                const merged = [...prev, ...remoteEvents];
                savePlanToStorage(merged);
                return merged;
              });
            }
          } catch (err) { console.error('Load saved events error:', err); }
        }
      }
    });
    return () => unsub.unsubscribe();
  }, []);



  const { coords, error: geoError, requested: geoRequested, silentPending: geoSilentPending, request: requestGeo } = useGeolocation();

  // ── Analytics: session_start (fires once per browser session) ──
  useEffect(() => {
    const KEY = 'abq_session_tracked';
    if (!sessionStorage.getItem(KEY)) {
      try { sessionStorage.setItem(KEY, '1'); } catch {}
      trackEvent('session_start');
    }
  }, []);

  // ── Seed browser history so "back" never leaves the site ──
  // On first load, push a sentinel entry. If the user presses back past all
  // app-pushed entries, they hit this sentinel and we catch it in popstate.
  useEffect(() => {
    if (!window.history.state?._abqSeeded) {
      // Replace current entry as the "floor" so back beyond it stays in-app
      window.history.replaceState({ _abqSeeded: true, tab: 'discover' }, '', window.location.hash || '#discover');
    }
  }, []);

  // ── Browser history management (prevents swipe-back leaving the site) ──
  const navigateTab = useCallback((tab: TabId) => {
    // Save current scroll before leaving this tab
    tabScrollPos.current[activeTab] = window.scrollY;
    setActiveTab(tab);
    // Reset Events genre filter when tapping Events tab directly (so stale filters don't persist)
    if (tab === 'events') setEventsNavGenre('');
    window.history.pushState({ tab, modal: null }, '', `#${tab}`);
    trackEvent('pageview', { tab, referrer: document.referrer || '', path: `#${tab}` });
    // Restore scroll position for the target tab
    requestAnimationFrame(() => {
      window.scrollTo({ top: tabScrollPos.current[tab] ?? 0, behavior: 'instant' });
    });
  }, [activeTab]);

  // ── Swipe between tabs (native-app feel) ─────────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null);
  const tabScrollPos = useRef({} as Partial<Record<TabId, number>>);
  const TAB_ORDER: TabId[] = NAV_ITEMS.map(n => n.id);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeLocked = useRef(false);

  const swipeIgnored = useRef(false);
  const onMainTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeLocked.current = false;
    // Ignore swipes that start inside horizontally-scrollable containers
    // (filter chips, image sliders, horizontal card rows, carousels, etc.)
    let el = e.target as HTMLElement | null;
    swipeIgnored.current = false;
    while (el && el !== e.currentTarget) {
      const style = window.getComputedStyle(el);
      const oxv = style.overflowX;
      const isHScrollable = (oxv === 'auto' || oxv === 'scroll') && el.scrollWidth > el.clientWidth + 2;
      if (isHScrollable || el.classList.contains('overflow-x-auto')
          || el.getAttribute('data-swipe-ignore') === 'true') {
        swipeIgnored.current = true;
        break;
      }
      el = el.parentElement;
    }
  }, []);

  // Prevent browser back/forward swipe when horizontal drag is detected
  const onMainTouchMove = useCallback((e: React.TouchEvent) => {
    if (swipeIgnored.current) return; // inside a scrollable container — don't hijack
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = e.touches[0].clientY - swipeStartY.current;
    if (!swipeLocked.current && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeLocked.current = true;
    }
    if (swipeLocked.current) {
      e.preventDefault();
    }
  }, []);

  const onMainTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeIgnored.current) { swipeIgnored.current = false; return; }
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeLocked.current = false;
    // Only count horizontal swipes (dx > dy threshold), min 80px
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const curIdx = TAB_ORDER.indexOf(activeTab);
    if (dx < 0 && curIdx < TAB_ORDER.length - 1) {
      navigateTab(TAB_ORDER[curIdx + 1]);
    } else if (dx > 0 && curIdx > 0) {
      navigateTab(TAB_ORDER[curIdx - 1]);
    }
  }, [activeTab, navigateTab]);

  // Non-passive native touchmove: allows e.preventDefault() to actually block
  // the browser back/forward swipe gesture (React handlers are passive, so
  // e.preventDefault() has no effect there since React 17).
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleTouchMove = (e: TouchEvent) => {
      if (swipeIgnored.current) return;
      if (swipeStartX.current === null || swipeStartY.current === null) return;
      const dx = e.touches[0].clientX - swipeStartX.current;
      const dy = e.touches[0].clientY - swipeStartY.current;
      if (!swipeLocked.current && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swipeLocked.current = true;
      }
      if (swipeLocked.current) e.preventDefault();
    };
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, []);



  const openEventModal = useCallback((event: TMEvent) => {
    setSelectedEvent(event);
    window.history.pushState({ tab: null, modal: 'event', id: event.id }, '', `#event/${event.id}`);
    trackEvent('event_click', { event_id: event.id, event_name: event.name });
    trackEvent('pageview', { tab: 'event_detail', event_id: event.id, event_name: event.name, path: `#event/${event.id}` });
  }, []);
  const closeEventModal = useCallback(() => setSelectedEvent(null), []);
  const openVenuePage = useCallback((slug: string) => {
    setSelectedEvent(null);
    setVenuePageSlug(slug);
  }, []);

  // ── Admin ──
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);
  const showAdmin = currentHash === '#admin';

  // Listen for hash changes so navigating to #admin after mount works
  // Keep currentHash in sync with all navigation methods (hashchange + popstate)
  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, []);

  useEffect(() => {
    // When admin panel is open, don't manipulate the URL at all
    if (showAdmin) return;

    // CRITICAL: Don't strip OAuth tokens — Supabase needs the #access_token hash to establish the session.
    // Once Supabase reads the tokens (async), onAuthStateChange will fire and set the correct tab.
    if (window.location.hash.includes('access_token')) return;

    // Don't overwrite a deep-link URL until it has been consumed
    if (pendingDeepLinkId.current && (window.location.hash.startsWith('#event/') || window.location.pathname.startsWith('/event/'))) return;
    if (pendingPlaceDeepLinkId.current && (window.location.hash.startsWith('#place/') || window.location.pathname.startsWith('/place/'))) return;

    // Sync URL to current active tab (do NOT hardcode 'discover' — that overrides post-login navigation)
    window.history.replaceState({ tab: activeTab, modal: null }, '', `#${activeTab}`);

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      // If going back from a modal or venue page, close it
      if (selectedEvent) { setSelectedEvent(null); return; }
      if (venuePageSlug) { setVenuePageSlug(null); return; }
      // If going back between tabs, go to that tab
      if (state?.tab) {
        setActiveTab(state.tab);
      } else {
        // No state = initial entry or external navigation.
        // Go to discover (home) and replace so back doesn't loop.
        setActiveTab('discover');
        window.history.replaceState({ tab: 'discover', modal: null }, '', '#discover');
      }
    };
    // Ensure there's always a base history entry so back doesn't leave the site.
    // pushState on first render creates a "floor" — pressing back from this entry
    // triggers popstate with no state, which we handle above by staying in-app.
    if (!window.history.state?.tab) {
      window.history.replaceState({ tab: activeTab, modal: null, base: true }, '', `#${activeTab}`);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedEvent, venuePageSlug, activeTab, showAdmin]);

  // ── Dynamic <title> + Event JSON-LD schema ─────────────────────────────────
  // Updates document title and injects structured data whenever the user views
  // a specific event, venue page, or returns to a default tab.
  useEffect(() => {
    const DEFAULT_TITLE = 'ABQ Unplugged — Events in Albuquerque, NM';
    const BASE_URL = 'https://abqunplugged.com';

    // Remove any previously injected dynamic JSON-LD
    const cleanup = () => {
      document.getElementById('abq-event-jsonld')?.remove();
      document.getElementById('abq-venue-jsonld')?.remove();
    };

    if (selectedEvent) {
      // ── Event detail view ──
      const venueName = selectedEvent._embedded?.venues?.[0]?.name ?? 'Albuquerque';
      const venueAddress = selectedEvent._embedded?.venues?.[0]?.address?.line1 ?? '';
      const startDate = selectedEvent.dates?.start?.localDate ?? '';
      const startTime = selectedEvent.dates?.start?.localTime ?? '';
      const img = selectedEvent.images?.find((i: any) => i.ratio === '16_9' && i.width > 500)?.url
        ?? selectedEvent.images?.[0]?.url ?? '';
      const minPrice = selectedEvent.priceRanges?.[0]?.min;
      const maxPrice = selectedEvent.priceRanges?.[0]?.max;
      const ticketUrl = selectedEvent.ticketLinks?.[0]?.url ?? selectedEvent.url ?? '';
      const genre = selectedEvent.classifications?.[0]?.genre?.name ?? '';

      document.title = `${selectedEvent.name} — ${venueName} | ABQ Unplugged`;

      cleanup();
      const schema: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        'name': selectedEvent.name,
        'description': selectedEvent.info ?? selectedEvent._aiEnrichment?.about ?? `${selectedEvent.name} at ${venueName} in Albuquerque, NM.`,
        'startDate': startTime ? `${startDate}T${startTime}` : startDate,
        'eventStatus': 'https://schema.org/EventScheduled',
        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
        'location': {
          '@type': 'Place',
          'name': venueName,
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': venueAddress,
            'addressLocality': 'Albuquerque',
            'addressRegion': 'NM',
            'addressCountry': 'US',
          },
        },
        'url': ticketUrl || `${BASE_URL}/event/${encodeURIComponent(selectedEvent.id)}`,
        'image': img || `${BASE_URL}/og-image.jpg`,
        'organizer': { '@type': 'Organization', 'name': 'ABQ Unplugged', 'url': BASE_URL },
      };
      if (genre) schema['genre'] = genre;
      if (minPrice !== undefined) {
        schema['offers'] = {
          '@type': 'Offer',
          'priceCurrency': 'USD',
          'price': minPrice,
          ...(maxPrice !== undefined && maxPrice > minPrice ? { 'highPrice': maxPrice } : {}),
          'availability': 'https://schema.org/InStock',
          ...(ticketUrl ? { 'url': ticketUrl } : {}),
        };
      }
      const s = document.createElement('script');
      s.id = 'abq-event-jsonld';
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(schema);
      document.head.appendChild(s);

    } else if (venuePageSlug) {
      // ── Venue page view ──
      const venue = getVenueBySlug(venuePageSlug);
      if (venue) {
        document.title = `${venue.name} Events — Albuquerque | ABQ Unplugged`;
        cleanup();
        const schema = {
          '@context': 'https://schema.org',
          '@type': 'EventVenue',
          'name': venue.name,
          'description': venue.description,
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': venue.address.split(',')[0],
            'addressLocality': 'Albuquerque',
            'addressRegion': 'NM',
            'addressCountry': 'US',
          },
          'url': venue.website ?? `${BASE_URL}/venue/${venue.slug}`,
          ...(venue.lat && venue.lng ? {
            'geo': { '@type': 'GeoCoordinates', 'latitude': venue.lat, 'longitude': venue.lng }
          } : {}),
        };
        const s = document.createElement('script');
        s.id = 'abq-venue-jsonld';
        s.type = 'application/ld+json';
        s.textContent = JSON.stringify(schema);
        document.head.appendChild(s);
      } else {
        document.title = DEFAULT_TITLE;
        cleanup();
      }
    } else {
      // ── Default: restore home title ──
      document.title = DEFAULT_TITLE;
      cleanup();
    }

    return cleanup;
  }, [selectedEvent, venuePageSlug]);

  // ── Sync /venue/:slug URL when venuePageSlug changes ──────────────────────
  useEffect(() => {
    if (venuePageSlug) {
      window.history.pushState({ venueSlug: venuePageSlug }, '', `/venue/${encodeURIComponent(venuePageSlug)}`);
    }
    // When cleared, navigation back is handled by the popstate handler
  }, [venuePageSlug]);

  const [siteBanner, setSiteBanner] = useState<BannerConfig | null>(null);
  const [mapProvider, setMapProvider] = useState<'google' | 'apple' | 'auto'>('apple');
  const [enrichedDataEnabled, setEnrichedDataEnabled] = useState(true);
  const [adminHeroLines, setAdminHeroLines] = useState<string[] | null>(null);

  // Resolve 'auto' → Apple Maps on iOS/iPadOS, Google Maps elsewhere
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const resolvedMapProvider: 'google' | 'apple' =
    mapProvider === 'auto' ? (isIOS ? 'apple' : 'google') : mapProvider;

  // siteConfig + banners are stored in the Supabase `config` table (AdminPanel uses cfgSet/cfgGet)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      (supabase.from as any)('config').select('value').eq('key', 'siteConfig').maybeSingle(),
      (supabase.from as any)('config').select('value').eq('key', 'banners').maybeSingle(),
      (supabase.from as any)('config').select('value').eq('key', 'enriched_data_enabled').maybeSingle(),
      (supabase.from as any)('config').select('value').eq('key', 'content').maybeSingle(),
    ]).then(([siteRes, bannersRes, enrichedRes, contentRes]: [{ data: { value: Record<string, unknown> } | null }, { data: { value: unknown[] } | null }, { data: { value: boolean } | null }, { data: { value: { heroLines?: string[] } } | null }]) => {
      // Apply siteConfig
      const d = siteRes.data?.value;
      if (d) {
        if ((d.banner as any)?.active) setSiteBanner(d.banner as BannerConfig);
        if (d.mapProvider) setMapProvider(d.mapProvider as 'google' | 'apple' | 'auto');
      }
      // Apply enriched data global toggle (default true if not set)
      if (enrichedRes.data !== null) setEnrichedDataEnabled(enrichedRes.data.value !== false);
      // Apply banners array — find first active banner within its date window
      const bannerArr = bannersRes.data?.value;
      if (Array.isArray(bannerArr)) {
        const active = bannerArr.find((b: any) =>
          b.active &&
          b.message?.trim() &&
          (!b.startDate || b.startDate <= today) &&
          (!b.endDate   || b.endDate   >= today)
        ) as any;
        if (active) {
          setSiteBanner({ message: active.message, type: active.type ?? 'info', active: true, linkUrl: active.linkUrl, linkText: active.linkText, bgColor: active.bgColor, textColor: active.textColor });
        }
      }
      // Apply hero lines from admin content config
      const contentData = contentRes.data?.value;
      if (contentData?.heroLines?.length) setAdminHeroLines(contentData.heroLines);
    });
  }, []);

  // ── Load theme config from Supabase and inject CSS variables ──────────────
  useEffect(() => {
    (supabase.from as any)('config')
      .select('value')
      .eq('key', 'themeConfig')
      .maybeSingle()
      .then(({ data }: { data: { value: Record<string, string> } | null }) => {
        const t = data?.value;
        if (!t?.brand) return; // no custom theme saved — keep CSS defaults
        const root = document.documentElement;
        root.style.setProperty('--brand', t.brand);
        if (t.brandLight) root.style.setProperty('--brand-light', t.brandLight);
        if (t.brand && t.brandLight)
          root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${t.brand} 0%, ${t.brandLight} 100%)`);
        if (t.bgScreen) root.style.setProperty('--brand-bg-screen', t.bgScreen);
        if (t.brand) root.style.setProperty('--brand-bg-subtle', t.brand + '1a');
        if (t.accent) {
          root.style.setProperty('--brand-ring-color', t.accent);
          root.style.setProperty('--brand-tint-bg', t.accent + '26');
          root.style.setProperty('--brand-tint-border', t.accent + '80');
        }
      })
      .then(() => {
        // Apply user's personal color preference (overrides admin theme)
        const userTheme = loadUserTheme();
        if (userTheme) applyUserTheme(userTheme.brand, userTheme.brandLight);
      });
  }, []);

  

  useEffect(() => {
    async function loadData() {
      // Clear any stale places cache left over from a prior version of the app
      try { localStorage.removeItem('abq_places_v3'); } catch {}

      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

      // ── Load events from Supabase (static bundled events are already pre-seeded) ──
      setEventsLoading(true);
      try {
        let tmEvents: TMEvent[] = [];
        let sgEvents: TMEvent[] = [];
        let bitEvents: TMEvent[] = [];
        let muEvents: TMEvent[] = [];
        let localDbEvents: TMEvent[] = [];

        try {
          const sbEvents = await withTimeout(fetchEventsFromDB(), 12000);
          tmEvents = sbEvents['ticketmaster'] || [];
          sgEvents = sbEvents['seatgeek'] || [];
          bitEvents = sbEvents['bandsintown'] || [];
          muEvents = sbEvents['musicbrainz'] || [];
          localDbEvents = [
            ...(sbEvents['eventbrite'] || []),
            ...(sbEvents['do505'] || []),
            ...(sbEvents['local'] || []),
            ...(sbEvents['volunteer'] || []),
          ];
        } catch (err) {
          console.warn('[Events] Supabase failed or timed out, using static fallback:', err);
          const [tmR, ebR, sgR, bitR, muR] = await Promise.allSettled([
            fetch('/data/ticketmaster-events.json').then(r => r.json()),
            fetch('/data/eventbrite-events.json').then(r => r.json()),
            fetch('/data/seatgeek-events.json').then(r => r.json()),
            fetch('/data/bandsintown-events.json').then(r => r.json()),
            fetch('/data/musicbrainz-events.json').then(r => r.json()),
          ]);
          const safeArr = (r: PromiseSettledResult<unknown>) =>
            r.status === 'fulfilled' && r.value && typeof r.value === 'object' && Array.isArray((r.value as any).events)
              ? (r.value as any).events : (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
          tmEvents = safeArr(tmR); localDbEvents = safeArr(ebR);
          sgEvents = safeArr(sgR); bitEvents = safeArr(bitR); muEvents = safeArr(muR);
        }

        // ── Universal deduplication across ALL sources ──
        // Combine every event into one flat array, then deduplicate by
        // normalized title + date.  When duplicates are found across sources,
        // merge their ticket URLs into one card with multiple "Get Tickets" buttons.
        const normTitle = (s: string) =>
          s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);

        const sourceLabel = (ev: TMEvent): string => {
          const s = (ev._source || '').toLowerCase();
          if (s === 'seatgeek') return 'SeatGeek';
          if (s === 'eventbrite') return 'Eventbrite';
          if (s === 'ticketmaster') return 'Ticketmaster';
          if (s === 'bandsintown') return 'Bandsintown';
          if (s === 'local' || s === 'do505' || s === 'nhcc') return 'Info';
          if (s === 'volunteer') return 'Volunteer';
          return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Tickets';
        };

        // Priority order: ticketmaster > seatgeek > eventbrite > local > volunteer > rest
        const sourcePriority: Record<string, number> = {
          ticketmaster: 0, seatgeek: 1, eventbrite: 2,
          bandsintown: 3, local: 4, do505: 4, nhcc: 4,
          volunteer: 5, musicbrainz: 6,
        };
        const getPriority = (ev: TMEvent) =>
          sourcePriority[(ev._source || '').toLowerCase()] ?? 99;

        const allRaw: TMEvent[] = [
          ...tmEvents, ...sgEvents,
          ...bitEvents, ...muEvents, ...localDbEvents,
        ];

        // Index: normalized title+date → best event (lowest priority number wins)
        const dedupIndex = new Map<string, TMEvent>();
        const seenUrls = new Map<string, Set<string>>(); // track URLs per dedup key

        for (const ev of allRaw) {
          const k = normTitle(ev.name || '') + '|' + (ev.dates?.start?.localDate || '');
          if (k === '|') continue;

          const existing = dedupIndex.get(k);
          const label = sourceLabel(ev);
          const url = ev.url || '';

          if (!existing) {
            // First time seeing this event — initialize ticketLinks
            ev.ticketLinks = url ? [{ source: label, url }] : [];
            dedupIndex.set(k, ev);
            seenUrls.set(k, new Set(url ? [url] : []));
          } else {
            // Duplicate — merge ticket link if URL is new
            const urls = seenUrls.get(k)!;
            if (url && !urls.has(url)) {
              if (!existing.ticketLinks) {
                existing.ticketLinks = existing.url
                  ? [{ source: sourceLabel(existing), url: existing.url }]
                  : [];
              }
              existing.ticketLinks.push({ source: label, url });
              urls.add(url);
            }
            // If the new event has better priority (lower number), swap the base card
            // but keep the merged ticketLinks AND preserve the best images
            if (getPriority(ev) < getPriority(existing)) {
              const mergedLinks = existing.ticketLinks || [];
              const mergedId = existing.id; // keep original ID for consistency
              const bestImages = (existing.images?.length ? existing.images : ev.images) || [];
              Object.assign(existing, ev);
              existing.ticketLinks = mergedLinks;
              existing.id = mergedId;
              // Restore best images — prefer whichever had real images
              if (bestImages.length > 0) existing.images = bestImages;
            }
            // If the existing still has no images and the new event does, take them
            if ((!existing.images || existing.images.length === 0) && ev.images?.length) {
              existing.images = ev.images;
            }
          }
        }

        const seen = new Set<string>();
        const liveEvents = [...dedupIndex.values()].filter((e: TMEvent) => {
          if (!e?.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });

        // Ensure every event with a URL but no ticketLinks gets one
        for (const ev of liveEvents) {
          if (!ev.ticketLinks || ev.ticketLinks.length === 0) {
            ev.ticketLinks = ev.url ? [{ source: sourceLabel(ev), url: ev.url }] : [];
          }
        }

        const normT = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
        const liveTitles = new Set(liveEvents.map(e => normT(e.name || '')));
        const staticOnly = STATIC_TM_EVENTS.filter(e => {
          if (seen.has(e.id)) return false;
          if (liveTitles.has(normT(e.name || ''))) return false;
          seen.add(e.id);
          return true;
        });

        const ABQ_METRO_CITIES = new Set([
          'albuquerque', 'rio rancho', 'corrales', 'bernalillo', 'placitas',
          'edgewood', 'tijeras', 'cedar crest', 'sandia park', 'los lunas',
          'belen', 'bosque farms', 'moriarty', 'estancia', 'mountainair',
          'peralta', 'isleta', 'paradise hills', 'four hills', 'kirtland',
          'south valley', 'north valley', 'west mesa', 'rio rancho nm',
        ]);
        const isInMetro = (ev: TMEvent): boolean => {
          const city = (ev._embedded?.venues?.[0]?.city?.name || '').toLowerCase().trim();
          if (!city) return true;
          return ABQ_METRO_CITIES.has(city);
        };

        const hasActionableLink = (ev: TMEvent): boolean => {
          if (ev.url) return true;
          if (ev.ticketLinks && ev.ticketLinks.some(l => l.url)) return true;
          return false;
        };

        const merged = [...liveEvents, ...staticOnly]
          .filter(isInMetro)
          .filter(hasActionableLink)
          .filter(e => !isJunkEvent(e))
          .map(tagAdultEvent)
          .map(e => e.name?.includes('&') ? { ...e, name: decodeEntities(e.name) } : e);
        setEvents(merged);
        // Trigger scheduled local notifications now that we have fresh data
        checkAndTriggerNotifications(loadNotifPrefs(), { events: merged });
      } catch (err) {
        console.error('[Events] Failed to load events:', err);
        const normT2 = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
        const seen2 = new Set<string>();
        const staticOnly2 = STATIC_TM_EVENTS
          .filter(e => { if (seen2.has(e.id)) return false; seen2.add(e.id); return true; })
          .filter(e => !isJunkEvent(e))
          .map(tagAdultEvent)
          .map(e => e.name?.includes('&') ? { ...e, name: decodeEntities(e.name) } : e);
        setEvents(staticOnly2);
      } finally {
        setEventsLoading(false);
      }
    }

    loadData();
  }, []);

  // ── SW notification-tap navigation handler ─────────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'NOTIF_NAV') {
        const filter = e.data.filter || '';
        if (filter) setEventsNavGenre(filter);
        setActiveTab('events');
      }
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handler);
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    }
  }, []);

  // ── Deep-link handler: open /event/{id} or #event/{id} once events load ────
  useEffect(() => {
    const id = pendingDeepLinkId.current;
    if (!id || events.length === 0) return;
    pendingDeepLinkId.current = null; // consume it — only fires once
    const found = events.find(e => e.id === id);
    if (found) {
      setActiveTab('events');
      setSelectedEvent(found);
      window.history.replaceState({ tab: 'events', modal: id }, '', `#event/${encodeURIComponent(id)}`);
    }
  }, [events]);

  // ── Admin route ──
  if (showAdmin) {
    // AdminPanel handles its own auth (Supabase email OR hardcoded password)
    return <AdminPanel user={user} onBack={() => { setCurrentHash("#discover"); window.history.replaceState({}, '', '#discover'); }} />;
  }

  if (loading) return <LoadingScreen />;
  // ── Desktop layout ──────────────────────────────────────────────────────────
  if (isDesktop) return (
    <ErrorBoundary>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d0d8d0; }
        :root {
          --brand: var(--brand);
          --brand-gradient: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          --brand-bg-screen: var(--bg);
        }
      `}</style>
      <DesktopApp
        events={events}
        places={places}
        coords={coords}
        loading={loading}
        eventsLoading={eventsLoading}
        onEventSelect={(e) => setSelectedEvent(e)}
        savedPlan={savedPlan}
        onToggleSaveEvent={toggleSavedEvent}
        isEventSaved={isEventSaved}
      />
      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => { closeEventModal(); window.history.back(); }} isSaved={isEventSaved(selectedEvent.id)} onToggleSave={() => toggleSavedEvent(selectedEvent)} mapProvider={resolvedMapProvider} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </ErrorBoundary>
  );

  if (loadError) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 px-8" style={{ background: 'var(--brand-bg-screen)' }}>
      <ABQUnpluggedLogo size={88} />
      <h2 className="text-xl font-black uppercase tracking-tighter text-center" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--brand)' }}>Couldn't Load Content</h2>
      <p className="text-sm text-gray-500 text-center" style={{ fontFamily: 'Public Sans, sans-serif' }}>Check your connection and try again.</p>
      <button
        onClick={() => { setLoadError(false); setLoading(true); }}
        className="mt-2 px-6 py-3 rounded-lg font-bold text-sm text-white"
        style={{ background: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}
      >
        Retry
      </button>
    </div>
  );

  return (
    <ErrorBoundary>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700;900&family=Manrope:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

        /* ── Reset ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { color-scheme: light; }

        /* ── Safe-area CSS variables (Apple HIG: viewport-fit=cover) ── */
        :root {
          --sat: env(safe-area-inset-top, 0px);
          --sab: env(safe-area-inset-bottom, 0px);
          --sal: env(safe-area-inset-left, 0px);
          --sar: env(safe-area-inset-right, 0px);
        }

        /* ── Base document ── */
        html {
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }
        body {
          background: var(--bg);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overscroll-behavior-x: none;
        }
        /* root grows with content — document overflows so Safari hides address bar on scroll */
        #root {
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
        }

        /* ── Scrollbars: hidden (native iOS feel) ── */
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }

        /* ── Touch: Apple HIG ≥ 44×44pt tap targets ── */
        button, a, [role="button"], [role="tab"] {
          min-height: 44px;
          -webkit-tap-highlight-color: transparent;
          tap-highlight-color: transparent;
          touch-action: manipulation;
          cursor: pointer;
        }

        /* ── Press state: iOS-style spring-back ── */
        button:active, [role="button"]:active {
          opacity: 0.65;
          transform: scale(0.96);
        }
        button { transition: opacity 0.12s ease, transform 0.12s ease; }

        /* ── Prevent unwanted text selection on UI chrome ── */
        header, nav, button, [role="button"] {
          -webkit-user-select: none;
          user-select: none;
        }

        /* ── Momentum scrolling + contain overscroll ── */
        .overflow-y-auto, .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        /* ── Input font-size ≥ 16px prevents iOS auto-zoom on focus ── */
        input, textarea, select {
          font-size: max(16px, 1rem) !important;
          -webkit-tap-highlight-color: transparent;
        }

        /* ── iOS Liquid Glass (iOS 26 HIG) — saturate + blur backdrop ── */
        .glass {
          background: rgba(245, 247, 245, 0.76);
          backdrop-filter: saturate(180%) blur(28px);
          -webkit-backdrop-filter: saturate(180%) blur(28px);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: saturate(160%) blur(20px);
          -webkit-backdrop-filter: saturate(160%) blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.55);
        }
      
        /* ─── Apple HIG globals ────────────────────────────────────── */
        :root {
          --sys-font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
          --ios-blue: #007AFF;
          --ios-bg: #F2F2F7;
          --ios-card: #FFFFFF;
          --ios-text: #1C1C1E;
          --ios-subtext: #8E8E93;
          --ios-sep: #C6C6C8;
          --ios-r-sm: 8px;
          --ios-r-md: 12px;
          --ios-r-lg: 16px;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --ios-bg: #000000;
            --ios-card: #1C1C1E;
            --ios-text: #FFFFFF;
            --ios-subtext: #8E8E93;
            --ios-sep: #38383A;
          }
        }
        html, body {
          font-family: var(--sys-font);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          -webkit-text-size-adjust: 100%;
          scroll-behavior: smooth;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
`}</style>

      <InstallPrompt />
      <PullToRefresh />
      <OfflineBanner />
      <div
        className="flex flex-col mx-auto relative"
        style={{ width: '100%', maxWidth: '480px', minHeight: '100dvh', background: 'var(--bg)', overflowX: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.08)', paddingTop: 'env(safe-area-inset-top, 0px)' } as React.CSSProperties}
      >
        {/* Header — Urban Curator: white + hard 2px border-bottom */}
        <header
          className="flex-shrink-0 px-4 flex items-center justify-between"
          style={{
            position: 'sticky',
            top: 0,
            paddingTop: '12px',
            paddingBottom: '12px',
            background: 'var(--bg)',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            zIndex: 40,
          }}
        >
          <button className="flex items-center gap-2" onClick={() => { setActiveTab('discover'); window.scrollTo(0, 0); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <img src="/logo-static.webp" alt="ABQ Unplugged" style={{ height: '32px', width: 'auto' }} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="w-9 h-9 flex items-center justify-center" style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--ink)' }}>search</span>
            </button>
            <button
              onClick={requestGeo}
              className="w-9 h-9 flex items-center justify-center"
              style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              title={coords ? 'Location active' : 'Enable location'}
              aria-label={coords ? 'Location active' : 'Enable location'}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '18px',
                  color: coords ? 'var(--brand)' : '#888',
                  fontVariationSettings: coords ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                my_location
              </span>
            </button>

          </div>
        </header>

        {/* Site-wide announcement banner */}
        <SiteBanner banner={siteBanner} />

        {/* Screen content */}
        <main ref={mainRef} className="flex-1" style={{ paddingBottom: 'calc(var(--sab) + 110px)', touchAction: 'pan-y', overscrollBehaviorX: 'none' } as React.CSSProperties}
          onTouchStart={onMainTouchStart} onTouchEnd={onMainTouchEnd}>
          {activeTab === 'discover' && (
            <DiscoverScreen
              events={events}
              eventsLoading={eventsLoading}
              onEventSelect={openEventModal}
              coords={coords}
              geoRequested={geoRequested}
              geoSilentPending={geoSilentPending}
              geoError={geoError}
              onRequestGeo={requestGeo}
              onNavigateEvents={(genre) => { setEventsNavGenre(genre || ''); setActiveTab('events'); }}
              prefs={prefs}
              adminHeroLines={adminHeroLines}/>
          )}
          {activeTab === 'events' && (
            <EventsScreen events={events} eventsLoading={eventsLoading} onEventSelect={openEventModal} initialSearch={eventsNavSearch} initialGenre={eventsNavGenre} />
          )}
          {activeTab === 'plan' && (
            <PlanScreen
              savedPlan={savedPlan}
              onPlaceSelect={() => {}}
              onEventSelect={openEventModal}
              onRemovePlace={(id) => { setSavedPlan(prev => { const n = prev.filter(p => !(p.type === 'place' && (p.data as Place).id === id)); savePlanToStorage(n); return n; }); }}
              onRemoveEvent={(id) => { setSavedPlan(prev => { const n = prev.filter(p => !(p.type === 'event' && (p.data as TMEvent).id === id)); savePlanToStorage(n); return n; }); }}
              onClearAll={() => { setSavedPlan([]); localStorage.removeItem('abq-saved-plan'); }}
            />
          )}
        </main>

        {/* Bottom navigation — Liquid Glass with home indicator safe area */}
        <nav
          className="flex items-stretch"
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '480px',
            padding: '0 3px',
            paddingBottom: 'calc(var(--sab) + 8px)',
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            background: 'var(--bg)',
            zIndex: 40,
          }}
        >
          {NAV_ITEMS.map((item, idx) => {
            const isActive = activeTab === item.id;
            return (
            <button
              key={item.id}
              onClick={() => { playHaptic(); navigateTab(item.id); }}
              aria-label={item.label}
              className="nav-press-btn flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{
                minHeight: '64px',
                background: isActive ? 'var(--brand)' : 'var(--bg)',
                border: 'none',
                borderRadius: 8,
                margin: '6px 3px 6px',
                position: 'relative' as const,
                top: 0,
                boxShadow: isActive
                  ? '0 4px 0 #7a2e1a, 0 2px 8px rgba(194,99,74,0.3)'
                  : isDark ? '0 4px 0 rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.2)' : '0 4px 0 #d5d0c8, 0 2px 6px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'top 0.1s ease, box-shadow 0.1s ease, background 0.15s ease',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '22px',
                  color: isActive ? 'white' : isDark ? 'rgba(238,233,229,0.65)' : '#555',
                  fontVariationSettings:
                    isActive
                      ? "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24"
                      : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {item.icon}
              </span>
              <span
                className="font-black uppercase"
                style={{
                  color: isActive ? 'white' : isDark ? 'rgba(238,233,229,0.65)' : '#555',
                  fontFamily: 'Public Sans, sans-serif',
                  fontSize: '8px',
                  letterSpacing: '0.1em',
                }}
              >
                {item.label}
              </span>
            </button>
          );})}
        </nav>
        {/* Hidden iOS haptic switch — clicking the label triggers a native switch toggle which produces haptic feedback on iOS 18+ */}
        <div className="haptic-switch" aria-hidden="true">
          <input type="checkbox" id="haptic-cb" />
          <label id="haptic-label" htmlFor="haptic-cb" />
        </div>
            {showSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '60px' }} onClick={() => setShowSearch(false)}>
          <div style={{ background: 'white', borderRadius: '4px', width: '90%', maxWidth: '480px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--brand)', fontSize: '22px' }}>search</span>
              <input autoFocus type="text" placeholder="Search events..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && globalSearch.trim()) { trackEvent('search', { query: globalSearch.trim(), context: 'events' }); setEventsNavSearch(globalSearch.trim()); setActiveTab('events'); setShowSearch(false); } }} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', fontFamily: 'Public Sans, sans-serif' }} />
              <button onClick={() => setShowSearch(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>close</span></button>
            </div>
            {globalSearch.trim() && (
              <div style={{display:'flex',gap:'8px',width:'100%'}}>
                <button onClick={() => { trackEvent('search', { query: globalSearch.trim(), context: 'events' }); setEventsNavSearch(globalSearch.trim()); setActiveTab('events'); setShowSearch(false); }} style={{flex:1,padding:'12px',background:'var(--brand)',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontFamily:'Public Sans, sans-serif',fontWeight:'600',cursor:'pointer'}}>Search Events</button>
              </div>
            )}
          </div>
        </div>
      )}
</div>

      {/* Detail Modals */}
      {/* Venue page — full-screen overlay shown when /venue/:slug is active */}
      {venuePageSlug && !selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#F9F5F2', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <VenuePage
            slug={venuePageSlug}
            events={events}
            onEventClick={(e) => { openEventModal(e); }}
            onBack={() => { setVenuePageSlug(null); window.history.back(); }}
          />
        </div>
      )}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => { closeEventModal(); window.history.back(); }} isSaved={isEventSaved(selectedEvent.id)} onToggleSave={() => toggleSavedEvent(selectedEvent)} mapProvider={resolvedMapProvider} />
      )}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
      {showUsernameSetup && (
        <UsernameSetupModal
          user={user}
          onDone={async (name) => {
            setShowUsernameSetup(false);
            if (name) {
              const { data: { user: fresh } } = await supabase.auth.getUser();
              if (fresh) setUser(fresh);
            }
          }}
        />
      )}
    </ErrorBoundary>
  );
}
