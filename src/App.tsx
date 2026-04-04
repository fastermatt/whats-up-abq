import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from './lib/supabase';
import { fetchPlacesFromDB, fetchEventsFromDB, searchPlacesFromDB } from './lib/db';
import { ALL_EVENTS, type Event as StaticEvent } from './data/events';
import AdminPanel from './AdminPanel';

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
  s.textContent = '@keyframes cardFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes neighborhoodFloat { 0%,100%{transform:translateX(0px)} 30%{transform:translateX(-5px)} 70%{transform:translateX(5px)} } @keyframes ptrSweep { 0%{background-position:-200% center} 100%{background-position:200% center} } @keyframes ptrDots { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} } @keyframes kenBurns0 { from { transform: scale(1.05) translate(0%,0%); } to { transform: scale(1.18) translate(-2%,-1%); } } @keyframes kenBurns1 { from { transform: scale(1.1) translate(-1%,1%); } to { transform: scale(1.2) translate(2%,-2%); } } @keyframes kenBurns2 { from { transform: scale(1.08) translate(1%,-1%); } to { transform: scale(1.18) translate(-1%,2%); } } @keyframes kenBurns3 { from { transform: scale(1.12) translate(-2%,0%); } to { transform: scale(1.05) translate(1%,-1%); } } @keyframes cursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } } @keyframes heartPop { 0% { transform: scale(1); } 15% { transform: scale(1.35); } 30% { transform: scale(0.9); } 45% { transform: scale(1.15); } 60% { transform: scale(0.97); } 75% { transform: scale(1.05); } 100% { transform: scale(1); } } @keyframes heartParticles { 0% { opacity: 1; transform: scale(0.5); } 50% { opacity: 0.8; } 100% { opacity: 0; transform: scale(2.5); } } .like-btn-pop { animation: heartPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; } .like-btn-particles::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; background: radial-gradient(circle, var(--brand) 0%, transparent 70%); animation: heartParticles 0.5s ease-out forwards; pointer-events: none; z-index: -1; } .nav-press-btn:active { top: 4px !important; box-shadow: 0 1px 0 #0a0a0a, 0 0px 2px rgba(0,0,0,0.1) !important; } .haptic-switch { position:fixed; top:-9999px; left:-9999px; opacity:0; pointer-events:none; }';
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
const _fbSetDoc = async (table: string, id: string, docData: any) => {
  await (supabase.from as any)(table).upsert({ id, ...docData });
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

interface Place {
  id: string;
  name: string;
  category: string;
  isFeatured?: boolean;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  image?: string;
  thumbnail?: string;
  additionalImages?: string[];
  gradient?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  hours?: string;
  phone?: string;
  website?: string;
  tags?: string[];
  googleTypes?: string[];
  isKidFriendly?: boolean;
  isAccessible?: boolean;
  source?: string;
}

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
  const tm: TMEvent = {
    id: ev.id,
    name: ev.title,
    url: ev.ticketUrl || ev.website || undefined,
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
  };
  return tm;
}

// Pre-convert all static events once (filter out today-or-past at load time)
const TODAY = new Date().toISOString().split('T')[0];
const STATIC_TM_EVENTS: TMEvent[] = ALL_EVENTS
  .filter(ev => (ev.endDate ?? ev.date) >= TODAY)
  .map(staticEventToTMEvent);

// ─── Utilities ──────────────────────────────────────────────────────────────

const GPLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY || '';

/**
 * Ensure Google Places photo URLs always carry a valid API key.
 * Extracts the photoreference and rebuilds the URL from scratch so that
 * stale/expired signed URLs, empty keys, and wrong keys are all fixed.
 */
function fixGooglePhotoUrl(url?: string): string {
  if (!url) return '';
  if (url.includes('maps.googleapis.com/maps/api/place/photo')) {
    const refMatch = url.match(/photoreference=([^&]+)/);
    if (refMatch && GPLACES_KEY) {
      const mwMatch = url.match(/maxwidth=(\d+)/);
      const maxwidth = mwMatch ? mwMatch[1] : '800';
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photoreference=${refMatch[1]}&key=${GPLACES_KEY}`;
    }
  }
  return url;
}

/** Patch all image URLs in a Place object so Google photos always carry the API key */
function fixPlaceImages<T extends { image?: string; thumbnail?: string; additionalImages?: string[] }>(place: T): T {
  return {
    ...place,
    image: fixGooglePhotoUrl(place.image),
    thumbnail: fixGooglePhotoUrl(place.thumbnail),
    ...(place.additionalImages ? { additionalImages: place.additionalImages.map(fixGooglePhotoUrl) } : {}),
  };
}

/**
 * Image component with styled fallback placeholder.
 * Shows dark gradient + venue name initial when src is missing or fails to load.
 */
function PlaceImg({ src, alt, className, style, iconSize }: {
  src?: string; alt: string; className?: string;
  style?: React.CSSProperties; iconSize?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    const initial = (alt || '?').replace(/^(the|a|an)\s+/i, '')[0]?.toUpperCase() || '?';
    return (
      <div className={className} style={{
        ...style, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        color: 'rgba(255,255,255,0.55)', fontSize: iconSize || '2rem',
        fontWeight: 700, fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.02em',
      }}>
        {initial}
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} />;
}

function hiResUrl(url: string): string {
  if (!url) return url;
  // Fix Google Places photo URLs missing their API key
  url = fixGooglePhotoUrl(url);
  if (!url.includes('places.googleapis.com')) return url;
  return url
    .replace(/maxHeightPx=\d+/, 'maxHeightPx=1600')
    .replace(/maxWidthPx=\d+/, 'maxWidthPx=2000');
}

function getBestEventImage(images?: TMImage[]): string {
  if (!images || images.length === 0) return '';
  const nonFallback = images.filter(img => !img.fallback);
  const pool = nonFallback.length > 0 ? nonFallback : images;
  const sorted = [...pool].sort((a, b) => {
    const ap = (a.width || 0) * (a.height || 0);
    const bp = (b.width || 0) * (b.height || 0);
    return bp - ap;
  });
  return sorted[0]?.url || '';
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
  const seg = event.classifications?.[0]?.segment?.name;
  const gen = event.classifications?.[0]?.genre?.name;
  const val = (seg && seg !== 'Undefined' ? seg : null) ||
              (gen && gen !== 'Undefined' ? gen : null);
  return val || 'Event';
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

function loadCheckins(): Set<string> {
  try {
    const raw = localStorage.getItem('abq_checkins');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveCheckins(s: Set<string>) {
  try { localStorage.setItem('abq_checkins', JSON.stringify([...s])); } catch {}
}

async function syncCheckinsToFirestore(uid: string, checkIns: Set<string>, displayName: string) {
  try {
    const count = checkIns.size;
    const streak = getStreak().count;
    await _fbSetDoc('users', uid, {
      checkIns: [...checkIns],
      updatedAt: new Date().toISOString(),
    });
    // Update leaderboard entry (merge: true preserves other fields)
    await _fbSetDoc('leaderboard', uid, {
      displayName: displayName || 'Anonymous',
      count,
      streak,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Firestore sync error:', err);
  }
}

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

const PLACE_CATEGORIES = [
  { label: 'All',            icon: 'grid',          value: 'All' },
  { label: 'Restaurants',    icon: 'food',          value: 'restaurant' },
  { label: 'Coffee',         icon: 'coffee',        value: 'coffee' },
  { label: 'Bars',           icon: 'beer',          value: 'bar' },
  { label: 'Parks',          icon: 'park',          value: 'park' },
  { label: 'Active',         icon: 'fitness',       value: 'fitness' },
  { label: 'Wellness',       icon: 'spa',           value: 'wellness' },
  { label: 'Arts',           icon: 'art',           value: 'arts' },
  { label: 'Shopping',       icon: 'shop',          value: 'shop' },
  { label: 'Entertainment',  icon: 'entertainment', value: 'entertainment' },
  { label: 'Museums',        icon: 'museum',        value: 'museum' },
  { label: 'Hotels',         icon: 'hotel',         value: 'hotel' },
];

// Vibe configs — shared between DiscoverScreen buttons and PlacesScreen pill filter
const VIBE_CONFIGS = [
  { icon: 'favorite', label: 'Date Night', gradient: 'linear-gradient(135deg, #C2634A, #D4896E)', borderColor: '#C2634A', animatedIcon: '/icons/vibes/date-night.gif', staticIcon: '/icons/vibes/date-night-static.png', vibeSearch: '', vibeCats: ['restaurant', 'bar', 'entertainment', 'arts'] },
  { icon: 'directions_run', label: 'Active', gradient: 'linear-gradient(135deg, #C8963E, #E8A838)', borderColor: '#C8963E', animatedIcon: '/icons/vibes/active.gif', staticIcon: '/icons/vibes/active-static.png', vibeSearch: '', vibeCats: ['fitness', 'park'] },
  { icon: 'self_improvement', label: 'Chill', gradient: 'linear-gradient(135deg, #6B8F71, #7A9E7E)', borderColor: '#6B8F71', animatedIcon: '/icons/vibes/chill.gif', staticIcon: '/icons/vibes/chill-static.png', vibeSearch: '', vibeCats: ['coffee', 'wellness', 'park'] },
  { icon: 'family_restroom', label: 'Family', gradient: 'linear-gradient(135deg, #5B7FA5, #7A9BC0)', borderColor: '#5B7FA5', animatedIcon: '/icons/vibes/family.gif', staticIcon: '/icons/vibes/family-static.png', vibeSearch: '', vibeCats: ['restaurant', 'entertainment', 'park', 'museum', 'coffee'] },
  { icon: 'palette', label: 'Culture', gradient: 'linear-gradient(135deg, #8B6B8A, #A8899E)', borderColor: '#8B6B8A', animatedIcon: '/icons/vibes/culture.gif', staticIcon: '/icons/vibes/culture-static.png', vibeSearch: '', vibeCats: ['arts', 'museum', 'entertainment'] },
];

// Category display name mapping (shows friendlier labels to users)
function displayCategory(cat: string): string {
  if (cat === 'other') return 'Services';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}


// Category badge color mapping
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  restaurant: { bg: '#fef3c7', text: '#92400e' },
  coffee:     { bg: '#f5e6d3', text: '#78350f' },
  bar:        { bg: '#dbeafe', text: '#1e40af' },
  park:       { bg: '#d1fae5', text: '#065f46' },
  fitness:    { bg: '#ede9fe', text: '#5b21b6' },
  arts:       { bg: '#fce7f3', text: '#9d174d' },
  shop:       { bg: '#e0e7ff', text: '#3730a3' },
  entertainment: { bg: '#fef9c3', text: '#854d0e' },
  museum:     { bg: '#f3e8ff', text: '#6b21a8' },
  wellness:   { bg: '#fce4ec', text: '#880e4f' },
  hotel:      { bg: '#cffafe', text: '#155e75' },
  other:      { bg: '#f3f4f6', text: '#374151' },
};


// ── Semantic search aliases ──────────────────────────────────────────────────
// Maps common search terms → category values they should expand to.
// When a query matches an alias key the search also returns ALL places in
// the mapped categories, not just those whose name contains the query.
// ── Search helpers ────────────────────────────────────────────────────────────
// CATEGORY_SYNONYMS: terms that mean "show me the whole category".
// Only true synonyms belong here — NOT specific products/cuisines/activities.
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  // Bars
  drinks:       ['bar', 'coffee'],
  nightlife:    ['bar', 'entertainment'],
  // Coffee
  cafe:         ['coffee'], café:        ['coffee'],
  // Food
  food:         ['restaurant', 'coffee'],
  eat:          ['restaurant', 'coffee'],
  dining:       ['restaurant'],
  // Shopping (full category only for generic shopping terms)
  shopping:     ['shop'], store: ['shop'], stores: ['shop'],
  retail:       ['shop'], mall:  ['shop'],
  // Fitness / Active
  gym:          ['fitness'], workout: ['fitness'],
  'work out':   ['fitness'], exercise: ['fitness'],
  // Wellness
  wellness:     ['wellness'], relax: ['wellness', 'coffee'],
  salon:        ['wellness'], massage: ['wellness'],
  // Arts
  art:          ['arts', 'museum'], gallery: ['arts', 'museum'],
  // Museums
  museum:       ['museum'],
  // Hotels
  hotel:        ['hotel'], lodging: ['hotel'],
  // Parks
  park:         ['park'], parks: ['park'],
  nature:       ['park'], outdoors: ['park'],
  // Entertainment
  'things to do': ['entertainment', 'arts', 'bar'],
  entertainment:  ['entertainment'],
};

// SEARCH_BOOSTS: cross-category activity terms ONLY.
// These are terms where a user clearly wants to see results spanning
// multiple categories AND the term won't reliably appear in place names.
// Do NOT add food-specific terms (pizza, bagel, etc.) — text search
// across name/description handles those fine.
const SEARCH_BOOSTS: Record<string, string[]> = {
  // Cross-category activities & events
  'live music': ['bar', 'arts', 'entertainment'],
  concert:      ['arts', 'entertainment'],
  theater:      ['arts', 'entertainment'], theatre: ['arts', 'entertainment'],
  comedy:       ['entertainment', 'arts'],
  sports:       ['fitness', 'entertainment'],
  dance:        ['fitness', 'arts'],
  // Outdoor activities
  climbing:     ['fitness', 'park'],
  outdoor:      ['park', 'fitness'],
  biking:       ['park', 'fitness'], bike: ['park', 'fitness'],
  trail:        ['park'], trails: ['park'], hike: ['park'], hiking: ['park'],
  // Cross-category
  history:      ['museum', 'arts'],
  spa:          ['wellness'],
  // Food sub-types
  brunch:       ['restaurant', 'coffee'],
  breakfast:    ['restaurant', 'coffee'],
  lunch:        ['restaurant'],
  dinner:       ['restaurant'],
  takeout:      ['restaurant'],
  delivery:     ['restaurant'],
};

const EVENT_GENRES = [
  'All', 'Tonight', 'This Weekend', '❤️ For You', 'Free', 'Music', 'Sports', 'Comedy', 'Arts', 'Family', 'Outdoor', 'Community',
];

const FOLLOWING_KEY = 'abq_following_genres';
function getFollowedGenres(): string[] {
  try { const raw = localStorage.getItem(FOLLOWING_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveFollowedGenres(genres: string[]) {
  try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(genres)); } catch {}
}

// Per-category icon and gradient for event cards
const EVENT_TYPE_META: Record<string, { icon: string; bg: string }> = {
  'Music':          { icon: 'music',         bg: 'linear-gradient(135deg,#8B3A0F,#c0552a)' },
  'Sports':         { icon: 'sports',        bg: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
  'Arts':           { icon: 'art',           bg: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
  'Arts & Theatre': { icon: 'theatre',       bg: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
  'Comedy':         { icon: 'comedy',        bg: 'linear-gradient(135deg,#b45309,#d97706)' },
  'Family':         { icon: 'family',        bg: 'linear-gradient(135deg,#047857,#10b981)' },
  'Outdoor':        { icon: 'outdoor',       bg: 'linear-gradient(135deg,#065f46,#059669)' },
  'Community':      { icon: 'community',     bg: 'linear-gradient(135deg,#0e7490,#06b6d4)' },
  'Festival':       { icon: 'festival',      bg: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  'Film':           { icon: 'film',          bg: 'linear-gradient(135deg,#1f2937,#4b5563)' },
  'Free':           { icon: 'free',          bg: 'linear-gradient(135deg,#047857,#10b981)' },
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
    sports:        <><path d="M5 3h6v4c0 2.8-1.3 4-3 4s-3-1.2-3-4Z" {...S}/><path d="M5 5H3.5a1.5 1.5 0 0 0 0 3H5" {...S}/><path d="M11 5h1.5a1.5 1.5 0 0 1 0 3H11" {...S}/><line x1="8" y1="11" x2="8" y2="13.5" {...S}/><line x1="5.5" y1="13.5" x2="10.5" y2="13.5" {...S}/></>,
    comedy:        <><circle cx="8" cy="8" r="6" {...S}/><path d="M5.5 9.5Q8 12 10.5 9.5" {...S}/><circle cx="6" cy="7" r="0.8" {...F}/><circle cx="10" cy="7" r="0.8" {...F}/></>,
    art:           <><path d="M8 2a6 6 0 1 0 5.2 9" {...S}/><path d="M13.5 9.5c1.5-1 1.5-2.5 0-2.5s-1.5 2.5 0 2.5Z" {...F}/><circle cx="5.5" cy="6.5" r="1" {...F}/><circle cx="9.5" cy="5" r="1" {...F}/><circle cx="11" cy="9" r="1" {...F}/></>,
    theatre:       <><path d="M2 5.5c0 2.5 2 4.5 4.5 4.5S11 8 11 5.5L6.5 3Z" {...S}/><path d="M5 7.5c.5.7 1.5.7 2 0" {...S}/><circle cx="12" cy="10.5" r="3" {...S}/><path d="M10.5 12c.5-.8 1.5-.8 2 0" {...S}/></>,
    family:        <><path d="M2 14L8 3l6 11Z" {...S}/><line x1="8" y1="14" x2="8" y2="9" {...S}/><line x1="5" y1="14" x2="11" y2="14" {...S}/></>,
    outdoor:       <><path d="M1 14L6 6l5 8Z" {...S}/><path d="M6 14l4-6 4 6Z" {...S}/><circle cx="13.5" cy="3.5" r="1.5" {...S}/></>,
    community:     <><circle cx="8" cy="5" r="2" {...S}/><path d="M4 14c0-2.5 8-2.5 8 0" {...S}/><circle cx="3" cy="7" r="1.5" {...S}/><path d="M1 13c0-2 4-2 4 0" {...S}/><circle cx="13" cy="7" r="1.5" {...S}/><path d="M11 13c0-2 4-2 4 0" {...S}/></>,
    festival:      <><path d="M8 2l1.6 4.5H15l-4 2.9 1.5 4.6L8 11.2l-4.5 2.8L5 9.4 1 6.5h5.4Z" {...S}/></>,
    film:          <><rect x="2" y="4" width="12" height="8" rx="1" {...S}/><line x1="2" y1="6.5" x2="14" y2="6.5" {...S}/><line x1="2" y1="9.5" x2="14" y2="9.5" {...S}/><line x1="4.5" y1="4" x2="4.5" y2="6.5" {...S}/><line x1="11.5" y1="4" x2="11.5" y2="6.5" {...S}/><line x1="4.5" y1="9.5" x2="4.5" y2="12" {...S}/><line x1="11.5" y1="9.5" x2="11.5" y2="12" {...S}/></>,
    free:          <><rect x="2" y="4" width="12" height="8" rx="1" {...S}/><path d="M5.5 7v3M5.5 7h2c.8 0 .8 2 0 2H5.5" {...S}/><line x1="10.5" y1="7" x2="10.5" y2="10" {...S}/></>,
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
        style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', padding: '0 4px', opacity: 0.6 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ─── Place Card ─────────────────────────────────────────────────────────────

// ─── Ken Burns Photo Slider (PlaceCard) ─────────────────────────────────────
function PlaceCardImageSlider({ place }: { place: Place }) {
  const initialPhotos = [place.thumbnail || place.image, ...(place.additionalImages ?? [])].filter(Boolean) as string[];
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const allPhotos = initialPhotos.filter(url => !brokenUrls.has(url));
  const handleImgError = useCallback((url: string) => {
    setBrokenUrls(prev => { const n = new Set(prev); n.add(url); return n; });
  }, []);
  // Google returns a tiny map-tile placeholder (~100×100) when photo_reference
  // is expired or invalid. Detect it on load and treat as broken.
  const handleImgLoad = useCallback((url: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalWidth < 150) {
      handleImgError(url);
    }
  }, [handleImgError]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = allPhotos.length;

  const scheduleNext = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current);
    if (count > 1) {
      autoRef.current = setTimeout(() => {
        setIdx(i => (i + 1) % count);
      }, 4200);
    }
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

  if (allPhotos.length === 0) return <div className="w-full h-full" style={{ background: 'var(--brand-gradient)' }} />;

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {allPhotos.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0"
          style={{ opacity: i === idx ? 1 : 0, transition: 'opacity 0.65s ease', overflow: 'hidden' }}
        >
          <img
            src={src}
            alt=""
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={(e) => handleImgLoad(src, e)}
            onError={() => handleImgError(src)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              animation: i === idx ? `kenBurns${i % 4} 8s ease-in-out forwards` : 'none',
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          />
        </div>
      ))}
      {count > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1" style={{ zIndex: 2 }}>
          {allPhotos.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); goTo(i, 3000); }}
              style={{
                width: i === idx ? '14px' : '5px', height: '5px', borderRadius: '3px',
                background: i === idx ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none', padding: 0, minHeight: 0, cursor: 'pointer',
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const PlaceCard = React.memo(function PlaceCard({
  place, onClick, distance, isCheckedIn, onCheckIn, tooFar,
}: {
  place: Place;
  onClick: () => void;
  distance?: number;
  isCheckedIn?: boolean;
  onCheckIn?: (e: React.MouseEvent) => void;
  tooFar?: boolean;
}) {
  // Match by value (e.g. 'restaurant') OR label (e.g. 'Restaurants') — data may use either
  const catMeta = PLACE_CATEGORIES.find(c => c.value === place.category) || PLACE_CATEGORIES.find(c => c.label === place.category);
  const catIconName = catMeta?.icon || 'pin';
  const catLabel = catMeta?.label || place.category || '';
  return (
    // div instead of button — avoids nested-button HTML invalidity that breaks tap on iOS Safari
    <div
      onClick={onClick}
      className="bg-white overflow-hidden text-left w-full"
      style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', borderRadius: '10px', animation: 'cardFadeIn 0.3s ease both', contain: 'layout paint' }}
    >
      <div className="relative" style={{ height: '140px' }}>
        <PlaceCardImageSlider place={place} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        {isCheckedIn && (
          <div className="absolute bottom-2 left-2">
            <span
              className="text-xs font-bold text-white px-1.5 py-0.5"
              style={{ background: 'var(--ink)' }}
            >
              ✓ Visited
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        {/* Category inline label with flat icon */}
        <div className="flex items-center gap-1 mb-1" style={{ opacity: 0.6 }}>
          <FlatIcon name={catIconName} size={11} color="var(--ink)" />
          <span className="text-xs font-bold uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em', fontSize: 9 }}>{catLabel}</span>
        </div>
        <p
          className="font-black text-sm leading-snug text-gray-900"
          style={{ fontFamily: 'Public Sans, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {place.name}
        </p>
        {/* Address snippet or neighborhood */}
        {(place.address || (place as any).neighborhood) && (
          <p className="text-xs mt-0.5 truncate flex items-center gap-0.5" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>location_on</span>
            {(place as any).neighborhood || place.address?.split(',')[0]}
          </p>
        )}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {place.rating ? (<>
              <span className="text-yellow-400 text-xs">★</span>
              <span className="text-xs font-bold text-gray-700">{place.rating.toFixed(1)}</span>
              {place.reviewCount ? (
                <span className="text-xs truncate" style={{ color: '#666' }}>
                  ({place.reviewCount >= 1000 ? (place.reviewCount / 1000).toFixed(1) + 'k' : place.reviewCount})
                </span>
              ) : null}
            </>) : null}
            {distance != null && (
              <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', marginLeft: place.rating ? 4 : 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '10px', color: '#888' }}>near_me</span>
                {formatDist(distance)}
              </span>
            )}
          </div>
          {onCheckIn && (
            <button
              onClick={onCheckIn}
              className="text-xs font-black px-2 py-1 flex-shrink-0"
              style={{
                fontFamily: 'Public Sans, sans-serif',
                letterSpacing: '0.06em',
                background: tooFar ? '#888' : isCheckedIn ? 'var(--ink)' : 'var(--brand)',
                color: 'white',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 6,
              }}
            >
              {tooFar ? 'Get Closer' : isCheckedIn ? '✓ Visited' : 'Check In'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

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
  const handleImgLoad = useCallback((url: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalWidth < 150) handleImgError(url);
  }, [handleImgError]);

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

  return (
    <button
      ref={fadeRef}
      onClick={onClick}
      className="bg-white overflow-hidden text-left w-full"
      style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', borderRadius: '10px', animation: 'cardFadeIn 0.3s ease both' }}
    >
      <div className="relative" style={{ height: '160px' }}>
        <EventCardImageSlider event={event} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1 }}>
          <FlatIcon name={typeMeta.icon} size={10} color="white" />
          <span style={{ fontSize: 9, fontWeight: 800, color: 'white', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'Public Sans, sans-serif' }}>{category}</span>
        </div>
      </div>
      <div className="p-3">
        <p
          className="font-black text-sm leading-snug text-gray-900"
          style={{ fontFamily: 'Public Sans, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {event.name}
        </p>
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
      </div>
    </button>
  );
});

// ─── Place Detail Modal ──────────────────────────────────────────────────────

function PlacePhotoGallery({ place }: { place: Place }) {
  const initialPhotos = [place.image, ...(place.additionalImages ?? [])].filter(Boolean) as string[];
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const allPhotos = initialPhotos.filter(url => !brokenUrls.has(url));
  const handleImgError = useCallback((url: string) => {
    setBrokenUrls(prev => { const n = new Set(prev); n.add(url); return n; });
  }, []);
  const handleImgLoad = useCallback((url: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalWidth < 150) handleImgError(url);
  }, [handleImgError]);
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const prev = () => setIdx(i => (i - 1 + allPhotos.length) % allPhotos.length);
  const next = () => setIdx(i => (i + 1) % allPhotos.length);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  if (allPhotos.length === 0) {
    return (
      <div className="w-full h-full" style={{ background: 'var(--brand-gradient)' }} />
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {allPhotos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={(e) => handleImgLoad(src, e)}
          onError={() => handleImgError(src)}
          style={{
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 0.35s ease',
            pointerEvents: 'none',
          }}
        />
      ))}
      {allPhotos.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', zIndex: 2 }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>chevron_left</span>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', zIndex: 2 }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>chevron_right</span>
          </button>
          <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5" style={{ zIndex: 2 }}>
            {allPhotos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === idx ? '18px' : '6px',
                  height: '6px',
                  background: i === idx ? 'white' : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Feedback Widget ──────────────────────────────────────────────────────────
function FeedbackWidget({ contextType, contextId, contextName }: { contextType: 'place' | 'event' | 'general'; contextId?: string; contextName?: string }) {
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

function PlaceDetailModal({
  place, onClose, isCheckedIn, onCheckIn, checkInError, tooFar, user, onShowAuth, isSaved, onToggleSave, mapProvider, enrichedDataEnabled,
}: {
  place: Place;
  onClose: () => void;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  checkInError?: string | null;
  tooFar?: boolean;
  user: User | null;
  onShowAuth: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  mapProvider?: 'google' | 'apple';
  enrichedDataEnabled?: boolean;
}) {
  const [shared, setShared] = useState(false);
  const [enriched, setEnriched] = useState<{ tip?: string; hours?: string; phone?: string; website?: string; editorial?: string; parking?: string; menu?: string; historicNote?: string; bestFor?: string[]; priceNote?: string } | null>(
    // Use pre-loaded enriched data from Supabase if available (attached by fetchPlacesFromDB)
    (place as any)._enriched || null
  );
  const [placeHideEnriched, setPlaceHideEnriched] = useState((place as any)._hideEnriched || false);
  const detailCatMeta = PLACE_CATEGORIES.find(c => c.value === place.category) || PLACE_CATEGORIES.find(c => c.label === place.category);
  const detailCatIcon = detailCatMeta?.icon || 'pin';
  const detailCatLabel = detailCatMeta?.label || place.category || '';
  const rawQuery = (place.address || place.name) + ' Albuquerque NM';
  const mapsQuery = encodeURIComponent(rawQuery);
  const directionsUrl = (mapProvider === 'apple')
    ? `https://maps.apple.com/?q=${mapsQuery}`
    : `https://maps.google.com/?q=${mapsQuery}`;

  // Lazy-load enriched data (tips, full hours, phone, website, parking) on modal open
  useEffect(() => {
    let cancelled = false;
    const fetchEnriched = async () => {
      try {
        // Supabase stores IDs as "google_<place_id>" but the app uses bare place_id
        const dbId = place.id.startsWith('google_') ? place.id : `google_${place.id}`;
        const { data, error } = await supabase
          .from('places')
          .select('enriched,hide_enriched')
          .eq('id', dbId)
          .maybeSingle();
        if (cancelled) return;
        if (error) { console.warn('[enriched] fetch error:', error.message); return; }
        if (data?.enriched) setEnriched(data.enriched as any);
        if (data?.hide_enriched) setPlaceHideEnriched(true);
      } catch (err) {
        console.warn('[enriched] unexpected error:', err);
      }
    };
    fetchEnriched();
    return () => { cancelled = true; };
  }, [place.id]);

  // Global flag + per-place override both gate enriched data display
  const showEnriched = enrichedDataEnabled !== false && !placeHideEnriched;

  // Merge: enriched data supplements (but doesn't erase) what's already on the place object
  // Falls back to place-level fields from static JSON (insiderTip, parkingInfo, about, etc.)
  // Validate hours: reject scraped garbage that doesn't look like actual hours
  const isValidHours = (h: string | undefined | null): boolean => {
    if (!h) return false;
    // Must contain at least one time pattern (digit followed by am/pm or colon)
    if (!/\d{1,2}(:\d{2})?\s*(am|pm)/i.test(h) && !/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/.test(h)) return false;
    // Reject if it's obviously scraped navigation/menu text (too many pipes, too long)
    if (h.length > 300) return false;
    if ((h.match(/\|/g) || []).length > 10) return false;
    return true;
  };
  const rawHours = (showEnriched ? enriched?.hours : null) || place.hours || null;
  const displayHours = isValidHours(rawHours) ? rawHours : null;
  const displayPhone   = (showEnriched ? enriched?.phone   : null) || place.phone   || null;
  const displayWebsite = (showEnriched ? enriched?.website : null) || place.website || null;
  const displayParking = showEnriched ? (enriched?.parking || (place as any).parkingInfo || null) : null;
  const displayMenu    = showEnriched ? (enriched?.menu    || null) : null;
  const displayDesc    = place.description || (showEnriched ? (enriched?.editorial || (place as any).about) : null) || null;
  const insiderTip     = showEnriched ? (enriched?.tip || (place as any).insiderTip || null) : null;
  const historicNote   = showEnriched ? (enriched?.historicNote || (place as any).historicNote || null) : null;
  const bestFor        = showEnriched ? (enriched?.bestFor || (place as any).bestFor as string[] || null) : null;
  const priceNote      = showEnriched ? (enriched?.priceNote || (place as any).priceNote || null) : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="flex flex-col overflow-y-auto w-full" style={{ maxWidth: '480px', background: 'white' }} onClick={e => e.stopPropagation()}>
      <div className="relative flex-shrink-0" style={{ height: '260px' }}>
        <PlacePhotoGallery place={place} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between" style={{ zIndex: 3 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>close</span>
          </button>
          <div className="flex items-center gap-2">
            {onToggleSave && (
              <button
                onClick={onToggleSave}
                className="w-10 h-10 flex items-center justify-center"
                style={{ background: isSaved ? 'var(--brand)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%' }}
                title={isSaved ? 'Remove from plan' : 'Save to plan'}
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: '20px', fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
              </button>
            )}
            <button
              onClick={async () => {
                const shareUrl = `https://abqunplugged.com/place/${encodeURIComponent(place.id)}`;
                const shareText = `${place.name} — ${place.description || place.category || ''}`;
                trackEvent('share_click', { type: 'place', place_id: place.id, name: place.name });
                if (navigator.share) {
                  try { await navigator.share({ title: place.name, text: shareText, url: shareUrl }); setShared(true); setTimeout(() => setShared(false), 2000); return; } catch { /* fall through */ }
                }
                try { await navigator.clipboard.writeText(shareUrl); setShared(true); setTimeout(() => setShared(false), 2000); } catch { /* ignore */ }
              }}
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%' }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>{shared ? 'check' : 'share'}</span>
            </button>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4" style={{ zIndex: 3, pointerEvents: 'none' }}>
          <span
            className="text-xs font-bold text-white px-2.5 py-1 rounded inline-flex items-center gap-1"
            style={{ background: 'var(--brand)', pointerEvents: 'auto' }}
          >
            <FlatIcon name={detailCatIcon} size={11} color="white" />
            {detailCatLabel}
          </span>
          <h2
            className="text-white font-black text-2xl mt-2 leading-tight"
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          >
            {place.name}
          </h2>
        </div>
      </div>

      <div className="px-5 py-4 pb-10">
        {/* Rating + Check In row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {place.rating && (
            <div className="flex items-center gap-1 bg-white rounded-lg px-3 py-2" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <span className="text-yellow-400">★</span>
              <span className="font-black text-sm" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                {place.rating.toFixed(1)}
              </span>
              {place.reviewCount && (
                <span className="text-xs" style={{ color: '#666' }}>({place.reviewCount.toLocaleString()})</span>
              )}
            </div>
          )}
          {place.priceLevel != null && place.priceLevel > 0 && (
            <div className="bg-white rounded-lg px-3 py-2" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <span className="font-black text-sm text-green-600">
                {'$'.repeat(Math.min(place.priceLevel, 4))}
              </span>
            </div>
          )}
          <button
            onClick={onCheckIn}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg font-black text-sm transition-all"
            style={{
              background: tooFar ? '#dc2626' : isCheckedIn ? 'var(--brand-bg-subtle)' : 'var(--brand)',
              color: isCheckedIn && !tooFar ? 'var(--brand)' : 'white',
              fontFamily: 'Public Sans, sans-serif',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {tooFar ? 'near_me' : isCheckedIn ? 'check_circle' : 'add_location_alt'}
            </span>
            {tooFar ? 'Get Closer' : isCheckedIn ? 'Visited! ✓' : 'Check In'}
          </button>
        </div>

        {checkInError && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: 'var(--brand-tint-bg)', color: 'var(--brand)', border: '1px solid #ffe0b2' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>location_off</span>
            {checkInError}
          </div>
        )}

        {displayDesc && (
          <p className="text-gray-700 text-sm leading-relaxed mb-4" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            {displayDesc}
          </p>
        )}

        {/* Insider Tip — shown when enriched data is available */}
        {insiderTip && (
          <div className="mb-4 p-3 flex items-start gap-2.5" style={{ background: '#fffbeb', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '18px', color: '#b45309' }}>tips_and_updates</span>
            <div>
              <p className="text-xs font-black uppercase mb-1" style={{ color: '#b45309', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.07em' }}>Local Tip</p>
              <p className="text-sm leading-relaxed text-gray-800" style={{ fontFamily: 'Public Sans, sans-serif' }}>{insiderTip}</p>
            </div>
          </div>
        )}

        {/* Best For tags */}
        {bestFor && bestFor.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {bestFor.map((tag, i) => (
              <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--brand-bg-subtle, #f0f0ff)', color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Historic Note */}
        {historicNote && (
          <div className="mb-4 p-3 flex items-start gap-2.5" style={{ background: '#fef3c7', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px' }}>
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '18px', color: '#92400e' }}>history_edu</span>
            <div>
              <p className="text-xs font-black uppercase mb-1" style={{ color: '#92400e', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.07em' }}>Historic Note</p>
              <p className="text-sm leading-relaxed text-gray-800" style={{ fontFamily: 'Public Sans, sans-serif' }}>{historicNote}</p>
            </div>
          </div>
        )}

        {/* Price Note */}
        {priceNote && (
          <div className="flex items-start gap-3 mb-3 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)', marginTop: '1px' }}>payments</span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase mb-0.5" style={{ color: '#6b7280', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em' }}>Price</p>
              <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{priceNote}</p>
            </div>
          </div>
        )}

        {/* Address — taps to Maps */}
        {place.address && (
          <a
            href={directionsUrl}
            target="_blank" rel="noopener noreferrer"
            onClick={() => trackEvent('directions_click', { place_id: place.id, name: place.name, category: place.category })}
            className="flex items-start gap-3 mb-3 bg-white p-3 w-full text-left"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)', marginTop: '1px' }}>location_on</span>
            <div className="min-w-0">
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif' }}>{place.address}</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand)' }}>Open in {mapProvider === 'apple' ? 'Apple Maps' : 'Google Maps'} →</p>
            </div>
          </a>
        )}

        {/* Hours — full schedule from enriched data, falls back to open_now text */}
        {displayHours && (
          <div className="flex items-start gap-3 mb-3 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)', marginTop: '1px' }}>schedule</span>
            <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>
              {displayHours.includes(' | ')
                ? displayHours.split(' | ').map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)
                : displayHours}
            </p>
          </div>
        )}

        {/* Phone — taps to call */}
        {displayPhone && (
          <a
            href={`tel:${displayPhone.replace(/\D/g, '')}`}
            className="flex items-center gap-3 mb-3 bg-white p-3 w-full"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)' }}>phone</span>
            <div className="min-w-0">
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif' }}>{displayPhone}</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand)' }}>Tap to call →</p>
            </div>
          </a>
        )}

        {/* Website */}
        {displayWebsite && (
          <a
            href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 mb-3 bg-white p-3 w-full"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)' }}>language</span>
            <div className="min-w-0">
              <p className="text-sm text-gray-700 truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                {displayWebsite.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand)' }}>Visit website →</p>
            </div>
          </a>
        )}

        {/* Menu — restaurants & coffee shops */}
        {displayMenu && (
          <a
            href={displayMenu.startsWith('http') ? displayMenu : `https://${displayMenu}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 mb-3 bg-white p-3 w-full"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textDecoration: 'none', border: '2px solid var(--brand)' }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)' }}>menu_book</span>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-800" style={{ fontFamily: 'Public Sans, sans-serif' }}>View Menu</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand)' }}>See full menu →</p>
            </div>
          </a>
        )}

        {/* Parking */}
        {displayParking && (
          <div className="flex items-start gap-3 mb-3 bg-white p-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: 'var(--brand)', marginTop: '1px' }}>local_parking</span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase mb-0.5" style={{ color: '#6b7280', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em' }}>Parking</p>
              <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>{displayParking}</p>
            </div>
          </div>
        )}

        {/* Map */}
        {(place.address || place.lat) && (
          <div className="rounded-lg overflow-hidden mb-4" style={{ height: '180px' }}>
            <iframe
              title={`Map for ${place.name}`}
              width="100%"
              height="180"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=15`}
              allowFullScreen
            />
          </div>
        )}

        {(place.isKidFriendly || place.isAccessible) && (
          <div className="flex gap-2 mt-2 mb-4 flex-wrap">
            {place.isKidFriendly && (
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded">
                ‍‍ Kid Friendly
              </span>
            )}
            {place.isAccessible && (
              <span className="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded">
                ♿ Accessible
              </span>
            )}
          </div>
        )}

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('directions_click', { place_id: place.id, name: place.name, category: place.category })}
          className="block w-full py-4 text-center text-white font-black text-sm rounded-lg mt-2"
          style={{ background: 'var(--brand-gradient)', fontFamily: 'Public Sans, sans-serif' }}
        >
          GET DIRECTIONS →
        </a>

        {/* Reviews */}
        <ReviewSection
          placeId={place.id}
          isCheckedIn={isCheckedIn}
          user={user}
          onShowAuth={onShowAuth}
        />
      </div>
      <FeedbackWidget contextType="place" contextId={place.id} contextName={place.name} />
    </div>
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

function ReviewSection({
  placeId, isCheckedIn, user, onShowAuth,
}: {
  placeId: string;
  isCheckedIn: boolean;
  user: User | null;
  onShowAuth: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [profWarn, setProfWarn] = useState<ProfanityMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Load reviews
  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    _fbGetDocsByField('reviews', 'place_id', placeId).then(snap => {
      if (!cancelled) {
        const loaded: Review[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<Review, 'id'>),
        }));
        // Sort client-side: newest first
        loaded.sort((a, b) => {
          const at = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
          const bt = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
          return bt - at;
        });
        setReviews(loaded);
        setLoading(false);
      }
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [placeId]);

  // Check if this user already reviewed this place
  const alreadyReviewed = user ? reviews.some(r => r.userId === user.id) : false;

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const handleTextChange = (val: string) => {
    setText(val);
    setProfWarn(checkProfanity(val));
  };

  const handleSubmit = async () => {
    if (!user) { onShowAuth(); return; }
    if (rating === 0) { setError('Please select an outlet rating first!'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await _fbAddDoc('reviews', {
        placeId,
        userId: user.id,
        userName: (user.user_metadata?.display_name || user.email) || user.email?.split('@')[0] || 'Explorer',
        rating,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        helpful: 0,
      });
      setText('');
      setRating(0);
      setProfWarn(null);
      setSubmitted(true);
      setShowForm(false);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setError('Could not save review. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-black text-gray-900 text-base" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            Reviews
          </h3>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-0.5">
              <OutletRating value={Math.round(avgRating)} size="sm" />
              <span className="text-xs text-gray-500 font-semibold">
                {avgRating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        {isCheckedIn && !alreadyReviewed && !showForm && (
          user
            ? <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-white"
                style={{ background: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                Write Review
              </button>
            : <button
                onClick={onShowAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-white"
                style={{ background: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>login</span>
                Sign in to Review
              </button>
        )}
        {isCheckedIn && alreadyReviewed && (
          <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--brand)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Reviewed
          </span>
        )}
      </div>

      {/* Gate message for non-checked-in users */}
      {!isCheckedIn && (
        <div className="mb-4 rounded-lg p-3 flex items-center gap-3" style={{ background: 'rgba(160,59,0,0.06)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--brand)', fontSize: '20px' }}>lock</span>
          <p className="text-xs text-gray-600 flex-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            Check in here first to leave a review
          </p>
        </div>
      )}

      {/* Success toast */}
      {submitted && (
        <div className="mb-3 rounded-lg p-3 flex items-center gap-2" style={{ background: 'rgba(160,59,0,0.08)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--brand)', fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-xs font-bold" style={{ color: 'var(--brand)' }}>Review posted — thanks! ✓</p>
        </div>
      )}

      {/* Review form */}
      {showForm && isCheckedIn && user && !alreadyReviewed && (
        <div className="mb-4 rounded-lg p-4" style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-600 mb-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>
              How many outlets does this place get?
            </p>
            <OutletRating value={rating} onChange={setRating} size="lg" />
          </div>

          <textarea
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Tell people what made this place worth visiting (or not)..."
            rows={3}
            className="w-full text-sm rounded-lg border border-gray-200 p-3 resize-none focus:outline-none"
            style={{
              fontFamily: 'Public Sans, sans-serif',
              background: '#fafafa',
              borderColor: profWarn ? '#fbbf24' : undefined,
            }}
          />

          {/* Profanity warning */}
          {profWarn && (
            <div className="mt-2 rounded-lg p-3 text-xs leading-relaxed" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <p className="font-bold mb-1">
                Whoa there! Kids use this app — let's try other words. 😄
              </p>
              <p>
                Instead of <strong>"{profWarn.found}"</strong>, how about{' '}
                {profWarn.alts.map((a, i) => (
                  <span key={a}>
                    <button
                      className="font-bold underline hover:no-underline"
                      style={{ color: 'var(--brand)' }}
                      onClick={() => {
                        const newText = text.replace(new RegExp(profWarn.found, 'gi'), a);
                        handleTextChange(newText);
                      }}
                    >
                      "{a}"
                    </button>
                    {i < profWarn.alts.length - 1 ? (i === profWarn.alts.length - 2 ? ', or ' : ', ') : ''}
                  </span>
                ))}
                ? You can still post your review, but maybe it's time to expand your vocabulary 😄
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 mt-2 font-semibold">{error}</p>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setShowForm(false); setProfWarn(null); setError(null); }}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-gray-500 bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="flex-1 py-2.5 rounded-lg text-xs font-black text-white transition-all"
              style={{
                background: submitting || rating === 0 ? '#d1d5db' : 'var(--brand)',
                fontFamily: 'Public Sans, sans-serif',
              }}
            >
              {submitting ? 'Posting…' : 'Post Review'}
            </button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading && (
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          Loading reviews…
        </p>
      )}
      {!loading && reviews.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          No reviews yet — be the first!
        </p>
      )}
      {!loading && reviews.length > 0 && (
        <div className="flex flex-col gap-3">
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}

// ─── Calendar / Share helpers ────────────────────────────────────────────────
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
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ABQ Unplugged//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@abqunplugged.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15)}Z`,
    `DTSTART;TZID=America/Denver:${dateStr}T${timeStr}`,
    `DTEND;TZID=America/Denver:${endDateStr}T${endTimeStr}`,
    `SUMMARY:${event.name}`,
    locationStr ? `LOCATION:${locationStr}` : '',
    ticketUrl ? `URL:${ticketUrl}` : '',
    ticketUrl ? `DESCRIPTION:Get tickets: ${ticketUrl}` : 'DESCRIPTION:Added from ABQ Unplugged',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  return lines;
}

function addToCalendar(event: TMEvent) {
  const ics = makeCalendarICS(event);
  if (!ics) return;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name.replace(/[^a-z0-9]/gi, '_').substring(0, 40)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
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

// ─── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({ event, onClose, isSaved, onToggleSave, mapProvider }: { event: TMEvent; onClose: () => void; isSaved?: boolean; onToggleSave?: () => void; mapProvider?: 'google' | 'apple' }) {
  const [shared, setShared] = useState(false);
  const [venueExpanded, setVenueExpanded] = useState(false);
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
    <div className="fixed inset-0 z-[150] flex justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="flex flex-col overflow-y-auto w-full" style={{ maxWidth: '480px', background: 'white' }} onClick={e => e.stopPropagation()}>
      <div className="relative flex-shrink-0" style={{ height: '280px' }}>
        <EventCardImageSlider event={event} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
        {/* Top bar: back + share */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between" style={{ zIndex: 3 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>close</span>
          </button>
          <div className="flex items-center gap-2">
            {onToggleSave && (
              <button
                onClick={onToggleSave}
                className="w-10 h-10 flex items-center justify-center"
                style={{ background: isSaved ? 'var(--brand)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%' }}
                title={isSaved ? 'Remove from plan' : 'Save to plan'}
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: '20px', fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
              </button>
            )}
            <button
              onClick={async () => { await shareEvent(event); setShared(true); setTimeout(() => setShared(false), 2000); }}
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: '50%' }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>
                {shared ? 'check' : 'share'}
              </span>
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
              src={`https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=15`}
              allowFullScreen
            />
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
                <span>GET TICKETS →</span>
              </a>
            ))}
          </div>
        ) : event.url ? (
          <a href={event.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 text-center text-white font-black text-sm"
            style={{ borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              background: event._source === 'seatgeek' ? 'linear-gradient(135deg, #d4184a, #ff5c5c)' : event._source === 'local' ? 'linear-gradient(135deg, #0369a1, #38bdf8)' : 'var(--brand-gradient)',
              fontFamily: 'Public Sans, sans-serif' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{event._source === 'local' ? 'info' : 'confirmation_number'}</span>
            {event._source === 'local' ? 'MORE INFO →' : 'GET TICKETS →'}
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
      <FeedbackWidget contextType="event" contextId={event.id} contextName={event.name} />
    </div>
  </div>
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
  { id: 'neighborhoods', label: 'Neighborhoods',     emoji: 'location_city' },
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

// ─── Wishlist localStorage helpers ────────────────────────────────────────────
const getWishlist = (): { id: string; name: string; type: string; category: string }[] => {
  try { return JSON.parse(localStorage.getItem('abq_wishlist') || '[]'); }
  catch { return []; }
};
const saveWishlist = (items: { id: string; name: string; type: string; category: string }[]) => {
  localStorage.setItem('abq_wishlist', JSON.stringify(items));
  window.dispatchEvent(new Event('abq_wishlist_changed'));
};
const toggleWishlist = (item: { id: string; name: string; type: string; category: string }) => {
  const current = getWishlist();
  const exists = current.some(w => w.id === item.id);
  trackEvent(exists ? 'wishlist_remove' : 'wishlist_add', { item_id: item.id, name: item.name, type: item.type });
  saveWishlist(exists ? current.filter(w => w.id !== item.id) : [...current, item]);
};
const isWishlisted = (id: string) => getWishlist().some(w => w.id === id);

// ─── Animated Like Button ────────────────────────────────────────────────────
function LikeButton({ id, type, name, category }: { id: string; type: 'event' | 'place'; name: string; category: string }) {
  const liked = isWishlisted(id);
  const [animating, setAnimating] = React.useState(false);
  const prevLiked = React.useRef(liked);

  React.useEffect(() => {
    if (liked && !prevLiked.current) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 550);
      return () => clearTimeout(t);
    }
    prevLiked.current = liked;
  }, [liked]);

  return (
    <button
      className={animating ? 'like-btn-pop like-btn-particles' : ''}
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        background: liked ? 'var(--brand)' : 'rgba(255,255,255,0.90)',
        border: 'none', borderRadius: '50%', width: 44, height: 44, minHeight: 0,
        color: liked ? 'white' : 'var(--brand)', fontSize: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'background 0.2s ease, color 0.2s ease',
      }}
      onClick={(e) => {
        e.stopPropagation();
        toggleWishlist({ id, type, name, category });
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
function DailyGem({ places, onSelect }: { places: Place[]; onSelect: (p: Place) => void }) {
  const gem = useMemo(() => {
    if (!places.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < today.length; i++) hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
    const pool = places.filter(p => p.rating && p.rating >= 4.2 && p.image);
    if (!pool.length) return null;
    return pool[hash % pool.length];
  }, [places]);

  if (!gem) return null;
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="px-5 pb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif' }}>Today's Pick</h2>
        <span className="text-xs font-black uppercase" style={{ color: '#666', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em' }}><span className="material-symbols-outlined" style={{fontSize:'12px',verticalAlign:'middle',marginRight:'3px'}}>calendar_today</span>Changes daily</span>
      </div>
      <button onClick={() => onSelect(gem)} className="w-full relative overflow-hidden text-left"
        style={{ height: '180px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.12)', animation: 'cardFadeIn 0.45s ease both', borderRadius: '10px' }}>
        <ImageWithFallback src={gem.image} alt={gem.name} className="w-full h-full object-cover" gradient={gem.gradient || hashGradient(gem.name)} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(28,111,234,0.12) 0%, rgba(0,0,0,0.72) 100%)' }} />
        <div className="absolute top-3 left-3">
          <span className="text-xs font-black px-3 py-1"
            style={{ background: 'var(--brand)', color: 'white', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6 }}>
            ★ TODAY'S PICK
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-sm font-black w-8 h-8 flex items-center justify-center"
            style={{ background: 'var(--ink)', color: 'white', border: '2px solid white' }}>→</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-black text-xl leading-tight" style={{ fontFamily: 'Public Sans, sans-serif' }}>{gem.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/80 text-xs font-semibold" style={{ fontFamily: 'Public Sans, sans-serif' }}>{gem.category}</span>
            {gem.rating && (<><span className="text-white/40 text-xs">·</span><span className="text-yellow-300 text-xs font-bold">★ {gem.rating.toFixed(1)}</span></>)}
            {gem.reviewCount && (<><span className="text-white/40 text-xs">·</span><span className="text-white/60 text-xs">{gem.reviewCount >= 1000 ? (gem.reviewCount/1000).toFixed(1)+'k' : gem.reviewCount} reviews</span></>)}
          </div>
          {gem.description && (
            <p className="text-white/70 text-xs mt-1 leading-snug"
              style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>
              {gem.description}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

// ─── Featured Event Banner ───────────────────────────────────────────────────
// Time-limited override: shows a specific event prominently on Discover.
// After the expiry date, falls through to DailyGem automatically.
const FEATURED_EVENT_ID = 'easter-sunrise-abq-2026';
const FEATURED_EVENT_EXPIRY = '2026-04-06'; // Show through Sunday April 5

function FeaturedEventBanner({ events, onSelect }: { events: TMEvent[]; onSelect: (e: TMEvent) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  if (today >= FEATURED_EVENT_EXPIRY) return null;
  const ev = events.find(e => e.id === FEATURED_EVENT_ID);
  if (!ev) return null;
  const img = ev.images?.[0]?.url || '';
  const venue = ev._embedded?.venues?.[0]?.name || '';
  const dateStr = ev.dates?.start?.localDate || '';
  const timeStr = ev.dates?.start?.localTime || '';
  const fmtDate = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const fmtTime = timeStr ? (() => { const [h, m] = timeStr.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; })() : '';

  return (
    <div className="px-5 pb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em' }}>Featured Event</h2>
        <span className="text-xs font-black uppercase" style={{ color: '#666', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '3px' }}>star</span>
          This Weekend
        </span>
      </div>
      <button onClick={() => onSelect(ev)} className="w-full relative overflow-hidden text-left"
        style={{ height: '220px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.12)', animation: 'cardFadeIn 0.45s ease both', borderRadius: '10px' }}>
        <PlaceImg src={img} alt={ev.name} className="w-full h-full object-cover" style={{ filter: 'brightness(0.75)' }} />
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
          <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'Public Sans, sans-serif' }}>Tap ♡ on any event or place to save it here for later</p>
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

function DiscoverScreen({
  places, events, eventsLoading, onPlaceSelect, onEventSelect,
  coords, geoRequested, geoSilentPending, geoError, onRequestGeo,
  checkedIn, onCheckIn,
  onNavigatePlaces, onNavigateEvents, prefs,
}: {
  places: Place[];
  events: TMEvent[];
  eventsLoading?: boolean;
  onPlaceSelect: (p: Place) => void;
  onEventSelect: (e: TMEvent) => void;
  coords: GeoCoords | null;
  geoRequested: boolean;
  geoSilentPending: boolean;
  geoError: string | null;
  onRequestGeo: () => void;
  checkedIn: Set<string>;
  onCheckIn: (id: string) => void;
  onNavigatePlaces?: (cat: string, search: string, vibeLabel?: string, vibeGradient?: string) => void;
  onNavigateEvents?: (genre?: string) => void;
  prefs?: UserPrefs;
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
  useEffect(() => {
    let cancelled = false;
    const target = HERO_PHRASES[Math.floor(Math.random() * HERO_PHRASES.length)];
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
  const featured = places.filter(p => p.isFeatured && !BLOCKED_VENUES.some(b => p.name?.toLowerCase().includes(b.toLowerCase()))).slice(0, 5);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDays = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const pool = events
      .filter(e => {
        const d = e.dates?.start?.localDate || '';
        return d >= today && d <= sevenDays;
      })
      .filter(e => !e._isAdult);  // Discover "This Week" is always family-friendly
    // Shuffle, pick 3, then sort by earliest date first
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).sort((a, b) => {
      const da = a.dates?.start?.localDate || '';
      const db = b.dates?.start?.localDate || '';
      return da.localeCompare(db);
    });
  }, [events]);

  const nearbyPlaces = useMemo(() => {
    if (!coords) return [];
    return places
      .filter(p => p.lat != null && p.lng != null)
      .map(p => ({ place: p, dist: distanceMiles(coords.lat, coords.lng, p.lat!, p.lng!) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);
  }, [places, coords]);

  const hiddenGems = places
    .filter(p => !p.isFeatured && p.rating && p.rating >= 4.5 && !BLOCKED_VENUES.some(b => p.name?.toLowerCase().includes(b.toLowerCase())))
    .slice(0, 10);

  return (
    <div className="w-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      {/* Streak Banner */}
      <StreakBanner />

      {/* Hero — value prop + primary CTA */}
      <div style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs font-black uppercase mb-2" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.12em' }}>
            Greater ABQ Metro
          </p>
          <h1 className="font-black leading-none mt-1 mb-1" style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '40px', letterSpacing: '-0.04em', color: 'var(--ink)', minHeight: '48px' }}>
            {heroDisplay}{!heroDone && <span style={{ display: 'inline-block', width: '3px', height: '0.85em', background: 'var(--ink)', marginLeft: '2px', verticalAlign: 'baseline', animation: 'cursorBlink 0.8s step-end infinite' }} />}
          </h1>
          <p style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '12px', color: '#555', fontWeight: 500, marginBottom: '14px' }}>
            {events.length.toLocaleString()} events · {places.length.toLocaleString()} places across Greater ABQ
          </p>
          <button
            onClick={() => onNavigateEvents?.('Tonight')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', padding: '0 16px', background: 'var(--ink)', color: 'white', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(185,92,67,0.25)', fontFamily: 'Public Sans, sans-serif', fontSize: '13px', fontWeight: 800, letterSpacing: '0.03em', cursor: 'pointer', borderRadius: 6, marginBottom: '12px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>confirmation_number</span>
            What's on tonight →
          </button>
        </div>
        <div className="flex px-5 pb-4 gap-2" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { label: 'Tonight',        action: () => onNavigateEvents?.('Tonight') },
            { label: 'This Weekend',   action: () => onNavigateEvents?.('This Weekend') },
            { label: 'Free Events',    action: () => onNavigateEvents?.('Free') },
            { label: 'Explore Places', action: () => onNavigatePlaces?.('All', '') },
          ].map(chip => (
            <button key={chip.label} onClick={chip.action}
              style={{ flexShrink: 0, height: '28px', padding: '0 12px', background: 'white', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'Public Sans, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', borderRadius: 6, whiteSpace: 'nowrap' }}>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Geo Banner */}
      <GeoBanner
        coords={coords}
        error={geoError}
        requested={geoRequested}
        silentPending={geoSilentPending}
        onRequest={onRequestGeo}
      />

      {/* This Week Events — brutalist table layout */}
      {!hidden.includes('thisWeek') && eventsLoading && upcomingEvents.length === 0 && (
        <div className="mb-5 mx-5" style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', backgroundColor: '#fff' }}>
            <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em' }}>Events This Week</h2>
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
      {!hidden.includes('thisWeek') && upcomingEvents.length > 0 && (
        <div className="mb-5 mx-5" style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', backgroundColor: '#fff' }}>
            <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>
              Events This Week
            </h2>
            <button
              onClick={() => onNavigateEvents?.()}
              className="text-xs font-black uppercase"
              style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)', letterSpacing: '0.06em' }}
            >
              → SEE ALL
            </button>
          </div>
          {/* Rows — 4 randomized events from next 7 days */}
          {upcomingEvents.map((event, idx, arr) => {
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
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid #D0D0D0' : 'none', backgroundColor: '#fff' }}
                >
                  {/* Date block */}
                  <div className="flex flex-col items-center justify-center flex-shrink-0"
                    style={{ width: 52, backgroundColor: 'var(--ink)', minHeight: 52 }}>
                    <span className="font-black uppercase" style={{ fontSize: 9, color: 'var(--bg)', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.06em', lineHeight: 1 }}>
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

      {/* Featured Event (time-limited) — shows above Daily Gem when active */}
      <FeaturedEventBanner events={events} onSelect={onEventSelect} />

      {/* Explore by Vibe — static icons only (no GIF animation) */}
      {!hidden.includes('vibes') && (
        <div className="mb-5 px-5">
          <p className="text-xs font-black uppercase flex items-center gap-2 mb-3" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}><FlatIcon name="zia" size={12} color="var(--brand)" /> Explore by Vibe</p>
          <div className="flex justify-between pb-1">
            {VIBE_CONFIGS.map(({ label, borderColor, staticIcon, vibeSearch, vibeCats }) => (
              <button key={label}
                className="flex flex-col items-center gap-1.5 transition-all active:scale-95"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flex: '1 1 0', minWidth: 0 }}
                onClick={() => { trackEvent('vibe_click', { vibe: label }); onNavigatePlaces?.(vibeCats.join('|'), vibeSearch, label); }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'white', border: `2.5px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                  <img
                    src={staticIcon}
                    alt={label}
                    style={{ width: 38, height: 38, objectFit: 'contain', display: 'block' }} />
                </div>
                <span className="text-center leading-tight font-bold" style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '10px', letterSpacing: '0.02em', color: 'var(--ink)' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Daily Gem — spot of the day, date-seeded */}
      {places.length > 0 && <DailyGem places={places} onSelect={onPlaceSelect} />}

      {/* Trending Bento Grid */}
      {featured.length > 0 && (
        <div className="pb-5">
          <h2
            className="text-lg font-black uppercase tracking-tight mb-3 px-5 flex items-center gap-2"
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          >
            <FlatIcon name="chile" size={18} color="var(--brand)" />
            Staff Picks
          </h2>
          <div className="grid gap-2 px-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Hero card */}
            <button
              onClick={() => onPlaceSelect(featured[0])}
              className="relative overflow-hidden rounded-lg col-span-2"
              style={{ height: '176px' }}
            >
              <ImageWithFallback
                src={featured[0].image}
                alt={featured[0].name}
                className="w-full h-full object-cover"
                gradient={featured[0].gradient}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute top-3 left-3">
                <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded">
                  ⚡ Featured
                </span>
              </div>
              {checkedIn.has(featured[0].id) && (
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-bold text-white px-2 py-1 rounded" style={{ background: 'rgba(160,59,0,0.85)' }}>✓ Visited</span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 text-left">
                <p
                  className="text-white font-black text-base leading-tight"
                  style={{ fontFamily: 'Public Sans, sans-serif' }}
                >
                  {featured[0].name}
                </p>
                <p className="text-white/70 text-xs mt-0.5">{featured[0].category}</p>
              </div>
            </button>
            {/* Two smaller cards */}
            {featured.slice(1, 3).map(place => (
              <button
                key={place.id}
                onClick={() => onPlaceSelect(place)}
                className="relative overflow-hidden rounded-lg"
                style={{ height: '128px' }}
              >
                <ImageWithFallback
                  src={place.image}
                  alt={place.name}
                  className="w-full h-full object-cover"
                  gradient={'var(--brand-gradient)'}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {checkedIn.has(place.id) && (
                  <div className="absolute top-2 right-2">
                    <span className="text-white text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(160,59,0,0.85)' }}>✓</span>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 text-left">
                  <p
                    className="text-white font-black text-sm leading-tight"
                    style={{ fontFamily: 'Public Sans, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
                  >
                    {place.name}
                  </p>
                  <p className="text-white/60 text-xs">{place.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Near You */}
      {!hidden.includes('nearYou') && coords && nearbyPlaces.length > 0 && (
        <div className="py-4">
          <div className="flex items-center justify-between px-5 py-3 mb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <h2
              className="text-sm font-black uppercase"
              style={{ fontFamily: 'Public Sans, sans-serif' }}
            >
              Near You
            </h2>
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>my_location</span>
              Live location
            </span>
          </div>
          <div className="flex gap-3 px-5 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {[...nearbyPlaces].sort((a, b) => (placeMatchesInterests(b.place.category, interests) ? 1 : 0) - (placeMatchesInterests(a.place.category, interests) ? 1 : 0)).map(({ place, dist }) => (
              <button
                key={place.id}
                onClick={() => onPlaceSelect(place)}
                className="flex-shrink-0 bg-white overflow-hidden text-left"
                style={{ width: '144px', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', borderRadius: '10px' }}
              >
                <div className="relative" style={{ height: '100px' }}>
                  <ImageWithFallback
                    src={place.image}
                    alt={place.name}
                    className="w-full h-full object-cover"
                    gradient={'var(--brand-gradient)'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <span
                      className="text-xs font-bold text-white px-1.5 py-0.5 flex items-center gap-0.5"
                      style={{ background: 'rgba(0,0,0,0.45)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>near_me</span>
                      {formatDist(dist)}
                    </span>
                  </div>
                  {checkedIn.has(place.id) && (
                    <div className="absolute top-2 right-2">
                      <span className="text-white text-xs px-1.5 py-0.5" style={{ background: 'rgba(160,59,0,0.85)' }}>✓</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p
                    className="text-xs font-bold text-gray-900 leading-tight truncate"
                    style={{ fontFamily: 'Public Sans, sans-serif' }}
                  >
                    {place.name}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>{place.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Gems */}
      {!hidden.includes('hiddenGems') && hiddenGems.length > 0 && (
        <div className="py-4">
          <div className="flex items-center justify-between px-5 py-3 mb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <h2
              className="text-sm font-black uppercase"
              style={{ fontFamily: 'Public Sans, sans-serif' }}
            >
              Hidden Gems
            </h2>
            <span className="text-xs font-black uppercase" style={{ color: '#666', fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.08em' }}>
              ★ 4.5+ rated
            </span>
          </div>
          <div className="flex gap-3 px-5 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {sortByInterests(hiddenGems, interests).map(place => (
              <button
                key={place.id}
                onClick={() => onPlaceSelect(place)}
                className="flex-shrink-0 bg-white overflow-hidden text-left"
                style={{ width: '144px', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', borderRadius: '10px' }}
              >
                <div className="relative" style={{ height: '100px' }}>
                  <ImageWithFallback
                    src={place.image}
                    alt={place.name}
                    className="w-full h-full object-cover"
                    gradient={'var(--brand-gradient)'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {place.rating && (
                    <div className="absolute bottom-2 left-2">
                      <span
                        className="text-xs font-bold text-white px-1.5 py-0.5"
                        style={{ background: 'rgba(0,0,0,0.4)' }}
                      >
                        ★ {place.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {checkedIn.has(place.id) && (
                    <div className="absolute top-2 right-2">
                      <span className="text-white text-xs px-1.5 py-0.5" style={{ background: 'rgba(160,59,0,0.85)' }}>✓</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p
                    className="text-xs font-bold text-gray-900 leading-tight truncate"
                    style={{ fontFamily: 'Public Sans, sans-serif' }}
                  >
                    {place.name}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>{place.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ABQ Neighborhoods */}
      {!hidden.includes('neighborhoods') && <div className="mb-5 px-5">
        <p className="text-xs font-black uppercase flex items-center gap-2 mb-3" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--brand)', fontVariationSettings: "'FILL' 1" }}>location_city</span>
          Neighborhoods
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', animation: 'neighborhoodFloat 5s ease-in-out infinite' }}>
          {[
            { name: 'Old Town', icon: 'account_balance', accent: 'var(--brand)' },
            { name: 'Nob Hill', icon: 'local_cafe', accent: '#6B8F71' },
            { name: 'Downtown', icon: 'nightlife', accent: 'var(--ink)' },
            { name: 'Rio Grande', icon: 'nature', accent: '#5B7FA5' },
            { name: 'NE Heights', icon: 'landscape', accent: '#C8963E' },
            { name: 'South Valley', icon: 'storefront', accent: '#8B6B8A' },
          ].map(({ name, icon, accent }) => (
            <button key={name}
              className="flex items-center justify-center gap-1.5 transition-all active:scale-95"
              style={{
                padding: '8px 10px',
                borderRadius: 20,
                border: '1.5px solid rgba(0,0,0,0.10)',
                background: 'white',
                cursor: 'pointer',
                fontFamily: 'Public Sans, sans-serif',
                width: '100%',
              }}
              onClick={() => onNavigatePlaces?.('All', name)}>
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: accent, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>{icon}</span>
              <span className="font-bold" style={{ fontSize: '11px', color: 'var(--ink)', letterSpacing: '0.01em' }}>{name}</span>
            </button>
          ))}
        </div>
      </div>}

      {/* Did You Know - animated rotating card */}
      <AnimatedFact />

      {/* Weekend Planner */}
      {!hidden.includes('planWeekend') && (() => {
        const [open, setOpen] = React.useState(false);
        return (
        <div className="mx-5 mb-6" style={{ border: '1px solid rgba(0,0,0,0.10)', borderRadius: 8, background: 'white', overflow: 'hidden' }}>
          <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="text-xs font-black uppercase flex items-center gap-2" style={{ fontFamily: 'Public Sans, sans-serif', letterSpacing: '0.1em', color: 'var(--ink)' }}>
              <FlatIcon name="sun" size={13} color="var(--brand)" /> Need help planning?
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--ink)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
          </button>
          {open && (
          <div className="flex flex-col gap-1.5 px-3 pb-3" style={{ animation: 'cardFadeIn 0.25s ease both' }}>
            {[
              { title: 'Morning Hike + Brunch', steps: ['Sandia Mountain foothills trail', 'Coffee at Flying Star Café', 'Brunch in Nob Hill'] },
              { title: 'Culture Day', steps: ['Explora Science Center', 'Lunch in Old Town', 'Albuquerque Museum'] },
              { title: 'Local Food Crawl', steps: ['Green chile breakfast at Frontier', 'Lunch at El Modelo', 'Drinks on Central Ave'] },
              { title: 'Nature Escape', steps: ['Rio Grande Bosque trail', 'Tingley Beach', 'Sunset at Petroglyph Monument'] },
            ].map(({ title, steps }) => (
              <div key={title} className="flex" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, backgroundColor: 'var(--bg)' }}>
                <div style={{ width: 3, flexShrink: 0, backgroundColor: 'var(--brand)', borderRadius: '6px 0 0 6px' }} />
                <div className="flex-1 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>{title}</p>
                    <button onClick={() => addToDayPlan(steps)} className="text-xs font-bold px-2 py-0.5" style={{ backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: 4, fontFamily: 'Public Sans, sans-serif', fontSize: '9px' }}>+ ADD</button>
                  </div>
                  <p className="text-xs" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', lineHeight: 1.3 }}>{steps.join(' → ')}</p>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        );
      })()}

      {/* Day Planner */}
      {!hidden.includes('todayPlan') && <DayPlanner />}

      {/* Wishlist */}
      {!hidden.includes('wishlist') && <MyWishlist />}

      {/* Ko-fi support banner */}
      <KoFiBanner />

      {/* Why Unplug */}
      <WhyUnplugCard />
    </div>
  );
}

// ─── Events Screen ────────────────────────────────────────────────────────────

function EventsScreen({
  events,
  onEventSelect,
  initialSearch = '',
  initialGenre = '',
}: {
  events: TMEvent[];
  onEventSelect: (e: TMEvent) => void;
  initialSearch?: string;
  initialGenre?: string;
}) {
  const eventsHero = useTypewriter("What's Happening", 300);
  const [search, setSearch] = useState('');
  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre || 'Tonight');
  // Reset genre when initialGenre changes (e.g. from "Free Events" chip)
  useEffect(() => { if (initialGenre) setSelectedGenre(initialGenre); }, [initialGenre]);
  const [followedGenres, setFollowedGenres] = useState<string[]>(() => getFollowedGenres());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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
    const satOffset = (6 - nowDay + 7) % 7 || 7;
    const sunOffset = (7 - nowDay) % 7;
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
      result = result.filter(e => {
        const eName    = e.name.toLowerCase();
        const eVenue   = (e._embedded?.venues?.[0]?.name || '').toLowerCase();
        const eInfo    = (e.info || '').toLowerCase();
        const eDesc    = (e.description || '').toLowerCase();
        const eSeg     = (e.classifications?.[0]?.segment?.name || '').toLowerCase();
        const eGenre   = (e.classifications?.[0]?.genre?.name || '').toLowerCase();
        const eSubGenre = (e.classifications?.[0]?.subGenre?.name || '').toLowerCase();
        return eName.includes(q) || eVenue.includes(q) || eInfo.includes(q) ||
          eDesc.includes(q) || eSeg.includes(q) || eGenre.includes(q) || eSubGenre.includes(q);
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
      const matchesAny = (e: TMEvent) => followedGenres.some(g => {
        const seg = e.classifications?.[0]?.segment?.name || '';
        const gen = e.classifications?.[0]?.genre?.name || '';
        const name = e.name.toLowerCase();
        switch (g) {
          case 'Music':    return seg === 'Music' || seg === 'Live Music';
          case 'Sports':   return seg === 'Sports';
          case 'Comedy':   return seg === 'Comedy' || seg === 'Theater & Comedy' || name.includes('comedy') || name.includes('stand-up');
          case 'Arts':     return seg === 'Arts & Theatre' || seg === 'Arts & Culture' || name.includes('art') || name.includes('gallery') || name.includes('museum');
          case 'Family':   return seg === 'Family' || name.includes('family') || name.includes(' kids') || name.includes('children');
          case 'Outdoor':  return name.includes('outdoor') || name.includes('trail') || name.includes('hike') || name.includes('5k') || name.includes('bike');
          case 'Community':return seg === 'Community' || seg === 'Festival' || name.includes('festival') || name.includes('market') || name.includes('fiesta');
          case 'Free':     return getEventPrice(e) === 'FREE' || name.includes('free') || name.includes('no cover') || name.includes('market') || name.includes('festival');
          default:         return seg === g || gen === g;
        }
      });
      return result.filter(matchesAny);
    }
    if (selectedGenre !== 'All') {
      result = result.filter(e => {
        const seg = e.classifications?.[0]?.segment?.name || '';
        const gen = e.classifications?.[0]?.genre?.name || '';
        const eventName = e.name.toLowerCase();
        const venueName = (e._embedded?.venues?.[0]?.name || '').toLowerCase();
        switch (selectedGenre) {
          case 'Music':
            return seg === 'Music' || seg === 'Live Music' || gen === 'Live Music' || gen === 'Music';
          case 'Sports':
            return seg === 'Sports' || gen === 'Sports';
          case 'Comedy':
            return seg === 'Comedy' || gen === 'Comedy' || seg === 'Theater & Comedy' ||
              eventName.includes('comedy') || eventName.includes('stand-up') || eventName.includes('standup');
          case 'Arts':
            return seg === 'Arts & Theatre' || seg === 'Arts & Culture' || gen === 'Arts & Culture' ||
              seg === 'Film' || gen === 'Theatre' || eventName.includes('art') || eventName.includes('gallery') ||
              eventName.includes('museum') || eventName.includes('theater') || eventName.includes('theatre');
          case 'Family':
            return seg === 'Family' || gen === 'Family' ||
              eventName.includes('family') || eventName.includes(' kids') || eventName.includes('for kids') ||
              eventName.includes('children') || eventName.includes('youth') || eventName.includes('junior') ||
              eventName.includes('circus') || eventName.includes('carnival') || eventName.includes('puppet') ||
              eventName.includes('storytime') || eventName.includes('story time') || eventName.includes('disney') ||
              eventName.includes('sesame') || eventName.includes('paw patrol') || eventName.includes('pokemon');
          case 'Outdoor':
            return seg === 'Outdoor' ||
              eventName.includes('outdoor') || eventName.includes('trail') || eventName.includes('hike') ||
              eventName.includes('hiking') || eventName.includes(' run') || eventName.includes('5k') ||
              eventName.includes('10k') || eventName.includes('marathon') || eventName.includes('triathlon') ||
              eventName.includes('bike') || eventName.includes('cycling') || eventName.includes('kayak') ||
              eventName.includes('camp') || eventName.includes('nature walk') || eventName.includes('garden') ||
              eventName.includes('farm') || eventName.includes('amphitheater') || eventName.includes('amphitheatre') ||
              venueName.includes('park') || venueName.includes('amphitheater') || venueName.includes('amphitheatre') ||
              venueName.includes('outdoor') || venueName.includes('fairground') || venueName.includes('plaza');
          case 'Community':
            return seg === 'Community' || gen === 'Community' || seg === 'Festival' || gen === 'Festival' ||
              eventName.includes('festival') || eventName.includes('market') || eventName.includes('fair') ||
              eventName.includes('community') || eventName.includes('fiesta');
          case 'Free': {
            // Show events priced at $0, with free in name, or local/curated events (no priceRanges = free)
            const isFree =
              getEventPrice(e) === 'FREE' ||
              eventName.includes('free') || eventName.includes('no cover') || eventName.includes('no charge') ||
              eventName.includes('market') || eventName.includes('festival') ||
              seg === 'Community' || seg === 'Festival';
            return isFree;
          }
          default:
            return seg === selectedGenre || gen === selectedGenre;
        }
      });
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
  }, [events, selectedGenre, search, dateFrom, dateTo]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const da = a.dates?.start?.localDate || '9999';
        const db = b.dates?.start?.localDate || '9999';
        return da.localeCompare(db);
      }),
    [filtered]
  );

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
      // Hide events with no real photos — they look broken in the feed
      // Only count non-fallback images with actual URLs
      const imgs = e.images ?? [];
      const realPhotos = imgs.filter(img => !img.fallback && img.url && img.url.length > 10);
      if (realPhotos.length === 0) return false;
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
      <div className="px-5 pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
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
          {events.length.toLocaleString()} things to do in Greater ABQ
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
        {showDatePicker && (
          <div className="flex items-center gap-2 mt-2" style={{ animation: 'cardFadeIn 0.2s ease both' }}>
            <div className="flex-1 flex items-center gap-1.5 bg-white px-3 py-2" style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6 }}>
              <span className="text-xs font-semibold" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', whiteSpace: 'nowrap' }}>From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 bg-transparent outline-none text-xs text-gray-800"
                style={{ fontFamily: 'Public Sans, sans-serif', colorScheme: 'light' }} />
            </div>
            <div className="flex-1 flex items-center gap-1.5 bg-white px-3 py-2" style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6 }}>
              <span className="text-xs font-semibold" style={{ color: '#888', fontFamily: 'Public Sans, sans-serif', whiteSpace: 'nowrap' }}>To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                min={dateFrom || new Date().toISOString().split('T')[0]}
                className="flex-1 bg-transparent outline-none text-xs text-gray-800"
                style={{ fontFamily: 'Public Sans, sans-serif', colorScheme: 'light' }} />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '6px' }}>
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex px-5 overflow-x-auto" style={{ scrollbarWidth: 'none', position: 'sticky', top: 'calc(var(--sat) + 58px)', zIndex: 30, background: 'white', paddingTop: '12px', paddingBottom: '0px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {EVENT_GENRES.map(genre => {
          const isForYou = genre === '❤️ For You';
          const isSelected = selectedGenre === genre;
          const isFollowed = !isForYou && followedGenres.includes(genre);
          return (
            <div key={genre} className="flex-shrink-0 flex items-stretch" style={{ marginRight: '-1.5px', position: 'relative', zIndex: isSelected ? 1 : 0, marginBottom: '12px' }}>
              <button
                onClick={() => setSelectedGenre(genre)}
                className="px-3 py-2 text-xs font-black uppercase transition-all"
                style={{
                  fontFamily: 'Public Sans, sans-serif',
                  letterSpacing: '0.1em',
                  background: isSelected ? 'var(--ink)' : isForYou && followedGenres.length > 0 ? 'var(--brand-bg-subtle)' : 'white',
                  color: isSelected ? 'white' : 'var(--ink)',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRight: 'none',
                  borderRadius: 6,
                }}
              >
                {genre}
              </button>
              {/* Star toggle — shown on genre chips only (not date chips or All/For You) */}
              {!isForYou && genre !== 'All' && genre !== 'Tonight' && genre !== 'This Weekend' && (
                <button
                  onClick={() => toggleFollowGenre(genre)}
                  title={isFollowed ? `Remove ${genre} from For You` : `Add ${genre} to For You`}
                  style={{
                    background: isSelected ? '#333' : isFollowed ? 'var(--brand)' : '#f5f5f5',
                    color: isFollowed || isSelected ? 'white' : '#999',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderLeft: 'none',
                    borderRadius: 6,
                    padding: '0 6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {isFollowed ? '★' : '☆'}
                </button>
              )}
            </div>
          );
        })}
      </div>
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
            {selectedGenre !== 'All'
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
      {selectedGenre === '❤️ For You' && followedGenres.length === 0 && (
        <div className="px-5 py-4 flex items-start gap-3" style={{ background: 'var(--brand-bg-subtle)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>❤️</span>
          <div>
            <p className="text-sm font-black" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>Personalize your feed</p>
            <p className="text-xs mt-0.5" style={{ fontFamily: 'Public Sans, sans-serif', color: '#555' }}>
              Tap the <strong>☆</strong> star next to any genre above to add it to your <em>For You</em> feed. Starred genres are highlighted.
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
          {(selectedGenre !== 'All' || search) && (
            <button
              onClick={() => { setSelectedGenre('All'); setSearch(''); }}
              className="ml-2 text-xs font-bold"
              style={{ color: 'var(--brand)' }}
            >
              Clear filters
            </button>
          )}
        </p>
      </div>

      <div className="px-5 pb-28 flex flex-col gap-3">
        {deduped.map(event => {
          const count = getShowtimeCount(event);
          return (
            <div key={event.id} style={{position:'relative'}}>
              <EventCard event={event} onClick={() => onEventSelect(event)} />
              {/* Showtime count badge — only shown when > 1 showtime was collapsed */}
              {count > 1 && (
                <div
                  style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.55)', color:'white', fontSize:'9px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', padding:'2px 7px', borderRadius:4, pointerEvents:'none' }}
                >
                  {count} showtimes
                </div>
              )}
              <LikeButton id={event.id} type="event" name={event.name} category="event" />
            </div>
          );
        })}
        {deduped.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>event_busy</span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Public Sans, sans-serif' }}>No events found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Places Screen ────────────────────────────────────────────────────────────

function PlacesScreen({
  places, onPlaceSelect, coords, geoRequested, geoSilentPending = false, geoError, onRequestGeo,
  checkedIn, onCheckIn, tooFarPlaceId,
  navKey = 0, navCat = 'All', navSearch = '', navVibe = '',
}: {
  places: Place[];
  onPlaceSelect: (p: Place) => void;
  coords: GeoCoords | null;
  geoRequested: boolean;
  geoSilentPending?: boolean;
  geoError: string | null;
  onRequestGeo: () => void;
  checkedIn: Set<string>;
  onCheckIn: (id: string) => void;
  tooFarPlaceId?: string | null;
  navKey?: number;
  navCat?: string;
  navSearch?: string;
  navVibe?: string;
}) {
  const placesHero = useTypewriter('Places to Go', 300);
  const PAGE_SIZE = 48;
  const [selectedCat, setSelectedCat] = useState('All');
  const [activeVibe, setActiveVibe] = useState('');
  const [openNow, setOpenNow] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortMode, setSortMode] = useState<'top' | 'near' | 'az'>('top');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Tracks whether the user tapped "Near Me" before location was available,
  // so we can auto-activate the near sort once coords arrive (no second tap).
  const pendingNearSort = useRef(false);
  const [wishlistVersion, setWishlistVersion] = useState(0);
  useEffect(() => {
    const handler = () => setWishlistVersion(v => v + 1);
    window.addEventListener('abq_wishlist_changed', handler);
    return () => window.removeEventListener('abq_wishlist_changed', handler);
  }, []);

  // Server-side search results (full-text + fuzzy from Supabase)
  const [serverResults, setServerResults] = useState<Place[]>([]);
  const serverSearchRef = useRef('');

  // Debounce search input by 250ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fire server-side search when debounced query changes (2+ chars)
  useEffect(() => {
    if (search.trim().length < 2) { setServerResults([]); return; }
    const q = search.trim();
    if (q === serverSearchRef.current) return;
    serverSearchRef.current = q;
    let cancelled = false;
    searchPlacesFromDB(q, 80).then(results => {
      if (cancelled) return;
      setServerResults(results as Place[]);
    });
    return () => { cancelled = true; };
  }, [search]);

  useEffect(() => { if (navKey > 0) { setSelectedCat(navCat || 'All'); setOpenNow(false); setSearchInput(navSearch || ''); setSearch(navSearch || ''); setActiveVibe(navVibe || ''); } }, [navKey]);

  // Auto-activate Near Me sort as soon as coords become available
  // (fires when pendingNearSort was set because the user tapped before geo was ready)
  useEffect(() => {
    if (pendingNearSort.current && coords) {
      setSortMode('near');
      pendingNearSort.current = false;
    }
  }, [coords]);

  // Reset pagination when filters change
  useEffect(() => { setDisplayCount(PAGE_SIZE); }, [selectedCat, search, sortMode]);

  // ── ABQ metro filter for places ───────────────────────────────────────────
  // Google Places addresses look like: "123 Main St, Albuquerque, NM 87106, USA"
  // The city segment is typically the part between the first and second commas.
  // We keep places whose city is in the greater ABQ metro, plus any place with
  // no address at all (manual/admin entries may omit it).
  const PLACE_METRO_CITIES = new Set([
    'albuquerque', 'rio rancho', 'corrales', 'bernalillo', 'placitas',
    'edgewood', 'tijeras', 'cedar crest', 'sandia park', 'los lunas',
    'belen', 'bosque farms', 'moriarty', 'estancia', 'mountainair',
    'peralta', 'isleta', 'paradise hills', 'kirtland', 'south valley',
    'north valley', 'west mesa',
  ]);
  const isPlaceInMetro = (p: Place): boolean => {
    if (!p.address) return true; // no address info → keep
    // Extract city: second comma-separated segment, strip zip/state noise
    const parts = p.address.split(',');
    if (parts.length < 2) return true; // can't determine city → keep
    const city = parts[1].trim().toLowerCase().replace(/\s+nm.*$/i, '').trim();
    return PLACE_METRO_CITIES.has(city);
  };

  const NEIGHBORHOOD_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
    'NE Heights':   { minLat: 35.067, maxLat: 35.220, minLng: -106.652, maxLng: -106.465 },
    'Old Town':     { minLat: 35.088, maxLat: 35.108, minLng: -106.682, maxLng: -106.655 },
    'Nob Hill':     { minLat: 35.073, maxLat: 35.092, minLng: -106.640, maxLng: -106.595 },
    'Downtown':     { minLat: 35.070, maxLat: 35.098, minLng: -106.665, maxLng: -106.635 },
    'Rio Grande':   { minLat: 35.020, maxLat: 35.220, minLng: -106.745, maxLng: -106.660 },
    'South Valley': { minLat: 34.960, maxLat: 35.068, minLng: -106.740, maxLng: -106.620 },
  };

  // Basic "Open Now" check using hours string from place data
  const isOpenNow = (hours?: string): boolean => {
    if (!hours) return false;
    const h = hours.toLowerCase();
    if (h.includes('24 hour') || h.includes('open 24') || h.includes('always open')) return true;
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon,...,6=Sat
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayFull = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayShort = dayNames[day];
    const todayFull = dayFull[day];
    // Find segments that mention today
    const segments = h.split(/[;,]/);
    for (const seg of segments) {
      if (!seg.includes(todayShort) && !seg.includes(todayFull)) continue;
      // Try to extract time range like "8am-9pm", "8:00am-9:00pm", "8:00-21:00"
      const timeRange = seg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!timeRange) continue;
      const toMins = (h: string, m: string, ampm: string): number => {
        let hours = parseInt(h, 10);
        const mins = m ? parseInt(m, 10) : 0;
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        return hours * 60 + mins;
      };
      const openMins = toMins(timeRange[1], timeRange[2], (timeRange[3] || '').toLowerCase());
      const closeMins = toMins(timeRange[4], timeRange[5], (timeRange[6] || '').toLowerCase());
      if (currentMins >= openMins && currentMins <= closeMins) return true;
    }
    return false;
  };

  const filtered = useMemo(() => {
    let result = places.filter(isPlaceInMetro);
    // Open Now filter
    if (openNow) result = result.filter(p => isOpenNow(p.hours));
    // When a search query is active it overrides the category filter so users
    // always search across ALL places — preventing the confusing "0 results"
    // you get when a category is locked and the search term doesn't match it.
    const searchActive = search.trim().length > 0;
    if (selectedCat !== 'All' && !searchActive) {
      const cats = selectedCat.includes('|') ? selectedCat.split('|') : [selectedCat];
      result = result.filter(p => cats.includes(p.category));
    }
    if (searchActive) {
      const neighborhoodBounds = NEIGHBORHOOD_BOUNDS[search.trim()];
      if (neighborhoodBounds) {
        // Geographic bounding box filter for neighborhood selectors
        result = result.filter(p => {
          if (p.lat == null || p.lng == null) return false;
          return (
            p.lat >= neighborhoodBounds.minLat &&
            p.lat <= neighborhoodBounds.maxLat &&
            p.lng >= neighborhoodBounds.minLng &&
            p.lng <= neighborhoodBounds.maxLng
          );
        });
      } else {
        const q = search.toLowerCase().trim();

        // Tier 1: CATEGORY_SYNONYMS → expand to full category (e.g. "shopping" → all shops)
        const synonymCats = new Set<string>();
        const synKeys = Object.keys(CATEGORY_SYNONYMS);
        for (let ai = 0; ai < synKeys.length; ai++) {
          const term = synKeys[ai];
          const termCats = CATEGORY_SYNONYMS[term];
          if (q === term || q.includes(term) || term.includes(q)) {
            for (let ci = 0; ci < termCats.length; ci++) synonymCats.add(termCats[ci]);
          }
        }
        // Also match category labels directly (e.g. "restaurants" → restaurant category)
        for (let pi = 0; pi < PLACE_CATEGORIES.length; pi++) {
          const pc = PLACE_CATEGORIES[pi];
          if (pc.value !== 'All' && (pc.label.toLowerCase().includes(q) || q.includes(pc.value))) {
            synonymCats.add(pc.value);
          }
        }

        // Tier 2: SEARCH_BOOSTS → cross-category hints (e.g. "brunch" → restaurant + coffee)
        const boostCats = new Set<string>();
        const boostKeys = Object.keys(SEARCH_BOOSTS);
        for (let bi = 0; bi < boostKeys.length; bi++) {
          const term = boostKeys[bi];
          const termCats = SEARCH_BOOSTS[term];
          if (q === term || q.includes(term) || term.includes(q)) {
            for (let ci = 0; ci < termCats.length; ci++) boostCats.add(termCats[ci]);
          }
        }

        result = result.filter(p => {
          const pName  = p.name.toLowerCase();
          const pAddr  = (p.address || '').toLowerCase();
          const pCat   = (p.category || '').toLowerCase();
          const pDesc  = (p.description || '').toLowerCase();
          const pAbout = ((p as any).about || '').toLowerCase();
          const pTip   = ((p as any).insiderTip || '').toLowerCase();
          const pBestFor = (((p as any).bestFor || []) as string[]).join(' ').toLowerCase();
          const pTags  = ((p.tags || []) as string[]).join(' ').toLowerCase();
          const pGTypes = ((p.googleTypes || []) as string[]).map(t => t.replace(/_/g, ' ')).join(' ').toLowerCase();
          const allText = `${pName} ${pAddr} ${pCat} ${pDesc} ${pAbout} ${pTip} ${pBestFor} ${pTags} ${pGTypes}`;

          // 1. Direct text match across all fields (always wins)
          if (allText.includes(q)) return true;
          // 2. Category synonym → full category expansion (generic shopping terms etc.)
          if (synonymCats.size > 0 && synonymCats.has(p.category)) return true;
          // 3. Boost categories → include if the place's category matches a boost
          //    (cross-category discovery like "brunch" finding coffee shops)
          if (boostCats.size > 0 && boostCats.has(p.category)) return true;
          return false;
        });

        // Merge server-side search results (full-text + fuzzy from Postgres)
        // Server results are pre-ranked by relevance, so prepend them
        if (serverResults.length > 0) {
          const clientIds = new Set(result.map(p => p.id));
          const extraFromServer = serverResults.filter(p => !clientIds.has(p.id));
          result = [...result, ...extraFromServer];
        }

        // Sort: name-starts-with first, then name-contains, then rating
        result = [...result].sort((a, b) => {
          const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
          const aScore = an.startsWith(q) ? 2 : an.includes(q) ? 1 : 0;
          const bScore = bn.startsWith(q) ? 2 : bn.includes(q) ? 1 : 0;
          if (aScore !== bScore) return bScore - aScore;
          return (b.rating || 0) - (a.rating || 0);
        });
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selectedCat, search, openNow, serverResults]);

  const sorted = useMemo(() => {
    if (sortMode === 'near' && coords) {
      return [...filtered]
        .filter(p => p.lat != null && p.lng != null)
        .sort((a, b) => {
          const da = distanceMiles(coords.lat, coords.lng, a.lat!, a.lng!);
          const db = distanceMiles(coords.lat, coords.lng, b.lat!, b.lng!);
          return da - db;
        });
    }
    if (sortMode === 'az') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...filtered].sort((a, b) => {
      const ra = a.rating || 0;
      const rb = b.rating || 0;
      if (rb !== ra) return rb - ra;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    });
  }, [filtered, sortMode, coords]);

  // Only compute distances when in 'near' mode or when coords arrive
  const distMap = useMemo(() => {
    if (!coords) return new Map<string, number>();
    const m = new Map<string, number>();
    // Only compute for the visible slice to keep it cheap
    sorted.slice(0, displayCount + PAGE_SIZE).forEach(p => {
      if (p.lat != null && p.lng != null) {
        m.set(p.id, distanceMiles(coords.lat, coords.lng, p.lat, p.lng));
      }
    });
    return m;
  }, [sorted, coords, displayCount]);

  // Infinite scroll: load more when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setDisplayCount(c => c + PAGE_SIZE);
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [sorted]);

  // Only show places that have a real photo — no gradient placeholders in the grid
  const withPhotos = sorted.filter(p => !!p.image);
  const visiblePlaces = withPhotos.slice(0, displayCount);

  return (
    <div className="w-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', willChange: 'transform' } as React.CSSProperties}>
      {activeVibe ? (() => {
        const [vibeLabel, vibeGrad] = activeVibe.split('|||');
        return (
          <div className="px-5 pt-5 pb-4" style={{ background: vibeGrad || 'var(--brand)', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Public Sans, sans-serif' }}>
                  Vibe Mode
                </p>
                <h1 className="font-black leading-none mt-1" style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '36px', letterSpacing: '-0.04em', color: 'white' }}>
                  {vibeLabel}
                </h1>
                <p className="text-sm mt-1" style={{ fontFamily: 'Public Sans, sans-serif', color: 'rgba(255,255,255,0.85)' }}>
                  {filtered.length} spot{filtered.length !== 1 ? 's' : ''} curated for you
                </p>
              </div>
              <button
                onClick={() => { setActiveVibe(''); setSelectedCat('All'); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, fontFamily: 'Public Sans, sans-serif', backdropFilter: 'blur(8px)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                Exit
              </button>
            </div>
          </div>
        );
      })() : (
      <div className="px-5 pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}
        >
          <span className="flex items-center gap-1.5"><FlatIcon name="cactus" size={11} color="var(--brand)" /> Explore Greater ABQ</span>
        </p>
        <h1
          className="font-black leading-none mt-1"
          style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '40px', letterSpacing: '-0.04em', color: 'var(--ink)', minHeight: '48px' }}
        >
          {placesHero.display}{!placesHero.done && <span style={{ display: 'inline-block', width: '3px', height: '0.85em', background: 'var(--ink)', marginLeft: '2px', verticalAlign: 'baseline', animation: 'cursorBlink 0.8s step-end infinite' }} />}
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          {search.trim() && NEIGHBORHOOD_BOUNDS[search.trim()]
            ? `${filtered.length} spot${filtered.length !== 1 ? 's' : ''} in ${search.trim()}`
            : `${places.length.toLocaleString()} spots across Greater ABQ`}
        </p>
      </div>
      )}

      {/* Geo banner if no location yet */}
      <GeoBanner
        coords={coords}
        error={geoError}
        requested={geoRequested}
        silentPending={geoSilentPending}
        onRequest={onRequestGeo}
      />

      {/* Search */}
      <div className="px-5 pb-3">
        <div
          className="flex items-center gap-2 bg-white px-4 py-3"
          style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search places, neighborhoods..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Search-scope badge: shown when a category is active AND a search is typed.
          Lets the user know search is now global (overrides category), and offers
          a one-tap way to jump back into the category they had selected. */}
      {search.trim() && selectedCat !== 'All' && (
        <div className="flex items-center gap-2 px-5 pb-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          <span className="text-xs text-gray-500">Searching all places · was in:</span>
          <button
            onClick={() => { setSearchInput(''); setSearch(''); }}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-black uppercase"
            style={{ background: 'var(--brand)', color: '#fff', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', letterSpacing: '0.08em' }}
          >
            {selectedCat.includes('|') ? `${selectedCat.split('|').length} categories` : selectedCat} <span style={{ fontSize: '14px', lineHeight: 1 }}>×</span>
          </button>
        </div>
      )}

      {/* Open Now chip + Category pills */}
      <div className="flex px-5 pb-0 overflow-x-auto" style={{ scrollbarWidth: 'none', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '12px', paddingTop: '12px' }}>
        {/* Open Now toggle — always first */}
        <button
          onClick={() => setOpenNow(v => !v)}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-black uppercase transition-all"
          style={{
            fontFamily: 'Public Sans, sans-serif',
            letterSpacing: '0.1em',
            background: openNow ? 'var(--brand)' : 'white',
            color: openNow ? 'white' : 'var(--ink)',
            border: '1px solid rgba(0,0,0,0.12)',
            marginRight: '-1.5px',
            borderRadius: 6,
            position: 'relative',
            zIndex: openNow ? 1 : 0,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: openNow ? 'var(--brand)' : '#4caf50', display: 'inline-block', marginRight: 2, flexShrink: 0 }} />
          Open Now
        </button>
        {(() => {
          // When a vibe is active, only show category pills relevant to that vibe
          const vibeLabel = activeVibe ? activeVibe.split('|||')[0] : '';
          const vibeConfig = vibeLabel ? VIBE_CONFIGS.find(v => v.label === vibeLabel) : null;
          const visibleCats = vibeConfig
            ? PLACE_CATEGORIES.filter(c => c.value === 'All' || vibeConfig.vibeCats.includes(c.value))
            : PLACE_CATEGORIES;
          return visibleCats;
        })().map(cat => {
          // In vibe mode, don't highlight individual category chips — the vibe header already shows what's active
          const isActive = activeVibe ? cat.value === 'All' : (selectedCat === cat.value || (selectedCat.includes('|') && selectedCat.split('|').includes(cat.value)));
          return (
          <button
            key={cat.label}
            onClick={() => setSelectedCat(cat.value)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-black uppercase transition-all"
            style={{
              fontFamily: 'Public Sans, sans-serif',
              letterSpacing: '0.1em',
              background: isActive ? 'var(--ink)' : 'white',
              color: isActive ? 'white' : 'var(--ink)',
              border: '1px solid rgba(0,0,0,0.12)',
              marginRight: '-1.5px',
              borderRadius: 6,
              position: 'relative',
              zIndex: isActive ? 1 : 0,
            }}
          >
            <FlatIcon name={cat.icon} size={13} color={isActive ? 'white' : 'var(--ink)'} />
            <span>{cat.label}</span>
          </button>
          );
        })}
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 px-5 pb-4 pt-3">
        {([
          { id: 'top', label: 'Top Rated' },
          { id: 'near', label: 'Near Me', disabled: !coords },
          { id: 'az', label: 'A–Z' },
        ] as const).map(s => (
          <button
            key={s.id}
            onClick={() => { if (s.disabled) { pendingNearSort.current = true; onRequestGeo(); } else { setSortMode(s.id); } }}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-black uppercase transition-all"
            title={s.disabled ? 'Enable location to sort by distance' : undefined}
            style={{
              fontFamily: 'Public Sans, sans-serif',
              letterSpacing: '0.08em',
              background: sortMode === s.id ? 'var(--ink)' : 'white',
              color: sortMode === s.id ? 'white' : s.disabled ? '#bbb' : 'var(--ink)',
              border: '1px solid rgba(0,0,0,0.12)',
              boxShadow: sortMode === s.id ? '4px 4px 0 var(--ink)' : '3px 3px 0 rgba(0,0,0,0.15)',
              borderRadius: 6,
              opacity: s.disabled ? 0.5 : 1,
            }}
          >
            {s.id === 'near' && !coords && (
              <span className="material-symbols-outlined mr-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>location_off</span>
            )}
            {s.label}
          </button>
        ))}
        <p className="ml-auto text-xs text-gray-400 self-center" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          {withPhotos.length} results
        </p>
      </div>

      {/* Grid */}
      <div className="px-5 pb-28">
        <div className="grid grid-cols-2 gap-3">
          {visiblePlaces.map(place => (
            <div key={place.id} style={{position:'relative'}}>
              <PlaceCard
                place={place}
                onClick={() => onPlaceSelect(place)}
                distance={distMap.get(place.id)}
                isCheckedIn={checkedIn.has(place.id)}
                tooFar={tooFarPlaceId === place.id}
                onCheckIn={e => { e.stopPropagation(); onCheckIn(place.id); }}
                />
              <LikeButton id={place.id} type="place" name={place.name} category={place.category} />
            </div>
          ))}
        </div>
        {/* Infinite scroll sentinel */}
        {displayCount < withPhotos.length && (
          <div ref={sentinelRef} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>
              Loading more…
            </span>
          </div>
        )}
        {withPhotos.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>search_off</span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Public Sans, sans-serif' }}>No places found</p>
            <button
              onClick={() => { setSelectedCat('All'); setSearchInput(''); setSearch(''); }}
              className="mt-3 text-xs font-bold"
              style={{ color: 'var(--brand)' }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
        const cred = await supabase.auth.signUp({ email: email, password: password, options: { captchaToken } });
        if (displayName) await supabase.auth.updateUser({ data: { display_name: displayName } });
      } else {
        await supabase.auth.signInWithPassword({ email: email, password: password, options: { captchaToken } });
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
          Sign in to sync your check-ins across devices and appear on the leaderboard.
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
function ProfileSettingsPane({ user, onUsernameChange, onSignIn }: { user: User | null; onUsernameChange?: (name: string) => void; onSignIn?: () => void }) {
  const [prefs, setPrefs] = useState<UserPrefs>(getPrefs);
  const [open, setOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState(
    user?.user_metadata?.display_name || user?.user_metadata?.full_name?.split(' ')[0] || ''
  );
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaved, setUsernameSaved] = useState(false);

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
const LEADERBOARD_SEEDS: { name: string; count: number }[] = [];

interface LeaderboardRow { rank: number; name: string; count: number; streak?: number; isMe: boolean; uid?: string; }

function ProfileScreen({
  checkedIn, user, onSignIn, onSignOut, places, onUsernameChange, onAdmin,
}: {
  checkedIn: Set<string>;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  places: Place[];
  onUsernameChange?: (name: string) => void;
  onAdmin?: () => void;
}) {
  const myCount = checkedIn.size;
  const myStreak = getStreak().count;
  const level = getLevel(myCount);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);

  // Subscribe to live leaderboard from Firestore
  useEffect(() => {
      let cancelled = false;
      _fbGetAllDocs('leaderboard', 'count', false).then(snap => {
        if (!cancelled) {
          const rows: LeaderboardRow[] = snap.docs.map((d, i) => ({
            rank: i + 1,
            name: (d.data().display_name as string) || (d.data().displayName as string) || 'Explorer',
            count: (d.data().count as number) || 0,
            streak: (d.data().streak as number) || 0,
            isMe: d.id === user?.id,
            uid: d.id,
          }));
          setLbRows(rows);
        }
      });
      return () => { cancelled = true; };
  }, [user?.id]);

  // Build leaderboard: if user signed in, they'll appear from Firestore; otherwise inject "You" locally
  const leaderboard = useMemo<LeaderboardRow[]>(() => {
    if (lbRows.length > 0) {
      // Use Firestore data; if user not in list, inject them
      const userInList = user && lbRows.some(r => r.isMe);
      if (!userInList && myCount > 0) {
        const merged = [...lbRows, { rank: 0, name: user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You', count: myCount, isMe: true }];
        merged.sort((a, b) => b.count - a.count);
        return merged.map((r, i) => ({ ...r, rank: i + 1 })).slice(0, 10);
      }
      return lbRows.slice(0, 10);
    }
    // No data yet — just show the current user if they have any check-ins
    if (myCount > 0) {
      return [{ rank: 1, name: user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You', count: myCount, isMe: true }];
    }
    return [];
  }, [lbRows, myCount, user]);

  const ACHIEVEMENTS = [
    { id: 'first',    icon: 'where_to_vote',          label: 'First Check-in',  sub: '1 place',        unlocked: myCount  >= 1  },
    { id: 'five',     icon: 'explore',                label: 'Explorer',        sub: '5 places',       unlocked: myCount  >= 5  },
    { id: 'ten',      icon: 'hiking',                 label: 'Adventurer',      sub: '10 places',      unlocked: myCount  >= 10 },
    { id: 'twenty',   icon: 'forest',                 label: 'Trailblazer',     sub: '20 places',      unlocked: myCount  >= 20 },
    { id: 'thirty5',  icon: 'footprint',              label: 'Pioneer',         sub: '35 places',      unlocked: myCount  >= 35 },
    { id: 'fifty',    icon: 'military_tech',          label: 'Legend',          sub: '50 places',      unlocked: myCount  >= 50 },
    { id: 'streak3',  icon: 'local_fire_department',  label: '3-Day Streak',    sub: '3 days running', unlocked: myStreak >= 3  },
    { id: 'streak7',  icon: 'whatshot',               label: 'Week Warrior',    sub: '7-day streak',   unlocked: myStreak >= 7  },
    { id: 'streak30', icon: 'emoji_events',           label: 'ABQ Regular',     sub: '30-day streak',  unlocked: myStreak >= 30 },
  ];

  const nextLevel = getLevel(myCount + 1);
  const progressPct = myCount === 0 ? 0 : Math.min(100, Math.round((myCount / level.next) * 100));

  return (
    <div className="w-full px-5 pb-28" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid var(--brand)', borderBottom: '1px solid rgba(0,0,0,0.08)', marginLeft: '-20px', marginRight: '-20px', paddingLeft: '20px', paddingRight: '20px' }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}
        >
          Your Profile
        </p>
        <h1
          className="font-black uppercase leading-none mt-1"
          style={{ fontFamily: 'Public Sans, sans-serif', fontSize: '48px', letterSpacing: '-0.04em', color: 'var(--ink)' }}
        >
          Hey,<br />{(user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Explorer').split(' ')[0]}
        </h1>
      </div>

      {/* Sign in / out banner */}
      {!user ? (
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-between rounded-lg px-4 py-3 mb-4 text-white font-bold text-sm"
          style={{ background: 'var(--brand-gradient)', fontFamily: 'Public Sans, sans-serif', boxShadow: '0 2px 8px rgba(185,92,67,0.20)' }}
        >
          <span>Sign in to sync check-ins & join the leaderboard</span>
          <span style={{ fontSize: '16px' }}>→</span>
        </button>
      ) : (
        <div
          className="w-full flex items-center justify-between rounded-lg px-4 py-3 mb-4"
          style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', fontFamily: 'Public Sans, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
        >
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>✅ Signed in & syncing your check-ins</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--brand)' }}>Check out the leaderboard below</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-xs font-bold flex-shrink-0 ml-3"
            style={{ fontFamily: 'Public Sans, sans-serif', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
          >
            Sign out
          </button>
        </div>
      )}

      {/* Admin panel shortcut — top of profile, immediately visible to admin */}
      {onAdmin && (
        <button
          onClick={onAdmin}
          style={{
            width: '100%',
            padding: '14px',
            background: '#000',
            color: '#fff',
            border: '2px solid #000',
            borderRadius: 6,
            fontFamily: 'Public Sans, sans-serif',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
          Admin Panel
        </button>
      )}

      {/* Customize Settings */}
      <ProfileSettingsPane user={user} onUsernameChange={onUsernameChange} onSignIn={onSignIn} />

      {/* Profile card */}
      <div
        className="flex items-center gap-4 bg-white rounded-lg p-4 mb-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: 'var(--brand-gradient)' }}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-2xl font-black" style={{ fontFamily: 'Public Sans, sans-serif' }}>
              {level.emoji}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            {user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ABQ Explorer'}
          </p>
          <p className="text-sm text-gray-500">Greater ABQ Metro</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--brand)', fontFamily: 'Public Sans, sans-serif' }}>
            {level.emoji} {level.label}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Places\nVisited', val: myCount.toString() },
          { label: 'Day\nStreak', val: myStreak >= 1 ? `${myStreak}${myStreak >= 30 ? ' 🔥🔥' : myStreak >= 7 ? ' 🔥' : myStreak >= 3 ? ' ⚡' : ''}` : '—' },
          { label: 'Next\nLevel', val: myCount >= 50 ? '★' : (level.next - myCount).toString() + ' away' },
          { label: 'Rank', val: leaderboard.find(r => r.isMe)?.rank ? '#' + leaderboard.find(r => r.isMe)!.rank : '—' },
        ].map(s => (
          <div
            key={s.label}
            className="bg-white rounded-lg p-3 text-center"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <p
              className="text-2xl font-black"
              style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--brand)' }}
            >
              {s.val}
            </p>
            <p className="text-xs text-gray-500 leading-tight whitespace-pre-line">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {myCount >= 50 ? (
        <div className="bg-white rounded-lg p-4 mb-4 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: '28px' }}>★</span>
          <p className="font-black text-sm mt-1" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--brand)' }}>Max Level Reached!</p>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Public Sans, sans-serif' }}>You're a Legend — {myCount} places explored!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-4 mb-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700" style={{ fontFamily: 'Public Sans, sans-serif' }}>
              Progress to {nextLevel.label}
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
              {myCount}/{level.next}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: '8px', background: '#f0f0f0' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: 'var(--brand-gradient)' }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>
            Check in to {level.next - myCount} more place{level.next - myCount !== 1 ? 's' : ''} to level up!
          </p>
        </div>
      )}

      {/* Achievements */}
      <div className="flex items-center px-0 py-3 mb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif' }}>Achievements</h2>
      </div>
      {/* Abutting border grid — no gap, container has left+top, cells have right+bottom */}
      <div className="grid grid-cols-3 mb-5" style={{ gap: 0, borderLeft: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.08)' }}>
        {ACHIEVEMENTS.map(a => (
          <div
            key={a.id}
            className="flex flex-col items-center justify-center gap-1 py-5 px-2"
            style={{
              borderRight: '1px solid rgba(0,0,0,0.08)',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              background: a.unlocked ? 'var(--brand)' : 'white',
              marginRight: '-2px',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '36px',
                color: a.unlocked ? 'var(--ink)' : '#D0D0D0',
                fontVariationSettings: a.unlocked
                  ? "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 48"
                  : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48",
              }}
            >
              {a.icon}
            </span>
            <p className="text-center leading-tight font-black uppercase" style={{
              fontFamily: 'Public Sans, sans-serif',
              fontSize: '8px',
              letterSpacing: '0.08em',
              color: a.unlocked ? 'var(--ink)' : '#CCCCCC',
            }}>
              {a.label}
            </p>
            <p className="text-center" style={{
              fontFamily: 'Public Sans, sans-serif',
              fontSize: '8px',
              color: a.unlocked ? 'var(--brand)' : '#DDDDDD',
              letterSpacing: '0.04em',
            }}>
              {a.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ABQ Explorer Challenges */}
      {(() => {
        const checkedInArr = [...checkedIn];
        const CHALLENGES = [
          {
            id: 'old-town-5',
            emoji: 'account_balance',
            title: 'Old Town Explorer',
            desc: 'Check in to 5 places in Old Town ABQ',
            target: 5,
            progress: places.filter(p => checkedIn.has(p.id) && (p.address?.toLowerCase().includes('old town') || p.name?.toLowerCase().includes('old town') || (p.lat && p.lat >= 35.094 && p.lat <= 35.102 && p.lng && p.lng >= -106.673 && p.lng <= -106.659))).length,
          },
          {
            id: 'nob-hill-3',
            emoji: 'coffee',
            title: 'Nob Hill Regular',
            desc: 'Check in to 3 spots on Central Ave / Nob Hill',
            target: 3,
            progress: places.filter(p => checkedIn.has(p.id) && (p.address?.toLowerCase().includes('central ave') || p.address?.toLowerCase().includes('nob hill') || (p.lat && p.lat >= 35.076 && p.lat <= 35.082 && p.lng && p.lng >= -106.618 && p.lng <= -106.593))).length,
          },
          {
            id: 'checkin-10',
            emoji: 'location_on',
            title: 'Stamped In',
            desc: 'Reach 10 total check-ins',
            target: 10,
            progress: Math.min(myCount, 10),
          },
          {
            id: 'diverse-5',
            emoji: 'map',
            title: 'City Sampler',
            desc: 'Check in to 5 different place categories',
            target: 5,
            progress: new Set(places.filter(p => checkedIn.has(p.id)).map(p => p.type || p.category)).size,
          },
          {
            id: 'streak-7',
            emoji: 'local_fire_department',
            title: 'Week Warrior',
            desc: 'Keep a 7-day check-in streak',
            target: 7,
            progress: Math.min(myStreak, 7),
          },
          {
            id: 'downtown-3',
            emoji: 'location_city',
            title: 'Downtown Devotee',
            desc: 'Check in to 3 places Downtown',
            target: 3,
            progress: places.filter(p => checkedIn.has(p.id) && (p.address?.toLowerCase().includes('downtown') || (p.lat && p.lat >= 35.083 && p.lat <= 35.095 && p.lng && p.lng >= -106.658 && p.lng <= -106.644))).length,
          },
        ];
        const allDone = CHALLENGES.every(c => c.progress >= c.target);
        return (
          <>
            <div className="flex items-center px-0 py-3 mb-0 mt-1" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Public Sans, sans-serif' }}>ABQ Explorer Challenges</h2>
            </div>
            <div className="flex flex-col gap-2 mb-5 mt-3">
              {CHALLENGES.map(c => {
                const done = c.progress >= c.target;
                const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
                return (
                  <div
                    key={c.id}
                    className="rounded-lg px-4 py-3"
                    style={{
                      background: done ? 'var(--brand)' : 'white',
                      boxShadow: done ? '3px 3px 0 var(--brand)' : '3px 3px 0 rgba(0,0,0,0.10)',
                      border: done ? '1.5px solid var(--brand)' : '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', lineHeight: 1, color: 'var(--brand)', fontVariationSettings: "'FILL' 1" }}>{c.emoji}</span>
                      <span className="font-black text-sm flex-1" style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--ink)' }}>{c.title}</span>
                      {done && <span className="text-xs font-black" style={{ color: 'var(--brand)' }}>✓ DONE</span>}
                      {!done && <span className="text-xs font-semibold" style={{ fontFamily: 'Public Sans, sans-serif', color: '#999' }}>{c.progress}/{c.target}</span>}
                    </div>
                    <p className="text-xs mb-2" style={{ fontFamily: 'Public Sans, sans-serif', color: '#555' }}>{c.desc}</p>
                    <div className="rounded-full overflow-hidden" style={{ height: '5px', background: done ? 'rgba(0,0,0,0.1)' : '#f0f0f0' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? 'var(--brand)' : 'var(--brand-gradient)' }} />
                    </div>
                  </div>
                );
              })}
              {allDone && (
                <div className="text-center py-3 rounded-lg" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
                  <p className="font-black text-sm" style={{ fontFamily: 'Public Sans, sans-serif' }}>🏆 All challenges complete — you're a true ABQ local!</p>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Leaderboard */}
      <div className="flex items-center justify-between mb-3">
        <h2
          className="font-black text-base uppercase tracking-tight"
          style={{ fontFamily: 'Public Sans, sans-serif' }}
        >
          Leaderboard
        </h2>
        <span className="text-xs text-gray-400" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          Self-reported check-ins
        </span>
      </div>

      <div className="flex flex-col gap-2 mb-5">
        {leaderboard.length === 0 && (
          <div className="text-center py-8" style={{ background: 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏁</div>
            <p className="font-black text-sm" style={{ fontFamily: 'Public Sans, sans-serif', color: '#1a1a1a' }}>No explorers yet — be first!</p>
            <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>Check in at places around ABQ to climb the board.</p>
          </div>
        )}
        {leaderboard.map((row) => (
          <div
            key={row.uid || `${row.name}_${row.rank}`}
            className="flex items-center gap-3 bg-white rounded-lg px-4 py-3"
            style={{
              boxShadow: row.isMe ? '0 0 0 2px var(--brand), 0 2px 8px var(--brand-bg-subtle)' : '3px 3px 0 rgba(0,0,0,0.10)',
              background: row.isMe ? 'var(--brand-bg-subtle)' : 'white',
            }}
          >
            <span
              className="font-black text-sm w-6 text-center flex-shrink-0"
              style={{ fontFamily: 'Public Sans, sans-serif', color: row.rank <= 3 ? 'var(--brand)' : '#999' }}
            >
              {row.rank === 1 ? '' : row.rank === 2 ? '' : row.rank === 3 ? '' : `#${row.rank}`}
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: row.isMe ? 'var(--brand-gradient)' : '#f0f0f0' }}
            >
              <span className="text-xs font-black" style={{ color: row.isMe ? 'white' : '#999' }}>
                {row.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <span
              className="flex-1 text-sm font-bold truncate"
              style={{ fontFamily: 'Public Sans, sans-serif', color: row.isMe ? 'var(--brand)' : '#333' }}
            >
              {row.isMe ? 'You' : row.name}
            </span>
            {row.streak && row.streak >= 3 ? (
              <span className="flex-shrink-0 text-xs" title={`${row.streak}-day streak`}>
                {row.streak >= 30 ? '★★' : row.streak >= 7 ? '★' : '·'}
              </span>
            ) : null}
            <span
              className="flex-shrink-0 text-sm font-black"
              style={{ fontFamily: 'Public Sans, sans-serif', color: 'var(--brand)' }}
            >
              {row.count}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">places</span>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg p-4 mb-5"
        style={{ background: 'rgba(160,59,0,0.06)' }}
      >
        <p className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          ️ Rankings are based on self-reported check-ins. We can't verify visits, but we trust you to explore honestly. The real prize is the memories you make!
        </p>
      </div>

      {/* Visited Places */}
      {myCount > 0 && (
        <>
          <h2
            className="font-black text-base uppercase tracking-tight mb-3"
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          >
            Your Check-ins
          </h2>
          <div className="flex flex-col gap-2 mb-6">
            {places
              .filter(p => checkedIn.has(p.id))
              .map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-4 py-3"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                    style={{ background: hashGradient(p.name) }}
                  >
                    <PlaceImg src={hiResUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ fontFamily: 'Public Sans, sans-serif' }}>{p.name}</p>
                    <p className="text-xs" style={{ fontFamily: 'Public Sans, sans-serif', color: '#666' }}>{p.category}</p>
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--brand)' }}>✓</span>
                </div>
              ))
            }
          </div>
        </>
      )}

    </div>
  );
}

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
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
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

type AdminTab = 'dashboard' | 'places' | 'events' | 'tagrules' | 'settings';

interface PlaceDoc {
  id: string;
  name: string;
  category: string;
  tags: string[];
  isFeatured: boolean;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  image?: string;
  gradient?: string;
  phone?: string;
  hours?: string;
  website?: string;
  rating?: number;
  priceLevel?: number;
  reviewCount?: number;
}

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

const PLACE_CATS = [
  'restaurant','bar','coffee','park','museum','shop',
  'entertainment','outdoor','arts','fitness','hotel','other',
];

const PLACE_TAG_OPTIONS = [
  'outdoor','indoor','family-friendly','dog-friendly','live-music',
  'date-night','free','kid-friendly','accessible','patio',
  'late-night','brunch','art','nature','hiking','sports',
];

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
function DashboardTab({ places, lbEntries }: { places: PlaceDoc[]; lbEntries: LbEntry[] }) {
  const totalCheckIns = lbEntries.reduce((s, e) => s + (e.count || 0), 0);
  const featured = places.filter(p => p.isFeatured).length;
  const stats = [
    { label: 'Total Places', value: places.length, icon: '@' },
    { label: 'Featured',     value: featured,       icon: '⭐' },
    { label: 'Users',        value: lbEntries.length, icon: 'U' },
    { label: 'Check-ins',   value: totalCheckIns,  icon: '✅' },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 16 }}>Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...cardSty }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#1f2937' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ ...cardSty }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>Top Check-in Leaders</h3>
        {lbEntries.slice(0, 10).map((entry, i) => (
          <div key={entry.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < Math.min(lbEntries.length - 1, 9) ? '1px solid #f3f4f6' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: i < 3 ? '#fbbf24' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{i + 1}</div>
            <div style={{ flex: 1, fontSize: 14, color: '#374151' }}>{entry.displayName || 'Anonymous'}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: ADMIN_ACCENT }}>{entry.count}</div>
          </div>
        ))}
        {lbEntries.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>No users yet.</p>}
      </div>
    </div>
  );
}

// ── Places ────────────────────────────────────────────────────────────────────
function PlacesTab({ places, setPlaces }: { places: PlaceDoc[]; setPlaces: (fn: (prev: PlaceDoc[]) => PlaceDoc[]) => void }) {
  const EMPTY: Omit<PlaceDoc,'id'> = { name:'', category:'restaurant', tags:[], isFeatured:false, description:'', address:'', image:'', phone:'', hours:'', website:'', rating:0, priceLevel:1 };
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [mode, setMode] = useState<'list'|'add'|'edit'>('list');
  const [editTarget, setEditTarget] = useState<PlaceDoc|null>(null);
  const [form, setForm] = useState<Omit<PlaceDoc,'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const startAdd = () => { setForm(EMPTY); setEditTarget(null); setMode('add'); };
  const startEdit = (p: PlaceDoc) => {
    setEditTarget(p);
    setForm({ name:p.name, category:p.category||'other', tags:p.tags||[], isFeatured:!!p.isFeatured,
      description:p.description||'', address:p.address||'', image:p.image||'',
      phone:p.phone||'', hours:p.hours||'', website:p.website||'',
      rating:p.rating||0, priceLevel:p.priceLevel||1, gradient:p.gradient });
    setMode('edit');
  };

  const savePlace = async () => {
    if (!form.name.trim()) { flash('Name is required'); return; }
    setSaving(true);
    try {
      if (mode === 'edit' && editTarget) {
        await _fbUpdateDoc('places', editTarget.id, form as Record<string,unknown>);
        setPlaces(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...form } : p));
        flash('Place updated ✓'); setMode('list');
      } else {
        const ref = await _fbAddDoc('places', form as Record<string,unknown>);
        setPlaces(prev => [...prev, { id: ref.id, ...form }]);
        flash('Place added ✓'); setMode('list');
      }
    } catch (e) { flash('Error: ' + (e as Error).message); }
    setSaving(false);
  };

  const deletePlace = async (p: PlaceDoc) => {
    if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;
    await _fbDeleteDoc('places', p.id);
    setPlaces(prev => prev.filter(x => x.id !== p.id));
    flash('Deleted ✓');
  };

  const toggleFeatured = async (p: PlaceDoc) => {
    const next = !p.isFeatured;
    await _fbUpdateDoc('places', p.id, { isFeatured: next });
    setPlaces(prev => prev.map(x => x.id === p.id ? { ...x, isFeatured: next } : x));
  };

  const sf = (key: string) => (e: { target: { value: string } }) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const toggleTag = (tag: string) => setForm(prev => ({
    ...prev,
    tags: (prev.tags||[]).includes(tag) ? (prev.tags||[]).filter(t => t !== tag) : [...(prev.tags||[]), tag],
  }));

  const filtered = places.filter(p =>
    (catFilter === 'all' || p.category === catFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.address||'').toLowerCase().includes(search.toLowerCase()))
  );

  if (mode === 'add' || mode === 'edit') {
    return (
      <div>
        <button style={{ ...btnSec, marginBottom: 16 }} onClick={() => setMode('list')}>← Back to List</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 16 }}>
          {mode === 'edit' ? `Edit: ${editTarget?.name}` : 'Add New Place'}
        </h2>
        <FlashMsg msg={msg} />
        <div style={{ ...cardSty }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {([['name','Name *'],['address','Address'],['phone','Phone'],['website','Website'],['hours','Hours (e.g. Mon–Sat 11am–9pm)']] as [string,string][]).map(([k,l]) => (
              <div key={k}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{l}</label>
                <input value={(form as Record<string,unknown>)[k] as string || ''} onChange={sf(k)} style={inputSty} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Image URL</label>
              <input value={form.image||''} onChange={sf('image')} style={inputSty} placeholder="https://..." />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Description</label>
              <textarea value={form.description||''} onChange={sf('description')} rows={3} style={{ ...inputSty, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Category</label>
              <select value={form.category} onChange={sf('category')} style={inputSty}>
                {PLACE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Rating (0–5)</label>
              <input type="number" min="0" max="5" step="0.1"
                value={form.rating||0}
                onChange={e => setForm(prev => ({ ...prev, rating: parseFloat(e.target.value)||0 }))}
                style={inputSty} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Price Level</label>
              <select value={form.priceLevel||1} onChange={e => setForm(prev => ({ ...prev, priceLevel: parseInt(e.target.value) }))} style={inputSty}>
                {[1,2,3,4].map(n => <option key={n} value={n}>{'$'.repeat(n)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PLACE_TAG_OPTIONS.map(tag => (
                <TagPill key={tag} label={tag} active={(form.tags||[]).includes(tag)} onClick={() => toggleTag(tag)} />
              ))}
            </div>
            {(form.tags||[]).length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                Selected: <strong>{(form.tags||[]).join(', ')}</strong>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.isFeatured} onChange={e => setForm(prev => ({ ...prev, isFeatured: e.target.checked }))} />
              <span style={{ fontWeight: 600 }}>Featured on home screen</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button style={btnSec} onClick={() => setMode('list')}>Cancel</button>
            <button style={{ ...btnPrim, opacity: saving ? 0.7 : 1 }} onClick={savePlace} disabled={saving}>
              {saving ? 'Saving…' : (mode === 'edit' ? 'Update Place' : 'Add Place')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', flex: 1 }}>Places ({places.length})</h2>
        <button style={btnPrim} onClick={startAdd}>+ Add Place</button>
      </div>
      <FlashMsg msg={msg} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="Search by name or address…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSty, flex: 1 }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...inputSty, width: 'auto', flex: 'none' }}>
          <option value="all">All Categories</option>
          {PLACE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => (
          <div key={p.id} style={{ ...cardSty, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <PlaceImg src={p.image} alt={p.name || ''} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} iconSize="1.2rem" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{p.name}</span>
                {p.isFeatured && <span style={{ fontSize: 11, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 999 }}>* Featured</span>}
                <span style={{ fontSize: 11, backgroundColor: '#f3f4f6', color: '#6b7280', padding: '2px 7px', borderRadius: 999 }}>{p.category}</span>
                {p.rating ? <span style={{ fontSize: 11, color: '#9ca3af' }}>★ {p.rating}</span> : null}
              </div>
              {p.address && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{p.address}</div>}
              {(p.tags||[]).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {(p.tags||[]).map(t => <span key={t} style={{ fontSize: 11, backgroundColor: '#ede9e0', color: '#6b4c2a', padding: '2px 8px', borderRadius: 999 }}>{t}</span>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
              <button onClick={() => toggleFeatured(p)} style={{ ...btnSec, padding: '4px 10px', fontSize: 12, backgroundColor: p.isFeatured ? '#fef3c7' : 'white' }}>
                {p.isFeatured ? '★ Unfeature' : '☆ Feature'}
              </button>
              <button onClick={() => startEdit(p)} style={{ ...btnSec, padding: '4px 10px', fontSize: 12 }}>Edit</button>
              <button onClick={() => deletePlace(p)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No places found.</p>}
      </div>
    </div>
  );
}

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
          Keywords that auto-assign events and places to tag categories. Comma-separated.
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
    { key: 'places',    label: 'Places',    icon: '@' },
    { key: 'events',    label: 'Events',    icon: '~' },
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
        {(tab === 'dashboard' || tab === 'places') && !dataLoaded ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 60 }}>Loading data…</p>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab places={places} lbEntries={lbEntries} />}
            {tab === 'places'    && <PlacesTab places={places} setPlaces={setPlacesFn} />}
            {tab === 'events'    && <EventsTab />}
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
          Bookmark events and places as you browse — they'll show up here so you can plan your next outing.
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
                    <PlaceImg src={p.thumbnail || p.image} alt={p.name || ''} className="w-full h-full object-cover" />
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
                      {img ? <PlaceImg src={img} alt={e?.name || ''} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>confirmation_number</span></div>}
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
  { id: 'discover', label: 'Home',    icon: 'explore' },
  { id: 'events',   label: 'Events',  icon: 'confirmation_number' },
  { id: 'places',   label: 'Places',  icon: 'storefront' },
  { id: 'plan',     label: 'Saved',   icon: 'bookmark' },
  { id: 'profile',  label: 'Profile', icon: 'person' },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];


// ─── Desktop Layout ──────────────────────────────────────────────────────────
interface DesktopAppProps {
  events: TMEvent[];
  places: Place[];
  coords: GeoCoords | null;
  loading: boolean;
  eventsLoading: boolean;
  onPlaceSelect: (p: Place) => void;
  onEventSelect: (e: TMEvent) => void;
  savedPlan: SavedPlanItem[];
  onToggleSavePlace: (p: Place) => void;
  onToggleSaveEvent: (e: TMEvent) => void;
  isPlaceSaved: (id: string) => boolean;
  isEventSaved: (id: string) => boolean;
}

type DesktopTab = 'discover' | 'events' | 'places';

const DESKTOP_DATE_COLORS = ['var(--brand)', '#0057c2', '#1a1a1a'];
const fmtLocalDate = (d: string) => {
  if (!d) return { month: '???', day: '??', dow: '???' };
  const dt = new Date(d + 'T12:00:00');
  return {
    month: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(dt.getDate()),
    dow: dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
  };
};
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

function DesktopApp({ events, places, coords, loading, eventsLoading, onPlaceSelect, onEventSelect, savedPlan: _savedPlan, onToggleSavePlace, onToggleSaveEvent, isPlaceSaved, isEventSaved }: DesktopAppProps) {
  const [tab, setTab]       = useState<DesktopTab>('discover');
  const [cat, setCat]       = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState<'top' | 'near' | 'az'>('top');
  const [detail, setDetail] = useState<{ type: 'place'; data: Place } | { type: 'event'; data: TMEvent } | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const windowWidth         = useWindowWidth();
  // Below 1280px the main panel is too narrow for hero+events side-by-side
  const isNarrowDesktop     = windowWidth < 1280;

  // This-week events
  const weekEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const plus7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return events
      .filter(e => { const d = e.dates?.start?.localDate || ''; return d >= today && d <= plus7; })
      .filter(e => !e._isAdult)
      .sort((a, b) => (a.dates?.start?.localDate || '').localeCompare(b.dates?.start?.localDate || ''));
  }, [events]);

  // All upcoming events (events tab)
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events
      .filter(e => !e._isAdult && (e.dates?.start?.localDate || '') >= today)
      .sort((a, b) => (a.dates?.start?.localDate || '').localeCompare(b.dates?.start?.localDate || ''))
      .slice(0, 60);
  }, [events]);

  // Filtered places
  const filteredPlaces = useMemo(() => {
    // Category-tab filter (unchanged)
    let r = places.filter(p => cat === 'All' || p.category === cat);

    if (search.trim()) {
      const q = search.toLowerCase().trim();

      // Tier 1: CATEGORY_SYNONYMS → expand to full category
      const synonymCats = new Set<string>();
      const synKeys = Object.keys(CATEGORY_SYNONYMS);
      for (let ai = 0; ai < synKeys.length; ai++) {
        const term = synKeys[ai];
        const termCats = CATEGORY_SYNONYMS[term];
        if (q === term || q.includes(term) || term.includes(q)) {
          for (let ci = 0; ci < termCats.length; ci++) synonymCats.add(termCats[ci]);
        }
      }
      for (let pi = 0; pi < PLACE_CATEGORIES.length; pi++) {
        const pc = PLACE_CATEGORIES[pi];
        if (pc.value !== 'All' && (pc.label.toLowerCase().includes(q) || q.includes(pc.value))) {
          synonymCats.add(pc.value);
        }
      }
      // Tier 2: SEARCH_BOOSTS → cross-category hints
      const boostCats = new Set<string>();
      const boostKeys = Object.keys(SEARCH_BOOSTS);
      for (let bi = 0; bi < boostKeys.length; bi++) {
        const term = boostKeys[bi];
        const termCats = SEARCH_BOOSTS[term];
        if (q === term || q.includes(term) || term.includes(q)) {
          for (let ci = 0; ci < termCats.length; ci++) boostCats.add(termCats[ci]);
        }
      }

      r = r.filter(p => {
        const pName    = p.name.toLowerCase();
        const pAddr    = (p.address    || '').toLowerCase();
        const pCat     = (p.category   || '').toLowerCase();
        const pDesc    = (p.description || '').toLowerCase();
        const pAbout   = ((p as any).about        || '').toLowerCase();
        const pTip     = ((p as any).insiderTip   || '').toLowerCase();
        const pBestFor = (((p as any).bestFor || []) as string[]).join(' ').toLowerCase();
        const pTags    = ((p.tags || []) as string[]).join(' ').toLowerCase();
        const allText  = `${pName} ${pAddr} ${pCat} ${pDesc} ${pAbout} ${pTip} ${pBestFor} ${pTags}`;

        if (allText.includes(q)) return true;
        if (synonymCats.size > 0 && synonymCats.has(p.category)) return true;
        if (boostCats.size > 0 && boostCats.has(p.category)) return true;
        return false;
      });

      // Sort: name-starts-with first, then name-contains, then rating
      r = [...r].sort((a, b) => {
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
        const aScore = an.startsWith(q) ? 2 : an.includes(q) ? 1 : 0;
        const bScore = bn.startsWith(q) ? 2 : bn.includes(q) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    if (sort === 'near' && coords)
      return [...r].filter(p => p.lat && p.lng)
        .sort((a, b) => distanceMiles(coords.lat, coords.lng, a.lat!, a.lng!) - distanceMiles(coords.lat, coords.lng, b.lat!, b.lng!));
    if (sort === 'az') return [...r].sort((a, b) => a.name.localeCompare(b.name));
    return [...r].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }, [places, cat, search, sort, coords]);

  const nearbyPlaces = useMemo(() => {
    if (!coords) return [];
    return places
      .filter(p => p.lat && p.lng && !BLOCKED_VENUES.some(b => p.name?.toLowerCase().includes(b.toLowerCase())))
      .map(p => ({ place: p, dist: distanceMiles(coords.lat, coords.lng, p.lat!, p.lng!) }))
      .sort((a, b) => a.dist - b.dist).slice(0, 8);
  }, [places, coords]);

  const hiddenGems = useMemo(() =>
    places.filter(p => p.rating && p.rating >= 4.5 && !BLOCKED_VENUES.some(b => p.name?.toLowerCase().includes(b.toLowerCase()))).slice(0, 8),
    [places]);

  const s = {
    root:   { display:'flex', flexDirection:'column' as const, height:'100vh', overflow:'hidden', background:'var(--bg)', fontFamily:'Public Sans,system-ui,sans-serif', color:'#1a1a1a' },
    header: { height:'56px', background:'#fff', borderBottom:'2px solid #1a1a1a', display:'flex', alignItems:'center', flexShrink:0 as const, zIndex:100 },
    logo:   { width:'232px', borderRight:'2px solid #1a1a1a', height:'100%', display:'flex', alignItems:'center', padding:'0 18px', gap:'10px', flexShrink:0 as const },
    logoBadge: { background:'linear-gradient(135deg,var(--brand),var(--brand-light))', padding:'5px 9px', border:'2px solid #1a1a1a', fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'13px', letterSpacing:'-0.01em', color:'var(--bg)' },
    headerSearch: { flex:1, height:'100%', display:'flex', alignItems:'center', padding:'0 18px', gap:'10px', borderRight:'2px solid #1a1a1a' },
    searchBox: { flex:1, maxWidth:'480px', height:'36px', border:'2px solid #1a1a1a', background:'var(--bg)', display:'flex', alignItems:'center', padding:'0 12px', gap:'8px' },
    headerRight: { width:'356px', height:'100%', display:'flex', alignItems:'center', padding:'0 16px', gap:'8px', flexShrink:0 as const },
    layout: { display:'flex', flex:1, overflow:'hidden' },
    sidebar: { width:'232px', borderRight:'2px solid #1a1a1a', background:'#fff', display:'flex', flexDirection:'column' as const, overflowY:'auto' as const, flexShrink:0 as const },
    main: { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden', borderRight:'2px solid #1a1a1a' },
    toolbar: { height:'44px', borderBottom:'2px solid #1a1a1a', display:'flex', alignItems:'center', padding:'0 16px', gap:'10px', background:'#fff', flexShrink:0 as const },
    scroll: { flex:1, overflowY:'auto' as const, padding:'16px' },
    right: { width:'356px', background:'#fff', display:'flex', flexDirection:'column' as const, overflow:'hidden', flexShrink:0 as const },
  };

  const pillBase = { height:'27px', padding:'0 9px', border:'1.5px solid #1a1a1a', fontSize:'10px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const, display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', background:'#fff', color:'#1a1a1a' };
  const catBtnBase = { height:'30px', border:'1.5px solid #d0d8d0', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', fontSize:'10px', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' as const, cursor:'pointer', color:'#5c6660' };

  const NavItem = ({ icon, label, id, count }: { icon:string; label:string; id:DesktopTab|string; count?:number }) => (
    <div onClick={() => typeof id === 'string' && ['discover','events','places'].includes(id) && setTab(id as DesktopTab)}
      style={{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 14px', fontSize:'13px', fontWeight:600, cursor:'pointer',
        color: tab === id ? 'var(--brand)' : '#5c6660', borderLeft: tab === id ? '3px solid var(--brand)' : '3px solid transparent',
        background: tab === id ? 'var(--brand)1a' : 'transparent' }}>
      <span className="material-symbols-outlined" style={{ fontSize:'18px' }}>{icon}</span>
      {label}
      {count !== undefined && <span style={{ marginLeft:'auto', fontSize:'10px', fontWeight:800, background: tab===id ? 'var(--brand)' : '#1a1a1a', color:'var(--bg)', padding:'1px 6px', minWidth:'20px', textAlign:'center' }}>{count.toLocaleString()}</span>}
    </div>
  );

  const CatBtn = ({ icon, label, val }: { icon:string; label:string; val:string }) => (
    <div onClick={() => { setCat(val); if (tab !== 'places') setTab('places'); }}
      style={{ ...catBtnBase, ...(cat===val ? { border:'1.5px solid #1a1a1a', background:'#1a1a1a', color:'var(--bg)', boxShadow:'2px 2px 0 #1a1a1a' } : {}) }}>
      <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>{icon}</span>
      {label}
    </div>
  );

  // ── Event card (discover view) ─────────────────────────────────────────────
  const EventCard = ({ ev, idx }: { ev: TMEvent; idx: number }) => {
    const { month, day } = fmtLocalDate(ev.dates?.start?.localDate || '');
    const genre = getEventGenre(ev);
    const price = getEventPrice(ev);
    const img = getEventImage(ev);
    const gc = genreColor(ev);
    return (
      <div onClick={() => { setDetail({ type:'event', data:ev }); onEventSelect(ev); }}
        style={{ border:'2px solid #1a1a1a', background:'#fff', boxShadow:'3px 3px 0 #1a1a1a', cursor:'pointer', overflow:'hidden', transition:'transform 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.transform='translate(-2px,-2px)')}
        onMouseLeave={e => (e.currentTarget.style.transform='')}>
        <div style={{ height:'90px', background: img ? 'transparent' : `linear-gradient(135deg,${DESKTOP_DATE_COLORS[idx%3]},${DESKTOP_DATE_COLORS[(idx+1)%3]})`, position:'relative', overflow:'hidden' }}>
          <PlaceImg src={img} alt={ev?.name || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 55%)' }} />
          <div style={{ position:'absolute', top:7, left:7, background:'var(--brand)', border:'1.5px solid #1a1a1a', padding:'2px 7px', fontSize:'9px', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase' }}>
            {month} {day}
          </div>
          {genre && <div style={{ position:'absolute', bottom:7, right:7, background:gc, color:'#fff', padding:'2px 7px', fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{genre}</div>}
        </div>
        <div style={{ padding:'9px 11px 11px' }}>
          <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:800, fontSize:'12px', lineHeight:1.25, marginBottom:'4px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const, overflow:'hidden' }}>{ev.name}</div>
          <div style={{ fontSize:'10px', color:'#5c6660', display:'flex', alignItems:'center', gap:'5px', marginBottom:'6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'11px' }}>location_on</span>
            <span style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{getEventVenue(ev) || getEventCity(ev) || 'Albuquerque'}</span>
          </div>
          {price && <span style={{ fontSize:'9px', fontWeight:800, letterSpacing:'0.04em', color: price==='FREE' ? 'var(--brand)' : '#0057c2', background: price==='FREE' ? 'var(--brand)0d' : '#dbeafe', border: price==='FREE' ? '1px solid var(--brand-light)' : '1px solid #93c5fd', padding:'1px 6px' }}>{price}</span>}
        </div>
      </div>
    );
  };

  // ── Place card (compact horizontal) ───────────────────────────────────────
  const PlaceCard = ({ p, dist }: { p: Place; dist?: number }) => (
    <div onClick={() => { setDetail({ type:'place', data:p }); onPlaceSelect(p); }}
      style={{ border:'2px solid #1a1a1a', background:'#fff', boxShadow:'3px 3px 0 #1a1a1a', cursor:'pointer', display:'flex', overflow:'hidden', transition:'transform 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.transform='translate(-2px,-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform='')}>
      <div style={{ width:'72px', flexShrink:0, background: p.image ? 'transparent' : 'linear-gradient(135deg,var(--brand),var(--brand-light))', overflow:'hidden' }}>
        <PlaceImg src={p.thumbnail || p.image} alt={p.name || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      </div>
      <div style={{ flex:1, padding:'9px 11px', minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:'12px', marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5c6660', marginBottom:'5px' }}>{p.category}</div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          {p.rating && <span style={{ fontSize:'10px', fontWeight:800, color:'var(--brand)' }}>★ {p.rating.toFixed(1)}</span>}
          {dist !== undefined && <span style={{ fontSize:'9px', color:'#5c6660', display:'flex', alignItems:'center', gap:'2px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'10px' }}>near_me</span>{formatDist(dist)}
          </span>}
        </div>
      </div>
    </div>
  );

  // ── Place grid card (places tab) ───────────────────────────────────────────
  const PlaceGridCard = ({ p }: { p: Place }) => (
    <div onClick={() => { setDetail({ type:'place', data:p }); onPlaceSelect(p); }}
      style={{ border:'2px solid #1a1a1a', background:'#fff', boxShadow:'3px 3px 0 #1a1a1a', cursor:'pointer', overflow:'hidden', transition:'transform 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.transform='translate(-2px,-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform='')}>
      <div style={{ height:'96px', background: p.image ? 'transparent' : 'linear-gradient(135deg,var(--brand),var(--brand-light))', position:'relative', overflow:'hidden' }}>
        <PlaceImg src={p.thumbnail || p.image} alt={p.name || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.45) 0%,transparent 55%)' }} />
        {p.rating && <div style={{ position:'absolute', bottom:6, left:6, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:'10px', fontWeight:700, padding:'2px 7px' }}>★ {p.rating.toFixed(1)}</div>}
      </div>
      <div style={{ padding:'8px 9px 10px' }}>
        <div style={{ fontWeight:700, fontSize:'11px', marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5c6660' }}>{p.category}</div>
      </div>
    </div>
  );

  // ── Event list row (events tab) ────────────────────────────────────────────
  const EventRow = ({ ev, idx }: { ev: TMEvent; idx: number }) => {
    const { month, day, dow } = fmtLocalDate(ev.dates?.start?.localDate || '');
    const price = getEventPrice(ev);
    const img = getEventImage(ev);
    const color = DESKTOP_DATE_COLORS[idx % 3];
    const isFree = price === 'FREE';
    return (
      <div onClick={() => { setDetail({ type:'event', data:ev }); onEventSelect(ev); }}
        style={{ border:'2px solid #1a1a1a', background:'#fff', display:'flex', alignItems:'stretch', cursor:'pointer', boxShadow:'3px 3px 0 #1a1a1a', transition:'transform 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.transform='translate(-2px,-2px)')}
        onMouseLeave={e => (e.currentTarget.style.transform='')}>
        <div style={{ width:'54px', flexShrink:0, background:color, color:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'10px 2px' }}>
          <div style={{ fontSize:'9px', fontWeight:800, letterSpacing:'0.1em' }}>{month}</div>
          <div style={{ fontFamily:'Public Sans,sans-serif', fontSize:'22px', fontWeight:900, lineHeight:1 }}>{day}</div>
          <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'0.06em', opacity:0.75 }}>{dow}</div>
        </div>
        <div style={{ width:'60px', flexShrink:0, background: img ? 'transparent' : `linear-gradient(135deg,${color},${DESKTOP_DATE_COLORS[(idx+1)%3]})`, overflow:'hidden' }}>
          <PlaceImg src={img} alt={ev.name || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ flex:1, padding:'11px 13px', minWidth:0 }}>
          <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:800, fontSize:'13px', marginBottom:'3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.name}</div>
          <div style={{ fontSize:'11px', color:'#5c6660', display:'flex', alignItems:'center', gap:'7px', marginBottom:'7px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>location_on</span>
            {getEventVenue(ev) || getEventCity(ev) || 'Albuquerque'}
            {ev.dates?.start?.localTime && <><span style={{ color:'#d0d8d0' }}>·</span>{fmtLocalTime(ev.dates.start.localTime)}</>}
          </div>
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
            {getEventGenre(ev) && <span style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', border:'1px solid #d0d8d0', padding:'1px 6px', color:'#5c6660' }}>{getEventGenre(ev)}</span>}
            {isFree && <span style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', border:'1px solid var(--brand-light)', padding:'1px 6px', color:'var(--brand)', background:'var(--brand)0d' }}>Free</span>}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'space-between', padding:'11px 13px', flexShrink:0 }}>
          <span style={{ fontSize:'11px', fontWeight:800, color: isFree ? 'var(--brand)' : '#0057c2' }}>{price || ''}</span>
          <button onClick={e => { e.stopPropagation(); if(ev.url) window.open(ev.url,'_blank'); }}
            style={{ height:'27px', padding:'0 9px', background: isFree ? 'var(--brand)' : '#0057c2', color:'#fff', border:'none', fontFamily:'Public Sans,sans-serif', fontSize:'9px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>{isFree ? 'open_in_new' : 'confirmation_number'}</span>
            {isFree ? 'Info' : 'Tickets'}
          </button>
        </div>
      </div>
    );
  };

  // ── Dark-themed event row (Discover tab Events This Week) ──────────────────
  const DarkEventRow = ({ ev, idx }: { ev: TMEvent; idx: number }) => {
    const { month, day } = fmtLocalDate(ev.dates?.start?.localDate || '');
    const venue = getEventVenue(ev) || getEventCity(ev) || 'Albuquerque';
    const time = ev.dates?.start?.localTime ? fmtLocalTime(ev.dates.start.localTime) : '';
    const price = getEventPrice(ev);
    const isFree = price === 'FREE';
    const isLast = idx === Math.min(weekEvents.length, 4) - 1;
    return (
      <div onClick={() => { setDetail({ type:'event', data:ev }); onEventSelect(ev); }}
        style={{ display:'flex', alignItems:'stretch', cursor:'pointer', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)', transition:'background 0.12s' }}
        onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background='')}>
        {/* Date block */}
        <div style={{ width:'72px', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'18px 8px' }}>
          <div style={{ fontSize:'10px', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--bg)' }}>{month}</div>
          <div style={{ fontFamily:'Public Sans,sans-serif', fontSize:'34px', fontWeight:900, lineHeight:1, color:'#ffffff' }}>{day}</div>
        </div>
        {/* Content */}
        <div style={{ flex:1, padding:'16px 12px 16px 4px', minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'15px', lineHeight:1.2, color:'#ffffff', marginBottom:'5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.name}</div>
          <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {venue}{time ? ` · ${time}` : ''}
          </div>
          {isFree && <div style={{ marginTop:'5px', display:'inline-block', fontSize:'9px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--bg)', border:'1px solid #d4ef4d', padding:'1px 6px', width:'fit-content' }}>FREE</div>}
        </div>
        {/* Arrow */}
        <div style={{ width:'52px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:'34px', height:'34px', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'18px', color:'#1a1a1a', fontWeight:700 }}>arrow_forward</span>
          </div>
        </div>
      </div>
    );
  };

  // ── Detail panel ──────────────────────────────────────────────────────────
  const DetailPanel = () => {
    if (!detail) return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center', color:'#5c6660' }}>
        <span className="material-symbols-outlined" style={{ fontSize:'36px', color:'#d0d8d0', marginBottom:'10px' }}>touch_app</span>
        <p style={{ fontSize:'12px', fontWeight:600 }}>Click any card to preview details here</p>
      </div>
    );
    if (detail.type === 'event') {
      const ev = detail.data;
      const { month, day, dow } = fmtLocalDate(ev.dates?.start?.localDate || '');
      const price = getEventPrice(ev);
      const isFree = price === 'FREE';
      const img = getEventImage(ev);
      const color = isFree ? 'var(--brand)' : '#0057c2';
      return (
        <div style={{ flex:1, overflowY:'auto' }}>
          <div style={{ height:'160px', background: img ? 'transparent' : `linear-gradient(135deg,${color},#1a1a1a)`, position:'relative', overflow:'hidden' }}>
            <PlaceImg src={img} alt={ev.name || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.7),transparent 60%)' }} />
            <div style={{ position:'absolute', bottom:10, left:12 }}>
              <div style={{ background:'var(--brand)', border:'1.5px solid #1a1a1a', display:'inline-block', padding:'3px 9px', fontSize:'10px', fontWeight:800, letterSpacing:'0.06em' }}>{month} {day} · {dow}</div>
            </div>
            <button onClick={() => setDetail(null)} style={{ position:'absolute', top:8, right:8, width:'28px', height:'28px', border:'1.5px solid rgba(255,255,255,0.5)', background:'rgba(0,0,0,0.4)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'16px' }}>close</span>
            </button>
          </div>
          <div style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:color, marginBottom:'4px', display:'flex', alignItems:'center', gap:'4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'11px' }}>confirmation_number</span>
              {getEventGenre(ev) || 'Event'}{isFree ? ' · Free' : ''}
            </div>
            <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'16px', lineHeight:1.2, marginBottom:'10px' }}>{ev.name}</div>
            <div style={{ fontSize:'11px', color:'#5c6660', display:'flex', alignItems:'center', gap:'5px', marginBottom:'6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>location_on</span>
              {getEventVenue(ev)}{getEventCity(ev) ? ` · ${getEventCity(ev)}` : ''}
            </div>
            {ev.dates?.start?.localTime && (
              <div style={{ fontSize:'11px', color:'#5c6660', display:'flex', alignItems:'center', gap:'5px', marginBottom:'14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>schedule</span>
                {fmtLocalTime(ev.dates.start.localTime)}
              </div>
            )}
            <div style={{ display:'flex', gap:'6px' }}>
              {ev.url && <button onClick={() => window.open(ev.url,'_blank')}
                style={{ flex:1, height:'32px', background: isFree ? 'var(--brand)' : '#0057c2', color:'#fff', border:'2px solid #1a1a1a', fontFamily:'Public Sans,sans-serif', fontSize:'10px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', boxShadow:'2px 2px 0 #1a1a1a' }}>
                <span className="material-symbols-outlined" style={{ fontSize:'13px' }}>{isFree ? 'open_in_new' : 'confirmation_number'}</span>
                {isFree ? 'More Info' : 'Get Tickets'}
              </button>}
              <button onClick={() => onToggleSaveEvent(ev)} title={isEventSaved(ev.id) ? 'Remove from plan' : 'Save to plan'} style={{ width:'32px', height:'32px', border:'2px solid #1a1a1a', background: isEventSaved(ev.id) ? 'var(--brand)' : '#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'2px 2px 0 #1a1a1a' }}>
                <span className="material-symbols-outlined" style={{ fontSize:'16px', color: isEventSaved(ev.id) ? '#fff' : '#1a1a1a', fontVariationSettings: isEventSaved(ev.id) ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
              </button>
              <button onClick={async () => { await shareEvent(ev); setShareToast(true); setTimeout(() => setShareToast(false), 2000); }} title="Copy shareable link" style={{ width:'32px', height:'32px', border:'2px solid #1a1a1a', background: shareToast ? 'var(--brand)' : '#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'2px 2px 0 #1a1a1a', transition:'background 0.2s' }}>
                <span className="material-symbols-outlined" style={{ fontSize:'16px' }}>{shareToast ? 'check' : 'share'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    // Place detail
    const p = detail.data;
    return (
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ height:'160px', background: p.image ? 'transparent' : 'linear-gradient(135deg,var(--brand),var(--brand-light))', position:'relative', overflow:'hidden' }}>
          <PlaceImg src={p.image || p.thumbnail} alt={p.name || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.65),transparent 55%)' }} />
          <button onClick={() => setDetail(null)} style={{ position:'absolute', top:8, right:8, width:'28px', height:'28px', border:'1.5px solid rgba(255,255,255,0.5)', background:'rgba(0,0,0,0.4)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'16px' }}>close</span>
          </button>
        </div>
        <div style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--brand)', marginBottom:'4px', display:'flex', alignItems:'center', gap:'4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'11px' }}>storefront</span>
            {p.category}{p.hours ? ` · ${p.hours}` : ''}
          </div>
          <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'16px', lineHeight:1.2, marginBottom:'8px' }}>{p.name}</div>
          {p.rating && <div style={{ fontSize:'12px', fontWeight:700, color:'var(--brand)', marginBottom:'8px' }}>★ {p.rating.toFixed(1)}{p.reviewCount ? <span style={{ fontWeight:400, color:'#5c6660', fontSize:'11px' }}> ({p.reviewCount.toLocaleString()} reviews)</span> : ''}</div>}
          {p.address && <div style={{ fontSize:'11px', color:'#5c6660', display:'flex', alignItems:'center', gap:'5px', marginBottom:'14px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>location_on</span>{p.address}
          </div>}
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => onPlaceSelect(p)} style={{ flex:1, height:'32px', background:'#1a1a1a', color:'var(--bg)', border:'2px solid #1a1a1a', fontFamily:'Public Sans,sans-serif', fontSize:'10px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', boxShadow:'2px 2px 0 #1a1a1a' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'13px' }}>info</span>
              Full Details
            </button>
            {p.address && <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(p.address||'')}`, '_blank')}
              style={{ width:'32px', height:'32px', border:'2px solid #1a1a1a', background:'#0057c2', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'2px 2px 0 #1a1a1a' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'16px' }}>directions</span>
            </button>}
            <button onClick={() => onToggleSavePlace(p)} title={isPlaceSaved(p.id) ? 'Remove from plan' : 'Save to plan'} style={{ width:'32px', height:'32px', border:'2px solid #1a1a1a', background: isPlaceSaved(p.id) ? 'var(--brand)' : '#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'2px 2px 0 #1a1a1a' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'16px', color: isPlaceSaved(p.id) ? '#fff' : '#1a1a1a', fontVariationSettings: isPlaceSaved(p.id) ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Map panel ──────────────────────────────────────────────────────────────
  const MapPanel = () => (
    <div style={{ flex:1, background:'#ecf0e8', position:'relative', overflow:'hidden', minHeight:'200px' }}>
      <div style={{ position:'absolute', inset:0,
        background:'repeating-linear-gradient(0deg,rgba(86,101,0,0.05) 0px,transparent 1px,transparent 31px,rgba(86,101,0,0.05) 32px),repeating-linear-gradient(90deg,rgba(86,101,0,0.05) 0px,transparent 1px,transparent 31px,rgba(86,101,0,0.05) 32px),#ecf0e8' }} />
      {/* Simulated roads */}
      <div style={{ position:'absolute', height:'5px', left:0, right:0, top:'42%', background:'rgba(255,255,255,0.9)', boxShadow:'0 0 0 1px rgba(0,0,0,0.1)' }} />
      <div style={{ position:'absolute', width:'5px', top:0, bottom:0, left:'35%', background:'rgba(255,255,255,0.9)', boxShadow:'0 0 0 1px rgba(0,0,0,0.1)' }} />
      <div style={{ position:'absolute', height:'3px', left:0, right:0, top:'65%', background:'rgba(255,255,255,0.7)' }} />
      <div style={{ position:'absolute', width:'3px', top:0, bottom:0, left:'65%', background:'rgba(255,255,255,0.7)' }} />
      {/* You are here dot */}
      <div style={{ position:'absolute', top:'50%', left:'43%', width:'12px', height:'12px', background:'var(--brand)', border:'2.5px solid #1a1a1a', borderRadius:'50%', transform:'translate(-50%,-50%)', boxShadow:'0 0 0 5px rgba(185,92,67,0.3)' }} />
      {/* Map watermark */}
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(86,101,0,0.35)' }}>Albuquerque · NM</div>
      </div>
      {/* Map controls */}
      <div style={{ position:'absolute', top:8, right:8, display:'flex', flexDirection:'column', gap:'3px' }}>
        {['+','−'].map((c,i) => (
          <div key={i} style={{ width:'26px', height:'26px', background:'#fff', border:'1.5px solid #1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'14px', fontWeight:700, boxShadow:'2px 2px 0 rgba(0,0,0,0.1)' }}>{c}</div>
        ))}
        <div style={{ width:'26px', height:'26px', background:'#0057c2', border:'1.5px solid #1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'2px 2px 0 rgba(0,0,0,0.1)' }}>
          <span className="material-symbols-outlined" style={{ fontSize:'14px', color:'#fff' }}>my_location</span>
        </div>
      </div>
      {/* Map filter strip */}
      <div style={{ position:'absolute', bottom:8, left:8, display:'flex', gap:'4px' }}>
        {[{icon:'confirmation_number',label:'Events',bg:'#1a1a1a'},{icon:'storefront',label:'Places',bg:'var(--brand)'}].map(c => (
          <div key={c.label} style={{ height:'22px', padding:'0 7px', background:c.bg, border:'1.5px solid #1a1a1a', fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px', color:'var(--bg)', boxShadow:'2px 2px 0 rgba(0,0,0,0.1)' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'11px' }}>{c.icon}</span>{c.label}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Today/this-week date strip ─────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoBadge}>ABQ</div>
          <div>
            <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'14px', letterSpacing:'-0.01em', lineHeight:1 }}>Unplugged</div>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#5c6660', marginTop:'1px' }}>Greater ABQ</div>
          </div>
        </div>
        <div style={s.headerSearch}>
          <div style={s.searchBox}>
            <span className="material-symbols-outlined" style={{ fontSize:'16px', color:'#5c6660' }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events, places, neighborhoods…"
              style={{ border:'none', background:'transparent', fontFamily:'Public Sans,sans-serif', fontSize:'13px', color:'#1a1a1a', outline:'none', flex:1 }} />
            {search && <span className="material-symbols-outlined" onClick={() => setSearch('')} style={{ fontSize:'16px', color:'#5c6660', cursor:'pointer' }}>close</span>}
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            {(['discover','events','places'] as DesktopTab[]).map(t => (
              <div key={t} onClick={() => { setTab(t); setCat('All'); }}
                style={{ ...pillBase, ...(tab===t ? { background:'#1a1a1a', color:'var(--bg)' } : {}) }}>
                {t === 'discover' ? 'Discover' : t === 'events' ? 'Events' : 'Places'}
              </div>
            ))}
          </div>
        </div>
        <div style={s.headerRight}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px', border:'1.5px solid var(--brand-light)', padding:'4px 9px', background:'var(--brand)1a', fontSize:'10px', fontWeight:700, color:'var(--brand)', letterSpacing:'0.04em', marginRight:'4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:'12px', color:'var(--brand)' }}>my_location</span>
            Downtown ABQ
          </div>
          {[{icon:'search',label:'Search'},{icon:'notifications',label:'Alerts'},{icon:'person',label:'Profile'}].map((btn, i) => (
            <div key={btn.icon} style={{ width:'32px', height:'32px', border:'2px solid #1a1a1a', background: i===2 ? '#1a1a1a' : '#fff', color: i===2 ? 'var(--brand)' : '#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              <span className="material-symbols-outlined" style={{ fontSize:'17px' }}>{btn.icon}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Three-panel body */}
      <div style={s.layout}>

        {/* ── Sidebar ── */}
        <aside style={s.sidebar}>
          {/* Navigation */}
          <div style={{ borderBottom:'2px solid #1a1a1a', paddingBottom:'8px', paddingTop:'14px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#5c6660', padding:'0 14px 8px' }}>Browse</div>
            <NavItem icon="explore"           label="Discover" id="discover" />
            <NavItem icon="confirmation_number" label="Events"   id="events"   count={weekEvents.length} />
            <NavItem icon="storefront"         label="Places"   id="places"   count={places.length} />
          </div>

          {/* Categories */}
          <div style={{ borderBottom:'2px solid #1a1a1a', padding:'14px 0' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#5c6660', padding:'0 14px 10px' }}>Category</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', padding:'0 11px 4px' }}>
              <CatBtn icon="grid_view"     label="All"     val="All" />
              <CatBtn icon="restaurant"    label="Food"    val="restaurant" />
              <CatBtn icon="local_cafe"    label="Coffee"  val="coffee" />
              <CatBtn icon="sports_bar"    label="Bars"    val="bar" />
              <CatBtn icon="park"          label="Parks"   val="park" />
              <CatBtn icon="palette"       label="Arts"    val="arts" />
              <CatBtn icon="museum"        label="Museums" val="museum" />
              <CatBtn icon="local_activity" label="Fun"    val="entertainment" />
            </div>
          </div>

          {/* Stats */}
          <div style={{ borderBottom:'2px solid #1a1a1a', padding:'14px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#5c6660', marginBottom:'10px' }}>This Week</div>
            {[
              { label:'Events happening', val: weekEvents.length },
              { label:'Free events', val: weekEvents.filter(e => getEventPrice(e) === 'FREE').length },
              { label:'Spots in ABQ', val: places.length },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                <span style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5c6660' }}>{row.label}</span>
                <span style={{ fontSize:'13px', fontWeight:800, color:'var(--brand)' }}>{row.val.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Sort (places) */}
          <div style={{ padding:'14px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#5c6660', marginBottom:'10px' }}>Sort Places</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {([['top','Top Rated','star'],['near','Near Me','near_me'],['az','A–Z','sort_by_alpha']] as const).map(([val, label, icon]) => (
                <div key={val} onClick={() => setSort(val)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'12px', fontWeight:600, border:'1.5px solid', borderColor: sort===val ? (val==='near' ? '#0057c2' : 'var(--brand)') : 'transparent', background: sort===val ? (val==='near' ? '#dbeafe' : 'var(--brand)0d') : 'transparent', color: sort===val ? (val==='near' ? '#0057c2' : 'var(--brand)') : '#5c6660' }}>
                  <span className="material-symbols-outlined" style={{ fontSize:'15px' }}>{icon}</span>{label}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main style={s.main}>
          <div style={s.toolbar}>
            <span style={{ fontSize:'11px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5c6660' }}>
              {tab === 'discover' && <><strong style={{ color:'#1a1a1a' }}>{places.length.toLocaleString()}</strong> places · <strong style={{ color:'#1a1a1a' }}>{weekEvents.length}</strong> events this week</>}
              {tab === 'events'   && <><strong style={{ color:'#1a1a1a' }}>{upcomingEvents.length}</strong> upcoming events · <strong style={{ color:'#0057c2' }}>{upcomingEvents.filter(e => getEventPrice(e) === 'FREE').length}</strong> free</>}
              {tab === 'places'   && <><strong style={{ color:'#1a1a1a' }}>{filteredPlaces.length.toLocaleString()}</strong> {cat !== 'All' ? cat : ''} places</>}
            </span>
            <div style={{ flex:1 }} />
            {tab === 'places' && (
              <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
                style={{ height:'27px', border:'1.5px solid #1a1a1a', background:'#fff', fontFamily:'Public Sans,sans-serif', fontSize:'10px', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', padding:'0 8px', cursor:'pointer', outline:'none', color:'#1a1a1a' }}>
                <option value="top">Sort: Top Rated</option>
                <option value="near">Sort: Near Me</option>
                <option value="az">Sort: A–Z</option>
              </select>
            )}
          </div>

          <div style={{ ...s.scroll, overflowX:'hidden' }}>
            {/* ── DISCOVER ── */}
            {tab === 'discover' && (
              <>
                {/* Hero + Events This Week — side by side on wide desktop, stacked on narrow */}
                <div style={{ display:'grid', gridTemplateColumns: isNarrowDesktop ? '1fr' : 'minmax(0,3fr) minmax(0,2fr)', gap:'0', marginBottom:'24px', border:'2px solid #1a1a1a', boxShadow:'4px 4px 0 #1a1a1a' }}>
                  {/* Hero */}
                  <div style={{ background:'linear-gradient(135deg,var(--brand),var(--brand-light))', padding:'clamp(14px,2vw,24px) clamp(14px,2vw,28px) clamp(12px,1.5vw,20px)', position:'relative', overflow:'hidden', minWidth:0 }}>
                    <div style={{ position:'absolute', top:'-30px', right:'-30px', width:'180px', height:'180px', background:'rgba(212,239,77,0.1)', borderRadius:'50%' }} />
                    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--bg)', marginBottom:'5px' }}>✦ Your City, Unplugged</div>
                    <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'clamp(16px,2.2vw,26px)', lineHeight:1.05, letterSpacing:'-0.02em', color:'#fff', marginBottom:'8px' }}>Find Something<br/>Worth Leaving<br/>the House For</div>
                    <div style={{ fontSize:'clamp(9px,1vw,11px)', color:'rgba(255,255,255,0.75)', marginBottom:'clamp(10px,1.5vw,16px)' }}>{today} · {places.length.toLocaleString()} spots across Greater ABQ</div>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      <button onClick={() => setTab('events')} style={{ height:'32px', padding:'0 12px', background:'var(--brand)', border:'2px solid #1a1a1a', boxShadow:'2px 2px 0 #1a1a1a', fontSize:'9px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', color:'#1a1a1a' }}>
                        <span className="material-symbols-outlined" style={{ fontSize:'13px' }}>confirmation_number</span>Browse Events
                      </button>
                      <button onClick={() => setTab('places')} style={{ height:'32px', padding:'0 12px', background:'rgba(255,255,255,0.15)', border:'2px solid rgba(255,255,255,0.4)', fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', color:'#fff' }}>
                        <span className="material-symbols-outlined" style={{ fontSize:'13px' }}>storefront</span>Browse Places
                      </button>
                    </div>
                  </div>

                  {/* Events This Week */}
                  <div style={{ background:'#1a1a1a', borderLeft: isNarrowDesktop ? 'none' : '2px solid #1a1a1a', borderTop: isNarrowDesktop ? '2px solid #1a1a1a' : 'none', display:'flex', flexDirection:'column', minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
                      <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'12px', letterSpacing:'0.1em', textTransform:'uppercase', color:'#fff' }}>Events This Week</div>
                      <span onClick={() => setTab('events')} style={{ fontSize:'10px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--bg)', cursor:'pointer' }}>
                        → SEE ALL
                      </span>
                    </div>
                    <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                      {eventsLoading && weekEvents.length === 0 ? (
                        [0,1,2,3].map(i => (
                          <div key={i} style={{ flex:1, minHeight:'52px', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none', background:'rgba(255,255,255,0.02)', animation:'pulse 1.5s ease-in-out infinite' }} />
                        ))
                      ) : (
                        weekEvents.slice(0,4).map((ev, i) => <DarkEventRow key={ev.id} ev={ev} idx={i} />)
                      )}
                    </div>
                  </div>
                </div>

                {/* Near You */}
                {nearbyPlaces.length > 0 && <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', paddingBottom:'10px', borderBottom:'2px solid #1a1a1a' }}>
                    <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'12px', letterSpacing:'0.08em', textTransform:'uppercase' }}>Near You</div>
                    <span style={{ fontSize:'10px', fontWeight:700, color:'var(--brand)', display:'flex', alignItems:'center', gap:'4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>my_location</span>Live location
                    </span>
                    <span onClick={() => setTab('places')} style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--brand)', cursor:'pointer', display:'flex', alignItems:'center', gap:'2px' }}>
                      All places <span className="material-symbols-outlined" style={{ fontSize:'12px' }}>arrow_forward</span>
                    </span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'8px', marginBottom:'24px' }}>
                    {nearbyPlaces.slice(0,4).map(({ place, dist }) => <PlaceCard key={place.id} p={place} dist={dist} />)}
                  </div>
                </>}

                {/* Hidden Gems */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', paddingBottom:'10px', borderBottom:'2px solid #1a1a1a' }}>
                  <div style={{ fontFamily:'Public Sans,sans-serif', fontWeight:900, fontSize:'12px', letterSpacing:'0.08em', textTransform:'uppercase' }}>Hidden Gems</div>
                  <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#5c6660' }}>★ 4.5+ Rated</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'8px', marginBottom:'24px' }}>
                  {hiddenGems.slice(0,4).map(p => <PlaceCard key={p.id} p={p} />)}
                </div>
              </>
            )}

            {/* ── EVENTS TAB ── */}
            {tab === 'events' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {upcomingEvents.length === 0 && eventsLoading && (
                  <div style={{ textAlign:'center', padding:'40px', color:'#5c6660' }}>
                    <div style={{ fontWeight:700 }}>Loading events…</div>
                  </div>
                )}
                {upcomingEvents.map((ev, i) => <EventRow key={ev.id} ev={ev} idx={i} />)}
              </div>
            )}

            {/* ── PLACES TAB ── */}
            {tab === 'places' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(175px, 1fr))', gap:'10px' }}>
                {filteredPlaces.slice(0,60).map(p => <PlaceGridCard key={p.id} p={p} />)}
              </div>
            )}
          </div>
        </main>

        {/* ── Right Panel ── */}
        <aside style={s.right}>
          <MapPanel />
          <div style={{ borderTop:'2px solid #1a1a1a', flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
            <DetailPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace('#', '').split('/')[0];
    const validTabs: TabId[] = ['discover', 'events', 'places', 'plan', 'profile'];
    return validTabs.includes(hash as TabId) ? (hash as TabId) : 'discover';
  });
  // Mobile-first: always use mobile layout (desktop layout disabled for now)
  const isDesktop = false;

  const [showSearch, setShowSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [placesNavKey, setPlacesNavKey] = useState(0);
  const [placesNavCat, setPlacesNavCat] = useState('All');
  const [placesNavSearch, setPlacesNavSearch] = useState('');
  const [placesNavVibe, setPlacesNavVibe] = useState('');
  // Pre-seed places from the localStorage cache so returning users see the app
  // immediately without waiting for a network fetch.
  const [places, setPlaces] = useState<Place[]>(() => {
    try {
      const raw = localStorage.getItem('abq_places_v3');
      if (!raw) return [];
      const { data } = JSON.parse(raw) as { data: Place[]; ts: number };
      return Array.isArray(data) && data.length > 0 ? data : [];
    } catch { return []; }
  });
  // Pre-seed with bundled static events so the list is never empty while
  // Supabase loads. Live data replaces this as soon as the fetch resolves.
  const [events, setEvents] = useState<TMEvent[]>(() =>
    STATIC_TM_EVENTS.filter(e => !isJunkEvent(e)).map(tagAdultEvent)
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
  // Never block on a loading screen — show the app shell immediately.
  // Data populates in the background; sections gracefully show when ready.
  const [loading, setLoading] = useState(false);
  // Start as false — static events are pre-seeded above; Supabase refreshes silently.
  const [eventsLoading, setEventsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TMEvent | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(loadCheckins);

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
      savePlanToStorage(next); return next;
    });
  };
  const isPlaceSaved = (id: string) => savedPlan.some(p => p.type === 'place' && (p.data as Place).id === id);
  const isEventSaved = (id: string) => savedPlan.some(p => p.type === 'event' && (p.data as TMEvent).id === id);

  // ── Firebase Auth ──
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs>(getPrefs);
  // Re-sync prefs state when ProfileSettingsPane saves changes
  useEffect(() => {
    const handler = () => setPrefs(getPrefs());
    window.addEventListener('abq_prefs_changed', handler);
    return () => window.removeEventListener('abq_prefs_changed', handler);
  }, []);

  //   // Fix: vertical wheel scroll passes through horizontal carousels
  useEffect(() => {
    const _psh = (e: Event) => {
      setPlacesNavSearch((e as CustomEvent).detail as string);
      setActiveTab('places');
    };
    window.addEventListener('plan-step-click', _psh);
    return () => window.removeEventListener('plan-step-click', _psh);
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
            window.history.pushState({}, '', '#admin');
            setCurrentHash('#admin');
          } else {
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
            // Admin Google sign-in — navigate to #admin (only works if email matches ADMIN_EMAIL)
            window.history.pushState({}, '', '#admin');
            setCurrentHash('#admin');
          } else {
            setActiveTab(pendingTab);
            const hasUsername = !!(u.user_metadata?.display_name);
            if (!hasUsername) setShowUsernameSetup(true);
          }
        }
      }
      if (u) {
        // Load check-ins from Firestore on sign-in
        try {
          const snap = await _fbGetDoc('profiles', u.id);
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.checkIns) && data.checkIns.length > 0) {
              const merged = new Set<string>([...loadCheckins(), ...data.checkIns]);
              setCheckedIn(merged);
              saveCheckins(merged);
            }
          }
        } catch (err) { console.error('Load checkins error:', err); }
      }
    });
    return () => unsub.unsubscribe();
  }, []);

  // Debounced Firestore sync when checkedIn changes and user is signed in
  useEffect(() => {
    if (!user || !authReady) return;
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      syncCheckinsToFirestore(user.id, checkedIn, (user.user_metadata?.display_name || user.email) || user.email || 'Explorer');
    }, 1500);
    return () => { if (syncTimeout.current) clearTimeout(syncTimeout.current); };
  }, [checkedIn, user, authReady]);

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
    setActiveTab(tab);
    window.history.pushState({ tab, modal: null }, '', `#${tab}`);
    trackEvent('pageview', { tab, referrer: document.referrer || '', path: `#${tab}` });
  }, []);

  // ── Swipe between tabs (native-app feel) ─────────────────────────────────
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
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || el.classList.contains('overflow-x-auto')
          || el.getAttribute('data-swipe-ignore') === 'true'
          || (el.scrollWidth > el.clientWidth + 2)) {
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

  const openPlaceModal = useCallback((place: Place) => {
    setSelectedPlace(place);
    window.history.pushState({ tab: null, modal: 'place', id: place.id }, '', `#place/${place.id}`);
    trackEvent('place_click', { place_id: place.id, place_name: place.name, category: place.category });
    trackEvent('pageview', { tab: 'place_detail', place_id: place.id, place_name: place.name, path: `#place/${place.id}` });
  }, []);

  const openEventModal = useCallback((event: TMEvent) => {
    setSelectedEvent(event);
    window.history.pushState({ tab: null, modal: 'event', id: event.id }, '', `#event/${event.id}`);
    trackEvent('event_click', { event_id: event.id, event_name: event.name });
    trackEvent('pageview', { tab: 'event_detail', event_id: event.id, event_name: event.name, path: `#event/${event.id}` });
  }, []);

  const closePlaceModal = useCallback(() => setSelectedPlace(null), []);
  const closeEventModal = useCallback(() => setSelectedEvent(null), []);

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
      // If going back from a modal, close it
      if (selectedPlace) { setSelectedPlace(null); return; }
      if (selectedEvent) { setSelectedEvent(null); return; }
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
  }, [selectedPlace, selectedEvent, activeTab, showAdmin]);

  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [tooFarPlaceId, setTooFarPlaceId] = useState<string | null>(null);

  const [siteBanner, setSiteBanner] = useState<BannerConfig | null>(null);
  const [mapProvider, setMapProvider] = useState<'google' | 'apple' | 'auto'>('apple');
  const [enrichedDataEnabled, setEnrichedDataEnabled] = useState(true);

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
    ]).then(([siteRes, bannersRes, enrichedRes]: [{ data: { value: Record<string, unknown> } | null }, { data: { value: unknown[] } | null }, { data: { value: boolean } | null }]) => {
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
      });
  }, []);

  const handleCheckIn = useCallback((placeId: string) => {
    // Allow un-checking without proximity
    if (checkedIn.has(placeId)) {
      setCheckedIn(prev => {
        const next = new Set(prev);
        next.delete(placeId);
        saveCheckins(next);
        return next;
      });
      setCheckInError(null);
      return;
    }

    // Require location for checking IN
    if (!coords) {
      setCheckInError('Enable location to check in — you need to be near the place!');
      requestGeo();
      setTimeout(() => setCheckInError(null), 5000);
      return;
    }

    // Find the place and verify proximity (within 0.05 miles / ~264 ft)
    const place = places.find(p => p.id === placeId);
    if (place?.lat && place?.lng) {
      const dist = distanceMiles(coords.lat, coords.lng, place.lat, place.lng);
      if (dist > 0.05) {
        setTooFarPlaceId(placeId);
        setTimeout(() => setTooFarPlaceId(null), 3000);
        return;
      }
    }

    // If place has no coordinates, we can't verify proximity — block check-in
    if (place && !place.lat && !place.lng) {
      setCheckInError('Check-in unavailable — this place has no location data.');
      setTimeout(() => setCheckInError(null), 4000);
      return;
    }

    // Proximity OK → check in
    // Haptic feedback: iOS/Android vibration on successful check-in
    if ('vibrate' in navigator) { try { navigator.vibrate([12, 40, 12]); } catch {} }
    tickStreak(); // advance daily check-in streak
    trackEvent('checkin', { place_id: placeId });
    setCheckedIn(prev => {
      const next = new Set(prev);
      next.add(placeId);
      saveCheckins(next);
      return next;
    });
    setCheckInError(null);
  }, [checkedIn, coords, places, requestGeo]);

  useEffect(() => {
    async function loadData() {
      // ── Phase 1: Load places — serve from cache instantly, refresh in bg ──
      const CACHE_KEY = 'abq_places_v3';
      const CACHE_TTL = 60 * 60 * 1000; // 1 hour

      // Timeout helper — defined at top so fast path can use it too
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

      let placesLoaded = false;

      // Serve from cache immediately (skips splash on repeat visits)
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { data, ts } = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            setPlaces(data.map(fixPlaceImages));
            setLoading(false);
            placesLoaded = true;
            // Cache still fresh — skip places network call, just load events
            if (Date.now() - ts < CACHE_TTL) {
              setEventsLoading(true);
              try {
                // Timeout added: if Supabase hangs, fall back to static events
                const sbEvents = await withTimeout(fetchEventsFromDB(), 8000);
                const allEvts = [
                  ...(sbEvents['ticketmaster'] || []),
                  ...(sbEvents['seatgeek'] || []),
                  ...(sbEvents['bandsintown'] || []),
                  ...(sbEvents['musicbrainz'] || []),
                ];
                // Merge in static events so "This Week" always has content
                const seenFast = new Set(allEvts.map((e: TMEvent) => e.id));
                const normFast = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
                const liveTitlesFast = new Set(allEvts.map((e: TMEvent) => normFast(e.name || '')));
                const staticFast = STATIC_TM_EVENTS.filter(e => {
                  if (seenFast.has(e.id)) return false;
                  if (liveTitlesFast.has(normFast(e.name || ''))) return false;
                  seenFast.add(e.id);
                  return true;
                });
                const fastMerged = [...allEvts, ...staticFast]
                  .filter(e => !isJunkEvent(e))
                  .map(tagAdultEvent);
                setEvents(fastMerged);
              } catch (err) {
                console.warn('[Events] fast path failed, using static fallback:', err);
                setEvents(STATIC_TM_EVENTS.filter(e => !isJunkEvent(e)).map(tagAdultEvent));
              }
              setEventsLoading(false);
              return;
            }
          }
        }
      } catch {}

      // ── Phase 0: Pre-seed from static JSON so the loading screen
      // almost never appears. /places-data.json is a same-origin static
      // file that the service worker caches on first load — it responds
      // in < 200 ms, well under the 1500 ms LoadingScreen delay.
      // Supabase then refreshes the data silently in the background.
      try {
        const staticR = await withTimeout(fetch('/places-data.json'), 8000);
        if (staticR.ok) {
          const staticPlaces = await staticR.json();
          if (Array.isArray(staticPlaces) && staticPlaces.length > 0) {
            setPlaces(staticPlaces.map(fixPlaceImages));
            placesLoaded = true;
            setLoading(false); // ← app visible immediately with static data
          }
        }
      } catch { /* SW cache miss on very first ever load — fall through */ }

      // Kick off events fetch NOW — in parallel with places — so Supabase only
      // needs to wake up once. Both promises race concurrently.
      setEventsLoading(true);
      const eventsPromise = withTimeout(fetchEventsFromDB(), 12000);

      try {
        // Refresh places from Supabase in background (app already visible above)
        const sbPlaces = await withTimeout(fetchPlacesFromDB(), 20000);
        if (Array.isArray(sbPlaces) && sbPlaces.length > 0) {
          const fixed = sbPlaces.map(fixPlaceImages);
          setPlaces(fixed);
          placesLoaded = true;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: fixed, ts: Date.now() })); } catch {}
        }
      } catch (err) {
        console.warn('[Places] Supabase failed or timed out:', err);
        // placesLoaded may already be true from static JSON pre-seed above
      } finally {
        setLoading(false); // ensure cleared regardless
      }

      if (!placesLoaded) {
        setLoadError(true);
        return;
      }

      // ── Phase 2: Await the events fetch that was already running ──────────
      try {
        let tmEvents: TMEvent[] = [];
        let ebEvents: TMEvent[] = [];
        let sgEvents: TMEvent[] = [];
        let bitEvents: TMEvent[] = [];
        let muEvents: TMEvent[] = [];

        try {
          // Await the promise that was started in parallel with places above
          const sbEvents = await eventsPromise;
          tmEvents = sbEvents['ticketmaster'] || [];
          sgEvents = sbEvents['seatgeek'] || [];
          bitEvents = sbEvents['bandsintown'] || [];
          muEvents = sbEvents['musicbrainz'] || [];
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
          tmEvents = safeArr(tmR); ebEvents = safeArr(ebR);
          sgEvents = safeArr(sgR); bitEvents = safeArr(bitR); muEvents = safeArr(muR);
        }

        // Synthetic result objects so the merge logic below stays unchanged
        const placesResult = { status: 'fulfilled' as const, value: [] };
        const tmResult   = { status: 'fulfilled' as const, value: { events: tmEvents } };
        const ebResult   = { status: 'fulfilled' as const, value: { events: ebEvents } };
        const sgResult   = { status: 'fulfilled' as const, value: { events: sgEvents } };
        const bitResult  = { status: 'fulfilled' as const, value: { events: bitEvents } };
        const muResult   = { status: 'fulfilled' as const, value: { events: muEvents } };

        // Merge all event sources with cross-source fuzzy deduplication
        const toArr = (r: PromiseSettledResult<unknown>) => {
          if (r.status !== 'fulfilled') return [];
          const v = r.value as unknown;
          if (Array.isArray(v)) return v;
          if (v && typeof v === 'object' && Array.isArray((v as Record<string,unknown>).events)) return (v as Record<string,unknown>).events as unknown[];
          return [];
        };

        // Normalize title for fuzzy matching: lowercase, strip non-alphanumeric, cap length
        const normTitle = (s: string) =>
          s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);

        // Index TM events by normalizedTitle|date so we can detect SeatGeek duplicates
        const _tmEvents: TMEvent[] = toArr(tmResult);
        const _tmIndex = new Map<string, TMEvent>();
        for (const e of _tmEvents) {
          const k = normTitle(e.name || '') + '|' + (e.dates?.start?.localDate || '');
          if (k !== '|') _tmIndex.set(k, e);
        }

        // For each SeatGeek event: merge ticket link into matched TM event, or keep as unique
        const _sgEvents: TMEvent[] = toArr(sgResult);
        const _sgOnlyEvents: TMEvent[] = [];
        for (const sg of _sgEvents) {
          const k = normTitle(sg.name || '') + '|' + (sg.dates?.start?.localDate || '');
          const tmMatch = _tmIndex.get(k);
          if (tmMatch) {
            // Duplicate: merge ticket links from both platforms into one card
            if (!tmMatch.ticketLinks) {
              tmMatch.ticketLinks = tmMatch.url
                ? [{ source: 'Ticketmaster', url: tmMatch.url }]
                : [];
            }
            if (sg.url) tmMatch.ticketLinks.push({ source: 'SeatGeek', url: sg.url });
          } else {
            _sgOnlyEvents.push(sg);
          }
        }

        const _ebEvents = toArr(ebResult);
        const _ebOnlyEvents: typeof _ebEvents = [];
        for (const eb of _ebEvents) {
          const k = normTitle(eb.name || '') + '|' + (eb.dates?.start?.localDate || '');
          const tmMatch = _tmIndex.get(k);
          if (tmMatch) {
            if (!tmMatch.ticketLinks) {
              tmMatch.ticketLinks = tmMatch.url
                ? [{ source: 'Ticketmaster', url: tmMatch.url }]
                : [];
            }
            if (eb.url) tmMatch.ticketLinks.push({ source: 'Eventbrite', url: eb.url });
          } else {
            _ebOnlyEvents.push(eb);
          }
        }
        // Ensure every TM event has its own Ticketmaster link; only add SeatGeek/Eventbrite
        // when there's a REAL specific URL (not a generic search page)
        for (const tmEv of _tmEvents) {
          if (!tmEv.ticketLinks) {
            tmEv.ticketLinks = tmEv.url ? [{source: 'Ticketmaster', url: tmEv.url}] : [];
          }
        }
        const seen = new Set<string>();
        const normT = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);

        // ── Deduplicate TM events by name+date before building the live list.
        // TM sometimes returns the same show under slightly different venue-name
        // spellings (e.g. "El Rey Theatre" vs "El Rey - NM"), producing duplicates
        // that the per-ID seen-set can't catch.  The _tmIndex map already groups by
        // normTitle|date, so iterating its values gives one entry per show.
        const dedupedTM = [..._tmIndex.values()];

        // Build merged list: live API events first, then static events that aren't duplicates
        const liveEvents = [
          ...dedupedTM,
          ..._ebOnlyEvents,
          ..._sgOnlyEvents,
          ...toArr(bitResult),
          ...toArr(muResult),
        ].filter((e: TMEvent) => {
          if (!e?.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });

        // Add static events, skipping IDs/titles already seen from live sources
        const liveTitles = new Set(liveEvents.map(e => normT(e.name || '')));
        const staticOnly = STATIC_TM_EVENTS.filter(e => {
          if (seen.has(e.id)) return false;
          if (liveTitles.has(normT(e.name || ''))) return false;
          seen.add(e.id);
          return true;
        });

        // ── ABQ metro geo filter ─────────────────────────────────────────────
        // Only show events whose venue city is in the greater ABQ metro area.
        // If no city is provided (e.g. static events hardcoded to ABQ), keep them.
        const ABQ_METRO_CITIES = new Set([
          'albuquerque', 'rio rancho', 'corrales', 'bernalillo', 'placitas',
          'edgewood', 'tijeras', 'cedar crest', 'sandia park', 'los lunas',
          'belen', 'bosque farms', 'moriarty', 'estancia', 'mountainair',
          'peralta', 'isleta', 'paradise hills', 'four hills', 'kirtland',
          'south valley', 'north valley', 'west mesa', 'rio rancho nm',
        ]);
        const isInMetro = (ev: TMEvent): boolean => {
          const city = (ev._embedded?.venues?.[0]?.city?.name || '').toLowerCase().trim();
          if (!city) return true; // no city info → assume local (static events)
          return ABQ_METRO_CITIES.has(city);
        };

        // ── CTA filter ───────────────────────────────────────────────────────
        // Hide events that have no actionable link (no ticket URL, no info URL).
        // These would otherwise dead-end at a "GET DIRECTIONS" button.
        const hasActionableLink = (ev: TMEvent): boolean => {
          if (ev.url) return true;
          if (ev.ticketLinks && ev.ticketLinks.some(l => l.url)) return true;
          return false;
        };

        const merged = [...liveEvents, ...staticOnly]
          .filter(isInMetro)
          .filter(hasActionableLink)
          .filter(e => !isJunkEvent(e))
          .map(tagAdultEvent);
        setEvents(merged);
      } catch (err) {
        console.error('[Events] Failed to load events:', err);
        // Events failing is non-fatal — static events are still available
        const normT = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
        const seen = new Set<string>();
        const staticOnly = STATIC_TM_EVENTS
          .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
          .filter(e => !isJunkEvent(e))
          .map(tagAdultEvent);
        setEvents(staticOnly);
      } finally {
        setEventsLoading(false);
      }
    }

    loadData();
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

  // ── Deep-link handler: open /place/{id} or #place/{id} once places load ───
  useEffect(() => {
    const id = pendingPlaceDeepLinkId.current;
    if (!id || places.length === 0) return;
    pendingPlaceDeepLinkId.current = null;
    const found = places.find(p => p.id === id);
    if (found) {
      setActiveTab('discover');
      setSelectedPlace(found);
      window.history.replaceState({ tab: 'discover', modal: 'place', id: found.id }, '', `#place/${found.id}`);
    }
  }, [places]);

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
        onPlaceSelect={(p) => setSelectedPlace(p)}
        onEventSelect={(e) => setSelectedEvent(e)}
        savedPlan={savedPlan}
        onToggleSavePlace={toggleSavedPlace}
        onToggleSaveEvent={toggleSavedEvent}
        isPlaceSaved={isPlaceSaved}
        isEventSaved={isEventSaved}
      />
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => { closePlaceModal(); window.history.back(); }}
          isCheckedIn={checkedIn.has(selectedPlace.id)}
          onCheckIn={() => handleCheckIn(selectedPlace.id)}
          checkInError={checkInError}
          tooFar={tooFarPlaceId === selectedPlace.id}
          user={user}
          onShowAuth={() => setShowAuthModal(true)}
          isSaved={isPlaceSaved(selectedPlace.id)}
          onToggleSave={() => toggleSavedPlace(selectedPlace)}
          mapProvider={resolvedMapProvider}
          enrichedDataEnabled={enrichedDataEnabled}
        />
      )}
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
        style={{ width: '100%', maxWidth: '480px', minHeight: '100dvh', background: 'white', overflowX: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.08)', paddingTop: 'env(safe-area-inset-top, 0px)' } as React.CSSProperties}
      >
        {/* Header — Urban Curator: white + hard 2px border-bottom */}
        <header
          className="flex-shrink-0 px-4 flex items-center justify-between"
          style={{
            position: 'sticky',
            top: 0,
            paddingTop: 'calc(var(--sat) + 12px)',
            paddingBottom: '12px',
            background: 'white',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            zIndex: 40,
          }}
        >
          <button className="flex items-center gap-2" onClick={() => { setActiveTab('discover'); window.scrollTo(0, 0); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <img src="/logo-static.png" alt="ABQ Unplugged" style={{ height: '32px', width: 'auto' }} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="w-9 h-9 flex items-center justify-center" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--ink)' }}>search</span>
            </button>
            <button
              onClick={requestGeo}
              className="w-9 h-9 flex items-center justify-center"
              style={{ background: 'white', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
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
        <main className="flex-1" style={{ paddingBottom: 'calc(var(--sab) + 110px)', touchAction: 'pan-y', overscrollBehaviorX: 'none' } as React.CSSProperties}
          onTouchStart={onMainTouchStart} onTouchMove={onMainTouchMove} onTouchEnd={onMainTouchEnd}>
          {activeTab === 'discover' && (
            <DiscoverScreen
              places={places}
              events={events}
              eventsLoading={eventsLoading}
              onPlaceSelect={openPlaceModal}
              onEventSelect={openEventModal}
              coords={coords}
              geoRequested={geoRequested}
              geoSilentPending={geoSilentPending}
              geoError={geoError}
              onRequestGeo={requestGeo}
              checkedIn={checkedIn}
              onCheckIn={handleCheckIn}

              onNavigatePlaces={(cat, search, vibeLabel, vibeGradient) => { setPlacesNavCat(cat); setPlacesNavSearch(search); setPlacesNavVibe(vibeLabel ? `${vibeLabel}|||${vibeGradient || ''}` : ''); setPlacesNavKey(k => k + 1); setActiveTab('places'); window.scrollTo({ top: 0, behavior: 'instant' }); }}
              onNavigateEvents={(genre) => { setEventsNavGenre(genre || ''); setActiveTab('events'); }}
              prefs={prefs}/>
          )}
          {activeTab === 'events' && (
            <EventsScreen events={events} onEventSelect={openEventModal} initialSearch={eventsNavSearch} initialGenre={eventsNavGenre} />
          )}
          {activeTab === 'places' && (
            <PlacesScreen
              places={places}
              onPlaceSelect={openPlaceModal}
              coords={coords}
              geoRequested={geoRequested}
              geoSilentPending={geoSilentPending}
              geoError={geoError}
              onRequestGeo={requestGeo}
              checkedIn={checkedIn}
              onCheckIn={handleCheckIn}
              tooFarPlaceId={tooFarPlaceId}
              navKey={placesNavKey}
              navCat={placesNavCat}
              navSearch={placesNavSearch}
              navVibe={placesNavVibe}/>
          )}
          {activeTab === 'plan' && (
            <PlanScreen
              savedPlan={savedPlan}
              onPlaceSelect={openPlaceModal}
              onEventSelect={openEventModal}
              onRemovePlace={(id) => { setSavedPlan(prev => { const n = prev.filter(p => !(p.type === 'place' && (p.data as Place).id === id)); savePlanToStorage(n); return n; }); }}
              onRemoveEvent={(id) => { setSavedPlan(prev => { const n = prev.filter(p => !(p.type === 'event' && (p.data as TMEvent).id === id)); savePlanToStorage(n); return n; }); }}
              onClearAll={() => { setSavedPlan([]); localStorage.removeItem('abq-saved-plan'); }}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              checkedIn={checkedIn}
              user={user}
              places={places}
              onSignIn={() => setShowAuthModal(true)}
              onSignOut={() => {
                // Clear session immediately (sync) so UI updates right away on mobile
                const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                if (sbKey) localStorage.removeItem(sbKey);
                setUser(null);
                // Also do the async server-side invalidation in the background
                supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              }}
              onUsernameChange={async () => { const { data: { user: fresh } } = await supabase.auth.getUser(); if (fresh) setUser(fresh); }}
              onAdmin={user?.email === ADMIN_EMAIL ? () => { setCurrentHash('#admin'); window.history.pushState({}, '', '#admin'); } : undefined}
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
            borderTop: '1px solid rgba(0,0,0,0.06)',
            background: '#faf8f5',
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
                background: isActive ? 'var(--ink)' : '#f5f3f0',
                border: 'none',
                borderRadius: 8,
                margin: '6px 3px 6px',
                position: 'relative' as const,
                top: 0,
                boxShadow: isActive
                  ? '0 4px 0 #0a0a0a, 0 2px 8px rgba(0,0,0,0.15)'
                  : '0 4px 0 #d5d0c8, 0 2px 6px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'top 0.1s ease, box-shadow 0.1s ease, background 0.15s ease',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '22px',
                  color: isActive ? 'white' : '#555',
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
                  color: isActive ? 'white' : '#555',
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
              <input autoFocus type="text" placeholder="Search places, events..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && globalSearch.trim()) { trackEvent('search', { query: globalSearch.trim(), context: 'events' }); setEventsNavSearch(globalSearch.trim()); setActiveTab('events'); setShowSearch(false); } }} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', fontFamily: 'Public Sans, sans-serif' }} />
              <button onClick={() => setShowSearch(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>close</span></button>
            </div>
            {globalSearch.trim() && (
              <div style={{display:'flex',gap:'8px',width:'100%'}}>
                <button onClick={() => { trackEvent('search', { query: globalSearch.trim(), context: 'events' }); setEventsNavSearch(globalSearch.trim()); setActiveTab('events'); setShowSearch(false); }} style={{flex:1,padding:'12px',background:'var(--brand)',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontFamily:'Public Sans, sans-serif',fontWeight:'600',cursor:'pointer'}}>Search Events</button>
                <button onClick={() => { trackEvent('search', { query: globalSearch.trim(), context: 'places' }); setPlacesNavCat('All'); setPlacesNavSearch(globalSearch.trim()); setPlacesNavKey(k => k + 1); setActiveTab('places'); setShowSearch(false); }} style={{flex:1,padding:'12px',background:'#026cdf',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontFamily:'Public Sans, sans-serif',fontWeight:'600',cursor:'pointer'}}>Search Places</button>
              </div>
            )}
          </div>
        </div>
      )}
</div>

      {/* Detail Modals */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => { closePlaceModal(); window.history.back(); }}
          isCheckedIn={checkedIn.has(selectedPlace.id)}
          onCheckIn={() => handleCheckIn(selectedPlace.id)}
          checkInError={checkInError}
          tooFar={tooFarPlaceId === selectedPlace.id}
          user={user}
          onShowAuth={() => setShowAuthModal(true)}
          isSaved={isPlaceSaved(selectedPlace.id)}
          onToggleSave={() => toggleSavedPlace(selectedPlace)}
          mapProvider={resolvedMapProvider}
          enrichedDataEnabled={enrichedDataEnabled}
        />
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
