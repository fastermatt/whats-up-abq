import { useState, useEffect, useMemo, useCallback } from 'react';

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
  const [h, m] = timeStr.split(':').map(Number);
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
  if (count >= 50) return { label: 'Legend', emoji: '🏆', next: 100 };
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
              {isCheckedIn ? '✓ In' : 'Check In'}
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
          <img src={imgSrc} alt={event.name} className="w-full h-full object-cover" />
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
          <img src={imgSrc} alt={event.name} className="w-full h-full object-cover" />
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
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
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
                      <img src={imgSrc} alt={event.name} className="w-full h-full object-cover" />
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
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
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
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
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
            onClick={() => { if (!s.disabled) setSortMode(s.id); }}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              background: sortMode === s.id ? '#111' : 'white',
              color: sortMode === s.id ? 'white' : s.disabled ? '#ccc' : '#555',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              opacity: s.disabled ? 0.5 : 1,
            }}
          >
            {s.id === 'near' && !coords && (
              <span className="material-symbols-outlined mr-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>lock</span>
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

function ProfileScreen({ checkedIn }: { checkedIn: Set<string> }) {
  const myCount = checkedIn.size;
  const level = getLevel(myCount);

  // Build leaderboard: inject "You" at the right rank
  const leaderboard = useMemo(() => {
    const rows = LEADERBOARD_SEEDS.map((s, i) => ({ rank: i + 1, name: s.name, count: s.count, isMe: false }));
    // Find where user fits
    const insertAt = rows.findIndex(r => myCount >= r.count);
    const meEntry = { rank: 0, name: 'You', count: myCount, isMe: true };
    if (insertAt === -1) {
      rows.push(meEntry);
    } else {
      rows.splice(insertAt, 0, meEntry);
    }
    // Re-rank
    return rows.map((r, i) => ({ ...r, rank: i + 1 })).slice(0, 10);
  }, [myCount]);

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
    <div className="h-full overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
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
          Hey,<br />Explorer
        </h1>
      </div>

      {/* Profile card */}
      <div
        className="flex items-center gap-4 bg-white rounded-2xl p-4 mb-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
        >
          <span className="text-white text-2xl font-black" style={{ fontFamily: 'Epilogue, sans-serif' }}>
            {level.emoji}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg" style={{ fontFamily: 'Epilogue, sans-serif' }}>ABQ Explorer</p>
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
      {myCount < 50 && (
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
            key={row.name}
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
        className="rounded-2xl p-4 mb-2"
        style={{ background: 'rgba(160,59,0,0.06)' }}
      >
        <p className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
          🎖️ Rankings are based on self-reported check-ins. We can't verify visits, but we trust you to explore honestly. The real prize is the memories you make!
        </p>
      </div>
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
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TMEvent | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(loadCheckins);

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
  }, [selectedPlace, selectedEvent, activeTab]);

  const [checkInError, setCheckInError] = useState<string | null>(null);

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
      setTimeout(() => setCheckInError(null), 3500);
      return;
    }

    // Find the place and verify proximity (within 0.5 miles)
    const place = places.find(p => p.id === placeId);
    if (place?.lat && place?.lng) {
      const dist = distanceMiles(coords.lat, coords.lng, place.lat, place.lng);
      if (dist > 0.5) {
        setCheckInError(`You're ${formatDist(dist)} away — get within 0.5 mi to check in!`);
        setTimeout(() => setCheckInError(null), 3500);
        return;
      }
    }

    // Proximity OK (or place has no coordinates) → check in
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
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700;900&family=Manrope:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f7f5; font-family: 'Manrope', sans-serif; overflow: hidden; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="flex flex-col mx-auto relative"
        style={{ maxWidth: '480px', height: '100dvh', background: '#f5f7f5', overflow: 'hidden' }}
      >
        {/* Glassmorphism header */}
        <header
          className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
          style={{
            background: 'rgba(245,247,245,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
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
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
              title={coords ? 'Location active' : 'Enable location'}
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
            <ProfileScreen checkedIn={checkedIn} />
          )}
        </main>

        {/* Bottom navigation */}
        <nav
          className="flex-shrink-0 flex items-center px-2 pt-2 pb-2"
          style={{
            background: 'rgba(245,247,245,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0,0,0,0.07)',
            zIndex: 40,
          }}
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => navigateTab(item.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 transition-all"
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
    </>
  );
}
