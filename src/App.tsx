import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy,
  limit, onSnapshot, serverTimestamp,
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
  if (count >= 50) return { label: 'Legend', emoji: '🏆', next: count }; // max level
  if (count >= 35) return { label: 'Pioneer', emoji: '🥇', next: 50 };
  if (count >= 20) return { label: 'Trailblazer', emoji: '🥈', next: 35 };
  if (count >= 10) return { label: 'Adventurer', emoji: '🥉', next: 20 };
  if (count >= 5)  return { label: 'Explorer', emoji: '⚡', next: 10 };
  return { label: 'Newcomer', emoji: '🌱', next: 5 };
}

// ─── Geolocation Hook ────────────────────────────────────────────────────────

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
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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
  { label: 'All', icon: '✨' },
  { label: 'Restaurant', icon: '🍽️' },
  { label: 'Coffee & Tea', icon: '☕' },
  { label: 'Bar', icon: '🍺' },
  { label: 'Bakery', icon: '🥐' },
  { label: 'Park', icon: '🌳' },
  { label: 'Museum', icon: '🏛️' },
  { label: 'Art Gallery', icon: '🎨' },
  { label: 'Attraction', icon: '🎡' },
  { label: 'Shopping', icon: '🛍️' },
  { label: 'Nightlife', icon: '🌙' },
  { label: 'Spa & Wellness', icon: '💆' },
  { label: 'Gym & Fitness', icon: '💪' },
  { label: 'Movie Theater', icon: '🎬' },
  { label: 'Library', icon: '📚' },
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
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || '📍';
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
            <span className="text-3xl">🎵</span>
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
  place, onClose, isCheckedIn, onCheckIn, checkInError,
}: {
  place: Place;
  onClose: () => void;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  checkInError?: string | null;
}) {
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || '📍';
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
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm"
            style={{
              background: isCheckedIn ? 'rgba(160,59,0,0.1)' : '#a03b00',
              color: isCheckedIn ? '#a03b00' : 'white',
              fontFamily: 'Epilogue, sans-serif',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {isCheckedIn ? 'check_circle' : 'add_location_alt'}
            </span>
            {isCheckedIn ? 'Visited! ✓' : 'Check In'}
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
                👨‍👩‍👧 Kid Friendly
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
      </div>
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
            <span style={{ fontSize: '72px' }}>🎵</span>
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
          Albuquerque, NM
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Get Out &<br />Unplug Today
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {places.length} places · {events.length} events in ABQ
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
              🎟 Live events
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
                        <span className="text-4xl">🎵</span>
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
          const venueName = (e._embedded?.venues?.[0]?.name || '').toLowerCase();
          const eventName = e.name.toLowerCase();
          return venueName.includes('outdoor') || venueName.includes('amphitheater') || venueName.includes('park') || venueName.includes('field') || venueName.includes('arena') || eventName.includes('outdoor') || gen === 'Outdoor';
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
          {events.length} upcoming events in ABQ
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
          Explore ABQ
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Places<br />to Go
        </h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {places.length} spots across Albuquerque
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
    { id: 'first', emoji: '🌱', label: 'First Check-in', unlocked: myCount >= 1 },
    { id: 'five', emoji: '⚡', label: 'Explorer (5)', unlocked: myCount >= 5 },
    { id: 'ten', emoji: '🥉', label: 'Adventurer (10)', unlocked: myCount >= 10 },
    { id: 'twenty', emoji: '🥈', label: 'Trailblazer (20)', unlocked: myCount >= 20 },
    { id: 'thirty5', emoji: '🥇', label: 'Pioneer (35)', unlocked: myCount >= 35 },
    { id: 'fifty', emoji: '🏆', label: 'Legend (50)', unlocked: myCount >= 50 },
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
          <p className="text-sm text-gray-500">Albuquerque, NM</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
            {level.emoji} {level.label}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Places\nVisited', val: myCount.toString() },
          { label: 'Next\nLevel', val: myCount >= 50 ? '🏆' : (level.next - myCount).toString() + ' away' },
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
          <span style={{ fontSize: '28px' }}>🏆</span>
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
            <span style={{ fontSize: '24px' }}>{a.unlocked ? a.emoji : '🔒'}</span>
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
              {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
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
          🎖️ Rankings are based on self-reported check-ins. We can't verify visits, but we trust you to explore honestly. The real prize is the memories you make!
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

function AdminScreen({ user, onBack }: { user: User | null; onBack: () => void }) {
  const [tab, setTab] = useState<'banner' | 'places'>('banner');

  // Banner
  const [bannerMsg, setBannerMsg] = useState('');
  const [bannerType, setBannerType] = useState<'info' | 'success' | 'warning'>('info');
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerSaved, setBannerSaved] = useState(false);

  // Places
  const [adminPlaces, setAdminPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [placeSaving, setPlaceSaving] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');

  useEffect(() => {
    getDoc(doc(fbDb, 'config', 'siteConfig')).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.banner) { setBannerMsg(d.banner.message || ''); setBannerType(d.banner.type || 'info'); setBannerActive(!!d.banner.active); }
      }
    });
  }, []);

  useEffect(() => {
    if (tab !== 'places') return;
    setPlacesLoading(true);
    getDocs(collection(fbDb, 'places')).then(snap => {
      const ps: Place[] = [];
      snap.forEach(d => ps.push({ id: d.id, ...d.data() } as Place));
      ps.sort((a, b) => a.name.localeCompare(b.name));
      setAdminPlaces(ps);
      setPlacesLoading(false);
    });
  }, [tab]);

  const saveBanner = async () => {
    setBannerSaving(true);
    await setDoc(doc(fbDb, 'config', 'siteConfig'), { banner: { message: bannerMsg, type: bannerType, active: bannerActive } }, { merge: true });
    setBannerSaving(false); setBannerSaved(true);
    setTimeout(() => setBannerSaved(false), 2000);
  };

  const toggleFeatured = async (place: Place) => {
    const next = !place.isFeatured;
    await setDoc(doc(fbDb, 'places', place.id), { isFeatured: next }, { merge: true });
    setAdminPlaces(prev => prev.map(p => p.id === place.id ? { ...p, isFeatured: next } : p));
  };

  const saveEditingPlace = async () => {
    if (!editingPlace) return;
    setPlaceSaving(true);
    await setDoc(doc(fbDb, 'places', editingPlace.id), {
      description: editingPlace.description || '',
      hours: editingPlace.hours || '',
      phone: editingPlace.phone || '',
      website: editingPlace.website || '',
    }, { merge: true });
    setAdminPlaces(prev => prev.map(p => p.id === editingPlace.id ? editingPlace : p));
    setPlaceSaving(false); setEditingPlace(null);
  };

  const filtered = adminPlaces.filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase()));

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e5e5e5', fontSize: '15px', fontFamily: 'Manrope, sans-serif', background: '#fafafa', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f5f7f5', zIndex: 50 }}>

      {/* Header */}
      <div style={{ paddingTop: 'calc(var(--sat) + 14px)', paddingBottom: '14px', paddingLeft: '16px', paddingRight: '16px', background: '#a03b00', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
          </button>
          <div>
            <p style={{ color: 'white', fontFamily: 'Epilogue, sans-serif', fontWeight: 900, fontSize: '17px', letterSpacing: '-0.5px' }}>Admin Panel</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontFamily: 'Manrope, sans-serif' }}>{user?.email}</p>
          </div>
        </div>
        <button onClick={() => window.location.reload()} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
          Reload App
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        {(['banner', 'places'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', borderBottom: tab === t ? '2px solid #a03b00' : '2px solid transparent', color: tab === t ? '#a03b00' : '#999', fontFamily: 'Manrope, sans-serif', fontSize: '11px', fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: tab === t ? "'FILL' 1" : "'FILL' 0" }}>{t === 'banner' ? 'campaign' : 'place'}</span>
            {t === 'banner' ? 'Banner' : 'Places'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

        {/* ── Banner Tab ── */}
        {tab === 'banner' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', color: '#999', marginBottom: '14px' }}>SITE ANNOUNCEMENT BANNER</p>
              <p style={{ fontSize: '13px', color: '#666', fontFamily: 'Manrope, sans-serif', marginBottom: '16px', lineHeight: 1.5 }}>Post a message visible to all users at the top of the app. Great for events, closures, or updates.</p>

              {/* Active toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#333' }}>Banner Active</span>
                <button onClick={() => setBannerActive(!bannerActive)} style={{ width: 46, height: 26, borderRadius: 13, background: bannerActive ? '#a03b00' : '#ddd', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: bannerActive ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                </button>
              </div>

              {/* Type */}
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '12px', color: '#666', marginBottom: '8px' }}>TYPE</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {(['info', 'success', 'warning'] as const).map(ty => (
                  <button key={ty} onClick={() => setBannerType(ty)} style={{ flex: 1, padding: '8px 4px', borderRadius: '10px', fontSize: '13px', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'capitalize', background: bannerType === ty ? '#a03b00' : '#f3f3f3', color: bannerType === ty ? 'white' : '#777', transition: 'all 0.15s' }}>
                    {ty === 'info' ? '🔵 Info' : ty === 'success' ? '🟢 Good' : '🟡 Alert'}
                  </button>
                ))}
              </div>

              {/* Message */}
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '12px', color: '#666', marginBottom: '8px' }}>MESSAGE</p>
              <textarea value={bannerMsg} onChange={e => setBannerMsg(e.target.value)} placeholder="e.g. 🎉 Balloon Fiesta this weekend — check the Events tab!" rows={3} style={{ ...inputStyle, resize: 'none' }} />

              {/* Preview */}
              {bannerMsg && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '11px', color: '#aaa', marginBottom: '6px', letterSpacing: '0.06em' }}>PREVIEW</p>
                  <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)' }}>
                    <SiteBanner banner={{ message: bannerMsg, type: bannerType, active: true }} />
                  </div>
                </div>
              )}

              <button onClick={saveBanner} disabled={bannerSaving} style={{ marginTop: '16px', width: '100%', padding: '14px', borderRadius: '12px', background: bannerSaved ? '#15803d' : '#a03b00', color: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '15px', transition: 'background 0.3s', opacity: bannerSaving ? 0.7 : 1 }}>
                {bannerSaved ? '✓ Saved!' : bannerSaving ? 'Saving…' : 'Save Banner'}
              </button>
            </div>
          </div>
        )}

        {/* ── Places Tab ── */}
        {tab === 'places' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Edit bottom sheet */}
            {editingPlace && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px', paddingBottom: 'calc(var(--sab) + 20px)', width: '100%', maxHeight: '82vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <p style={{ fontFamily: 'Epilogue, sans-serif', fontWeight: 900, fontSize: '17px', letterSpacing: '-0.5px', color: '#111' }}>{editingPlace.name}</p>
                    <button onClick={() => setEditingPlace(null)} style={{ color: '#999', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: '50%' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                  </div>
                  {[
                    { key: 'description', label: 'Description', multi: true },
                    { key: 'hours', label: 'Hours (e.g. Mon–Sat 10am–9pm)', multi: false },
                    { key: 'phone', label: 'Phone', multi: false },
                    { key: 'website', label: 'Website URL', multi: false },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: '14px' }}>
                      <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '12px', color: '#666', marginBottom: '6px' }}>{f.label.toUpperCase()}</p>
                      {f.multi
                        ? <textarea value={(editingPlace as any)[f.key] || ''} onChange={e => setEditingPlace({ ...editingPlace, [f.key]: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'none' }} />
                        : <input value={(editingPlace as any)[f.key] || ''} onChange={e => setEditingPlace({ ...editingPlace, [f.key]: e.target.value })} style={inputStyle} />
                      }
                    </div>
                  ))}
                  <button onClick={saveEditingPlace} disabled={placeSaving} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#a03b00', color: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '15px', opacity: placeSaving ? 0.7 : 1, marginTop: '4px' }}>
                    {placeSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#bbb', pointerEvents: 'none' }}>search</span>
              <input value={placeSearch} onChange={e => setPlaceSearch(e.target.value)} placeholder="Search places…" style={{ ...inputStyle, paddingLeft: '38px' }} />
            </div>

            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '12px', color: '#aaa', textAlign: 'center' }}>⭐ = Featured in Discover &nbsp;·&nbsp; ✏️ = Edit details</p>

            {placesLoading ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>sync</span>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '13px' }}>Loading places…</p>
              </div>
            ) : filtered.map(place => (
              <div key={place.id} style={{ background: 'white', borderRadius: '14px', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{place.name}</p>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '11px', color: '#aaa' }}>{place.category}</p>
                </div>
                <button onClick={() => toggleFeatured(place)} title={place.isFeatured ? 'Unfeature' : 'Feature'} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: place.isFeatured ? 'rgba(160,59,0,0.1)' : '#f3f3f3', color: place.isFeatured ? '#a03b00' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: place.isFeatured ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                </button>
                <button onClick={() => setEditingPlace(place)} title="Edit" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: '#f3f3f3', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: 'explore' },
  { id: 'events',   label: 'Events',   icon: 'confirmation_number' },
  { id: 'places',   label: 'Places',   icon: 'storefront' },
  { id: 'profile',  label: 'Profile',  icon: 'person' },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];

// ─── Main App ──────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    // Set initial history entry (preserve #admin so the admin panel can mount)
    if (window.location.hash !== '#admin') {
      window.history.replaceState({ tab: 'discover', modal: null }, '', '#discover');
    }

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
  }, [selectedPlace, selectedEvent, activeTab]);

  const [checkInError, setCheckInError] = useState<string | null>(null);

  // ── Admin & Site Banner ──
  const [showAdmin, setShowAdmin] = useState(() => window.location.hash === '#admin');

  // Listen for hash changes so navigating to #admin after mount works
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setShowAdmin(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

    // Find the place and verify proximity (within 0.5 miles)
    const place = places.find(p => p.id === placeId);
    if (place?.lat && place?.lng) {
      const dist = distanceMiles(coords.lat, coords.lng, place.lat, place.lng);
      if (dist > 0.5) {
        setCheckInError(`You're ${formatDist(dist)} away — get within 0.5 mi to check in!`);
        setTimeout(() => setCheckInError(null), 5000);
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
        const [placesResult, eventsResult] = await Promise.allSettled([
          fetch('/places-data.json').then(r => r.json()),
          fetch('/data/ticketmaster-events.json').then(r => r.json()),
        ]);

        if (placesResult.status === 'fulfilled') {
          const data = placesResult.value;
          setPlaces(Array.isArray(data) ? data : []);
        }

        if (eventsResult.status === 'fulfilled') {
          const data = eventsResult.value;
          setEvents(Array.isArray(data) ? data : []);
        }
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
          <button onClick={() => { setShowAdmin(false); window.history.replaceState({}, '', '#discover'); }} style={{ color: '#aaa', fontSize: '13px', fontFamily: 'Manrope, sans-serif' }}>
            Back to App
          </button>
          {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </div>
      );
    }
    return <AdminScreen user={user} onBack={() => { setShowAdmin(false); window.history.replaceState({}, '', '#discover'); }} />;
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
