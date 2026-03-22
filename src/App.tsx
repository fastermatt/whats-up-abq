import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

// âââ Firebase Setup ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Utilities ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
  if (count >= 50) return { label: 'Legend', emoji: 'ð', next: count }; // max level
  if (count >= 35) return { label: 'Pioneer', emoji: 'ð¥', next: 50 };
  if (count >= 20) return { label: 'Trailblazer', emoji: 'ð¥', next: 35 };
  if (count >= 10) return { label: 'Adventurer', emoji: 'ð¥', next: 20 };
  if (count >= 5)  return { label: 'Explorer', emoji: 'â¡', next: 10 };
  return { label: 'Newcomer', emoji: 'ð±', next: 5 };
}

// âââ Geolocation Hook ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Check-In Storage ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ SVG Logo âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ ImageWithFallback ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Category Data ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const PLACE_CATEGORIES = [
  { label: 'All', icon: 'â¨' },
  { label: 'Restaurant', icon: 'ð½ï¸' },
  { label: 'Coffee & Tea', icon: 'â' },
  { label: 'Bar', icon: 'ðº' },
  { label: 'Bakery', icon: 'ð¥' },
  { label: 'Park', icon: 'ð³' },
  { label: 'Museum', icon: 'ðï¸' },
  { label: 'Art Gallery', icon: 'ð¨' },
  { label: 'Attraction', icon: 'ð¡' },
  { label: 'Shopping', icon: 'ðï¸' },
  { label: 'Nightlife', icon: 'ð' },
  { label: 'Spa & Wellness', icon: 'ð' },
  { label: 'Gym & Fitness', icon: 'ðª' },
  { label: 'Movie Theater', icon: 'ð¬' },
  { label: 'Library', icon: 'ð' },
];

const EVENT_GENRES = ['All', 'Music', 'Sports', 'Arts & Theatre', 'Comedy', 'Family', 'Outdoor'];

// âââ Geo Banner ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
      <p className="text-xs text-gray-500 flex-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Getting your locationâ¦</p>
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

// âââ Place Card âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function PlaceCard({
  place, onClick, distance, isCheckedIn, onCheckIn,
}: {
  place: Place;
  onClick: () => void;
  distance?: number;
  isCheckedIn?: boolean;
  onCheckIn?: (e: React.MouseEvent) => void;
}) {
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || 'ð';
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
              â Visited
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
              <span className="text-yellow-400 text-xs">â</span>
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
              {isCheckedIn ? 'â Visited' : 'Check In'}
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// âââ Event Card âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
            <span className="text-3xl">ðµ</span>
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
              {event.dates?.start?.localTime ? ' Â· ' + formatTime(event.dates.start.localTime) : ''}
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

// âââ Place Detail Modal ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function PlaceDetailModal({
  place, onClose, isCheckedIn, onCheckIn, checkInError,
}: {
  place: Place;
  onClose: () => void;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  checkInError?: string | null;
}) {
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || 'ð';
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
              <span className="text-yellow-400">â</span>
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
            {isCheckedIn ? 'Visited! â' : 'Check In'}
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
                ð¨âð©âð§ Kid Friendly
              </span>
            )}
            {place.isAccessible && (
              <span className="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                â¿ Accessible
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
          GET DIRECTIONS â
        </a>
      </div>
    </div>
  );
}

// âââ Event Detail Modal ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
            <span style={{ fontSize: '72px' }}>ðµ</span>
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
                ${Math.round(price.min || 0)} â ${Math.round(price.max || 0)}
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
            â¡ UNPLUGGING TIP
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
            GET TICKETS â
          </a>
        ) : (
          <a
            href={`https://maps.google.com/?q=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 text-center text-white font-black text-sm rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Epilogue, sans-serif' }}
          >
            GET DIRECTIONS â
          </a>
        )}
      </div>
    </div>
  );
}

// âââ Discover Screen (Mixed Feed) âââââââââââââââââââââââââââââââââââââââââââââ

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
          {places.length} places Â· {events.length} events in ABQ
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
              ð Live events
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
                        <span className="text-4xl">ðµ</span>
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
                      {event.dates?.start?.localTime ? ' Â· ' + formatTime(event.dates.start.localTime) : ''}
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
                  â¡ Featured
                </span>
              </div>
              {checkedIn.has(featured[0].id) && (
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-bold text-white px-2 py-1 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>â Visited</span>
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
                    <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>â</span>
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
                      <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>â</span>
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
              â 4.5+ rated
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
                        â {place.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {checkedIn.has(place.id) && (
                    <div className="absolute top-2 right-2">
                      <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,59,0,0.85)' }}>â</span>
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
        <span className="absolute right-4 bottom-2 text-5xl opacity-20">â¡</span>
      </div>
    </div>
  );
}

// âââ Events Screen ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Places Screen ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
          { id: 'az', label: 'AâZ' },
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

// âââ Auth Modal ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">Ã</button>
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
              {loading ? 'Please waitâ¦' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            <button type="button" onClick={() => setMode('choose')}
              className="text-xs text-gray-400 text-center mt-1"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >â Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

// âââ Profile Screen ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
    { id: 'first', emoji: 'ð±', label: 'First Check-in', unlocked: myCount >= 1 },
    { id: 'five', emoji: 'â¡', label: 'Explorer (5)', unlocked: myCount >= 5 },
    { id: 'ten', emoji: 'ð¥', label: 'Adventurer (10)', unlocked: myCount >= 10 },
    { id: 'twenty', emoji: 'ð¥', label: 'Trailblazer (20)', unlocked: myCount >= 20 },
    { id: 'thirty5', emoji: 'ð¥', label: 'Pioneer (35)', unlocked: myCount >= 35 },
    { id: 'fifty', emoji: 'ð', label: 'Legend (50)', unlocked: myCount >= 50 },
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
          { label: 'Next\nLevel', val: myCount >= 50 ? 'ð' : (level.next - myCount).toString() + ' away' },
          { label: 'Rank', val: leaderboard.find(r => r.isMe)?.rank ? '#' + leaderboard.find(r => r.isMe)!.rank : 'â' },
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
          <span style={{ fontSize: '28px' }}>ð</span>
          <p className="font-black text-sm mt-1" style={{ fontFamily: 'Epilogue, sans-serif', color: '#a03b00' }}>Max Level Reached!</p>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>You're a Legend â {myCount} places explored!</p>
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
            <span style={{ fontSize: '24px' }}>{a.unlocked ? a.emoji : 'ð'}</span>
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
              {row.rank === 1 ? 'ð¥' : row.rank === 2 ? 'ð¥' : row.rank === 3 ? 'ð¥' : `#${row.rank}`}
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
          ðï¸ Rankings are based on self-reported check-ins. We can't verify visits, but we trust you to explore honestly. The real prize is the memories you make!
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
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: '#a03b00' }}>â</span>
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  );
}

// âââ Loading Screen ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
        Loading your cityâ¦
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

// âââ Site Banner âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Admin Screen âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

// ─────────────────────────────────────────────────────────────────────────────
// ─── Admin Screen ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

type AdminTab = 'dashboard' | 'places' | 'events' | 'tagrules' | 'settings';// ─────────────────────────────────────────────────────────────────────────────
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
    { label: 'Total Places', value: places.length, icon: '📍' },
    { label: 'Featured',     value: featured,       icon: '⭐' },
    { label: 'Users',        value: lbEntries.length, icon: '👤' },
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
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}🏆 Top Check-in Leaders</h3>
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
        const ref = await addDoc(collection(fbDb, 'places', form as Record<string,unknown>);
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
        <button style={{ ...btnSec, marginBottom: 16 }} onClick={() => setMode('list')}← Back to List</button>
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
                {p.isFeatured && <span style={{ fontSize: 11, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 999 }}>⭐ Featured</span>}
                <span style={{ fontSize: 11, backgroundColor: '#f3f4f6', color: '#6b7280', padding: '2px 7px', borderRadius: 999 }}>{p.category}</span>
                {p.rating ? <span style={{ fontSize: 11, color: '#9ca3af' }}★ {p.rating}</span> : null}
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
              <button onClick={() => startEdit(p)} style={{ ...btnSec, padding: '4px 10px', fontSize: 12 }}✏️ Edit</button>
              <button onClick={() => deletePlace(p)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}🗑 Delete</button>
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
                {o.venueName && <div style={{ fontSize: 12, color: '#6b7280' }}📍 {o.venueName}</div>}
                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>ID: {o.eventId}</div>
                {o.notes && <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 2 }}>{o.notes}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {o.customTags.map(t => <span key={t} style={{ fontSize: 11, backgroundColor: '#ede9e0', color: '#6b4c2a', padding: '2px 8px', borderRadius: 999 }}>{t}</span>)}
                </div>
              </div>
              <button onClick={() => deleteOverride(o.eventId)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}🗑 Delete</button>
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
          {saving ? 'Saving…' : '💾 Save Rules'}
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
          <span style={{ fontSize: 22 }}🌿</span>
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
          <span style={{ fontSize: 22 }}🏛️</span>
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
          <span style={{ fontSize: 22 }}🏷️</span>
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
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', flex: 1 }}🏷 {cat}</label>
                <button onClick={() => removeCat(cat)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}✕ remove</button>
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
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 14 }}📢 Site Banner</h3>
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
          {saving ? 'Saving…' : '💾 Save Settings'}
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
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'places',    label: 'Places',    icon: '📍' },
    { key: 'events',    label: 'Events',    icon: '🎭' },
    { key: 'tagrules',  label: 'Tag Rules', icon: '🏷️' },
    { key: 'settings',  label: 'Settings',  icon: '⚙️' },
  ];

  const setPlacesFn = (fn: (prev: PlaceDoc[]) => PlaceDoc[]) => setPlaces(fn);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#faf7f4' }}>
      {/* Header */}
      <div style={{ backgroundColor: ADMIN_ACCENT, color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', padding: '6px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}← Back</button>
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