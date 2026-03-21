import { useState, useEffect, useMemo } from 'react';

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

// ─── SVG Logo ───────────────────────────────────────────────────────────────

function ABQUnpluggedLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hot air balloon / unplug concept */}
      <defs>
        <radialGradient id="bg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff793b" />
          <stop offset="100%" stopColor="#a03b00" />
        </radialGradient>
      </defs>
      {/* Balloon body */}
      <ellipse cx="20" cy="17" rx="12" ry="13" fill="url(#bg)" />
      {/* Lightning bolt / unplug symbol overlay */}
      <path d="M22 9 L17 18 L21 18 L18 27 L23 16 L19 16 Z" fill="white" opacity="0.95" />
      {/* Basket */}
      <rect x="17" y="30" width="6" height="4" rx="1.5" fill="#a03b00" />
      {/* Ropes */}
      <line x1="18" y1="30" x2="16" y2="28" stroke="#a03b00" strokeWidth="1" />
      <line x1="22" y1="30" x2="24" y2="28" stroke="#a03b00" strokeWidth="1" />
    </svg>
  );
}

// ─── ImageWithFallback ──────────────────────────────────────────────────────

function ImageWithFallback({
  src,
  alt,
  className,
  gradient,
}: {
  src?: string;
  alt?: string;
  className?: string;
  gradient?: string;
}) {
  const [error, setError] = useState(false);
  const resolvedSrc = src ? hiResUrl(src) : '';

  if (!resolvedSrc || error) {
    return (
      <div
        className={className}
        style={{ background: gradient || 'linear-gradient(135deg,#a03b00,#ff793b)' }}
        aria-label={alt}
      />
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
  { label: 'Church', icon: '⛪' },
  { label: 'Spa & Wellness', icon: '💆' },
  { label: 'Gym & Fitness', icon: '💪' },
  { label: 'Movie Theater', icon: '🎬' },
  { label: 'Library', icon: '📚' },
];

const EVENT_GENRES = ['All', 'Music', 'Sports', 'Arts & Theatre', 'Comedy', 'Family'];

// ─── Place Card ─────────────────────────────────────────────────────────────

function PlaceCard({ place, onClick }: { place: Place; onClick: () => void }) {
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
        {place.priceLevel != null && place.priceLevel > 0 && (
          <div className="absolute top-2 right-2">
            <span
              className="text-xs font-bold text-white px-1.5 py-0.5 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
            >
              {'$'.repeat(Math.min(place.priceLevel, 4))}
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
        {place.rating ? (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-xs font-bold text-gray-700">{place.rating.toFixed(1)}</span>
            {place.reviewCount ? (
              <span className="text-xs text-gray-400">({place.reviewCount >= 1000 ? (place.reviewCount / 1000).toFixed(1) + 'k' : place.reviewCount})</span>
            ) : null}
          </div>
        ) : null}
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

function PlaceDetailModal({ place, onClose }: { place: Place; onClose: () => void }) {
  const catEmoji = PLACE_CATEGORIES.find(c => c.label === place.category)?.icon || '📍';
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
        {place.rating && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <span className="text-yellow-400">★</span>
              <span className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>
                {place.rating.toFixed(1)}
              </span>
              {place.reviewCount && (
                <span className="text-xs text-gray-400">({place.reviewCount.toLocaleString()})</span>
              )}
            </div>
            {place.priceLevel != null && place.priceLevel > 0 && (
              <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <span className="font-black text-sm text-green-600">
                  {'$'.repeat(Math.min(place.priceLevel, 4))}
                </span>
              </div>
            )}
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
              className="flex items-start gap-3 mb-
 bg-white rounded-xl p-3"
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

        {(place.isKidFriendly || place.isAccessible) && (
          <div className="flex gap-2 mt-2 mb-4">
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
          href={
            place.website ||
            `https://maps.google.com/?q=${encodeURIComponent(place.name + ' Albuquerque NM')}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-4 text-center text-white font-black text-sm rounded-2xl mt-4"
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
            <div className="bg-white rounded-2xl p-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <p className="text-xs text-gray-400 mb-1">Price</p>
              <p className="font-black text-sm" style={{ fontFamily: 'Epilogue, sans-serif' }}>
                ${Math.round(price.min || 0)} – ${Math.round(price.max || 0)}
              </p>
            </div>
          )}
        </div>

        {/* Unplugging tip */}
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
          <button
            className="w-full py-4 text-center text-white font-black text-sm rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)', fontFamily: 'Epilogue, sans-serif' }}
          >
            ADD TO PLANNER
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Discover Screen ─────────────────────────────────────────────────────────

function DiscoverScreen({
  places,
  onPlaceSelect,
}: {
  places: Place[];
  onPlaceSelect: (p: Place) => void;
}) {
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');

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

  const featured = places.filter(p => p.isFeatured).slice(0, 5);
  const hiddenGems = places
    .filter(p => !p.isFeatured && p.rating && p.rating >= 4.5)
    .slice(0, 10);

  const showSections = selectedCat === 'All' && !search.trim();

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Hero headline */}
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
          {places.length} places to explore in ABQ
        </p>
      </div>

      {/* Search bar */}
      <div className="px-5 pb-3">
        <div
          className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        >
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>
            search
          </span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search places..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: 'Manrope, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>
                close
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div
        className="flex gap-2 px-5 pb-4 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {PLACE_CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => setSelectedCat(cat.label)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
            style={{
              fontFamily: 'Manrope, sans-serif',
              background: selectedCat === cat.label ? '#a03b00' : 'white',
              color: selectedCat === cat.label ? 'white' : '#333',
              boxShadow:
                selectedCat === cat.label
                  ? '0 4px 12px rgba(160,59,0,0.3)'
                  : '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Trending bento grid */}
      {showSections && featured.length > 0 && (
        <div className="px-5 pb-4">
          <h2
            className="text-lg font-black uppercase tracking-tight mb-
"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            Trending Now
          </h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto' }}>
            {/* Large hero card */}
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
            {/* Smaller cards */}
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

      {/* Hidden Gems horizontal scroll */}
      {showSections && hiddenGems.length > 0 && (
        <div className="pb-4">
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
              <button key={place.id} onClick={() => onPlaceSelect(place)} className="flex-shrink-0" style={{ width: '144px' }}>
                <div className="relative rounded-2xl overflow-hidden mb-2" style={{ width: '144px', height: '144px' }}>
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

      {/* Why Unplug callout */}
      {showSections && (
        <div
          className="mx-5 mb-4 rounded-2xl p-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
        >
          <p
            className="text-white font-black text-lg leading-tight"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            WHY UNPLUG?
          </p>
          <p className="text-white/80 text-sm mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Real experiences create memories no screen can replicate. Get out there, ABQ.
          </p>
          <span className="absolute right-4 bottom-2 text-5xl opacity-20">⚡</span>
        </div>
      )}

      {/* Places grid */}
      <div className="px-5 pb-28">
        {showSections && (
          <h2
            className="text-lg font-black uppercase tracking-tight mb-
"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            All Places ({filtered.length})
          </h2>
        )}
        {!showSections && (
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-lg font-black uppercase tracking-tight"
              style={{ fontFamily: 'Epilogue, sans-serif' }}
            >
              {filtered.length} {selectedCat !== 'All' ? selectedCat : 'Results'}
            </h2>
            {(selectedCat !== 'All' || search) && (
              <button
                onClick={() => { setSelectedCat('All'); setSearch(''); }}
                className="text-xs font-semibold"
                style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filtered.map(place => (
            <PlaceCard key={place.id} place={place} onClick={() => onPlaceSelect(place)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>
              search_off
            </span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
              No places found
            </p>
          </div>
        )}
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
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>
            search
          </span>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: 'Manrope, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '18px' }}>
                close
              </span>
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
              boxShadow:
                selectedGenre === genre
                  ? '0 4px 12px rgba(160,59,0,0.3)'
                  : '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            {genre}
          </button>
        ))}
      </div>

      {selectedGenre === 'All' && !search && (
        <div
          className="mx-5 mb-4 rounded-2xl p-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
        >
          <p
            className="text-white font-black text-lg"
            style={{ fontFamily: 'Epilogue, sans-serif' }}
          >
            WHY UNPLUG?
          </p>
          <p className="text-white/80 text-sm mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Live experiences create memories that no screen can replicate.
          </p>
          <span className="absolute right-4 bottom-2 text-5xl opacity-20">🎶</span>
        </div>
      )}

      <div className="px-5 pb-2">
        <p className="text-sm font-semibold text-gray-500" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {sorted.length} event{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="px-5 pb-28 flex flex-col gap-3">
        {sorted.map(event => (
          <EventCard key={event.id} event={event} onClick={() => onEventSelect(event)} />
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>
              event_busy
            </span>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
              No events found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Planner Screen ────────────────────────────────────────────────────────────

function PlannerScreen({ events, places }: { events: TMEvent[]; places: Place[] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(0);

  const dayEvents = useMemo(() => {
    const dateStr = days[selectedDay].toISOString().slice(0, 10);
    return events.filter(e => e.dates?.start?.localDate === dateStr);
  }, [events, selectedDay]);

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="px-5 pt-5 pb-4">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}
        >
          Your Schedule
        </p>
        <h1
          className="text-4xl font-black uppercase tracking-tighter leading-none mt-1"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Plan Your<br />Unplug
        </h1>
      </div>

      {/* Reminder banner */}
      <div
        className="mx-5 mb-4 bg-white rounded-2xl p-4 flex items-center gap-3"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(160,59,0,0.1)' }}
        >
          <span className="material-symbols-outlined" style={{ color: '#a03b00' }}>
            notifications
          </span>
        </div>
        <div>
          <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Set a reminder
          </p>
          <p className="text-xs text-gray-500">Never miss a great event in ABQ</p>
        </div>
        <button
          className="ml-auto text-white text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: '#a03b00' }}
        >
          Enable
        </button>
      </div>

      {/* Calendar strip */}
      <div className="px-5 pb-4">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {days.map((day, i) => {
            const dateStr = day.toISOString().slice(0, 10);
            const hasEvents = events.some(e => e.dates?.start?.localDate === dateStr);
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className="flex-shrink-0 flex flex-col items-center py-2.5 rounded-2xl transition-all"
                style={{
                  width: '48px',
                  background: selectedDay === i ? '#a03b00' : 'white',
                  boxShadow:
                    selectedDay === i
                      ? '0 4px 12px rgba(160,59,0,0.3)'
                      : '0 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: selectedDay === i ? 'rgba(255,255,255,0.7)' : '#999' }}
                >
                  {DAY_NAMES[day.getDay()]}
                </p>
                <p
                  className="text-lg font-black"
                  style={{ fontFamily: 'Epilogue, sans-serif', color: selectedDay === i ? 'white' : '#111' }}
                >
                  {day.getDate()}
                </p>
                {hasEvents && (
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{ background: selectedDay === i ? 'white' : '#a03b00' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day events */}
      <div className="px-5 pb-4">
        <h2
          className="font-black text-base uppercase tracking-tight mb-
"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          {selectedDay === 0 ? "Today's Events" : selectedDay === 1 ? 'Tomorrow' : `${DAY_NAMES[days[selectedDay].getDay()]}'s Events`}
        </h2>
        {dayEvents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {dayEvents.map(event => (
              <div
                key={event.id}
                className="bg-white rounded-2xl p-4 flex items-center gap-3"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                  {getBestEventImage(event.images) ? (
                    <img
                      src={getBestEventImage(event.images)}
                      alt={event.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xl"
                      style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
                    >
                      🎵
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-black text-sm leading-tight truncate"
                    style={{ fontFamily: 'Epilogue, sans-serif' }}
                  >
                    {event.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatTime(event.dates?.start?.localTime)} ·{' '}
                    {event._embedded?.venues?.[0]?.name || 'TBD'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-gray-300">chevron_right</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl p-6 text-center"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>🌅</span>
            <p className="font-bold text-sm text-gray-700">No events scheduled</p>
            <p className="text-xs text-gray-400 mt-1">Explore the city on your own terms</p>
          </div>
        )}
      </div>

      {/* Explore freely */}
      <div className="px-5 pb-28">
        <h2
          className="font-black text-base uppercase tracking-tight mb-
"
          style={{ fontFamily: 'Epilogue, sans-serif' }}
        >
          Explore Freely
        </h2>
        <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {places.filter(p => p.isFeatured || (p.rating && p.rating >= 4.5)).slice(0, 8).map(place => (
            <div key={place.id} className="flex-shrink-0" style={{ width: '128px' }}>
              <div className="relative rounded-xl overflow-hidden mb-1.5" style={{ width: '128px', height: '128px' }}>
                <ImageWithFallback
                  src={place.image}
                  alt={place.name}
                  className="w-full h-full object-cover"
                  gradient={place.gradient}
                />
              </div>
              <p
                className="text-xs font-bold text-gray-900 leading-tight truncate"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {place.name}
              </p>
              <p className="text-xs text-gray-400">{place.category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Screen ────────────────────────────────────────────────────────────

function ProfileScreen() {
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

      <div
        className="flex items-center gap-4 bg-white rounded-2xl p-4 mb-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #a03b00, #ff793b)' }}
        >
          <span className="text-white text-2xl font-black" style={{ fontFamily: 'Epilogue, sans-serif' }}>
            A
          </span>
        </div>
        <div>
          <p className="font-black text-lg" style={{ fontFamily: 'Epilogue, sans-serif' }}>
            ABQ Explorer
          </p>
          <p className="text-sm text-gray-500">Albuquerque, NM</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#a03b00', fontFamily: 'Manrope, sans-serif' }}>
            Level 1 · Unplugged
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Places\nVisited', val: '0' },
          { label: 'Events\nAttended', val: '0' },
          { label: 'Hours\nUnplugged', val: '0' },
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

      {[
        { icon: 'notifications', label: 'Notifications' },
        { icon: 'bookmark', label: 'Saved Places' },
        { icon: 'share', label: 'Share ABQ Unplugged' },
        { icon: 'info', label: 'About' },
      ].map(item => (
        <button
          key={item.label}
          className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-2 w-full text-left"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        >
          <span className="material-symbols-outlined" style={{ color: '#a03b00' }}>
            {item.icon}
          </span>
          <span className="font-semibold text-sm text-gray-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {item.label}
          </span>
          <span className="material-symbols-outlined text-gray-300 ml-auto">chevron_right</span>
        </button>
      ))}
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
        Loading your city...
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

// ─── Bottom Nav Items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: 'explore' },
  { id: 'events', label: 'Events', icon: 'confirmation_number' },
  { id: 'planner', label: 'Planner', icon: 'calendar_month' },
  { id: 'profile', label: 'Profile', icon: 'person' },
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
      {/* Global styles + fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700;900&family=Manrope:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f7f5; font-family: 'Manrope', sans-serif; overflow: hidden; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="flex flex-col mx-auto relative"
        style={{ maxWidth: '480px', height: '100dvh', height: '100vh', background: '#f5f7f5', overflow: 'hidden' }}
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
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '20px', color: '#a03b00' }}
              >
                tune
              </span>
            </button>
          </div>
        </header>

        {/* Screen content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'discover' && (
            <DiscoverScreen places={places} onPlaceSelect={setSelectedPlace} />
          )}
          {activeTab === 'events' && (
            <EventsScreen events={events} onEventSelect={setSelectedEvent} />
          )}
          {activeTab === 'planner' && (
            <PlannerScreen events={events} places={places} />
          )}
          {activeTab === 'profile' && <ProfileScreen />}
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
              onClick={() => setActiveTab(item.id)}
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
        <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      )}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}
