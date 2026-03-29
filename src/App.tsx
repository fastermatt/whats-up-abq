import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from './lib/supabase';
import { fetchPlacesFromDB, fetchEventsFromDB } from './lib/db';
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


// Inject global keyframe for card fade-in (CSS-only, no JS observers)
if (typeof document !== 'undefined' && !document.getElementById('card-fade-style')) {
  const s = document.createElement('style');
  s.id = 'card-fade-style';
  s.textContent = '@keyframes cardFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }';
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
  ticketLinks?: Array<{ source: string; url: string }>;
  images?: TMImage[];
  dates?: {
    start?: { localDate?: string; localTime?: string };
  };
  _embedded?: {
    venues?: Array<{
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
      location?: { longitude?: string; latitude?: string };
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
    url: ev.ticketUrl || undefined,
    _source: isFreeInfo ? 'local' : (ev.source || '').toLowerCase().replace(/\s+/g, ''),
    _isAdult: ev.is21Plus === true || undefined,
    images: ev.image ? [{ url: ev.image }] : undefined,
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

function hiResUrl(url: string): string {
  if (!url || !url.includes('places.googleapis.com')) return url;
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
        try { localStorage.setItem(GEO_GRANTED_KEY, 'true'); } catch {}
      },
      err => {
        setError(err.message);
        // Clear saved grant if user denied / revoked
        if (err.code === 1 /* PERMISSION_DENIED */) {
          try { localStorage.removeItem(GEO_GRANTED_KEY); } catch {}
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

  return { coords, error, requested, request };
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
    await _fbSetDoc('users', uid, {
      checkIns: [...checkIns],
      updatedAt: new Date().toISOString(),
    });
    // Update leaderboard entry
    await _fbSetDoc('leaderboard', uid, {
      displayName: displayName || 'Anonymous',
      count,
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
        background: '#D4EF4D',
        padding: `2px ${Math.round(blockH * 0.28)}px`,
        display: 'inline-flex',
        alignItems: 'center',
        border: '2px solid #1A1A1A',
      }}>
        <span style={{
          fontFamily: 'Epilogue, Inter, sans-serif',
          fontWeight: 900,
          fontSize: `${abqSize}px`,
          color: '#1A1A1A',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>ABQ</span>
      </div>
      {/* Wordmark */}
      <span style={{
        fontFamily: 'Epilogue, Inter, sans-serif',
        fontWeight: 900,
        fontSize: `${unplSize}px`,
        color: '#1A1A1A',
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
  const [error, setError] = useState(false);
  const resolvedSrc = src ? hiResUrl(src) : '';
  const bg = gradient || hashGradient(alt);

  if (!resolvedSrc || error) {
    return (
      <div
        className={className}
        style={{ background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        aria-label={alt}
      >
        {showLabel && alt && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Epilogue, sans-serif', fontWeight: 900, fontSize: '13px', textAlign: 'center', padding: '8px', lineHeight: 1.2 }}>
            {alt}
          </span>
        )}
      </div>
    );
  }
  return (
    <img
      src={resolvedSrc}
      alt={alt || ''}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
    />
  );
}

// ─── Category Data ──────────────────────────────────────────────────────────

const PLACE_CATEGORIES = [
  { label: 'All',            icon: '✨', value: 'All' },
  { label: 'Restaurants',    icon: '🍽️', value: 'restaurant' },
  { label: 'Coffee',         icon: '☕', value: 'coffee' },
  { label: 'Bars',           icon: '🍺', value: 'bar' },
  { label: 'Parks',          icon: '🌳', value: 'park' },
  { label: 'Fitness',        icon: '💪', value: 'fitness' },
  { label: 'Arts',           icon: '🎨', value: 'arts' },
  { label: 'Shopping',       icon: '🛍️', value: 'shop' },
  { label: 'Entertainment',  icon: '🎭', value: 'entertainment' },
  { label: 'Museums',        icon: '🏛️', value: 'museum' },
  { label: 'Hotels',         icon: '🏨', value: 'hotel' },
];

const EVENT_GENRES = [
  'All', 'Music', 'Sports', 'Comedy', 'Arts', 'Community', 'Free',
];

// ─── Geo Banner ──────────────────────────────────────────────────────────────

function GeoBanner({
  coords, error, requested, onRequest,
}: {
  coords: GeoCoords | null;
  error: string | null;
  requested: boolean;
  onRequest: () => void;
}) {
  if (coords) return null;

  if (error) return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#1ebaeb', borderBottom: '2px solid #1A1A1A' }}>
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#1A1A1A', fontSize: '20px' }}>location_off</span>
      <p className="text-xs font-bold flex-1" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>
        Enable location to see distances &amp; sort by nearby
      </p>
      <button
        onClick={onRequest}
        className="text-xs font-black px-3 py-1.5 flex-shrink-0"
        style={{ background: '#1A1A1A', color: 'white', border: '2px solid #1A1A1A', fontFamily: 'Inter, sans-serif' }}
      >
        Retry
      </button>
    </div>
  );

  if (requested) return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#1ebaeb', borderBottom: '2px solid #1A1A1A' }}>
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#1A1A1A', fontSize: '20px' }}>my_location</span>
      <p className="text-xs font-bold flex-1" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>Getting your location…</p>
    </div>
  );

  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{ background: '#1ebaeb', borderBottom: '2px solid #1A1A1A' }}
    >
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#1A1A1A', fontSize: '20px' }}>near_me</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>Find things near you</p>
        <p className="text-xs" style={{ color: 'rgba(0,0,0,0.6)', fontFamily: 'Inter, sans-serif' }}>Share location for distances &amp; "Near Me"</p>
      </div>
      <button
        onClick={onRequest}
        className="text-xs font-black px-3 py-1.5 flex-shrink-0"
        style={{ background: '#1A1A1A', color: 'white', border: '2px solid #1A1A1A', fontFamily: 'Inter, sans-serif' }}
      >
        Enable
      </button>
    </div>
  );
}

// ─── Place Card ─────────────────────────────────────────────────────────────

const PlaceCard = React.memo(function PlaceCard({
  place, onClick, distance, isCheckedIn, onCheckIn,
}: {
  place: Place;
  onClick: () => void;
  distance?: number;
  isCheckedIn?: boolean;
  onCheckIn?: (e: React.MouseEvent) => void;
}) {
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || '';
  return (
    <button
      onClick={onClick}
      className="bg-white overflow-hidden text-left w-full"
      style={{ border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A', animation: 'cardFadeIn 0.3s ease both', contain: 'layout paint' }}
    >
      <div className="relative" style={{ height: '140px' }}>
        <ImageWithFallback
          src={place.thumbnail || place.image}
          alt={place.name}
          className="w-full h-full object-cover"
          gradient={'var(--brand-gradient)'}
          showLabel={!place.image}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-2 left-2">
          <span
            className="text-xs font-bold text-white px-2 py-0.5"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            {catEmoji}
          </span>
        </div>
        {distance != null && (
          <div className="absolute top-2 right-2">
            <span
              className="text-xs font-bold text-white px-1.5 py-0.5 flex items-center gap-0.5"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>near_me</span>
              {formatDist(distance)}
            </span>
          </div>
        )}
        {isCheckedIn && (
          <div className="absolute bottom-2 left-2">
            <span
              className="text-xs font-bold text-white px-1.5 py-0.5"
              style={{ background: '#1A1A1A' }}
            >
              ✓ Visited
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p
          className="font-black text-sm leading-snug text-gray-900"
          style={{ fontFamily: 'Epilogue, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {place.name}
        </p>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          {place.rating ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <span className="text-yellow-400 text-xs">★</span>
              <span className="text-xs font-bold text-gray-700">{place.rating.toFixed(1)}</span>
              {place.reviewCount ? (
                <span className="text-xs truncate" style={{ color: '#666' }}>
                  ({place.reviewCount >= 1000 ? (place.reviewCount / 1000).toFixed(1) + 'k' : place.reviewCount})
                </span>
              ) : null}
            </div>
          ) : <div className="flex-1" />}
          {onCheckIn && (
            <button
              onClick={onCheckIn}
              className="text-xs font-black px-2 py-1 flex-shrink-0"
              style={{
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.06em',
                background: isCheckedIn ? '#1A1A1A' : '#1ebaeb',
                color: isCheckedIn ? 'white' : '#1A1A1A',
                border: '1.5px solid #1A1A1A',
                borderRadius: 0,
              }}
            >
              {isCheckedIn ? '✓ Visited' : 'Check In'}
            </button>
          )}
        </div>
      </div>
    </button>
  );
});

// ─── Event Card ─────────────────────────────────────────────────────────────

const EventCard = React.memo(function EventCard({ event, onClick }: { event: TMEvent; onClick: () => void }) {
  const imgSrc = getBestEventImage(event.images);
  const venue = event._embedded?.venues?.[0];
  const category = getEventCategory(event);
  const price = event.priceRanges?.[0];

  const fadeRef = useFadeIn();
  return (
    <button
      ref={fadeRef}
      onClick={onClick}
      className="bg-white overflow-hidden text-left w-full flex"
      style={{ border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A', borderRadius: 0, minHeight: '100px' }}
    >
      <div className="flex-shrink-0 relative overflow-hidden" style={{ width: '110px' }}>
        {imgSrc ? (
          <img src={hiResUrl(imgSrc)} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--brand-gradient)' }}
          >
            <span className="text-3xl">♪</span>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <span
            className="text-xs font-bold text-white px-2 py-0.5 inline-block mb-1.5"
            style={{ background: '#1A1A1A', fontFamily: 'Inter, sans-serif', borderRadius: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            {category}
          </span>
          {event._isAdult && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded inline-block mb-1.5 ml-1"
              style={{ background: '#1c1c1e', color: '#fff', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}
            >
              21+
            </span>
          )}
          <p
            className="font-black text-sm leading-snug text-gray-900"
            style={{ fontFamily: 'Epilogue, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
          >
            {event.name}
          </p>
        </div>
        <div className="mt-2">
          {venue && (
            <p className="text-xs text-gray-500 flex items-center gap-0.5 truncate">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
              {venue.name}
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
              {event.dates?.start?.localDate ? formatDate(event.dates.start.localDate) : 'Date TBD'}
              {event.dates?.start?.localTime ? ' · ' + formatTime(event.dates.start.localTime) : ''}
            </p>
            {price && (
              <p className="text-xs text-gray-500">From ${Math.round(price.min || 0)}</p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

// ─── Place Detail Modal ──────────────────────────────────────────────────────

function PlacePhotoGallery({ place }: { place: Place }) {
  const allPhotos = [place.image, ...(place.additionalImages ?? [])].filter(Boolean) as string[];
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

function PlaceDetailModal({
  place, onClose, isCheckedIn, onCheckIn, checkInError, tooFar, user, onShowAuth,
}: {
  place: Place;
  onClose: () => void;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  checkInError?: string | null;
  tooFar?: boolean;
  user: User | null;
  onShowAuth: () => void;
}) {
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || '';
  const mapsQuery = encodeURIComponent((place.address || place.name) + ' Albuquerque NM');

  return (
    <div className="fixed inset-0 z-50 flex justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="flex flex-col overflow-y-auto w-full" style={{ maxWidth: '480px', background: 'white' }}>
      <div className="relative flex-shrink-0" style={{ height: '260px' }}>
        <PlacePhotoGallery place={place} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', zIndex: 3 }}
        >
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <div className="absolute bottom-4 left-4 right-4" style={{ zIndex: 3, pointerEvents: 'none' }}>
          <span
            className="text-xs font-bold text-white px-2.5 py-1 rounded"
            style={{ background: 'var(--brand)', pointerEvents: 'auto' }}
          >
            {catEmoji} {place.category}
          </span>
          <h2
            className="text-white font-black text-2xl mt-2 leading-tight"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            {place.name}
          </h2>
        </div>
      </div>

      <div className="px-5 py-4 pb-10">
        {/* Rating + Check In row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {place.rating && (
            <div className="flex items-center gap-1 bg-white rounded-lg px-3 py-2" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.12)' }}>
              <span className="text-yellow-400">★</span>
              <span className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>
                {place.rating.toFixed(1)}
              </span>
              {place.reviewCount && (
                <span className="text-xs" style={{ color: '#666' }}>({place.reviewCount.toLocaleString()})</span>
              )}
            </div>
          )}
          {place.priceLevel != null && place.priceLevel > 0 && (
            <div className="bg-white rounded-lg px-3 py-2" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.12)' }}>
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
              fontFamily: 'Epilogue, sans-serif',
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

        {place.description && (
          <p className="text-gray-700 text-sm leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
            {place.description}
          </p>
        )}

        {[
          place.address && { icon: 'location_on', text: place.address },
          place.hours && { icon: 'schedule', text: place.hours },
          place.phone && { icon: 'phone', text: place.phone },
        ]
          .filter(Boolean)
          .map((item: any, i) => (
            <div
              key={i}
              className="flex items-start gap-3 mb-3 bg-white rounded-lg p-3"
              style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: '18px', color: 'var(--brand)', marginTop: '1px' }}
              >
                {item.icon}
              </span>
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
                {item.text}
              </p>
            </div>
          ))}

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
          href={`https://maps.google.com/?q=${mapsQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-4 text-center text-white font-black text-sm rounded-lg mt-2"
          style={{ background: 'var(--brand-gradient)', fontFamily: 'Epilogue, sans-serif' }}
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
    <div className="bg-white rounded-lg p-4" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
          style={{ background: 'var(--brand-gradient)', fontFamily: 'Epilogue, sans-serif' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-black text-gray-900 truncate" style={{ fontFamily: 'Epilogue, sans-serif' }}>
              {review.userName}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{dateStr}</span>
          </div>
          <OutletRating value={review.rating} size="sm" />
        </div>
      </div>
      {review.text && (
        <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
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
          <h3 className="font-black text-gray-900 text-base" style={{ fontFamily: 'Epilogue, sans-serif' }}>
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
                style={{ background: 'var(--brand)', fontFamily: 'Epilogue, sans-serif' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                Write Review
              </button>
            : <button
                onClick={onShowAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-white"
                style={{ background: 'var(--brand)', fontFamily: 'Epilogue, sans-serif' }}
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
          <p className="text-xs text-gray-600 flex-1" style={{ fontFamily: 'Inter, sans-serif' }}>
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
        <div className="mb-4 rounded-lg p-4" style={{ background: 'white', boxShadow: '4px 4px 0 rgba(0,0,0,0.12)' }}>
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-600 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
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
              fontFamily: 'Inter, sans-serif',
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
                fontFamily: 'Epilogue, sans-serif',
              }}
            >
              {submitting ? 'Posting…' : 'Post Review'}
            </button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading && (
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          Loading reviews…
        </p>
      )}
      {!loading && reviews.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
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

// ─── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({ event, onClose }: { event: TMEvent; onClose: () => void }) {
  const imgSrc = getBestEventImage(event.images);
  const venue = event._embedded?.venues?.[0];
  const category = getEventCategory(event);
  const price = event.priceRanges?.[0];
  const mapsQuery = encodeURIComponent(
    (venue?.address?.line1 || venue?.name || event.name) + ' Albuquerque NM'
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="flex flex-col overflow-y-auto w-full" style={{ maxWidth: '480px', background: 'white' }}>
      <div className="relative flex-shrink-0" style={{ height: '260px' }}>
        {imgSrc ? (
          <img src={hiResUrl(imgSrc)} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--brand-gradient)' }}
          >
            <span style={{ fontSize: '72px' }}>♪</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
        >
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <span
            className="text-xs font-bold text-white px-2.5 py-1 rounded"
            style={{ background: 'var(--brand)' }}
          >
            {category}
          </span>
          <h2
            className="text-white font-black text-xl mt-2 leading-tight"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            {event.name}
          </h2>
        </div>
      </div>

      <div className="px-5 py-4 pb-10">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
            <p className="text-xs text-gray-400 mb-1">Date</p>
            <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}>
              {event.dates?.start?.localDate ? formatDate(event.dates.start.localDate) : 'TBD'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-3" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
            <p className="text-xs text-gray-400 mb-1">Time</p>
            <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}>
              {event.dates?.start?.localTime ? formatTime(event.dates.start.localTime) : 'TBD'}
            </p>
          </div>
          {venue && (
            <div
              className="col-span-2 bg-white rounded-lg p-3"
              style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}
            >
              <p className="text-xs text-gray-400 mb-1">Venue</p>
              <p className="font-bold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                {venue.name}
              </p>
              {venue.address?.line1 && (
                <p className="text-xs text-gray-500 mt-0.5">{venue.address.line1}</p>
              )}
            </div>
          )}
          {price && (
            <div className="col-span-2 bg-white rounded-lg p-3" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
              <p className="text-xs text-gray-400 mb-1">Price</p>
              <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>
                ${Math.round(price.min || 0)} – ${Math.round(price.max || 0)}
              </p>
            </div>
          )}
        </div>

        {/* Venue map */}
        {venue?.address?.line1 && (
          <div className="rounded-lg overflow-hidden mb-4" style={{ height: '160px' }}>
            <iframe
              title={`Map for ${venue.name}`}
              width="100%"
              height="160"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=15`}
              allowFullScreen
            />
          </div>
        )}

        <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(160,59,0,0.08)' }}>
          <p
            className="font-black text-sm mb-1"
            style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}
          >
            ⚡ UNPLUGGING TIP
          </p>
          <p className="text-xs text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            Put your phone away for the first 30 minutes. Let yourself fully arrive before documenting.
          </p>
        </div>

        {event.ticketLinks && event.ticketLinks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {event.ticketLinks.filter(l => l.source === 'Ticketmaster').map((link) => (
              <a
                key={link.source}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-5 py-3 text-white font-black text-sm rounded-lg"
                style={{
                  background: link.source === 'Ticketmaster'
                    ? 'linear-gradient(135deg, #026cdf, #02a7f0)'
                    : link.source === 'Eventbrite'
                    ? 'linear-gradient(135deg, #f05537, #ff7a5c)'
                    : 'linear-gradient(135deg, #d4184a, #ff5c5c)',
                  fontFamily: 'Epilogue, sans-serif',
                }}
              >
                <span>{link.source}</span>
                <span>GET TICKETS →</span>
              </a>
            ))}
          </div>
        ) : event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 text-center text-white font-black text-sm rounded-lg"
            style={{
              background: event._source === 'seatgeek'
                ? 'linear-gradient(135deg, #d4184a, #ff5c5c)'
                : event._source === 'local'
                ? 'linear-gradient(135deg, #0369a1, #38bdf8)'
                : 'var(--brand-gradient)',
              fontFamily: 'Epilogue, sans-serif',
            }}
          >
            {event._source === 'local' ? 'MORE INFO →' : 'GET TICKETS →'}
          </a>
        ) : (
          <a
            href={`https://maps.google.com/?q=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 text-center text-white font-black text-sm rounded-lg"
            style={{ background: 'var(--brand-gradient)', fontFamily: 'Epilogue, sans-serif' }}
          >
            GET DIRECTIONS →
          </a>
        )}
      </div>
    </div>
  </div>
  );
}

// ─── Why Unplug? Rotating Research Quotes ────────────────────────────────────

const BLOCKED_VENUES = ['Hooters', 'Twin Peaks', 'Twin Peaks Restaurant', 'Coyote Ugly', 'Tilted Kilt'];

const UNPLUG_QUOTES = [
  // Social connection & health
  { text: "People with strong social ties have a 50% increased likelihood of survival compared to those with weaker ties.", source: "Holt-Lunstad et al., PLOS Medicine", icon: "🤝" },
  { text: "Loneliness is as harmful to health as smoking 15 cigarettes a day.", source: "Holt-Lunstad, Brigham Young University", icon: "🤝" },
  { text: "Face-to-face contact is the bread and butter of social life — it's how we evolved to connect.", source: "Robin Dunbar, Oxford University", icon: "🤝" },
  { text: "Just 10 minutes of conversation with another person can improve memory and mental performance.", source: "Ybarra et al., University of Michigan", icon: "🤝" },
  { text: "People who feel more connected report 3× more daily joy than those who feel isolated.", source: "Journal of Happiness Studies", icon: "🤝" },
  { text: "Having five or more in-person friends reduces your risk of depression by 70%.", source: "Melbourne Institute of Applied Economic Research", icon: "🤝" },
  // Experiences vs objects
  { text: "People over-estimate happiness from buying things, and underestimate it from experiences.", source: "Van Boven & Gilovich, Cornell University", icon: "✨" },
  { text: "Experiences get better every time you think about them. Objects don't.", source: "Thomas Gilovich, Cornell Psychology", icon: "✨" },
  { text: "Novel real-world experiences create richer, more detailed memories than screen-based ones.", source: "Maguire et al., Nature Neuroscience", icon: "✨" },
  { text: "Shared experiences — even with strangers — make us happier than having them alone.", source: "Boothby et al., Psychological Science", icon: "✨" },
  { text: "You can't get the same neurological hit from watching something as from being in the room.", source: "Dr. Paul Zak, Claremont Graduate University", icon: "✨" },
  // Urban exploration
  { text: "Walking through new neighborhoods activates the hippocampus — the brain's exploration center.", source: "O'Keefe & Moser, Nobel Prize in Medicine 2014", icon: "🏙️" },
  { text: "People who explore local culture report significantly higher life satisfaction.", source: "American Journal of Community Psychology", icon: "🏙️" },
  { text: "Exploring your own city produces the same mood boost as traveling far away.", source: "Nawijn et al., Applied Research in Quality of Life", icon: "🏙️" },
  { text: "Local exploration builds place identity — a key predictor of resilience and belonging.", source: "Lewicka, Journal of Environmental Psychology", icon: "🏙️" },
  { text: "Cities with vibrant arts and live events see measurably lower rates of depression.", source: "World Health Organization, 2019", icon: "🏙️" },
  // Presence & phones
  { text: "A wandering mind is an unhappy mind. Being present is one of the strongest predictors of happiness.", source: "Killingsworth & Gilbert, Harvard — Science 2010", icon: "💫" },
  { text: "People who put their phones away during meals enjoy both the food and company significantly more.", source: "Dwyer et al., Journal of Experimental Social Psychology", icon: "💫" },
  { text: "The mere presence of a smartphone — even face down — reduces available cognitive capacity.", source: "Ward et al., Journal of Consumer Research", icon: "💫" },
  { text: "Brief moments of undivided attention with another person build real trust and emotional closeness.", source: "Turkle, MIT Media Lab", icon: "💫" },
  { text: "Screen-free time directly correlates with increased creativity and cognitive flexibility.", source: "Leroy, University of Washington", icon: "💫" },
  // Health & longevity
  { text: "Community engagement is one of the strongest predictors of longevity — stronger than diet or exercise alone.", source: "Blue Zones research, National Geographic", icon: "❤️" },
  { text: "Going to live events and performances is associated with a 14% lower risk of early death.", source: "Fancourt & Finn, BMJ 2019", icon: "❤️" },
  { text: "Physical presence activates oxytocin — the bonding hormone — in ways video calls cannot replicate.", source: "Dunbar, Evolutionary Psychology", icon: "❤️" },
  { text: "Social activities lower cortisol levels as effectively as meditation.", source: "Post, International Journal of Service Learning", icon: "❤️" },
  // Belonging & community
  { text: "Brief interactions with cashiers, neighbors, and café regulars improve mood more than most people predict.", source: "Epley & Schroeder, Journal of Experimental Psychology", icon: "🌟" },
  { text: "Feeling you belong to a place is associated with 40% higher reported wellbeing.", source: "Knight Foundation, Soul of the Community study", icon: "🌟" },
  { text: "Attending community events 3+ times a month doubles your sense of belonging.", source: "Pew Research Center, Community Connections Study", icon: "🌟" },
  { text: "People who regularly attend local events have stronger support networks in times of crisis.", source: "Putnam, Bowling Alone, Harvard University Press", icon: "🌟" },
  { text: "Even watching live sports alongside strangers creates real feelings of tribal belonging.", source: "Wann, Journal of Sport Behavior", icon: "🌟" },
  // Science bonus
  { text: "The brain produces far more dopamine from live, unpredictable experiences than from pre-recorded content.", source: "Schultz, Annual Review of Neuroscience", icon: "⚡" },
  { text: "Live music physically synchronizes heartbeats across audience members — a measurable form of group bonding.", source: "Vickhoff et al., Frontiers in Psychology", icon: "⚡" },
  { text: "Attending a cultural event even once a month is associated with a 31% increase in reported happiness.", source: "ONS Wellbeing Study, UK Office for National Statistics", icon: "⚡" },
  { text: "Humans who belong to meaningful community groups recover from illness faster.", source: "Cohen & Wills, Psychological Bulletin", icon: "⚡" },
  { text: "Children who play outside with others develop stronger empathy than screen-first peers.", source: "Gray, American Journal of Play", icon: "⚡" },
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
        <span style={{ fontSize: '18px', lineHeight: '1' }}>{q.icon}</span>
        <span style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '10px', fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#d4450a' }}>
          Why Unplug?
        </span>
      </div>
      <p className="unplug-quote" style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: 1.5, color: '#1a1a1a', marginBottom: '8px', marginTop: 0 }}>
        "{q.text}"
      </p>
      <p className="unplug-source" style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontStyle: 'italic', color: '#888', margin: 0 }}>
        — {q.source}
      </p>
    </div>
  );
}
const ABQ_FACTS = [
  { icon: '⛰️', fact: 'ABQ sits at 5,312 ft elevation — higher than Denver, CO.' },
  { icon: '☀️', fact: 'Albuquerque averages 310+ days of sunshine per year — one of the sunniest cities in the US.' },
  { icon: '🎈', fact: 'The Albuquerque International Balloon Fiesta draws 900,000+ visitors every October and is the largest hot air balloon event on Earth.' },
  { icon: '🏺', fact: 'Old Town Albuquerque was founded in 1706, making it one of the oldest European settlements in New Mexico.' },
  { icon: '🎬', fact: 'Breaking Bad was filmed almost entirely in ABQ — you can tour real filming locations around the city.' },
  { icon: '🌶️', fact: 'New Mexico is the only US state with an official state question: "Red or green?" — referring to chile sauce.' },
  { icon: '🏔️', fact: 'The Sandia Mountains turn vivid watermelon-pink at sunset — locals call the phenomenon "the watermelon."' },
  { icon: '🚡', fact: 'The Sandia Peak Tramway climbs 2,600 feet in just 15 minutes, offering a jaw-dropping view of the city below.' },
  { icon: '🌊', fact: 'The Rio Grande Bosque in ABQ is one of the largest cottonwood riparian forests in North America.' },
  { icon: '🦅', fact: 'The Rio Grande Bosque is a critical flyway for 400+ bird species, including sandhill cranes every winter.' },
  { icon: '🗿', fact: 'Petroglyph National Monument protects 20,000+ ancient rock carvings made by Ancestral Puebloans 400–700 years ago.' },
  { icon: '🛣️', fact: 'Historic Route 66 runs right through Central Avenue in ABQ — cruise it for retro diners, neon signs, and local flavor.' },
  { icon: '🎭', fact: 'The KiMo Theatre, built in 1927, is a stunning example of Pueblo Deco architecture and a National Historic Landmark.' },
  { icon: '🍺', fact: 'New Mexico has one of the highest concentrations of craft breweries per capita in the western US.' },
  { icon: '🌵', fact: 'ABQ sits in the high Chihuahuan Desert — expect warm sunny days and surprisingly cool evenings year-round.' },
  { icon: '🐍', fact: "The International Rattlesnake Museum in Old Town holds the world's largest collection of live rattlesnake species." },
  { icon: '💎', fact: "New Mexico's official state gem is turquoise — and the Turquoise Museum in ABQ has the world's largest private collection." },
  { icon: '🏜️', fact: 'The Albuquerque Volcanoes — a line of five cinder cones on the West Mesa — are visible from much of the city and are under 150,000 years old.' },
  { icon: '🎓', fact: 'New Mexico has more PhD holders per capita than almost any other US state.' },
  { icon: '⚛️', fact: "The world's first atomic bomb was detonated at Trinity Site, just 90 miles south of ABQ, on July 16, 1945." },
  { icon: '🌯', fact: 'The green chile cheeseburger is an unofficial state dish of New Mexico — and dozens of ABQ spots make an exceptional one.' },
  { icon: '🦎', fact: "New Mexico's state reptile is the New Mexico whiptail lizard — and it's all-female, reproducing without males." },
  { icon: '🌺', fact: 'The ABQ BioPark complex includes a world-class zoo, botanic garden, aquarium, and Tingley Beach — all connected by a scenic rail.' },
  { icon: '🏛️', fact: 'The National Museum of Nuclear Science and History in ABQ is the only congressionally chartered museum of its kind in the US.' },
  { icon: '🎨', fact: 'Meow Wolf was founded in Santa Fe, NM — the original House of Eternal Return is just an hour up I-25 and worth the trip.' },
  { icon: '🎪', fact: 'The Balloon Fiesta has been held every October since 1972 — it started with just 13 balloons; now it attracts 500+.' },
  { icon: '🚀', fact: "Spaceport America, the world's first purpose-built commercial spaceport, is just 2.5 hours south of ABQ." },
  { icon: '🌅', fact: '"Sandia" means watermelon in Spanish — the mountains were named for the deep pink glow they cast at dusk.' },
  { icon: '🏘️', fact: 'ABQ is nicknamed "The Duke City" after the Duke of Alburquerque (Spain) — an extra "r" was dropped over the centuries.' },
  { icon: '🌿', fact: 'Green chile season in late summer fills ABQ with the unmistakable smoky-sweet aroma of roasting chiles on street corners.' },
  { icon: '🎨', fact: 'New Mexico is said to have more registered artists per capita than any other US state.' },
  { icon: '🌄', fact: "ABQ's West Mesa is thought to be one of the best spots in the state to watch the sunset — especially during Balloon Fiesta." },
  { icon: '🏃', fact: 'The Paseo del Bosque Trail runs 16 miles along the Rio Grande and is entirely car-free — great for biking, jogging, or walking.' },
  { icon: '🐦', fact: "New Mexico's state bird is the Greater Roadrunner — and yes, they really do run fast (up to 20 mph)." },
  { icon: '🫙', fact: 'The biscochito is the official state cookie of New Mexico — an anise-flavored shortbread traditionally made with lard.' },
  { icon: '🏗️', fact: 'The University of New Mexico was founded in 1889 and is known for its Pueblo Revival architecture.' },
  { icon: '🌍', fact: "About 38% of ABQ residents speak Spanish at home, reflecting the city's deep Hispanic roots." },
  { icon: '🧭', fact: 'ABQ is at the crossroads of Interstates 25 and 40 — roughly the geographic center of New Mexico.' },
  { icon: '🍽️', fact: 'The Frontier Restaurant near UNM has been serving students since 1971 and is famous for its cinnamon rolls.' },
  { icon: '🌐', fact: 'New Mexico became the 47th US state on January 6, 1912.' },
  { icon: '❄️', fact: 'It snows in ABQ — usually a few times a winter, but it rarely lasts more than a day or two at lower elevations.' },
  { icon: '🦜', fact: 'Rio Grande Nature Center is a 270-acre state park within the city that protects wetlands and native wildlife.' },
  { icon: '🏹', fact: "ABQ's Maxwell Museum of Anthropology at UNM holds artifacts spanning 12,000+ years of human history in the region." },
  { icon: '⛺', fact: 'Kasha-Katuwe Tent Rocks National Monument — famous for its cone-shaped volcanic rock formations — is only 45 min from ABQ.' },
  { icon: '🎯', fact: "Kirtland Air Force Base on ABQ's south side is one of the largest military installations in New Mexico and a major local employer." },
  { icon: '🎠', fact: 'Old Town ABQ hosts festive markets throughout the year, including Luminaria Night every December.' },
  { icon: '📚', fact: 'The Albuquerque Museum was founded in 1967 and its permanent collection spans 400 years of Rio Grande history.' },
  { icon: '🚲', fact: 'ABQ has over 400 miles of bicycle routes — one of the most bike-friendly cities in the Southwest.' },
  { icon: '🧪', fact: 'Sandia National Laboratories in ABQ employs 14,000+ scientists and engineers and drives cutting-edge research.' },
  { icon: '🌙', fact: "ABQ's clear skies and high elevation make it one of the best cities in the US for amateur stargazing." },
  { icon: '🎲', fact: 'The original spelling of the city was "Alburquerque" — matching the Spanish town. The extra "r" disappeared in the 1800s.' },
  { icon: '🌋', fact: 'The Albuquerque Volcanoes are a row of five cinder cones that erupted 150,000 years ago — their lava flow forms the West Mesa.' },
  { icon: '🎻', fact: 'The National Hispanic Cultural Center in ABQ is one of the largest institutions dedicated to Hispanic arts and culture in the world.' },
  { icon: '🏊', fact: 'ABQ has a vibrant Día de los Muertos celebration every November — one of the largest outside of Mexico.' },
  { icon: '🦋', fact: "Bosque Preserve's cottonwoods turn golden every fall, creating a brilliant canopy that draws thousands of visitors." },
  { icon: '🎡', fact: 'The New Mexico State Fair (held in ABQ every September) is one of the top 10 largest state fairs in the US.' },
  { icon: '🏆', fact: 'ABQ is home to the Isotopes, the AAA Minor League affiliate of the Colorado Rockies — a beloved local team.' },
  { icon: '🌱', fact: 'New Mexico leads the US in production of chiles, piñon nuts, and pinto beans.' },
  { icon: '💫', fact: "The original Nob Hill neighborhood was inspired by San Francisco's wealthy Nob Hill and became ABQ's eclectic arts & dining hub." },
  { icon: '🦊', fact: "Coyotes are commonly spotted in the Rio Grande Bosque and even in ABQ's urban neighborhoods — especially at dawn and dusk." },
  { icon: '🎤', fact: "ABQ's cultural scene includes the New Mexico Symphony, the Albuquerque Repertory Theatre, and dozens of live music venues." },
  { icon: '🔭', fact: 'The Turquoise Trail — a scenic byway from ABQ to Santa Fe — passes through ghost towns including Madrid, once a coal-mining hub.' },
  { icon: '🛤️', fact: "ABQ's Rail Runner Express connects the city to Santa Fe — a 90-minute train ride through stunning high-desert scenery." },
  { icon: '🌊', fact: 'The Rio Grande has flowed through New Mexico for over a million years, carving river valleys that Puebloans called home.' },
  { icon: '🐢', fact: "New Mexico's state reptile is the western box turtle — commonly found in the scrublands around ABQ." },
  { icon: '🎸', fact: 'ABQ has a thriving local music scene spanning indie rock, mariachi, flamenco, and hip-hop.' },
  { icon: '🧠', fact: 'Los Alamos National Lab (90 min from ABQ) employs more PhDs per capita than almost any city in the world.' },
  { icon: '🏄', fact: 'The Adobe Bar at Taos Inn (2 hrs north of ABQ) has been pouring margaritas since 1936 — a legendary NM bucket list stop.' },
  { icon: '🌯', fact: "New Mexico's Official State Vegetables are the chile and the pinto bean — both officially adopted in 1965." },
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
  { id: 'thisWeek',      label: 'This Week Events',  emoji: '🗓️' },
  { id: 'nearYou',       label: 'Near You',          emoji: '📍' },
  { id: 'hiddenGems',    label: 'Hidden Gems',       emoji: '💎' },
  { id: 'vibes',         label: 'Explore by Vibe',   emoji: '✨' },
  { id: 'neighborhoods', label: 'Neighborhoods',     emoji: '🏘️' },
  { id: 'planWeekend',   label: 'Plan Your Weekend', emoji: '🗺️' },
  { id: 'todayPlan',     label: "Today's Plan",      emoji: '📋' },
  { id: 'wishlist',      label: 'My Wishlist',       emoji: '🤍' },
];

const INTEREST_OPTIONS = [
  { id: 'music',    label: '🎵 Music',        categories: ['entertainment'] },
  { id: 'sports',   label: '🏆 Sports',       categories: ['fitness', 'park'] },
  { id: 'arts',     label: '🎨 Arts',         categories: ['arts', 'museum'] },
  { id: 'outdoor',  label: '🌿 Outdoor',      categories: ['park'] },
  { id: 'family',   label: '👨‍👩‍👧 Family',     categories: ['entertainment', 'park'] },
  { id: 'active',   label: '🏃 Active',       categories: ['fitness'] },
  { id: 'coffee',   label: '☕ Coffee',       categories: ['restaurant'] },
  { id: 'food',     label: '🍽️ Food & Drink', categories: ['restaurant'] },
  { id: 'bars',     label: '🍺 Bars',         categories: ['bar'] },
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
  saveWishlist(exists ? current.filter(w => w.id !== item.id) : [...current, item]);
};
const isWishlisted = (id: string) => getWishlist().some(w => w.id === id);

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
  if (!visible || info.count < 2) return null;
  const emoji = info.count >= 7 ? '🔥' : info.count >= 3 ? '⚡' : '👋';
  const label = info.count >= 7
    ? `${info.count}-day streak! You're officially a local.`
    : info.count >= 3
    ? `${info.count} days running — ABQ local in the making 🌶️`
    : `Welcome back! Day ${info.count} in a row.`;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ background: '#1ebaeb', borderBottom: '2px solid #1A1A1A', animation: 'cardFadeIn 0.4s ease both' }}>
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ fontSize: '20px', lineHeight: 1 }}>{emoji}</span>
        <span className="text-sm font-black truncate" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>{label}</span>
      </div>
      <button onClick={() => setVisible(false)} className="flex-shrink-0 font-black" style={{ fontSize: '16px', lineHeight: 1, color: '#1A1A1A' }}>✕</button>
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
        <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Epilogue, sans-serif' }}>{dayOfWeek}'s Spot</h2>
        <span className="text-xs font-black uppercase" style={{ color: '#666', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>🗓 Changes daily</span>
      </div>
      <button onClick={() => onSelect(gem)} className="w-full relative overflow-hidden text-left"
        style={{ height: '180px', boxShadow: '4px 4px 0 #1A1A1A', border: '2px solid #1A1A1A', animation: 'cardFadeIn 0.45s ease both', borderRadius: 0 }}>
        {gem.image && <img src={gem.image} alt={gem.name} className="w-full h-full object-cover" style={{ filter: 'brightness(0.82)' }} />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(28,111,234,0.12) 0%, rgba(0,0,0,0.72) 100%)' }} />
        <div className="absolute top-3 left-3">
          <span className="text-xs font-black px-3 py-1"
            style={{ background: '#1ebaeb', color: '#1A1A1A', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1.5px solid #1A1A1A', borderRadius: 0 }}>
            ★ SPOT OF THE DAY
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-sm font-black w-8 h-8 flex items-center justify-center"
            style={{ background: '#1A1A1A', color: 'white', border: '2px solid white' }}>→</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-black text-xl leading-tight" style={{ fontFamily: 'Epilogue, sans-serif' }}>{gem.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/80 text-xs font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>{gem.category}</span>
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
          <p className="text-white font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>Built for ABQ, by ABQ</p>
          <p className="text-white/60 text-xs mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
            Free forever. If it helped you find something great — buy us a coffee.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="https://ko-fi.com/stopscrolling" target="_blank" rel="noopener noreferrer"
            className="text-xs font-black px-3 py-2 rounded-lg text-white"
            style={{ background: '#FF5E5B', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
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
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A', marginBottom: '12px' }}>
        <p className="text-sm font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', color: '#1A1A1A' }}>Did You Know?</p>
      </div>
      <div className="px-5">
        <button onClick={next} className="w-full p-5 text-left" style={{ background: '#D4EF4D', border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A', minHeight: 96, borderRadius: 0 }}>
          <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}>
            <span className="text-3xl">{facts[idx].icon}</span>
            <p className="text-sm mt-2 leading-relaxed font-semibold" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>{facts[idx].fact}</p>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {[0,1,2,3,4].map(d => (
                <div key={d} className="w-1.5 h-1.5 transition-colors" style={{ backgroundColor: d === idx % 5 ? '#1A1A1A' : 'rgba(0,0,0,0.2)' }} />
              ))}
            </div>
            <span className="text-xs font-black" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A', letterSpacing: '0.05em' }}>TAP FOR NEXT ›</span>
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
        <p className="text-xs font-black tracking-widest text-gray-400 uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>TODAY'S PLAN</p>
        <span className="text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #f3f4f6' }}>
        {plan.items.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round((done / plan.items.length) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>{done}/{plan.items.length}</span>
          </div>
        )}
        {plan.items.length === 0 && (
          <div className="py-5 text-center">
            <span className="text-2xl">📋</span>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>Add things to do in ABQ today</p>
          </div>
        )}
        {plan.items.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #f9fafb' }}>
            <button onClick={() => toggle(item.id)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors" style={{ border: `2px solid ${item.done ? '#22c55e' : '#d1d5db'}`, backgroundColor: item.done ? '#22c55e' : 'transparent' }}>
              {item.done && <span className="text-white text-xs font-bold">✓</span>}
            </button>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(item.text + ' Albuquerque NM')}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm" style={{ fontFamily: 'Inter, sans-serif', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#9ca3af' : '#111827', display: 'flex', alignItems: 'center' }}>{item.text}</a>
            <button onClick={() => remove(item.id)} className="text-gray-200 hover:text-gray-400 text-sm ml-2">✕</button>
          </div>
        ))}
        <div className="flex gap-2 p-3">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem(input)} placeholder="Add something to do..." className="flex-1 text-sm rounded-lg px-3 py-2 outline-none" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f9fafb' }} />
          <button onClick={() => addItem(input)} className="text-white rounded-lg px-4 py-2 text-sm font-bold" style={{ backgroundColor: '#f97316', fontFamily: 'Inter, sans-serif' }}>+</button>
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
        <p className="text-xs font-black tracking-widest text-gray-400 uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>MY WISHLIST</p>
        {items.length > 0 && <span className="text-xs font-bold" style={{ color: '#f97316', fontFamily: 'Inter, sans-serif' }}>{items.length} saved</span>}
      </div>
      {items.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-5 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🤍</span>
          <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>Tap ♡ on any event or place to save it here for later</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg p-4 flex items-center gap-3" style={{ border: '1px solid #f3f4f6' }}>
              <span className="text-xl flex-shrink-0">{item.type === 'event' ? '📅' : '📍'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{item.name}</p>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>{item.category}</p>
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
  coords, geoRequested, geoError, onRequestGeo,
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
  geoError: string | null;
  onRequestGeo: () => void;
  checkedIn: Set<string>;
  onCheckIn: (id: string) => void;
  onNavigatePlaces?: (cat: string, search: string) => void;
  onNavigateEvents?: () => void;
  prefs?: UserPrefs;
}) {
  const hidden = prefs?.hiddenSections ?? [];
  const interests = prefs?.preferredInterests ?? [];
  const HERO_PHRASES = ['Go Do Something', 'Time to Get Outside', 'Stop Doomscrolling', 'Put the Phone Down', 'Touch Some Grass', 'Go See People', 'Time to Unplug', 'Get Out of the House'];
  const [heroDisplay, setHeroDisplay] = useState('');
  useEffect(() => {
    const p = HERO_PHRASES[Math.floor(Math.random() * HERO_PHRASES.length)];
    let i = 0;
    const iv = setInterval(() => { i++; setHeroDisplay(p.slice(0, i)); if (i >= p.length) clearInterval(iv); }, 55);
    return () => clearInterval(iv);
  }, []);
  const featured = places.filter(p => p.isFeatured && !BLOCKED_VENUES.some(b => p.name?.toLowerCase().includes(b.toLowerCase()))).slice(0, 5);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const twoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    return events
      .filter(e => {
        const d = e.dates?.start?.localDate || '';
        return d >= today && d <= twoWeeks;
      })
      .filter(e => !e._isAdult)  // Discover "This Week" is always family-friendly
      .sort((a, b) => (a.dates?.start?.localDate || '').localeCompare(b.dates?.start?.localDate || ''))
      .slice(0, 6);
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

      {/* Hero */}
      <div className="px-5 pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid #1ebaeb', borderBottom: '2px solid #1A1A1A' }}>
        <p
          className="text-xs font-black uppercase mb-1"
          style={{ color: '#888', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em' }}
        >
          Greater ABQ Metro
        </p>
        <h1
          className="font-black uppercase leading-none"
          style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '48px', letterSpacing: '-0.04em', color: '#1A1A1A', lineHeight: 1 }}
        >
          {heroDisplay || ' '}
        </h1>
        <p className="mt-2" style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#666', fontWeight: 600, letterSpacing: '0.04em' }}>
          {places.length} places · {events.length} events
        </p>
      </div>

      {/* Geo Banner */}
      <GeoBanner
        coords={coords}
        error={geoError}
        requested={geoRequested}
        onRequest={onRequestGeo}
      />

      {/* This Week Events — brutalist table layout */}
      {!hidden.includes('thisWeek') && eventsLoading && upcomingEvents.length === 0 && (
        <div className="mb-5 mx-5" style={{ border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '2px solid #1A1A1A', backgroundColor: '#fff' }}>
            <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em' }}>Events This Week</h2>
            <span className="text-xs font-black" style={{ color: '#aaa' }}>Loading…</span>
          </div>
          {[0,1,2].map(i => (
            <div key={i} className="flex" style={{ borderBottom: i < 2 ? '1px solid #1A1A1A' : 'none', height: 64 }}>
              <div style={{ width: 62, backgroundColor: '#e8e8e8' }} />
              <div className="flex-1 px-3 py-2" style={{ backgroundColor: '#f5f5f5', opacity: 0.7 }} />
              <div style={{ width: 48, backgroundColor: '#e8e8e8', borderLeft: '1px solid #ccc' }} />
            </div>
          ))}
        </div>
      )}
      {!hidden.includes('thisWeek') && upcomingEvents.length > 0 && (
        <div className="mb-5 mx-5" style={{ border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '2px solid #1A1A1A', backgroundColor: '#fff' }}>
            <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', color: '#1A1A1A' }}>
              Events This Week
            </h2>
            <button
              onClick={() => onNavigateEvents?.()}
              className="text-xs font-black uppercase"
              style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A', letterSpacing: '0.06em' }}
            >
              → SEE ALL
            </button>
          </div>
          {/* Rows — top 6, sorted by date */}
          {[...upcomingEvents]
            .sort((a, b) => (a.dates?.start?.localDate || '').localeCompare(b.dates?.start?.localDate || ''))
            .slice(0, 6)
            .map((event, idx, arr) => {
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
                    style={{ width: 62, backgroundColor: '#1A1A1A', minHeight: 64 }}>
                    <span className="font-black uppercase" style={{ fontSize: 10, color: '#D4EF4D', fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em', lineHeight: 1 }}>
                      {month}
                    </span>
                    <span className="font-black" style={{ fontSize: 30, color: '#fff', fontFamily: 'Epilogue, sans-serif', lineHeight: 1.05 }}>
                      {day}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 px-3 py-2 flex flex-col justify-center overflow-hidden">
                    <p className="font-black text-sm leading-tight" style={{ fontFamily: 'Epilogue, sans-serif', color: '#1A1A1A', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                      {event.name}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#888', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
                      {[time, venueName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {/* Arrow */}
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 48, backgroundColor: '#D4EF4D', borderLeft: '1px solid #1A1A1A' }}>
                    <span className="font-black" style={{ fontSize: 18, color: '#1A1A1A' }}>→</span>
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {/* Daily Gem — spot of the day, date-seeded */}
      {places.length > 0 && <DailyGem places={places} onSelect={onPlaceSelect} />}

      {/* Trending Bento Grid */}
      {featured.length > 0 && (
        <div className="pb-5">
          <h2
            className="text-lg font-black uppercase tracking-tight mb-3 px-5"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            Trending Now
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
                  style={{ fontFamily: 'Epilogue, sans-serif' }}
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
                    style={{ fontFamily: 'Epilogue, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
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
          <div className="flex items-center justify-between px-5 py-3 mb-0" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A' }}>
            <h2
              className="text-sm font-black uppercase"
              style={{ fontFamily: 'Epilogue, sans-serif' }}
            >
              Near You
            </h2>
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--brand)', fontFamily: 'Inter, sans-serif' }}>
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
                style={{ width: '144px', border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A' }}
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
                    style={{ fontFamily: 'Inter, sans-serif' }}
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
          <div className="flex items-center justify-between px-5 py-3 mb-0" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A' }}>
            <h2
              className="text-sm font-black uppercase"
              style={{ fontFamily: 'Epilogue, sans-serif' }}
            >
              Hidden Gems
            </h2>
            <span className="text-xs font-black uppercase" style={{ color: '#666', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>
              ★ 4.5+ rated
            </span>
          </div>
          <div className="flex gap-3 px-5 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {sortByInterests(hiddenGems, interests).map(place => (
              <button key={place.id} onClick={() => onPlaceSelect(place)} className="flex-shrink-0" style={{ width: '136px', boxShadow: '4px 4px 0 #1A1A1A' }}>
                <div className="relative overflow-hidden mb-0" style={{ width: '136px', height: '136px', border: '2px solid #1A1A1A' }}>
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
                <p
                  className="text-xs font-bold text-gray-900 leading-tight text-left truncate mt-1"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {place.name}
                </p>
                <p className="text-xs text-left" style={{ color: '#666' }}>{place.category}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Explore by Vibe */}
      {!hidden.includes('vibes') && <div className="mb-6">
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A' }}>
          <p className="text-sm font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', color: '#1A1A1A' }}>Explore by Vibe</p>
        </div>
        <div className="grid grid-cols-3" style={{ gap: '0', borderLeft: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A', borderRight: '2px solid #1A1A1A' }}>
          {[
            { icon: 'park', label: 'Outdoor', cat: 'park' },
            { icon: 'restaurant', label: 'Food & Drink', cat: 'restaurant' },
            { icon: 'palette', label: 'Arts & Culture', cat: 'arts' },
            { icon: 'music_note', label: 'Live Music', cat: 'entertainment' },
            { icon: 'child_care', label: 'Family Fun', cat: 'park' },
            { icon: 'directions_run', label: 'Active', cat: 'fitness' },
          ].map(({ icon, label, cat }) => (
            <button key={label}
              className="flex flex-col items-center gap-1 p-3 transition-all active:bg-gray-100"
              style={{ background: 'white', border: 'none', borderRight: '2px solid #1A1A1A', borderBottom: '2px solid #1A1A1A', borderRadius: 0 }}
              onClick={() => onNavigatePlaces?.(cat, '')}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#1A1A1A', fontVariationSettings: "'FILL' 0, 'wght' 300" }}>{icon}</span>
              <span className="text-center leading-tight font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', letterSpacing: '0.08em', color: '#1A1A1A' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>}

      {/* ABQ Neighborhoods */}
      {!hidden.includes('neighborhoods') && <div className="mb-6">
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A' }}>
          <p className="text-sm font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', color: '#1A1A1A' }}>ABQ Neighborhoods</p>
        </div>
        <div className="grid grid-cols-2" style={{ gap: '0', borderLeft: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A', borderRight: '2px solid #1A1A1A' }}>
          {[
            { name: 'Old Town', desc: 'History, art & adobe', icon: 'account_balance', bg: '#566500' },
            { name: 'Nob Hill', desc: 'Eclectic & walkable', icon: 'local_cafe', bg: '#0057c2' },
            { name: 'Downtown', desc: 'Nightlife & events', icon: 'nightlife', bg: '#1A1A1A' },
            { name: 'Rio Grande', desc: 'Nature & trails', icon: 'nature', bg: '#1C6FEA' },
            { name: 'NE Heights', desc: 'Views & dining', icon: 'landscape', bg: '#8a9e00' },
            { name: 'South Valley', desc: 'Local flavor', icon: 'storefront', bg: '#D4EF4D' },
          ].map(({ name, desc, icon, bg }) => (
            <button key={name} className="p-4 text-left transition-all"
              style={{ backgroundColor: bg, borderRight: '2px solid #1A1A1A', borderBottom: '2px solid #1A1A1A', borderRadius: 0 }}
              onClick={() => onNavigatePlaces?.('All', name)}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: bg === '#D4EF4D' ? '#1A1A1A' : 'white', fontVariationSettings: "'FILL' 0, 'wght' 300" }}>{icon}</span>
              <p className="font-black text-sm mt-1" style={{ fontFamily: 'Epilogue, sans-serif', color: bg === '#D4EF4D' ? '#1A1A1A' : 'white' }}>{name}</p>
              <p className="text-xs" style={{ fontFamily: 'Inter, sans-serif', color: bg === '#D4EF4D' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)' }}>{desc}</p>
            </button>
          ))}
        </div>
      </div>}

      {/* Did You Know - animated rotating card */}
      <AnimatedFact />

      {/* Weekend Planner */}
      {!hidden.includes('planWeekend') && <div className="mb-6">
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A', marginBottom: '12px' }}>
          <p className="text-sm font-black uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', color: '#1A1A1A' }}>Plan Your Weekend</p>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { title: 'Morning Hike + Brunch', steps: ['Sandia Mountain foothills trail', 'Coffee at Flying Star Café', 'Brunch in Nob Hill'], bar: '#D4EF4D' },
            { title: 'Culture Day', steps: ['Explora Science Center', 'Lunch in Old Town', 'Albuquerque Museum'], bar: '#1ebaeb' },
            { title: 'Local Food Crawl', steps: ['Green chile breakfast at Frontier', 'Lunch at El Modelo', 'Drinks on Central Ave'], bar: '#D4EF4D' },
            { title: 'Nature Escape', steps: ['Rio Grande Bosque trail', 'Tingley Beach', 'Sunset at Petroglyph Monument'], bar: '#1ebaeb' },
          ].map(({ title, steps, bar }) => (
            <div key={title} className="flex" style={{ border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A', backgroundColor: '#fff' }}>
              {/* left accent bar */}
              <div style={{ width: 4, flexShrink: 0, backgroundColor: bar }} />
              <div className="flex-1 px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-black uppercase" style={{ fontFamily: 'Epilogue, sans-serif', color: '#1A1A1A', letterSpacing: '0.09em' }}>{title}</p>
                  <button
                    onClick={() => addToDayPlan(steps)}
                    className="text-xs font-black px-2 py-0.5"
                    style={{ backgroundColor: '#D4EF4D', color: '#1A1A1A', border: '1.5px solid #1A1A1A', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}
                  >
                    + plan
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs font-black w-5 h-5 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1A1A1A', color: '#D4EF4D' }}>{i + 1}</span>
                      <button onClick={() => window.dispatchEvent(new CustomEvent('plan-step-click',{detail:step}))} className="text-xs text-left leading-tight flex-1" style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>{step}</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>}

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
  show21Plus = false,
  onToggle21Plus,
}: {
  events: TMEvent[];
  onEventSelect: (e: TMEvent) => void;
  initialSearch?: string;
  show21Plus?: boolean;
  onToggle21Plus?: () => void;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);
  const [selectedGenre, setSelectedGenre] = useState('All');

  const filtered = useMemo(() => {
    let result = show21Plus ? events : events.filter(e => !e._isAdult);
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
          case 'Community':
            return seg === 'Community' || gen === 'Community' || seg === 'Festival' || gen === 'Festival' ||
              eventName.includes('festival') || eventName.includes('market') || eventName.includes('fair') ||
              eventName.includes('community') || eventName.includes('fiesta');
          case 'Free': {
            const prices = e.priceRanges;
            const isFree = !prices || prices.length === 0 ||
              prices.some(p => (p.min === 0 || p.min === undefined) && (p.max === 0 || p.max === undefined)) ||
              eventName.includes('free');
            return isFree;
          }
          default:
            return seg === selectedGenre || gen === selectedGenre;
        }
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          (e._embedded?.venues?.[0]?.name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, selectedGenre, search]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const da = a.dates?.start?.localDate || '9999';
        const db = b.dates?.start?.localDate || '9999';
        return da.localeCompare(db);
      }),
    [filtered]
  );

  return (
    <div className="w-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="px-5 pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid #1ebaeb', borderBottom: '2px solid #1A1A1A' }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand)', fontFamily: 'Inter, sans-serif' }}
        >
          What's Happening
        </p>
        <h1
          className="font-black uppercase leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '48px', letterSpacing: '-0.04em', color: '#1A1A1A' }}
        >
          Live Events<br />Near You
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          {events.length} upcoming events in Greater ABQ
        </p>
      </div>

      <div className="px-5 py-3" style={{ borderBottom: '2px solid #1A1A1A' }}>
        <div
          className="flex items-center gap-2 bg-white px-4 py-3"
          style={{ border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search events or venues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex px-5 overflow-x-auto" style={{ scrollbarWidth: 'none', position: 'sticky', top: 'calc(var(--sat) + 72px)', zIndex: 30, background: 'white', paddingTop: '12px', paddingBottom: '0px', borderBottom: '2px solid #1A1A1A' }}>
        {EVENT_GENRES.map(genre => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className="flex-shrink-0 px-3 py-2 text-xs font-black uppercase transition-all"
            style={{
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.1em',
              background: selectedGenre === genre ? '#1A1A1A' : 'white',
              color: selectedGenre === genre ? 'white' : '#1A1A1A',
              border: '1.5px solid #1A1A1A',
              marginRight: '-1.5px',
              borderRadius: 0,
              position: 'relative',
              zIndex: selectedGenre === genre ? 1 : 0,
              marginBottom: '12px',
            }}
          >
            {genre}
          </button>
        ))}
      </div>

      <div className="px-5 pb-2 flex items-center justify-between" style={{ borderBottom: '1px solid #eee', paddingTop: 10, paddingBottom: 10 }}>
        <p className="text-sm font-semibold text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          {sorted.length} event{sorted.length !== 1 ? 's' : ''}
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
        {/* 21+ toggle */}
        <button
          onClick={onToggle21Plus}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 700,
            color: show21Plus ? '#a03b00' : '#999',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 8,
            outline: show21Plus ? '1.5px solid #a03b00' : '1.5px solid #ddd',
          }}
        >
          <span style={{ fontSize: 14 }}>🔞</span>
          21+ events
          <span style={{
            width: 28, height: 16, borderRadius: 8, display: 'inline-block',
            background: show21Plus ? '#a03b00' : '#ccc', position: 'relative',
            transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: 2, left: show21Plus ? 14 : 2,
              width: 12, height: 12, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s',
            }} />
          </span>
        </button>
      </div>

      <div className="px-5 pb-28 flex flex-col gap-3">
        {sorted.map(event => (
          <div key={event.id} style={{position:'relative'}}>
            <EventCard event={event} onClick={() => onEventSelect(event)} />
            <button style={{position:'absolute',top:8,right:8,zIndex:10,background:'white',border:'2px solid #1A1A1A',borderRadius:0,width:34,height:34,minHeight:0,color:'#1A1A1A',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'2px 2px 0 #1A1A1A'}} onClick={(e)=>{e.stopPropagation();toggleWishlist({id:event.id,type:'event',name:event.name});}}><span className="material-symbols-outlined" style={{fontSize:'18px',fontVariationSettings:"'FILL' 0, 'wght' 400"}}>favorite</span></button>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>event_busy</span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>No events found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Places Screen ────────────────────────────────────────────────────────────

function PlacesScreen({
  places, onPlaceSelect, coords, geoRequested, geoError, onRequestGeo,
  checkedIn, onCheckIn,
  navKey = 0, navCat = 'All', navSearch = '',
}: {
  places: Place[];
  onPlaceSelect: (p: Place) => void;
  coords: GeoCoords | null;
  geoRequested: boolean;
  geoError: string | null;
  onRequestGeo: () => void;
  checkedIn: Set<string>;
  onCheckIn: (id: string) => void;
  navKey?: number;
  navCat?: string;
  navSearch?: string;
}) {
  const PAGE_SIZE = 48;
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortMode, setSortMode] = useState<'top' | 'near' | 'az'>('top');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 250ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { if (navKey > 0) { setSelectedCat(navCat || 'All'); setSearchInput(navSearch || ''); setSearch(navSearch || ''); } }, [navKey]);

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

  const filtered = useMemo(() => {
    let result = places.filter(isPlaceInMetro);
    if (selectedCat !== 'All') result = result.filter(p => p.category === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selectedCat, search]);

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
      <div className="px-5 pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid #1ebaeb', borderBottom: '2px solid #1A1A1A' }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand)', fontFamily: 'Inter, sans-serif' }}
        >
          Explore Greater ABQ
        </p>
        <h1
          className="font-black uppercase leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '48px', letterSpacing: '-0.04em', color: '#1A1A1A' }}
        >
          Places<br />to Go
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          {places.length} spots across Greater ABQ
        </p>
      </div>

      {/* Geo banner if no location yet */}
      <GeoBanner
        coords={coords}
        error={geoError}
        requested={geoRequested}
        onRequest={onRequestGeo}
      />

      {/* Search */}
      <div className="px-5 pb-3">
        <div
          className="flex items-center gap-2 bg-white px-4 py-3"
          style={{ border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search places..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex px-5 pb-0 overflow-x-auto" style={{ scrollbarWidth: 'none', borderBottom: '2px solid #1A1A1A', paddingBottom: '12px', paddingTop: '12px' }}>
        {PLACE_CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => setSelectedCat(cat.value)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-black uppercase transition-all"
            style={{
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.1em',
              background: selectedCat === cat.value ? '#1A1A1A' : 'white',
              color: selectedCat === cat.value ? 'white' : '#1A1A1A',
              border: '1.5px solid #1A1A1A',
              marginRight: '-1.5px',
              borderRadius: 0,
              position: 'relative',
              zIndex: selectedCat === cat.value ? 1 : 0,
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
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
            onClick={() => { if (s.disabled) { onRequestGeo(); } else { setSortMode(s.id); } }}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-black uppercase transition-all"
            title={s.disabled ? 'Enable location to sort by distance' : undefined}
            style={{
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.08em',
              background: sortMode === s.id ? '#1A1A1A' : 'white',
              color: sortMode === s.id ? 'white' : s.disabled ? '#bbb' : '#1A1A1A',
              border: '2px solid #1A1A1A',
              boxShadow: sortMode === s.id ? '4px 4px 0 #1A1A1A' : '3px 3px 0 rgba(0,0,0,0.15)',
              borderRadius: 0,
              opacity: s.disabled ? 0.5 : 1,
            }}
          >
            {s.id === 'near' && !coords && (
              <span className="material-symbols-outlined mr-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>location_off</span>
            )}
            {s.label}
          </button>
        ))}
        <p className="ml-auto text-xs text-gray-400 self-center" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                onCheckIn={e => { e.stopPropagation(); onCheckIn(place.id); }}
                />
              <button style={{position:'absolute',top:8,right:8,zIndex:10,background:'white',border:'2px solid #1A1A1A',borderRadius:0,width:32,height:32,minHeight:0,color:'#1A1A1A',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'2px 2px 0 #1A1A1A'}} onClick={(e)=>{e.stopPropagation();toggleWishlist({id:place.id,type:'place',name:place.name});}}>♡</button>
            </div>
          ))}
        </div>
        {/* Infinite scroll sentinel */}
        {displayCount < withPhotos.length && (
          <div ref={sentinelRef} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
              Loading more…
            </span>
          </div>
        )}
        {withPhotos.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>search_off</span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>No places found</p>
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
          <h2 className="text-2xl font-black uppercase tracking-tighter" style={{ fontFamily: 'Epilogue, sans-serif' }}>
            {mode === 'choose' ? 'Sign In' : (isSignUp ? 'Create Account' : 'Sign In')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5" style={{ fontFamily: 'Inter, sans-serif' }}>
          Sign in to sync your check-ins across devices and appear on the leaderboard.
        </p>

        {mode === 'choose' ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full rounded-lg py-3.5 font-bold text-sm border border-gray-200"
              style={{ fontFamily: 'Inter, sans-serif', background: '#fff' }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.58-13.47-8.71l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <button
              onClick={() => setMode('email')}
              className="w-full rounded-lg py-3.5 font-bold text-sm text-white"
              style={{ fontFamily: 'Inter, sans-serif', background: 'var(--brand)' }}
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
                  style={{ background: isSignUp === (i === 1) ? 'var(--brand)' : '#f5f5f5', color: isSignUp === (i === 1) ? 'white' : '#666', fontFamily: 'Inter, sans-serif' }}
                >{t}</button>
              ))}
            </div>
            {isSignUp && (
              <input
                type="text" placeholder="Display name (e.g. xplorer_abq)" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none"
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            )}
            <input
              type="email" placeholder="Email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
            <input
              type="password" placeholder="Password (min 6 chars)" required value={password}
              onChange={e => setPassword(e.target.value)} minLength={6}
              className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
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
              style={{ background: 'var(--brand)', fontFamily: 'Inter, sans-serif', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Please wait…' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            <button type="button" onClick={() => setMode('choose')}
              className="text-xs text-gray-400 text-center mt-1"
              style={{ fontFamily: 'Inter, sans-serif' }}
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
      padding: '24px', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', padding: '32px 28px',
        width: '100%', maxWidth: '380px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>👋</div>
        <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontWeight: 900, fontSize: '22px', margin: '0 0 6px' }}>
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
            fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: '8px',
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
            fontFamily: 'Inter, sans-serif', marginBottom: '10px',
            transition: 'background 0.2s',
          }}
        >
          {saved ? '✓ All set!' : saving ? 'Saving…' : 'Set Username'}
        </button>
        <button
          onClick={() => onDone()}
          style={{
            background: 'none', border: 'none', color: '#aaa', fontSize: '13px',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
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
        style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)', fontFamily: 'Inter, sans-serif' }}
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
            <div className="bg-white rounded-lg p-4" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Username</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value); setUsernameError(''); setUsernameSaved(false); }}
                  placeholder="e.g. xplorer_abq"
                  maxLength={20}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  style={{ fontFamily: 'Inter, sans-serif', outline: 'none' }}
                />
                <button
                  onClick={handleUsernameSave}
                  className="px-4 py-2 rounded-lg text-white text-sm font-bold flex-shrink-0"
                  style={{ background: usernameSaved ? '#2e7d32' : 'var(--brand)', fontFamily: 'Inter, sans-serif', minWidth: 64 }}
                >
                  {usernameSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              {usernameError && <p className="text-xs mt-1.5" style={{ color: '#c62828', fontFamily: 'Inter, sans-serif' }}>{usernameError}</p>}
              <p className="text-xs text-gray-400 mt-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>Shown on the leaderboard. Letters, numbers & underscores only.</p>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="w-full bg-white rounded-lg p-4 flex items-center gap-3 text-left"
              style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)', fontFamily: 'Inter, sans-serif' }}
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
          <div className="bg-white rounded-lg p-4" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Homescreen Sections</p>
            <div className="flex flex-col gap-3">
              {DISCOVER_SECTIONS.map(sec => {
                const visible = !prefs.hiddenSections.includes(sec.id);
                return (
                  <button key={sec.id} onClick={() => toggleSection(sec.id)} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sec.emoji}</span>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>{sec.label}</span>
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
          <div className="bg-white rounded-lg p-4" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Your Interests</p>
            <p className="text-xs text-gray-400 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Selected interests appear first in your feed</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(opt => {
                const active = prefs.preferredInterests.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleInterest(opt.id)}
                    className="px-3 py-1.5 rounded text-sm font-semibold transition-all"
                    style={{ fontFamily: 'Inter, sans-serif', background: active ? 'var(--brand)' : '#f3f4f6', color: active ? 'white' : '#374151', boxShadow: active ? '2px 2px 0 var(--brand)' : 'none' }}
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

const LEADERBOARD_SEEDS = [
  { name: 'xplorer_abq',      count: 47 },
  { name: 'roadrunner505',     count: 38 },
  { name: 'balloon_fiesta',    count: 31 },
  { name: 'oldtown_local',     count: 26 },
  { name: 'riograndevibes',    count: 19 },
  { name: 'nob_hill_nights',   count: 14 },
  { name: 'sandia_sunrise',    count: 9  },
  { name: 'tortilla_factory',  count: 6  },
];

interface LeaderboardRow { rank: number; name: string; count: number; isMe: boolean; uid?: string; }

function ProfileScreen({
  checkedIn, user, onSignIn, onSignOut, places, onUsernameChange,
}: {
  checkedIn: Set<string>;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  places: Place[];
  onUsernameChange?: (name: string) => void;
}) {
  const myCount = checkedIn.size;
  const level = getLevel(myCount);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);

  // Subscribe to live leaderboard from Firestore
  useEffect(() => {
      let cancelled = false;
      _fbGetAllDocs('leaderboard', 'count', false).then(snap => {
        if (!cancelled) {
          const rows: LeaderboardRow[] = snap.docs.map((d, i) => ({
            rank: i + 1,
            name: (d.data().display_name as string) || 'Explorer',
            count: (d.data().count as number) || 0,
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
    // Fallback: seed data + local user
    const rows = LEADERBOARD_SEEDS.map((s, i) => ({ rank: i + 1, name: s.name, count: s.count, isMe: false }));
    const insertAt = rows.findIndex(r => myCount >= r.count);
    const meEntry = { rank: 0, name: 'You', count: myCount, isMe: true };
    if (insertAt === -1) rows.push(meEntry); else rows.splice(insertAt, 0, meEntry);
    return rows.map((r, i) => ({ ...r, rank: i + 1 })).slice(0, 10);
  }, [lbRows, myCount, user]);

  const ACHIEVEMENTS = [
    { id: 'first',   icon: 'where_to_vote', label: 'First Check-in',  sub: '1 place',   unlocked: myCount >= 1  },
    { id: 'five',    icon: 'explore',       label: 'Explorer',        sub: '5 places',  unlocked: myCount >= 5  },
    { id: 'ten',     icon: 'hiking',        label: 'Adventurer',      sub: '10 places', unlocked: myCount >= 10 },
    { id: 'twenty',  icon: 'forest',        label: 'Trailblazer',     sub: '20 places', unlocked: myCount >= 20 },
    { id: 'thirty5', icon: 'footprint',     label: 'Pioneer',         sub: '35 places', unlocked: myCount >= 35 },
    { id: 'fifty',   icon: 'military_tech', label: 'Legend',          sub: '50 places', unlocked: myCount >= 50 },
  ];

  const nextLevel = getLevel(myCount + 1);
  const progressPct = myCount === 0 ? 0 : Math.min(100, Math.round((myCount / level.next) * 100));

  return (
    <div className="w-full px-5 pb-28" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="pt-5 pb-4" style={{ background: "url('/hero-texture.jpg') center/cover no-repeat, #E2E1DC", borderTop: '3px solid #1ebaeb', borderBottom: '2px solid #1A1A1A', marginLeft: '-20px', marginRight: '-20px', paddingLeft: '20px', paddingRight: '20px' }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand)', fontFamily: 'Inter, sans-serif' }}
        >
          Your Profile
        </p>
        <h1
          className="font-black uppercase leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '48px', letterSpacing: '-0.04em', color: '#1A1A1A' }}
        >
          Hey,<br />{(user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Explorer').split(' ')[0]}
        </h1>
      </div>

      {/* Sign in / out banner */}
      {!user ? (
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-between rounded-lg px-4 py-3 mb-4 text-white font-bold text-sm"
          style={{ background: 'var(--brand-gradient)', fontFamily: 'Inter, sans-serif', boxShadow: '3px 3px 0 var(--brand)' }}
        >
          <span>Sign in to sync check-ins & join the leaderboard</span>
          <span style={{ fontSize: '16px' }}>→</span>
        </button>
      ) : (
        <div
          className="w-full flex items-center justify-between rounded-lg px-4 py-3 mb-4"
          style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', fontFamily: 'Inter, sans-serif', boxShadow: '3px 3px 0 rgba(0,0,0,0.15)' }}
        >
          <div>
            <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>✅ Signed in & syncing your check-ins</p>
            <p className="text-xs mt-0.5" style={{ color: '#566500' }}>Check out the leaderboard below</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-xs font-bold flex-shrink-0 ml-3" style={{ color: '#1A1A1A' }}
            style={{ fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      )}

      {/* Customize Settings */}
      <ProfileSettingsPane user={user} onUsernameChange={onUsernameChange} onSignIn={onSignIn} />

      {/* Profile card */}
      <div
        className="flex items-center gap-4 bg-white rounded-lg p-4 mb-4"
        style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.12)' }}
      >
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: 'var(--brand-gradient)' }}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-2xl font-black" style={{ fontFamily: 'Epilogue, sans-serif' }}>
              {level.emoji}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg truncate" style={{ fontFamily: 'Epilogue, sans-serif' }}>
            {user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ABQ Explorer'}
          </p>
          <p className="text-sm text-gray-500">Greater ABQ Metro</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--brand)', fontFamily: 'Inter, sans-serif' }}>
            {level.emoji} {level.label}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Places\nVisited', val: myCount.toString() },
          { label: 'Next\nLevel', val: myCount >= 50 ? '★' : (level.next - myCount).toString() + ' away' },
          { label: 'Rank', val: leaderboard.find(r => r.isMe)?.rank ? '#' + leaderboard.find(r => r.isMe)!.rank : '—' },
        ].map(s => (
          <div
            key={s.label}
            className="bg-white rounded-lg p-3 text-center"
            style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}
          >
            <p
              className="text-2xl font-black"
              style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}
            >
              {s.val}
            </p>
            <p className="text-xs text-gray-500 leading-tight whitespace-pre-line">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {myCount >= 50 ? (
        <div className="bg-white rounded-lg p-4 mb-4 text-center" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
          <span style={{ fontSize: '28px' }}>★</span>
          <p className="font-black text-sm mt-1" style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}>Max Level Reached!</p>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>You're a Legend — {myCount} places explored!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-4 mb-4" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
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
          <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            Check in to {level.next - myCount} more place{level.next - myCount !== 1 ? 's' : ''} to level up!
          </p>
        </div>
      )}

      {/* Achievements */}
      <div className="flex items-center px-0 py-3 mb-0" style={{ borderBottom: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A' }}>
        <h2 className="text-sm font-black uppercase" style={{ fontFamily: 'Epilogue, sans-serif' }}>Achievements</h2>
      </div>
      {/* Abutting border grid — no gap, container has left+top, cells have right+bottom */}
      <div className="grid grid-cols-3 mb-5" style={{ gap: 0, borderLeft: '2px solid #1A1A1A', borderTop: '2px solid #1A1A1A', borderRight: '2px solid #1A1A1A' }}>
        {ACHIEVEMENTS.map(a => (
          <div
            key={a.id}
            className="flex flex-col items-center justify-center gap-1 py-5 px-2"
            style={{
              borderRight: '2px solid #1A1A1A',
              borderBottom: '2px solid #1A1A1A',
              background: a.unlocked ? '#D4EF4D' : 'white',
              marginRight: '-2px',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '36px',
                color: a.unlocked ? '#1A1A1A' : '#D0D0D0',
                fontVariationSettings: a.unlocked
                  ? "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 48"
                  : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48",
              }}
            >
              {a.icon}
            </span>
            <p className="text-center leading-tight font-black uppercase" style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '8px',
              letterSpacing: '0.08em',
              color: a.unlocked ? '#1A1A1A' : '#CCCCCC',
            }}>
              {a.label}
            </p>
            <p className="text-center" style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '8px',
              color: a.unlocked ? '#566500' : '#DDDDDD',
              letterSpacing: '0.04em',
            }}>
              {a.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="flex items-center justify-between mb-3">
        <h2
          className="font-black text-base uppercase tracking-tight"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Leaderboard
        </h2>
        <span className="text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
          Self-reported check-ins
        </span>
      </div>

      <div className="flex flex-col gap-2 mb-5">
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
              style={{ fontFamily: 'Epilogue, sans-serif', color: row.rank <= 3 ? 'var(--brand)' : '#999' }}
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
              style={{ fontFamily: 'Inter, sans-serif', color: row.isMe ? 'var(--brand)' : '#333' }}
            >
              {row.isMe ? 'You' : row.name}
            </span>
            <span
              className="flex-shrink-0 text-sm font-black"
              style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}
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
        <p className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
          ️ Rankings are based on self-reported check-ins. We can't verify visits, but we trust you to explore honestly. The real prize is the memories you make!
        </p>
      </div>

      {/* Visited Places */}
      {myCount > 0 && (
        <>
          <h2
            className="font-black text-base uppercase tracking-tight mb-3"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
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
                  style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.10)' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                    style={{ background: hashGradient(p.name) }}
                  >
                    {p.image && (
                      <img src={hiResUrl(p.image)} alt={p.name} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ fontFamily: 'Epilogue, sans-serif' }}>{p.name}</p>
                    <p className="text-xs" style={{ fontFamily: 'Inter, sans-serif', color: '#666' }}>{p.category}</p>
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

// ─── Add-to-Home-Screen Prompt ─────────────────────────────────────────────────
// Shows once on iOS Safari (not in standalone mode) after a short delay.
// Dismissed state is stored in localStorage for 14 days.

const INSTALL_DISMISSED_KEY = 'abq_install_dismissed';
const INSTALL_DISMISSED_DAYS = 14;

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS device check
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // Safari check (not Chrome/Firefox/etc on iOS)
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|opios|mercury/i.test(ua);
  return isIos && isSafari;
}

function isInStandaloneMode(): boolean {
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

function AddToHomePrompt() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not already installed
    if (!isIosSafari() || isInStandaloneMode()) return;
    // Check if recently dismissed
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissed) {
      const age = Date.now() - parseInt(dismissed, 10);
      if (age < INSTALL_DISMISSED_DAYS * 24 * 60 * 60 * 1000) return;
    }
    // Show after 4 seconds
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

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
            style={{ width: 56, height: 56, borderRadius: 4, boxShadow: '3px 3px 0 rgba(0,0,0,0.15)' }}
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
      setTimeout(() => setVisible(true), 3000);
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
    if (!prompt) return;
    (prompt as any).prompt();
    const { outcome } = await (prompt as any).userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      setPrompt(null);
    } else {
      dismiss();
    }
  };

  if (!visible || !prompt) return null;

  return (
    <>
      <style>{`
        @keyframes abqAndroidSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes abqAndroidSlideDown {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(100%); }
        }
      `}</style>
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.35)',
          opacity: hiding ? 0 : 1, transition: 'opacity 0.38s',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        padding: '20px 24px calc(28px + env(safe-area-inset-bottom))',
        fontFamily: 'Manrope, -apple-system, sans-serif',
        animation: hiding
          ? 'abqAndroidSlideDown 0.38s ease forwards'
          : 'abqAndroidSlideUp 0.44s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e0e0e0', margin: '0 auto 18px' }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <img
            src="/apple-touch-icon-180.png"
            alt="ABQ Unplugged"
            style={{ width: 56, height: 56, borderRadius: 4, boxShadow: '3px 3px 0 rgba(0,0,0,0.15)' }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#1c1c1e', lineHeight: 1.2 }}>
              Install ABQ Unplugged
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
              Add to your home screen for the best experience
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 4,
              background: '#f2f2f2', border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: '#333',
            }}
          >Not now</button>
          <button
            onClick={install}
            style={{
              flex: 2, padding: '13px 0', borderRadius: 4,
              background: 'var(--brand)', border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15, color: '#fff',
            }}
          >Install App</button>
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
        fontFamily: 'Inter, sans-serif',
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
  'ABQ weather is the best ☀️',
  'Not a long wait longer…',
  'Finding your next adventure…',
  'Green chile is always the answer 🌶️',
  'Scanning the Duke City…',
];

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

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
            fontFamily: 'Inter, sans-serif',
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

interface BannerConfig { message: string; type: 'info' | 'success' | 'warning'; active: boolean; }

function SiteBanner({ banner }: { banner: BannerConfig | null }) {
  if (!banner?.active || !banner.message) return null;
  const color = { info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#1d4ed8' }, success: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#15803d' }, warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#92400e' } }[banner.type] ?? { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#1d4ed8' };
  return (
    <div style={{ background: color.bg, borderBottom: `1px solid ${color.border}`, padding: '9px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: color.text, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>{banner.message}</p>
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
  boxShadow: '2px 2px 0 rgba(0,0,0,0.10)',
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
            {p.image && (
              <img src={p.image} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
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

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: 'explore' },
  { id: 'events',   label: 'Events',   icon: 'confirmation_number' },
  { id: 'places',   label: 'Places',   icon: 'storefront' },
  { id: 'profile',  label: 'Profile',  icon: 'person' },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('discover');
  const [showSearch, setShowSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [placesNavKey, setPlacesNavKey] = useState(0);
  const [placesNavCat, setPlacesNavCat] = useState('All');
  const [placesNavSearch, setPlacesNavSearch] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [events, setEvents] = useState<TMEvent[]>([]);
  const [eventsNavSearch, setEventsNavSearch] = useState('');
  const [show21Plus, setShow21Plus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TMEvent | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(loadCheckins);

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
          setActiveTab(pendingTab);
          if (!session.user.user_metadata?.display_name) setShowUsernameSetup(true);
        }
      } else {
        setAuthReady(true);
      }
    });
  }, []);

  useEffect(() => {
    const { data: { subscription: unsub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
          setActiveTab(pendingTab);
          const hasUsername = !!(u.user_metadata?.display_name);
          if (!hasUsername) setShowUsernameSetup(true);
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

  const { coords, error: geoError, requested: geoRequested, request: requestGeo } = useGeolocation();

  // ── Browser history management (prevents swipe-back leaving the site) ──
  const navigateTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    window.history.pushState({ tab, modal: null }, '', `#${tab}`);
  }, []);

  const openPlaceModal = useCallback((place: Place) => {
    setSelectedPlace(place);
    window.history.pushState({ tab: null, modal: 'place', id: place.id }, '', `#place/${place.id}`);
  }, []);

  const openEventModal = useCallback((event: TMEvent) => {
    setSelectedEvent(event);
    window.history.pushState({ tab: null, modal: 'event', id: event.id }, '', `#event/${event.id}`);
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

    // Sync URL to current active tab (do NOT hardcode 'discover' — that overrides post-login navigation)
    window.history.replaceState({ tab: activeTab, modal: null }, '', `#${activeTab}`);

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      // If going back from a modal, close it
      if (selectedPlace) { setSelectedPlace(null); return; }
      if (selectedEvent) { setSelectedEvent(null); return; }
      // If going back between tabs, go to that tab (or default to discover)
      if (state?.tab) {
        setActiveTab(state.tab);
      } else {
        // Push a new state to prevent leaving the site
        window.history.pushState({ tab: activeTab, modal: null }, '', `#${activeTab}`);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPlace, selectedEvent, activeTab, showAdmin]);

  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [tooFarPlaceId, setTooFarPlaceId] = useState<string | null>(null);

  const [siteBanner, setSiteBanner] = useState<BannerConfig | null>(null);

  useEffect(() => {
    _fbGetDoc('config', 'siteConfig', 'key').then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.banner?.active) setSiteBanner(d.banner as BannerConfig);
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
      const CACHE_KEY = 'abq_places_v1';
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
            setPlaces(data);
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

      try {
        const sbPlaces = await withTimeout(fetchPlacesFromDB(), 8000);
        if (Array.isArray(sbPlaces) && sbPlaces.length > 0) {
          setPlaces(sbPlaces);
          placesLoaded = true;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: sbPlaces, ts: Date.now() })); } catch {}
        }
      } catch (err) {
        console.warn('[Places] Supabase failed or timed out, trying JSON fallback:', err);
        try {
          const r = await fetch('/places-data.json');
          if (r.ok) { setPlaces(await r.json()); placesLoaded = true; }
        } catch {}
      } finally {
        setLoading(false); // ← Show the app NOW; events will stream in shortly
      }

      if (!placesLoaded) {
        setLoadError(true);
        return;
      }

      // ── Phase 2: Load events in the background (non-blocking) ─────────────
      setEventsLoading(true);
      try {
        let tmEvents: TMEvent[] = [];
        let ebEvents: TMEvent[] = [];
        let sgEvents: TMEvent[] = [];
        let bitEvents: TMEvent[] = [];
        let muEvents: TMEvent[] = [];

        try {
          // Timeout: if Supabase hangs, throw so the catch can serve static fallback
          const sbEvents = await withTimeout(fetchEventsFromDB(), 8000);
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
        // Auto-generate SeatGeek & Eventbrite search links for all TM events
        for (const tmEv of _tmEvents) {
          if (!tmEv.ticketLinks) {
            tmEv.ticketLinks = tmEv.url ? [{source: 'Ticketmaster', url: tmEv.url}] : [];
          }
          const _hasSG = tmEv.ticketLinks.some(l => l.source === 'SeatGeek');
          const _hasEB = tmEv.ticketLinks.some(l => l.source === 'Eventbrite');
          const _q = encodeURIComponent(tmEv.name || '');
          if (!_hasSG) tmEv.ticketLinks.push({source: 'SeatGeek', url: `https://seatgeek.com/search?q=${_q}&current_location=albuquerque`});
          if (!_hasEB) {
            const _slug = (tmEv.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            tmEv.ticketLinks.push({source: 'Eventbrite', url: `https://www.eventbrite.com/d/nm--albuquerque/${_slug}/`});
          }
        }
        const seen = new Set<string>();
        // Build merged list: live API events first, then static events that aren't duplicates
        const liveEvents = [
          ..._tmEvents,
          ..._ebOnlyEvents,
          ..._sgOnlyEvents,
          ...toArr(bitResult),
          ...toArr(muResult),
        ].filter((e: TMEvent) => {
          if (!e?.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });

        // Add static events, skipping IDs already seen from live sources
        console.log('[Static] STATIC_TM_EVENTS count:', STATIC_TM_EVENTS.length, 'TODAY:', TODAY);
        const normT = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
        const liveTitles = new Set(liveEvents.map(e => normT(e.name || '')));
        const staticOnly = STATIC_TM_EVENTS.filter(e => {
          if (seen.has(e.id)) return false;
          if (liveTitles.has(normT(e.name || ''))) return false;
          seen.add(e.id);
          return true;
        });
        console.log('[Static] staticOnly count:', staticOnly.length, 'merged total:', liveEvents.length + staticOnly.length);

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

  // ── Admin route ──
  if (showAdmin) {
    if (!user || user.email !== ADMIN_EMAIL) {
      return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px', background: 'var(--brand-bg-screen)' }}>
          <ABQUnpluggedLogo size={82} />
          <p style={{ fontFamily: 'Epilogue, sans-serif', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>Admin Access</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#666', textAlign: 'center', lineHeight: 1.5 }}>
            Sign in with the owner account ({ADMIN_EMAIL}) to access the admin panel.
          </p>
          <button onClick={() => setShowAuthModal(true)} style={{ padding: '13px 28px', background: 'var(--brand)', color: 'white', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '15px' }}>
            Sign In
          </button>
          <button onClick={() => { setCurrentHash("#discover"); window.history.replaceState({}, '', '#discover'); }} style={{ color: '#aaa', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            Back to App
          </button>
          {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </div>
      );
    }
    return <AdminPanel user={user} onBack={() => { setCurrentHash("#discover"); window.history.replaceState({}, '', '#discover'); }} />;
  }

  if (loading) return <LoadingScreen />;
  if (loadError) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 px-8" style={{ background: 'var(--brand-bg-screen)' }}>
      <ABQUnpluggedLogo size={88} />
      <h2 className="text-xl font-black uppercase tracking-tighter text-center" style={{ fontFamily: 'Epilogue, sans-serif', color: 'var(--brand)' }}>Couldn't Load Content</h2>
      <p className="text-sm text-gray-500 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>Check your connection and try again.</p>
      <button
        onClick={() => { setLoadError(false); setLoading(true); }}
        className="mt-2 px-6 py-3 rounded-lg font-bold text-sm text-white"
        style={{ background: 'var(--brand)', fontFamily: 'Inter, sans-serif' }}
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
          background: #F8FAF8;
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

      <AddToHomePrompt />
      <AndroidInstallPrompt />
      <OfflineBanner />
      <div
        className="flex flex-col mx-auto relative"
        style={{ width: '100%', maxWidth: '480px', minHeight: '100dvh', background: 'white', overflowX: 'hidden' }}
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
            borderBottom: '2px solid #1A1A1A',
            zIndex: 40,
          }}
        >
          <div className="flex items-center gap-2">
            <img src="/logo-static.png" alt="ABQ Unplugged" style={{ height: '32px', width: 'auto' }} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="w-9 h-9 flex items-center justify-center" style={{ background: 'white', border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#1A1A1A' }}>search</span>
            </button>
            <button
              onClick={requestGeo}
              className="w-9 h-9 flex items-center justify-center"
              style={{ background: 'white', border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A' }}
              title={coords ? 'Location active' : 'Enable location'}
              aria-label={coords ? 'Location active' : 'Enable location'}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '18px',
                  color: coords ? '#566500' : '#888',
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
        <main className="flex-1" style={{ paddingBottom: 'calc(var(--sab) + 72px)' }}>
          {activeTab === 'discover' && (
            <DiscoverScreen
              places={places}
              events={events}
              eventsLoading={eventsLoading}
              onPlaceSelect={openPlaceModal}
              onEventSelect={openEventModal}
              coords={coords}
              geoRequested={geoRequested}
              geoError={geoError}
              onRequestGeo={requestGeo}
              checkedIn={checkedIn}
              onCheckIn={handleCheckIn}

              onNavigatePlaces={(cat, search) => { setPlacesNavCat(cat); setPlacesNavSearch(search); setPlacesNavKey(k => k + 1); setActiveTab('places'); }}
              onNavigateEvents={() => setActiveTab('events')}
              prefs={prefs}/>
          )}
          {activeTab === 'events' && (
            <EventsScreen events={events} onEventSelect={openEventModal} initialSearch={eventsNavSearch}
              show21Plus={show21Plus} onToggle21Plus={() => setShow21Plus(v => !v)} />
          )}
          {activeTab === 'places' && (
            <PlacesScreen
              places={places}
              onPlaceSelect={openPlaceModal}
              coords={coords}
              geoRequested={geoRequested}
              geoError={geoError}
              onRequestGeo={requestGeo}
              checkedIn={checkedIn}
              onCheckIn={handleCheckIn}
            
              navKey={placesNavKey}
              navCat={placesNavCat}
              navSearch={placesNavSearch}/>
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
            paddingBottom: 'var(--sab)',
            borderTop: '2px solid #1A1A1A',
            background: 'white',
            zIndex: 40,
          }}
        >
          {NAV_ITEMS.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => navigateTab(item.id)}
              aria-label={item.label}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-none"
              style={{
                minHeight: '52px',
                background: activeTab === item.id ? '#1A1A1A' : 'white',
                borderRight: idx < NAV_ITEMS.length - 1 ? '1.5px solid #1A1A1A' : 'none',
                borderRadius: 0,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '22px',
                  color: activeTab === item.id ? 'white' : '#555',
                  fontVariationSettings:
                    activeTab === item.id
                      ? "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24"
                      : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {item.icon}
              </span>
              <span
                className="font-black uppercase"
                style={{
                  color: activeTab === item.id ? 'white' : '#555',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '8px',
                  letterSpacing: '0.1em',
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>
            {showSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '60px' }} onClick={() => setShowSearch(false)}>
          <div style={{ background: 'white', borderRadius: '4px', width: '90%', maxWidth: '480px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--brand)', fontSize: '22px' }}>search</span>
              <input autoFocus type="text" placeholder="Search places, events..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && globalSearch.trim()) { setEventsNavSearch(globalSearch.trim()); setActiveTab('events'); setShowSearch(false); } }} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', fontFamily: 'Inter, sans-serif' }} />
              <button onClick={() => setShowSearch(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>close</span></button>
            </div>
            {globalSearch.trim() && (
              <div style={{display:'flex',gap:'8px',width:'100%'}}>
                <button onClick={() => { setEventsNavSearch(globalSearch.trim()); setActiveTab('events'); setShowSearch(false); }} style={{flex:1,padding:'12px',background:'var(--brand)',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontFamily:'Manrope, sans-serif',fontWeight:'600',cursor:'pointer'}}>Search Events</button>
                <button onClick={() => { setPlacesNavCat('All'); setPlacesNavSearch(globalSearch.trim()); setPlacesNavKey(k => k + 1); setActiveTab('places'); setShowSearch(false); }} style={{flex:1,padding:'12px',background:'#026cdf',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontFamily:'Manrope, sans-serif',fontWeight:'600',cursor:'pointer'}}>Search Places</button>
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
        />
      )}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => { closeEventModal(); window.history.back(); }} />
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
