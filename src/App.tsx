import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit, where, onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore';

// ─── Firebase Setup ──────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyAVL8hY7QZjgbgny7GKDWA7ti2hoBU2Xvs",
  authDomain: "abq-unplugged.firebaseapp.com",
  projectId: "abq-unplugged",
  storageBucket: "abq-unplugged.firebasestorage.app",
  messagingSenderId: "587816012900",
  appId: "1:587816012900:web:bba5f7bc9f43b64ce76371",
};

const fbApp  = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
const fbDb   = getFirestore(fbApp);

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
  return (
    event.classifications?.[0]?.segment?.name ||
    event.classifications?.[0]?.genre?.name ||
    'Event'
  );
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
    await setDoc(doc(fbDb, 'users', uid), {
      checkIns: [...checkIns],
      updatedAt: serverTimestamp(),
    }, { merge: true });
    // Update leaderboard entry
    await setDoc(doc(fbDb, 'leaderboard', uid), {
      displayName: displayName || 'Anonymous',
      count,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.error('Firestore sync error:', err);
  }
}

// ─── SVG Logo ───────────────────────────────────────────────────────────────

function ABQUnpluggedLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="balloonGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff793b" />
          <stop offset="100%" stopColor="#a03b00" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="17" rx="12" ry="13" fill="url(#balloonGrad)" />
      <path d="M22 9 L17 18 L21 18 L18 27 L23 16 L19 16 Z" fill="white" opacity="0.95" />
      <rect x="17" y="30" width="6" height="4" rx="1.5" fill="#a03b00" />
      <line x1="18" y1="30" x2="16" y2="28" stroke="#a03b00" strokeWidth="1" />
      <line x1="22" y1="30" x2="24" y2="28" stroke="#a03b00" strokeWidth="1" />
    </svg>
  );
}

// ─── ImageWithFallback ──────────────────────────────────────────────────────

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg,#a03b00,#ff793b)',
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
      onError={() => setError(true)}
    />
  );
}

// ─── Category Data ──────────────────────────────────────────────────────────

const PLACE_CATEGORIES = [
  { label: 'All',           icon: '✨' },
  { label: 'Restaurant',    icon: '' },
  { label: 'Coffee & Tea',  icon: '☕' },
  { label: 'Bar',           icon: '' },
  { label: 'Bakery',        icon: '' },
  { label: 'Park',          icon: '' },
  { label: 'Museum',        icon: '' },
  { label: 'Art Gallery',   icon: '' },
  { label: 'Attraction',    icon: '' },
  { label: 'Shopping',      icon: '' },
  { label: 'Nightlife',     icon: '' },
  { label: 'Spa & Wellness',icon: '' },
  { label: 'Gym & Fitness', icon: '' },
  { label: 'Movie Theater', icon: '' },
  { label: 'Library',       icon: '' },
];

const EVENT_GENRES = ['All', 'Music', 'Sports', 'Arts & Theatre', 'Comedy', 'Family', 'Outdoor'];

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
    <div className="mx-5 mb-4 rounded-2xl p-3 flex items-center gap-3" style={{ background: 'rgba(160,59,0,0.08)' }}>
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#a03b00', fontSize: '20px' }}>location_off</span>
      <p className="text-xs text-gray-600 flex-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Enable location to see distances &amp; sort by nearby
      </p>
      <button
        onClick={onRequest}
        className="text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0"
        style={{ background: '#a03b00' }}
      >
        Retry
      </button>
    </div>
  );

  if (requested) return (
    <div className="mx-5 mb-4 rounded-2xl p-3 flex items-center gap-3" style={{ background: 'rgba(160,59,0,0.06)' }}>
      <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#a03b00', fontSize: '20px' }}>my_location</span>
      <p className="text-xs text-gray-500 flex-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Getting your location…</p>
    </div>
  );

  return (
    <div
      className="mx-5 mb-4 rounded-2xl p-3 flex items-center gap-3"
      style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(160,59,0,0.1)' }}
      >
        <span className="material-symbols-outlined" style={{ color: '#a03b00', fontSize: '20px' }}>near_me</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Find things near you</p>
        <p className="text-xs text-gray-400">Share location for distances &amp; "Near Me"</p>
      </div>
      <button
        onClick={onRequest}
        className="text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0"
        style={{ background: '#a03b00' }}
      >
        Enable
      </button>
    </div>
  );
}

// ─── Place Card ─────────────────────────────────────────────────────────────

function PlaceCard({
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
      className="bg-white rounded-2xl overflow-hidden text-left w-full"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
    >
      <div className="relative" style={{ height: '140px' }}>
        <ImageWithFallback
          src={place.image}
          alt={place.name}
          className="w-full h-full object-cover"
          gradient={place.gradient}
          showLabel
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-2 left-2">
          <span
            className="text-xs font-bold text-white px-2 py-0.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          >
            {catEmoji}
          </span>
        </div>
        {distance != null && (
          <div className="absolute top-2 right-2">
            <span
              className="text-xs font-bold text-white px-1.5 py-0.5 rounded-lg flex items-center gap-0.5"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>near_me</span>
              {formatDist(distance)}
            </span>
          </div>
        )}
        {isCheckedIn && (
          <div className="absolute bottom-2 left-2">
            <span
              className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(160,59,0,0.85)' }}
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
                <span className="text-xs text-gray-400 truncate">
                  ({place.reviewCount >= 1000 ? (place.reviewCount / 1000).toFixed(1) + 'k' : place.reviewCount})
                </span>
              ) : null}
            </div>
          ) : <div className="flex-1" />}
          {onCheckIn && (
            <button
              onClick={onCheckIn}
              className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: isCheckedIn ? 'rgba(160,59,0,0.12)' : '#a03b00',
                color: isCheckedIn ? '#a03b00' : 'white',
              }}
            >
              {isCheckedIn ? '✓ Visited' : 'Check In'}
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Event Card ─────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: TMEvent; onClick: () => void }) {
  const imgSrc = getBestEventImage(event.images);
  const venue = event._embedded?.venues?.[0];
  const category = getEventCategory(event);
  const price = event.priceRanges?.[0];

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden text-left w-full flex"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: '100px' }}
    >
      <div className="flex-shrink-0 relative overflow-hidden" style={{ width: '110px' }}>
        {imgSrc ? (
          <img src={hiResUrl(imgSrc)} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
          >
            <span className="text-3xl">♪</span>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <span
            className="text-xs font-bold text-white px-2 py-0.5 rounded-full inline-block mb-1.5"
            style={{ background: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
          >
            {category}
          </span>
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
            <p className="text-xs font-bold" style={{ color: '#a03b00' }}>
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
}

// ─── Place Detail Modal ──────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto" style={{ background: '#f5f7f5' }}>
      <div className="relative flex-shrink-0" style={{ height: '260px' }}>
        <ImageWithFallback
          src={place.image}
          alt={place.name}
          className="w-full h-full object-cover"
          gradient={place.gradient}
        />
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
            className="text-xs font-bold text-white px-2.5 py-1 rounded-full"
            style={{ background: '#a03b00' }}
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
            <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <span className="text-yellow-400">★</span>
              <span className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>
                {place.rating.toFixed(1)}
              </span>
              {place.reviewCount && (
                <span className="text-xs text-gray-400">({place.reviewCount.toLocaleString()})</span>
              )}
            </div>
          )}
          {place.priceLevel != null && place.priceLevel > 0 && (
            <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <span className="font-black text-sm text-green-600">
                {'$'.repeat(Math.min(place.priceLevel, 4))}
              </span>
            </div>
          )}
          <button
            onClick={onCheckIn}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm transition-all"
            style={{
              background: tooFar ? '#dc2626' : isCheckedIn ? 'rgba(160,59,0,0.1)' : '#a03b00',
              color: isCheckedIn && !tooFar ? '#a03b00' : 'white',
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
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2" style={{ background: '#fff3e0', color: '#a03b00', border: '1px solid #ffe0b2' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>location_off</span>
            {checkInError}
          </div>
        )}

        {place.description && (
          <p className="text-gray-700 text-sm leading-relaxed mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
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
              className="flex items-start gap-3 mb-3 bg-white rounded-xl p-3"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: '18px', color: '#a03b00', marginTop: '1px' }}
              >
                {item.icon}
              </span>
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {item.text}
              </p>
            </div>
          ))}

        {/* Map */}
        {(place.address || place.lat) && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ height: '180px' }}>
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
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                ‍‍ Kid Friendly
              </span>
            )}
            {place.isAccessible && (
              <span className="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                ♿ Accessible
              </span>
            )}
          </div>
        )}

        <a
          href={`https://maps.google.com/?q=${mapsQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-4 text-center text-white font-black text-sm rounded-2xl mt-2"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Epilogue, sans-serif' }}
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
            color: i <= display ? '#a03b00' : '#d1d5db',
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
    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Epilogue, sans-serif' }}
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
        <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
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
    const q = query(collection(fbDb, 'reviews'), where('placeId', '==', placeId));
    const unsub = onSnapshot(q, snap => {
      const loaded: Review[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Review, 'id'>),
      }));
      // Sort client-side: newest first
      loaded.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      });
      setReviews(loaded);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [placeId]);

  // Check if this user already reviewed this place
  const alreadyReviewed = user ? reviews.some(r => r.userId === user.uid) : false;

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
      await addDoc(collection(fbDb, 'reviews'), {
        placeId,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Explorer',
        rating,
        text: text.trim(),
        createdAt: serverTimestamp(),
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white"
                style={{ background: '#a03b00', fontFamily: 'Epilogue, sans-serif' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                Write Review
              </button>
            : <button
                onClick={onShowAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white"
                style={{ background: '#a03b00', fontFamily: 'Epilogue, sans-serif' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>login</span>
                Sign in to Review
              </button>
        )}
        {isCheckedIn && alreadyReviewed && (
          <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#a03b00', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Reviewed
          </span>
        )}
      </div>

      {/* Gate message for non-checked-in users */}
      {!isCheckedIn && (
        <div className="mb-4 rounded-2xl p-3 flex items-center gap-3" style={{ background: 'rgba(160,59,0,0.06)' }}>
          <span className="material-symbols-outlined" style={{ color: '#a03b00', fontSize: '20px' }}>lock</span>
          <p className="text-xs text-gray-600 flex-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Check in here first to leave a review
          </p>
        </div>
      )}

      {/* Success toast */}
      {submitted && (
        <div className="mb-3 rounded-2xl p-3 flex items-center gap-2" style={{ background: 'rgba(160,59,0,0.08)' }}>
          <span className="material-symbols-outlined" style={{ color: '#a03b00', fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-xs font-bold" style={{ color: '#a03b00' }}>Review posted — thanks! ✓</p>
        </div>
      )}

      {/* Review form */}
      {showForm && isCheckedIn && user && !alreadyReviewed && (
        <div className="mb-4 rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-600 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              How many outlets does this place get?
            </p>
            <OutletRating value={rating} onChange={setRating} size="lg" />
          </div>

          <textarea
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Tell people what made this place worth visiting (or not)..."
            rows={3}
            className="w-full text-sm rounded-xl border border-gray-200 p-3 resize-none focus:outline-none"
            style={{
              fontFamily: 'Manrope, sans-serif',
              background: '#fafafa',
              borderColor: profWarn ? '#fbbf24' : undefined,
            }}
          />

          {/* Profanity warning */}
          {profWarn && (
            <div className="mt-2 rounded-xl p-3 text-xs leading-relaxed" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <p className="font-bold mb-1">
                Whoa there! Kids use this app — let's try other words. 😄
              </p>
              <p>
                Instead of <strong>"{profWarn.found}"</strong>, how about{' '}
                {profWarn.alts.map((a, i) => (
                  <span key={a}>
                    <button
                      className="font-bold underline hover:no-underline"
                      style={{ color: '#a03b00' }}
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
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-500 bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all"
              style={{
                background: submitting || rating === 0 ? '#d1d5db' : '#a03b00',
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
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Loading reviews…
        </p>
      )}
      {!loading && reviews.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
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
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto" style={{ background: '#f5f7f5' }}>
      <div className="relative flex-shrink-0" style={{ height: '260px' }}>
        {imgSrc ? (
          <img src={hiResUrl(imgSrc)} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
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
            className="text-xs font-bold text-white px-2.5 py-1 rounded-full"
            style={{ background: '#a03b00' }}
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
          <div className="bg-white rounded-2xl p-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p className="text-xs text-gray-400 mb-1">Date</p>
            <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}>
              {event.dates?.start?.localDate ? formatDate(event.dates.start.localDate) : 'TBD'}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p className="text-xs text-gray-400 mb-1">Time</p>
            <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}>
              {event.dates?.start?.localTime ? formatTime(event.dates.start.localTime) : 'TBD'}
            </p>
          </div>
          {venue && (
            <div
              className="col-span-2 bg-white rounded-2xl p-3"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            >
              <p className="text-xs text-gray-400 mb-1">Venue</p>
              <p className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {venue.name}
              </p>
              {venue.address?.line1 && (
                <p className="text-xs text-gray-500 mt-0.5">{venue.address.line1}</p>
              )}
            </div>
          )}
          {price && (
            <div className="col-span-2 bg-white rounded-2xl p-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <p className="text-xs text-gray-400 mb-1">Price</p>
              <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>
                ${Math.round(price.min || 0)} – ${Math.round(price.max || 0)}
              </p>
            </div>
          )}
        </div>

        {/* Venue map */}
        {venue?.address?.line1 && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ height: '160px' }}>
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

        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(160,59,0,0.08)' }}>
          <p
            className="font-black text-sm mb-1"
            style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}
          >
            ⚡ UNPLUGGING TIP
          </p>
          <p className="text-xs text-gray-600" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Put your phone away for the first 30 minutes. Let yourself fully arrive before documenting.
          </p>
        </div>

        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 text-center text-white font-black text-sm rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Epilogue, sans-serif' }}
          >
            GET TICKETS →
          </a>
        ) : (
          <a
            href={`https://maps.google.com/?q=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 text-center text-white font-black text-sm rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Epilogue, sans-serif' }}
          >
            GET DIRECTIONS →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Discover Screen (Mixed Feed) ─────────────────────────────────────────────

function DiscoverScreen({
  places, events, onPlaceSelect, onEventSelect,
  coords, geoRequested, geoError, onRequestGeo,
  checkedIn, onCheckIn,
}: {
  places: Place[];
  events: TMEvent[];
  onPlaceSelect: (p: Place) => void;
  onEventSelect: (e: TMEvent) => void;
  coords: GeoCoords | null;
  geoRequested: boolean;
  geoError: string | null;
  onRequestGeo: () => void;
  checkedIn: Set<string>;
  onCheckIn: (id: string) => void;
}) {
  const featured = places.filter(p => p.isFeatured).slice(0, 5);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const twoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    return events
      .filter(e => {
        const d = e.dates?.start?.localDate || '';
        return d >= today && d <= twoWeeks;
      })
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
    .filter(p => !p.isFeatured && p.rating && p.rating >= 4.5)
    .slice(0, 10);

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      {/* Hero */}
      <div className="px-5 pt-5 pb-3">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
        >
          Greater ABQ Metro
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Get Out &<br />Unplug Today
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {places.length} places · {events.length} events in Greater ABQ
        </p>
      </div>

      {/* Geo Banner */}
      <GeoBanner
        coords={coords}
        error={geoError}
        requested={geoRequested}
        onRequest={onRequestGeo}
      />

      {/* This Week Events - horizontal scroll */}
      {upcomingEvents.length > 0 && (
        <div className="pb-5">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2
              className="text-lg font-black uppercase tracking-tight"
              style={{ fontFamily: 'Epilogue, sans-serif' }}
            >
              This Week
            </h2>
            <span className="text-xs font-semibold" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
               Live events
            </span>
          </div>
          <div className="flex gap-3 px-5 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {upcomingEvents.map(event => {
              const imgSrc = getBestEventImage(event.images);
              const venue = event._embedded?.venues?.[0];
              return (
                <button
                  key={event.id}
                  onClick={() => onEventSelect(event)}
                  className="flex-shrink-0 bg-white rounded-2xl overflow-hidden text-left"
                  style={{ width: '200px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  <div className="relative" style={{ height: '120px' }}>
                    {imgSrc ? (
                      <img src={hiResUrl(imgSrc)} alt={event.name} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
                      >
                        <span className="text-4xl">♪</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span
                        className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: '#a03b00' }}
                      >
                        {getEventCategory(event)}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <p
                        className="text-white font-black text-xs leading-tight"
                        style={{ fontFamily: 'Epilogue, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
                      >
                        {event.name}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
                      {event.dates?.start?.localDate ? formatDate(event.dates.start.localDate) : 'TBD'}
                      {event.dates?.start?.localTime ? ' · ' + formatTime(event.dates.start.localTime) : ''}
                    </p>
                    {venue && (
                      <p className="text-xs text-gray-400 truncate">{venue.name}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Trending Bento Grid */}
      {featured.length > 0 && (
        <div className="px-5 pb-5">
          <h2
            className="text-lg font-black uppercase tracking-tight mb-3"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            Trending Now
          </h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Hero card */}
            <button
              onClick={() => onPlaceSelect(featured[0])}
              className="relative overflow-hidden rounded-2xl col-span-2"
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
                <span className="text-xs font-bold text-white bg-[#a03b00] px-2 py-1 rounded-full">
                  ⚡ Featured
                </span>
              </div>
              {checkedIn.has(featured[0].id) && (
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-bold text-white px-2 py-1 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>✓ Visited</span>
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
                className="relative overflow-hidden rounded-2xl"
                style={{ height: '128px' }}
              >
                <ImageWithFallback
                  src={place.image}
                  alt={place.name}
                  className="w-full h-full object-cover"
                  gradient={place.gradient}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {checkedIn.has(place.id) && (
                  <div className="absolute top-2 right-2">
                    <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>✓</span>
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
      {coords && nearbyPlaces.length > 0 && (
        <div className="pb-5">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2
              className="text-lg font-black uppercase tracking-tight"
              style={{ fontFamily: 'Epilogue, sans-serif' }}
            >
              Near You
            </h2>
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>my_location</span>
              Live location
            </span>
          </div>
          <div className="flex gap-3 px-5 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {nearbyPlaces.map(({ place, dist }) => (
              <button
                key={place.id}
                onClick={() => onPlaceSelect(place)}
                className="flex-shrink-0 bg-white rounded-2xl overflow-hidden text-left"
                style={{ width: '144px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              >
                <div className="relative" style={{ height: '100px' }}>
                  <ImageWithFallback
                    src={place.image}
                    alt={place.name}
                    className="w-full h-full object-cover"
                    gradient={place.gradient}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <span
                      className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>near_me</span>
                      {formatDist(dist)}
                    </span>
                  </div>
                  {checkedIn.has(place.id) && (
                    <div className="absolute top-2 right-2">
                      <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>✓</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p
                    className="text-xs font-bold text-gray-900 leading-tight truncate"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    {place.name}
                  </p>
                  <p className="text-xs text-gray-400">{place.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Gems */}
      {hiddenGems.length > 0 && (
        <div className="pb-5">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2
              className="text-lg font-black uppercase tracking-tight"
              style={{ fontFamily: 'Epilogue, sans-serif' }}
            >
              Hidden Gems
            </h2>
            <span className="text-xs font-semibold" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
              ★ 4.5+ rated
            </span>
          </div>
          <div className="flex gap-3 px-5 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {hiddenGems.map(place => (
              <button key={place.id} onClick={() => onPlaceSelect(place)} className="flex-shrink-0" style={{ width: '136px' }}>
                <div className="relative rounded-2xl overflow-hidden mb-2" style={{ width: '136px', height: '136px' }}>
                  <ImageWithFallback
                    src={place.image}
                    alt={place.name}
                    className="w-full h-full object-cover"
                    gradient={place.gradient}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {place.rating && (
                    <div className="absolute bottom-2 left-2">
                      <span
                        className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                      >
                        ★ {place.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {checkedIn.has(place.id) && (
                    <div className="absolute top-2 right-2">
                      <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>✓</span>
                    </div>
                  )}
                </div>
                <p
                  className="text-xs font-bold text-gray-900 leading-tight text-left truncate"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {place.name}
                </p>
                <p className="text-xs text-gray-400 text-left">{place.category}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Why Unplug */}
      <div
        className="mx-5 mb-28 rounded-2xl p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
      >
        <p className="text-white font-black text-lg leading-tight" style={{ fontFamily: 'Epilogue, sans-serif' }}>
          WHY UNPLUG?
        </p>
        <p className="text-white/80 text-sm mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Real experiences create memories no screen can replicate. Get out there, ABQ.
        </p>
        <span className="absolute right-4 bottom-2 text-5xl opacity-20">⚡</span>
      </div>
    </div>
  );
}

// ─── Events Screen ────────────────────────────────────────────────────────────

function EventsScreen({
  events,
  onEventSelect,
}: {
  events: TMEvent[];
  onEventSelect: (e: TMEvent) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  const filtered = useMemo(() => {
    let result = events;
    if (selectedGenre !== 'All') {
      result = result.filter(e => {
        const seg = e.classifications?.[0]?.segment?.name || '';
        const gen = e.classifications?.[0]?.genre?.name || '';
        if (selectedGenre === 'Outdoor') {
          // Match genuine outdoor venues (amphitheaters, outdoor parks) and
          // explicitly outdoor-themed events. Exclude sports stadiums and arenas
          // (e.g. "Isotopes Park" is a baseball stadium; "Dream Style Arena" is indoor).
          const venueName = (e._embedded?.venues?.[0]?.name || '').toLowerCase();
          const eventName = e.name.toLowerCase();
          const isAmphi = venueName.includes('amphitheater') || venueName.includes('amphitheatre');
          const isOutdoorVenue = venueName.includes('outdoor') ||
            (venueName.includes('balloon fiesta') || venueName === 'balloon fiesta park');
          const isOutdoorEvent = eventName.includes('outdoor') ||
            eventName.includes('festival') || eventName.includes(' fair') ||
            eventName.includes('balloon fiesta') || eventName.includes('garden') ||
            eventName.includes('nature') || eventName.includes('hiking') ||
            eventName.includes('trail') || eventName.includes('fiesta');
          return isAmphi || isOutdoorVenue || isOutdoorEvent || gen === 'Outdoor';
        }
        if (selectedGenre === 'Family') {
          // TM rarely classifies ABQ events as Family segment/genre.
          // Broaden with keyword matching on event names.
          const eventName = e.name.toLowerCase();
          const familyKeywords = [
            'family', 'kids', 'children', 'child', 'junior', 'youth',
            'disney', 'sesame', 'circus', 'magic show', 'puppet',
            'ballet', 'nutcracker', 'ice show', 'princess', 'wizard',
          ];
          return seg === 'Family' || gen === 'Family' ||
            familyKeywords.some(k => eventName.includes(k));
        }
        return seg === selectedGenre || gen === selectedGenre;
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
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="px-5 pt-5 pb-3">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
        >
          What's Happening
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Live Events<br />Near You
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {events.length} upcoming events in Greater ABQ
        </p>
      </div>

      <div className="px-5 pb-3">
        <div
          className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search events or venues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: 'Manrope, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {EVENT_GENRES.map(genre => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className="flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
            style={{
              fontFamily: 'Manrope, sans-serif',
              background: selectedGenre === genre ? '#a03b00' : 'white',
              color: selectedGenre === genre ? 'white' : '#333',
              boxShadow: selectedGenre === genre ? '0 4px 12px rgba(160,59,0,0.3)' : '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            {genre}
          </button>
        ))}
      </div>

      <div className="px-5 pb-2">
        <p className="text-sm font-semibold text-gray-500" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {sorted.length} event{sorted.length !== 1 ? 's' : ''}
          {(selectedGenre !== 'All' || search) && (
            <button
              onClick={() => { setSelectedGenre('All'); setSearch(''); }}
              className="ml-2 text-xs font-bold"
              style={{ color: '#a03b00' }}
            >
              Clear filters
            </button>
          )}
        </p>
      </div>

      <div className="px-5 pb-28 flex flex-col gap-3">
        {sorted.map(event => (
          <EventCard key={event.id} event={event} onClick={() => onEventSelect(event)} />
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>event_busy</span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>No events found</p>
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
}: {
  places: Place[];
  onPlaceSelect: (p: Place) => void;
  coords: GeoCoords | null;
  geoRequested: boolean;
  geoError: string | null;
  onRequestGeo: () => void;
  checkedIn: Set<string>;
  onCheckIn: (id: string) => void;
}) {
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'top' | 'near' | 'az'>('top');

  const filtered = useMemo(() => {
    let result = places;
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
    // top rated
    return [...filtered].sort((a, b) => {
      const ra = a.rating || 0;
      const rb = b.rating || 0;
      if (rb !== ra) return rb - ra;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    });
  }, [filtered, sortMode, coords]);

  const distMap = useMemo(() => {
    if (!coords) return new Map<string, number>();
    const m = new Map<string, number>();
    places.forEach(p => {
      if (p.lat != null && p.lng != null) {
        m.set(p.id, distanceMiles(coords.lat, coords.lng, p.lat, p.lng));
      }
    });
    return m;
  }, [places, coords]);

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="px-5 pt-5 pb-3">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
        >
          Explore Greater ABQ
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Places<br />to Go
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
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
          className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search places..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: 'Manrope, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {PLACE_CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => setSelectedCat(cat.label)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
            style={{
              fontFamily: 'Manrope, sans-serif',
              background: selectedCat === cat.label ? '#a03b00' : 'white',
              color: selectedCat === cat.label ? 'white' : '#333',
              boxShadow: selectedCat === cat.label ? '0 4px 12px rgba(160,59,0,0.3)' : '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 px-5 pb-4">
        {([
          { id: 'top', label: 'Top Rated' },
          { id: 'near', label: 'Near Me', disabled: !coords },
          { id: 'az', label: 'A–Z' },
        ] as const).map(s => (
          <button
            key={s.id}
            onClick={() => { if (s.disabled) { onRequestGeo(); } else { setSortMode(s.id); } }}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            title={s.disabled ? 'Enable location to sort by distance' : undefined}
            style={{
              background: sortMode === s.id ? '#111' : 'white',
              color: sortMode === s.id ? 'white' : s.disabled ? '#ccc' : '#555',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              opacity: s.disabled ? 0.6 : 1,
            }}
          >
            {s.id === 'near' && !coords && (
              <span className="material-symbols-outlined mr-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>location_off</span>
            )}
            {s.label}
          </button>
        ))}
        <p className="ml-auto text-xs text-gray-400 self-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {sorted.length} results
        </p>
      </div>

      {/* Grid */}
      <div className="px-5 pb-28">
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
              onClick={() => onPlaceSelect(place)}
              distance={distMap.get(place.id)}
              isCheckedIn={checkedIn.has(place.id)}
              onCheckIn={e => { e.stopPropagation(); onCheckIn(place.id); }}
            />
          ))}
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>search_off</span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>No places found</p>
            <button
              onClick={() => { setSelectedCat('All'); setSearch(''); }}
              className="mt-3 text-xs font-bold"
              style={{ color: '#a03b00' }}
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
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      await signInWithPopup(fbAuth, new GoogleAuthProvider());
      onClose();
    } catch (e: any) { setError(e.message || 'Sign-in failed'); }
    setLoading(false);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(fbAuth, email, password);
        if (displayName) await updateProfile(cred.user, { displayName });
      } else {
        await signInWithEmailAndPassword(fbAuth, email, password);
      }
      onClose();
    } catch (e: any) { setError(e.message?.replace('Firebase: ', '') || 'Auth failed'); }
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
        <p className="text-sm text-gray-500 mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Sign in to sync your check-ins across devices and appear on the leaderboard.
        </p>

        {mode === 'choose' ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full rounded-2xl py-3.5 font-bold text-sm border border-gray-200"
              style={{ fontFamily: 'Manrope, sans-serif', background: '#fff' }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.58-13.47-8.71l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <button
              onClick={() => setMode('email')}
              className="w-full rounded-2xl py-3.5 font-bold text-sm text-white"
              style={{ fontFamily: 'Manrope, sans-serif', background: '#a03b00' }}
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
                  className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
                  style={{ background: isSignUp === (i === 1) ? '#a03b00' : '#f5f5f5', color: isSignUp === (i === 1) ? 'white' : '#666', fontFamily: 'Manrope, sans-serif' }}
                >{t}</button>
              ))}
            </div>
            {isSignUp && (
              <input
                type="text" placeholder="Display name (e.g. xplorer_abq)" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm border border-gray-200 outline-none"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              />
            )}
            <input
              type="email" placeholder="Email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm border border-gray-200 outline-none"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            />
            <input
              type="password" placeholder="Password (min 6 chars)" required value={password}
              onChange={e => setPassword(e.target.value)} minLength={6}
              className="w-full rounded-xl px-4 py-3 text-sm border border-gray-200 outline-none"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-2xl py-3.5 font-bold text-sm text-white"
              style={{ background: '#a03b00', fontFamily: 'Manrope, sans-serif', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Please wait…' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            <button type="button" onClick={() => setMode('choose')}
              className="text-xs text-gray-400 text-center mt-1"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >← Back</button>
          </form>
        )}
      </div>
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
  checkedIn, user, onSignIn, onSignOut, places,
}: {
  checkedIn: Set<string>;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  places: Place[];
}) {
  const myCount = checkedIn.size;
  const level = getLevel(myCount);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);

  // Subscribe to live leaderboard from Firestore
  useEffect(() => {
    const q = query(collection(fbDb, 'leaderboard'), orderBy('count', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      const rows: LeaderboardRow[] = snap.docs.map((d, i) => ({
        rank: i + 1,
        name: (d.data().displayName as string) || 'Explorer',
        count: (d.data().count as number) || 0,
        isMe: d.id === user?.uid,
        uid: d.id,
      }));
      setLbRows(rows);
    }, () => {/* ignore errors */ });
    return unsub;
  }, [user?.uid]);

  // Build leaderboard: if user signed in, they'll appear from Firestore; otherwise inject "You" locally
  const leaderboard = useMemo<LeaderboardRow[]>(() => {
    if (lbRows.length > 0) {
      // Use Firestore data; if user not in list, inject them
      const userInList = user && lbRows.some(r => r.isMe);
      if (!userInList && myCount > 0) {
        const merged = [...lbRows, { rank: 0, name: user?.displayName || 'You', count: myCount, isMe: true }];
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
    { id: 'first', emoji: '✿', label: 'First Check-in', unlocked: myCount >= 1 },
    { id: 'five', emoji: '⚡', label: 'Explorer (5)', unlocked: myCount >= 5 },
    { id: 'ten', emoji: '', label: 'Adventurer (10)', unlocked: myCount >= 10 },
    { id: 'twenty', emoji: '', label: 'Trailblazer (20)', unlocked: myCount >= 20 },
    { id: 'thirty5', emoji: '', label: 'Pioneer (35)', unlocked: myCount >= 35 },
    { id: 'fifty', emoji: '★', label: 'Legend (50)', unlocked: myCount >= 50 },
  ];

  const nextLevel = getLevel(myCount + 1);
  const progressPct = myCount === 0 ? 0 : Math.min(100, Math.round((myCount / level.next) * 100));

  return (
    <div className="h-full overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="pt-5 pb-4">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
        >
          Your Profile
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Hey,<br />{user?.displayName?.split(' ')[0] || 'Explorer'}
        </h1>
      </div>

      {/* Sign in / out banner */}
      {!user ? (
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-between rounded-2xl px-4 py-3 mb-4 text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Manrope, sans-serif', boxShadow: '0 2px 8px rgba(160,59,0,0.25)' }}
        >
          <span>Sign in to sync check-ins & join the leaderboard</span>
          <span className="material-symbols-rounded text-base">login</span>
        </button>
      ) : (
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs text-gray-400" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Signed in as {user.email}
          </p>
          <button onClick={onSignOut} className="text-xs font-bold" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
            Sign out
          </button>
        </div>
      )}

      {/* Profile card */}
      <div
        className="flex items-center gap-4 bg-white rounded-2xl p-4 mb-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
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
            {user?.displayName || 'ABQ Explorer'}
          </p>
          <p className="text-sm text-gray-500">Greater ABQ Metro</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
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
            className="bg-white rounded-2xl p-3 text-center"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <p
              className="text-2xl font-black"
              style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}
            >
              {s.val}
            </p>
            <p className="text-xs text-gray-500 leading-tight whitespace-pre-line">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {myCount >= 50 ? (
        <div className="bg-white rounded-2xl p-4 mb-4 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: '28px' }}>★</span>
          <p className="font-black text-sm mt-1" style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}>Max Level Reached!</p>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>You're a Legend — {myCount} places explored!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Progress to {nextLevel.label}
            </span>
            <span className="text-xs font-bold" style={{ color: '#a03b00' }}>
              {myCount}/{level.next}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: '8px', background: '#f0f0f0' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #a03b00, #ff793b)' }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Check in to {level.next - myCount} more place{level.next - myCount !== 1 ? 's' : ''} to level up!
          </p>
        </div>
      )}

      {/* Achievements */}
      <h2
        className="font-black text-base uppercase tracking-tight mb-3"
        style={{ fontFamily: 'Epilogue, sans-serif' }}
      >
        Achievements
      </h2>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {ACHIEVEMENTS.map(a => (
          <div
            key={a.id}
            className="bg-white rounded-2xl p-3 text-center flex flex-col items-center gap-1"
            style={{
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              opacity: a.unlocked ? 1 : 0.4,
            }}
          >
            <span style={{ fontSize: '24px' }}>{a.unlocked ? a.emoji : '○'}</span>
            <p className="text-xs font-semibold text-gray-600 leading-tight text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {a.label}
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
        <span className="text-xs text-gray-400" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Self-reported check-ins
        </span>
      </div>

      <div className="flex flex-col gap-2 mb-5">
        {leaderboard.map((row) => (
          <div
            key={row.uid || `${row.name}_${row.rank}`}
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3"
            style={{
              boxShadow: row.isMe ? '0 0 0 2px #a03b00, 0 2px 8px rgba(160,59,0,0.15)' : '0 1px 4px rgba(0,0,0,0.08)',
              background: row.isMe ? 'rgba(160,59,0,0.05)' : 'white',
            }}
          >
            <span
              className="font-black text-sm w-6 text-center flex-shrink-0"
              style={{ fontFamily: 'Epilogue, sans-serif', color: row.rank <= 3 ? '#a03b00' : '#999' }}
            >
              {row.rank === 1 ? '' : row.rank === 2 ? '' : row.rank === 3 ? '' : `#${row.rank}`}
            </span>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: row.isMe ? 'linear-gradient(135deg, #a03b00, #ff793b)' : '#f0f0f0' }}
            >
              <span className="text-xs font-black" style={{ color: row.isMe ? 'white' : '#999' }}>
                {row.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <span
              className="flex-1 text-sm font-bold truncate"
              style={{ fontFamily: 'Manrope, sans-serif', color: row.isMe ? '#a03b00' : '#333' }}
            >
              {row.isMe ? 'You' : row.name}
            </span>
            <span
              className="flex-shrink-0 text-sm font-black"
              style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}
            >
              {row.count}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">places</span>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: 'rgba(160,59,0,0.06)' }}
      >
        <p className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
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
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden"
                    style={{ background: hashGradient(p.name) }}
                  >
                    {p.image && (
                      <img src={hiResUrl(p.image)} alt={p.name} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ fontFamily: 'Epilogue, sans-serif' }}>{p.name}</p>
                    <p className="text-xs text-gray-400" style={{ fontFamily: 'Manrope, sans-serif' }}>{p.category}</p>
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: '#a03b00' }}>✓</span>
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#f5f7f5' }}
    >
      <ABQUnpluggedLogo size={72} />
      <h1
        className="text-3xl font-black uppercase tracking-tighter mt-4"
        style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}
      >
        ABQ Unplugged
      </h1>
      <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Loading your city…
      </p>
      <div
        className="mt-6 rounded-full overflow-hidden"
        style={{ width: '48px', height: '4px', background: '#e0e0e0' }}
      >
        <div
          className="h-full rounded-full"
          style={{ background: '#a03b00', width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }}
        />
      </div>
    </div>
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
      <p style={{ fontSize: '13px', fontWeight: 700, color: color.text, fontFamily: 'Manrope, sans-serif', lineHeight: 1.4 }}>{banner.message}</p>
    </div>
  );
}

// ─── Admin Screen ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ─── Admin Screen ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
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
        await updateDoc(doc(fbDb, 'places', editTarget.id), form as Record<string,unknown>);
        setPlaces(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...form } : p));
        flash('Place updated ✓'); setMode('list');
      } else {
        const ref = await addDoc(collection(fbDb, 'places'), form as Record<string,unknown>);
        setPlaces(prev => [...prev, { id: ref.id, ...form }]);
        flash('Place added ✓'); setMode('list');
      }
    } catch (e) { flash('Error: ' + (e as Error).message); }
    setSaving(false);
  };

  const deletePlace = async (p: PlaceDoc) => {
    if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;
    await deleteDoc(doc(fbDb, 'places', p.id));
    setPlaces(prev => prev.filter(x => x.id !== p.id));
    flash('Deleted ✓');
  };

  const toggleFeatured = async (p: PlaceDoc) => {
    const next = !p.isFeatured;
    await updateDoc(doc(fbDb, 'places', p.id), { isFeatured: next });
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
    getDocs(collection(fbDb, 'eventOverrides')).then(snap => {
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
      await setDoc(doc(fbDb, 'eventOverrides', form.eventId.trim()), data);
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
    await deleteDoc(doc(fbDb, 'eventOverrides', id));
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
    getDoc(doc(fbDb, 'config', 'tagRules')).then(snap => {
      if (snap.exists()) setRules({ ...DEFAULT_RULES, ...(snap.data() as TagRulesConfig) });
      setLoading(false);
    });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const saveRules = async () => {
    setSaving(true);
    try {
      await setDoc(doc(fbDb, 'config', 'tagRules'), rules);
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
    getDoc(doc(fbDb, 'config', 'siteConfig')).then(snap => {
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
      await setDoc(doc(fbDb, 'config', 'siteConfig'),
        { banner: { message: bannerMsg, active: bannerActive, color: bannerColor } },
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
      getDocs(collection(fbDb, 'places')),
      getDocs(collection(fbDb, 'leaderboard')),
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
  const [places, setPlaces] = useState<Place[]>([]);
  const [events, setEvents] = useState<TMEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TMEvent | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(loadCheckins);

  // ── Firebase Auth ──
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(fbAuth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        // Load check-ins from Firestore on sign-in
        try {
          const snap = await getDoc(doc(fbDb, 'users', u.uid));
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
    return unsub;
  }, []);

  // Debounced Firestore sync when checkedIn changes and user is signed in
  useEffect(() => {
    if (!user || !authReady) return;
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      syncCheckinsToFirestore(user.uid, checkedIn, user.displayName || user.email || 'Explorer');
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

    // Set initial history entry
    window.history.replaceState({ tab: 'discover', modal: null }, '', '#discover');

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
    getDoc(doc(fbDb, 'config', 'siteConfig')).then(snap => {
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
      try {
        const safeJson = (r: Response) => r.ok ? r.json() : Promise.resolve([]);
        const [placesResult, tmResult, ebResult, sgResult, bitResult, muResult] =
          await Promise.allSettled([
            fetch('/places-data.json').then(r => r.json()),
            fetch('/data/ticketmaster-events.json').then(r => r.json()),
            fetch('/data/eventbrite-events.json').then(safeJson),
            fetch('/data/seatgeek-events.json').then(safeJson),
            fetch('/data/bandsintown-events.json').then(safeJson),
            fetch('/data/meetup-events.json').then(safeJson),
          ]);

        if (placesResult.status === 'fulfilled') {
          const data = placesResult.value;
          setPlaces(Array.isArray(data) ? data : []);
        }

        // Merge all event sources, deduplicating by id
        const toArr = (r: PromiseSettledResult<unknown>) =>
          r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [];
        const seen = new Set<string>();
        const merged = [
          ...toArr(tmResult),
          ...toArr(ebResult),
          ...toArr(sgResult),
          ...toArr(bitResult),
          ...toArr(muResult),
        ].filter((e: TMEvent) => {
          if (!e?.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        setEvents(merged);
      } catch (err) {
        console.error('Failed to load data:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // ── Admin route ──
  if (showAdmin) {
    if (!user || user.email !== ADMIN_EMAIL) {
      return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px', background: '#f5f7f5' }}>
          <ABQUnpluggedLogo size={52} />
          <p style={{ fontFamily: 'Epilogue, sans-serif', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>Admin Access</p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '14px', color: '#666', textAlign: 'center', lineHeight: 1.5 }}>
            Sign in with the owner account ({ADMIN_EMAIL}) to access the admin panel.
          </p>
          <button onClick={() => setShowAuthModal(true)} style={{ padding: '13px 28px', background: '#a03b00', color: 'white', borderRadius: '12px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '15px' }}>
            Sign In
          </button>
          <button onClick={() => { setCurrentHash("#discover"); window.history.replaceState({}, '', '#discover'); }} style={{ color: '#aaa', fontSize: '13px', fontFamily: 'Manrope, sans-serif' }}>
            Back to App
          </button>
          {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </div>
      );
    }
    return <AdminScreen user={user} onBack={() => { setCurrentHash("#discover"); window.history.replaceState({}, '', '#discover'); }} />;
  }

  if (loading) return <LoadingScreen />;
  if (loadError) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 px-8" style={{ background: '#f5f7f5' }}>
      <ABQUnpluggedLogo size={56} />
      <h2 className="text-xl font-black uppercase tracking-tighter text-center" style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}>Couldn't Load Content</h2>
      <p className="text-sm text-gray-500 text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>Check your connection and try again.</p>
      <button
        onClick={() => { setLoadError(false); setLoading(true); }}
        className="mt-2 px-6 py-3 rounded-2xl font-bold text-sm text-white"
        style={{ background: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
      >
        Retry
      </button>
    </div>
  );

  return (
    <>
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
          height: 100%;
        }
        body {
          background: #f5f7f5;
          font-family: -apple-system, 'Manrope', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          /* NOTE: no position:fixed here — that blocks iOS Safari address-bar auto-hide.
             The app root div uses height:100dvh to fill the visual viewport instead. */
          overflow: hidden;
          overscroll-behavior: none;
          height: 100%;
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
      `}</style>

      <div
        className="flex flex-col mx-auto relative"
        style={{ maxWidth: '480px', height: '100dvh', background: '#f5f7f5', overflow: 'hidden' }}
      >
        {/* Glassmorphism header — Liquid Glass (iOS 26 HIG) with Dynamic Island / notch safe area */}
        <header
          className="glass flex-shrink-0 px-5 flex items-center justify-between"
          style={{
            paddingTop: 'calc(var(--sat) + 12px)',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            zIndex: 40,
          }}
        >
          <div className="flex items-center gap-2">
            <ABQUnpluggedLogo size={30} />
            <span
              className="font-black uppercase tracking-tighter text-base"
              style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}
            >
              ABQ Unplugged
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Location indicator */}
            <button
              onClick={requestGeo}
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
              title={coords ? 'Location active' : 'Enable location'}
              aria-label={coords ? 'Location active' : 'Enable location'}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '18px',
                  color: coords ? '#a03b00' : '#bbb',
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
        <main className="flex-1 overflow-hidden">
          {activeTab === 'discover' && (
            <DiscoverScreen
              places={places}
              events={events}
              onPlaceSelect={openPlaceModal}
              onEventSelect={openEventModal}
              coords={coords}
              geoRequested={geoRequested}
              geoError={geoError}
              onRequestGeo={requestGeo}
              checkedIn={checkedIn}
              onCheckIn={handleCheckIn}
            />
          )}
          {activeTab === 'events' && (
            <EventsScreen events={events} onEventSelect={openEventModal} />
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
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              checkedIn={checkedIn}
              user={user}
              places={places}
              onSignIn={() => setShowAuthModal(true)}
              onSignOut={() => signOut(fbAuth)}
            />
          )}
        </main>

        {/* Bottom navigation — Liquid Glass with home indicator safe area */}
        <nav
          className="glass flex-shrink-0 flex items-center px-2"
          style={{
            paddingTop: '8px',
            paddingBottom: 'calc(var(--sab) + 8px)',
            borderTop: '1px solid rgba(0,0,0,0.07)',
            zIndex: 40,
          }}
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => navigateTab(item.id)}
              aria-label={item.label}
              className="flex-1 flex flex-col items-center gap-0.5 py-1 transition-all"
              style={{ minHeight: '44px' }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '24px',
                  color: activeTab === item.id ? '#a03b00' : '#bbb',
                  fontVariationSettings:
                    activeTab === item.id
                      ? "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24"
                      : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                  transition: 'all 0.2s',
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-xs font-semibold"
                style={{
                  color: activeTab === item.id ? '#a03b00' : '#bbb',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '10px',
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>
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
    </>
  );
}
