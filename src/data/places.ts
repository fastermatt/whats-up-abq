export type PlaceCategory =
  | "Restaurant"
  | "Coffee"
  | "Coffee & Tea"
  | "Bar"
  | "Bakery"
  | "Park"
  | "Church"
  | "Museum"
  | "Art Gallery"
  | "Attraction"
  | "Brewery"
  | "Shopping"
  | "Outdoors"
  | "Nightlife"
  | "Spa & Wellness"
  | "Gym & Fitness"
  | "Movie Theater"
  | "Library";

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string;
  address: string;
  lat: number;
  lng: number;
  image: string;
  gradient: string;
  rating: number;
  priceLevel: 1 | 2 | 3 | 4;
  hours: string;
  phone?: string;
  website?: string;
  tags: string[];
  isKidFriendly?: boolean;
  isOutdoor?: boolean;
  isAccessible?: boolean;
  isFeatured?: boolean;
}

export const PLACE_CATEGORIES: { label: PlaceCategory; emoji: string; color: string }[] = [
  { label: "Restaurant", emoji: "🍽️", color: "#FF6B35" },
  { label: "Coffee",     emoji: "☕",  color: "#8B5E3C" },
  { label: "Bar",        emoji: "🍹",  color: "#5856D6" },
  { label: "Park",       emoji: "🌳",  color: "#34C759" },
  { label: "Outdoors",   emoji: "🥾",  color: "#30B0C7" },
  { label: "Church",     emoji: "⛪",  color: "#9B59B6" },
  { label: "Museum",     emoji: "🏛️",  color: "#FF9500" },
  { label: "Brewery",    emoji: "🍺",  color: "#FFCC00" },
  { label: "Shopping",   emoji: "🛍️",  color: "#FF2D55" },
];

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return "Right here";
  if (miles < 0.2) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

// ── Per-category curated Unsplash photo IDs ────────────────────────────────
const CATEGORY_IMAGES: Record<PlaceCategory, string[]> = {
  Restaurant: [
    "photo-1565299585323-38d6b0865b47",
    "photo-1414235077428-338989a2e8c0",
    "photo-1555396273-367ea4eb4db5",
    "photo-1517248135467-4c7edcad34c4",
    "photo-1504674900247-0877df9cc836",
    "photo-1551504734-5ee1c4a1479b",
    "photo-1615361200141-f45040f367be",
    "photo-1544025162-d76694265947",
    "photo-1512621776951-a57141f2eefd",
    "photo-1493770348161-369560ae357d",
  ],
  Coffee: [
    "photo-1442512595331-e89e73853f31",
    "photo-1495474472287-4d71bcdd2085",
    "photo-1509042239860-f550ce710b93",
    "photo-1501339847302-ac426a4a7cbb",
    "photo-1514432324607-a09d9b4aefdd",
    "photo-1507003211169-0a1dd7228f2d",
    "photo-1600093463592-8e36ae95ef56",
    "photo-1461023058943-07fcbe16d735",
  ],
  Bar: [
    "photo-1575444758702-4a6b9222336e",
    "photo-1470337458703-46ad1756a187",
    "photo-1514362545857-3bc16c4c7d1b",
    "photo-1527090526205-beaac8dc3c62",
    "photo-1543007630-9710e4a00a20",
    "photo-1572116469696-31de0f17cc34",
    "photo-1536935338788-846bb9981813",
  ],
  Park: [
    "photo-1508193638397-1c4234db14d8",
    "photo-1441974231531-c6227db76b6e",
    "photo-1472214103451-9374bd1c798e",
    "photo-1502082553048-f009c37129b9",
    "photo-1568702846914-96b305d2aaeb",
    "photo-1501854140801-50d01698950b",
    "photo-1506905925346-21bda4d32df4",
  ],
  Outdoors: [
    "photo-1464822759023-fed622ff2c3b",
    "photo-1501854140801-50d01698950b",
    "photo-1440688807730-73e4e2169fb8",
    "photo-1506905925346-21bda4d32df4",
    "photo-1519681393784-d120267933ba",
    "photo-1493246507139-91e8fad9978e",
  ],
  Church: [
    "photo-1548625149-720754178789",
    "photo-1438032005730-c779502df39b",
    "photo-1507692049790-de58290a4334",
    "photo-1596386461350-326ccb383e9f",
    "photo-1533577116850-9cc66cad8a9b",
    "photo-1568607689150-17e625c1586e",
  ],
  Museum: [
    "photo-1584551246679-0daf3d275d0f",
    "photo-1518998053901-5348d3961a04",
    "photo-1530026405186-ed1f139313f8",
    "photo-1570168007204-dfb528c6958f",
    "photo-1577083552431-6e5fd01aa342",
    "photo-1544413660-299165566b1d",
  ],
  Brewery: [
    "photo-1555658636-6e4a36218be7",
    "photo-1565958011703-44f9829ba187",
    "photo-1436076863939-06870fe779c2",
    "photo-1559818488-b2a0e7c33d7d",
    "photo-1532634733-cae1395e440f",
    "photo-1514362545857-3bc16c4c7d1b",
  ],
  Shopping: [
    "photo-1555529669-2269763671c0",
    "photo-1481437156560-3205f6a55735",
    "photo-1441986300917-64674bd600d8",
    "photo-1472851294608-062f824d29cc",
    "photo-1607082348824-0a96f2a4b9da",
    "photo-1528698827591-e19ccd7bc23d",
  ],
  Nightlife:      ["photo-1575444758702-4a6b9222336e", "photo-1543007630-9710e4a00a20"],
  "Coffee & Tea": ["photo-1442512595331-e89e73853f31", "photo-1495474472287-4d71bcdd2085"],
  Bakery:         ["photo-1558961363-fa8fdf82db35", "photo-1509440159596-0249088772ff"],
  "Art Gallery":  ["photo-1578926288207-a90a103502c6", "photo-1518998053901-5348d3961a04"],
  Attraction:     ["photo-1558618666-fcd25c85cd64", "photo-1568607689150-17e625c1586e"],
  "Spa & Wellness":["photo-1540555700478-4be289fbecef", "photo-1515377905703-c4788e51af15"],
  "Gym & Fitness":["photo-1534438327276-14e5300c3a48", "photo-1571019614242-c5c5dee9f50b"],
  "Movie Theater":["photo-1489599849927-2ee91cede3ba", "photo-1517604931442-7e0c8ed2963c"],
  Library:        ["photo-1507003211169-0a1dd7228f2d", "photo-1481627834876-b7833e8f5570"],
};

const CATEGORY_GRADIENTS: Record<PlaceCategory, string[]> = {
  Restaurant: ["linear-gradient(135deg, #FF6B35, #FF9500)", "linear-gradient(135deg, #D4450C, #FF6B35)", "linear-gradient(135deg, #C0392B, #E74C3C)"],
  Coffee:     ["linear-gradient(135deg, #8B5E3C, #C49A6C)", "linear-gradient(135deg, #764BA2, #667EEA)", "linear-gradient(135deg, #232526, #414345)"],
  Bar:        ["linear-gradient(135deg, #5856D6, #7B68EE)", "linear-gradient(135deg, #1A1A2E, #5856D6)", "linear-gradient(135deg, #360033, #0b8793)"],
  Park:       ["linear-gradient(135deg, #11998e, #38ef7d)", "linear-gradient(135deg, #134E5E, #71B280)", "linear-gradient(135deg, #56ab2f, #a8e063)"],
  Outdoors:   ["linear-gradient(135deg, #56CCF2, #2F80ED)", "linear-gradient(135deg, #B24592, #F15F79)", "linear-gradient(135deg, #30B0C7, #56CCF2)"],
  Church:     ["linear-gradient(135deg, #9B59B6, #6C3483)", "linear-gradient(135deg, #4568DC, #B06AB3)", "linear-gradient(135deg, #2980B9, #6DD5FA)"],
  Museum:     ["linear-gradient(135deg, #FF9500, #FFCC00)", "linear-gradient(135deg, #F7971E, #FFD200)", "linear-gradient(135deg, #16213E, #0F3460)"],
  Brewery:        ["linear-gradient(135deg, #FFCC00, #FF8C00)", "linear-gradient(135deg, #1A1A2E, #16213E)", "linear-gradient(135deg, #20B2AA, #3CB371)"],
  Shopping:       ["linear-gradient(135deg, #B24592, #F15F79)", "linear-gradient(135deg, #FF2D55, #FF6B6B)", "linear-gradient(135deg, #F7971E, #FFD200)"],
  Nightlife:      ["linear-gradient(135deg, #0f0c29, #302b63)"],
  "Coffee & Tea": ["linear-gradient(135deg, #8B5E3C, #C49A6C)"],
  Bakery:         ["linear-gradient(135deg, #f2994a, #f2c94c)"],
  "Art Gallery":  ["linear-gradient(135deg, #FF6B6B, #556270)"],
  Attraction:     ["linear-gradient(135deg, #FF8C00, #FF4500)"],
  "Spa & Wellness":["linear-gradient(135deg, #a18cd1, #fbc2eb)"],
  "Gym & Fitness":["linear-gradient(135deg, #11998e, #38ef7d)"],
  "Movie Theater":["linear-gradient(135deg, #1a1a2e, #16213e)"],
  Library:        ["linear-gradient(135deg, #4568DC, #B06AB3)"],
};

function pickImage(cat: PlaceCategory, id: number): string {
  const arr = CATEGORY_IMAGES[cat];
  const photoId = arr[Math.abs(id) % arr.length];
  return `https://images.unsplash.com/${photoId}?w=500&h=340&fit=crop&q=75`;
}

function pickGradient(cat: PlaceCategory, id: number): string {
  const arr = CATEGORY_GRADIENTS[cat];
  return arr[Math.abs(id) % arr.length];
}

// ── OSM tag → category mapping ─────────────────────────────────────────────
interface OSMTags { [key: string]: string }

function osmToCategory(tags: OSMTags): PlaceCategory | null {
  const a = tags.amenity;
  const s = tags.shop;
  const l = tags.leisure;
  const t = tags.tourism;
  const c = tags.craft;

  if (a === "restaurant" || a === "fast_food" || a === "food_court" || a === "ice_cream") return "Restaurant";
  if (a === "cafe") return "Coffee";
  if (a === "bar" || a === "pub" || a === "nightclub" || a === "biergarten") return "Bar";
  if (a === "brewery" || c === "brewery" || c === "winery" || c === "distillery" || tags.microbrewery === "yes") return "Brewery";
  if (a === "place_of_worship") return "Church";
  if (t === "museum" || a === "museum") return "Museum";
  if (t === "gallery") return "Museum";
  if (l === "park" || l === "garden" || l === "playground" || l === "recreation_ground") return "Park";
  if (l === "sports_centre" || l === "fitness_centre" || l === "golf_course" || l === "nature_reserve" || l === "pitch") return "Outdoors";
  if (s === "mall" || s === "department_store" || s === "supermarket" || s === "convenience" ||
      s === "clothes" || s === "books" || s === "antiques" || s === "gift" || s === "jewelry" ||
      s === "furniture" || s === "electronics" || s === "sports" || s === "art" || s === "music" ||
      s === "toys" || s === "variety_store" || s === "general" || s === "wine" || s === "bakery") return "Shopping";
  return null;
}

function formatOSMAddress(tags: OSMTags): string {
  const num = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";
  const city = tags["addr:city"] || "Albuquerque";
  const state = tags["addr:state"] || "NM";
  if (num && street) return `${num} ${street}, ${city}, ${state}`;
  if (street) return `${street}, ${city}, ${state}`;
  return `Albuquerque, NM`;
}

function guessRating(_tags: OSMTags, id: number): number {
  // No real ratings in OSM — use a realistic distribution seeded by ID
  const seed = Math.abs(id * 2654435761) % 10000;
  const norm = seed / 10000;
  // Bell-curve-ish around 4.1, range 3.2–4.9
  const base = 3.2 + norm * 1.7;
  return Math.round(base * 10) / 10;
}

function guessPriceLevel(tags: OSMTags, cat: PlaceCategory): 1 | 2 | 3 | 4 {
  if (tags.price) {
    const p = tags.price.length;
    return (Math.min(4, Math.max(1, p)) as 1 | 2 | 3 | 4);
  }
  if (cat === "Park" || cat === "Outdoors" || cat === "Church") return 1;
  if (cat === "Museum") return 2;
  if (cat === "Restaurant" || cat === "Bar" || cat === "Brewery") return 2;
  if (cat === "Coffee" || cat === "Shopping") return 2;
  return 2;
}

function buildTags(tags: OSMTags, cat: PlaceCategory): string[] {
  const result: string[] = [];
  if (tags.cuisine) result.push(...tags.cuisine.replace(/_/g, "-").split(";").map(s => s.trim()).filter(Boolean));
  if (cat === "Restaurant" && tags.takeaway === "yes") result.push("takeaway");
  if (cat === "Restaurant" && tags.delivery === "yes") result.push("delivery");
  if (cat === "Bar" || cat === "Brewery") result.push("craft-beer");
  if (tags.outdoor_seating === "yes") result.push("patio");
  if (tags.wheelchair === "yes") result.push("accessible");
  if (tags.internet_access === "wlan") result.push("wifi");
  if (result.length === 0) result.push(cat.toLowerCase());
  return result.slice(0, 5);
}

// ── OSM type definitions ───────────────────────────────────────────────────
interface OSMElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OSMTags;
}

export async function fetchOSMPlaces(signal?: AbortSignal): Promise<Place[]> {
  // ABQ bounding box: S,W,N,E
  const bbox = "34.95,-106.90,35.30,-106.40";
  const query = `
[out:json][timeout:30][maxsize:30000000];
(
  node["amenity"~"restaurant|cafe|bar|pub|fast_food|brewery|museum|place_of_worship|nightclub|biergarten"](${bbox});
  way["amenity"~"restaurant|cafe|bar|pub|fast_food|brewery|museum|place_of_worship"](${bbox});
  node["shop"~"mall|department_store|supermarket|clothes|books|antiques|gift|jewelry|furniture|electronics|sports|art|music|toys|variety_store|general|wine|bakery|convenience"](${bbox});
  node["leisure"~"park|garden|nature_reserve|sports_centre|fitness_centre"](${bbox});
  way["leisure"~"park|garden|nature_reserve"](${bbox});
  node["tourism"~"museum|gallery"](${bbox});
  way["tourism"~"museum|gallery"](${bbox});
  node["craft"~"brewery|winery|distillery"](${bbox});
);
out center;
`.trim();

  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method: "POST",
    body: query,
    signal,
    headers: { "Content-Type": "text/plain" },
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json = await res.json() as { elements: OSMElement[] };

  const seen = new Set<string>();
  const places: Place[] = [];

  for (const el of json.elements) {
    const tags = el.tags || {};
    const name = tags.name?.trim();
    if (!name || name.length < 2) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;

    const cat = osmToCategory(tags);
    if (!cat) continue;

    // Deduplicate by name+category
    const key = `${name.toLowerCase()}|${cat}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const id = el.id;
    places.push({
      id: `osm-${id}`,
      name,
      category: cat,
      description: tags.description || tags["description:en"] || `${name} — a ${cat.toLowerCase()} in Albuquerque, NM.`,
      address: formatOSMAddress(tags),
      lat,
      lng: lon,
      image: pickImage(cat, id),
      gradient: pickGradient(cat, id),
      rating: guessRating(tags, id),
      priceLevel: guessPriceLevel(tags, cat),
      hours: tags.opening_hours || "",
      phone: tags.phone || tags["contact:phone"],
      website: tags.website || tags["contact:website"],
      tags: buildTags(tags, cat),
      isKidFriendly: tags.wheelchair === "yes" || cat === "Park",
      isOutdoor: cat === "Park" || cat === "Outdoors" || tags.outdoor_seating === "yes",
      isAccessible: tags.wheelchair === "yes",
    });
  }

  return places;
}

// ── Places cache (localStorage) ────────────────────────────────────────────
// Bumped to v3 — switching from live API calls to static pre-baked JSON
const CACHE_KEY = "explore-abq-places-v4";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (static data changes rarely)

export interface PlacesCache {
  timestamp: number;
  source: "static" | "osm";
  places: Place[];
}

export function loadPlacesCache(): PlacesCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as PlacesCache;
    if (!Array.isArray(cache.places) || cache.places.length === 0) return null;
    return cache; // may be stale — caller decides whether to use
  } catch {
    return null;
  }
}

export function isCacheStale(cache: PlacesCache): boolean {
  return Date.now() - cache.timestamp > CACHE_TTL_MS;
}

export function savePlacesCache(places: Place[], source: "static" | "osm"): void {
  try {
    const payload: PlacesCache = { timestamp: Date.now(), source, places };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* storage full or unavailable — silently skip */ }
}

export function clearPlacesCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

// fetchStaticPlaces — loads pre-baked places-data.json served as a CDN asset.
// Zero API calls, zero cost per visitor. Refresh the JSON by running:
//   GOOGLE_PLACES_KEY=AIza... npm run fetch-places
export async function fetchStaticPlaces(
  onBatch: (places: Place[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/places-data.json", { signal });
  if (!res.ok) throw new Error(`Failed to load places data: ${res.status}`);
  const data = await res.json() as { places?: Place[] };
  const places = data.places ?? [];
  if (places.length > 0) onBatch(places);
}

// ── Curated featured places (always shown, highest quality) ──────────────
export const FEATURED_PLACES: Place[] = [
  {
    id: "p-frontier", name: "Frontier Restaurant", category: "Restaurant", isFeatured: true,
    description: "An Albuquerque icon since 1971. Famous for sweet rolls, green chile stew, and massive portions. Open 24 hours.",
    address: "2400 Central Ave SE, Albuquerque, NM 87106", lat: 35.0813, lng: -106.6195,
    image: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Frontier_Restaurant_in_ABQ.jpg",
    gradient: "linear-gradient(135deg, #FF6B35, #FF9500)", rating: 4.4, priceLevel: 1,
    hours: "Open 24 hours", phone: "(505) 266-0550", website: "https://frontierrestaurant.com",
    tags: ["new-mexican", "breakfast", "24-hours", "iconic"], isKidFriendly: true, isAccessible: true,
  },
  {
    id: "p-mary-titos", name: "Mary & Tito's Cafe", category: "Restaurant", isFeatured: true,
    description: "James Beard Award-winning New Mexican restaurant. Legendary red chile and carne adovada in a tiny, beloved family-run spot since 1963.",
    address: "2711 4th St NW, Albuquerque, NM 87107", lat: 35.1038, lng: -106.6590,
    image: "https://images.unsplash.com/photo-1615361200141-f45040f367be?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #C0392B, #E74C3C)", rating: 4.6, priceLevel: 1,
    hours: "Tue–Sat 9AM–3PM", phone: "(505) 344-6266",
    tags: ["james-beard", "new-mexican", "red-chile", "carne-adovada"], isKidFriendly: true,
  },
  {
    id: "p-farm-table", name: "Farm & Table", category: "Restaurant", isFeatured: true,
    description: "Celebrating local NM farms with seasonal, sustainably sourced dishes. Beautiful indoor-outdoor dining with stunning mountain views.",
    address: "8917 4th St NW, Albuquerque, NM 87114", lat: 35.1756, lng: -106.6550,
    image: "https://farmandtablenm.com/wp-content/uploads/2020/01/Ex-novo-dinner-2019-table.jpg",
    gradient: "linear-gradient(135deg, #27AE60, #2ECC71)", rating: 4.7, priceLevel: 3,
    hours: "Tue–Sun 11AM–9PM", phone: "(505) 503-7124", website: "https://farmandtablenm.com",
    tags: ["farm-to-table", "local", "patio", "brunch"], isKidFriendly: true, isOutdoor: true, isAccessible: true,
  },
  {
    id: "p-zendo", name: "Zendo Coffee", category: "Coffee", isFeatured: true,
    description: "Downtown ABQ's premier specialty coffee shop. Exceptional single-origin pour-overs, a cozy vibe, and rotating local pastries.",
    address: "313 Gold Ave SW, Albuquerque, NM 87102", lat: 35.0833, lng: -106.6504,
    image: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #8B5E3C, #C49A6C)", rating: 4.7, priceLevel: 2,
    hours: "Mon–Fri 7AM–5PM, Sat–Sun 8AM–4PM", phone: "(505) 312-3556", website: "https://zendocoffee.com",
    tags: ["specialty-coffee", "pour-over", "wifi", "downtown"], isAccessible: true,
  },
  {
    id: "p-flying-star", name: "Flying Star Cafe", category: "Coffee", isFeatured: true,
    description: "An ABQ institution with multiple locations. Famous for homemade pastries, strong coffee, and full scratch kitchen. Great for any hour.",
    address: "3416 Central Ave SE, Albuquerque, NM 87106", lat: 35.0807, lng: -106.6295,
    image: "https://www.flyingstarcafe.com/wp-content/uploads/2017/09/Kneading-Dough-BRT.jpg",
    gradient: "linear-gradient(135deg, #232526, #414345)", rating: 4.4, priceLevel: 2,
    hours: "Mon–Sun 6AM–11PM", phone: "(505) 255-6633", website: "https://flyingstarcafe.com",
    tags: ["bakery", "coffee", "pastries", "late-night", "wifi"], isKidFriendly: true, isAccessible: true,
  },
  {
    id: "p-marble", name: "Marble Brewery", category: "Brewery", isFeatured: true,
    description: "ABQ's pioneering craft brewery downtown. Award-winning IPAs, lagers, and seasonals brewed on-site with great food trucks and live music.",
    address: "111 Marble Ave NW, Albuquerque, NM 87102", lat: 35.0874, lng: -106.6497,
    image: "https://images.unsplash.com/photo-1555658636-6e4a36218be7?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #FFCC00, #FF8C00)", rating: 4.5, priceLevel: 2,
    hours: "Mon–Thu 3PM–10PM, Fri 2PM–11PM, Sat–Sun 12PM–11PM", phone: "(505) 243-2739", website: "https://marblebrewery.com",
    tags: ["craft-beer", "ipa", "taproom", "live-music", "downtown"], isAccessible: true,
  },
  {
    id: "p-la-cumbre", name: "La Cumbre Brewing", category: "Brewery", isFeatured: true,
    description: "Home of the legendary Elevated IPA. Award-winning, innovative beers in a huge welcoming taproom with regular events and live music.",
    address: "3313 Girard Blvd NE, Albuquerque, NM 87107", lat: 35.1098, lng: -106.6177,
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #1A1A2E, #16213E)", rating: 4.6, priceLevel: 2,
    hours: "Mon–Thu 2PM–10PM, Fri 2PM–11PM, Sat–Sun 12PM–11PM", phone: "(505) 872-0225", website: "https://lacumbrebrewing.com",
    tags: ["craft-beer", "elevated-ipa", "taproom", "award-winning"], isAccessible: true,
  },
  {
    id: "p-tingley", name: "Tingley Beach", category: "Park", isFeatured: true,
    description: "A serene urban fishing spot along the Rio Grande. Three stocked ponds, a model railroad, and beautiful bosque walks.",
    address: "1800 Tingley Dr SW, Albuquerque, NM 87104", lat: 35.0930, lng: -106.6697,
    image: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #11998e, #38ef7d)", rating: 4.5, priceLevel: 1,
    hours: "Daily dawn to dusk", website: "https://cabq.gov/biopark",
    tags: ["fishing", "nature", "rio-grande", "family", "free"], isKidFriendly: true, isOutdoor: true, isAccessible: true,
  },
  {
    id: "p-elena-gallegos", name: "Elena Gallegos Open Space", category: "Outdoors", isFeatured: true,
    description: "Stunning hiking at the base of the Sandia Mountains. Miles of trails ranging from flat walks to challenging climbs with spectacular views.",
    address: "7100 Tramway Blvd NE, Albuquerque, NM 87122", lat: 35.1550, lng: -106.4842,
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #56CCF2, #2F80ED)", rating: 4.8, priceLevel: 1,
    hours: "Daily 7AM–9PM (summer), 7AM–7PM (winter)",
    tags: ["hiking", "trails", "mountains", "sandia", "views"], isKidFriendly: true, isOutdoor: true,
  },
  {
    id: "p-petroglyph", name: "Petroglyph National Monument", category: "Outdoors", isFeatured: true,
    description: "Over 20,000 ancient images carved into West Mesa volcanic rocks by Ancestral Pueblo people and early Spanish settlers.",
    address: "6510 Western Trail NW, Albuquerque, NM 87120", lat: 35.1300, lng: -106.7366,
    image: "https://upload.wikimedia.org/wikipedia/commons/0/02/Petroglyph_National_Monument_Aerial_%2852260985771%29.jpg",
    gradient: "linear-gradient(135deg, #B24592, #F15F79)", rating: 4.6, priceLevel: 1,
    hours: "Daily 8AM–5PM", website: "https://nps.gov/petr",
    tags: ["petroglyphs", "history", "hiking", "cultural", "nps"], isKidFriendly: true, isOutdoor: true, isAccessible: true,
  },
  {
    id: "p-san-felipe", name: "San Felipe de Neri Church", category: "Church", isFeatured: true,
    description: "One of the oldest churches in the US, built in 1793 in Old Town Albuquerque. A stunning adobe structure with a beautiful plaza setting.",
    address: "2005 N Plaza NW, Albuquerque, NM 87104", lat: 35.0983, lng: -106.6689,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/77/San_Felipe_de_Neri_Church_Albuquerque.jpg",
    gradient: "linear-gradient(135deg, #9B59B6, #6C3483)", rating: 4.7, priceLevel: 1,
    hours: "Mon–Sat 9AM–5PM, Sun services 8AM, 10AM, 12PM", website: "https://sanfelipedeneri.org",
    tags: ["historic", "adobe", "catholic", "old-town", "1793"], isKidFriendly: true, isAccessible: true,
  },
  {
    id: "p-abq-museum", name: "Albuquerque Museum", category: "Museum", isFeatured: true,
    description: "Explore NM's rich 400-year history with rotating exhibitions on art, history, and culture. Stunning free sculpture garden open daily.",
    address: "2000 Mountain Rd NW, Albuquerque, NM 87104", lat: 35.1006, lng: -106.6678,
    image: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Albuquerque_Museum.jpg",
    gradient: "linear-gradient(135deg, #FF9500, #FFCC00)", rating: 4.5, priceLevel: 2,
    hours: "Tue–Sun 9AM–5PM", phone: "(505) 243-7255", website: "https://albuquerquemuseum.org",
    tags: ["art", "history", "culture", "sculpture-garden"], isKidFriendly: true, isAccessible: true,
  },
  {
    id: "p-ipcc", name: "Indian Pueblo Cultural Center", category: "Museum", isFeatured: true,
    description: "Owned by the 19 Pueblos of NM. Discover living cultures, traditions, art, and history of Pueblo people through world-class exhibitions.",
    address: "2401 12th St NW, Albuquerque, NM 87104", lat: 35.1023, lng: -106.6621,
    image: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=500&h=340&fit=crop&q=75",
    gradient: "linear-gradient(135deg, #C0392B, #E74C3C)", rating: 4.7, priceLevel: 2,
    hours: "Daily 9AM–5PM", phone: "(505) 843-7270", website: "https://indianpueblo.org",
    tags: ["native-american", "pueblo", "culture", "art"], isKidFriendly: true, isAccessible: true,
  },
  {
    id: "p-old-town", name: "Old Town Albuquerque", category: "Shopping", isFeatured: true,
    description: "The heart of historic ABQ. Adobe buildings, Native American art galleries, jewelry shops, pottery studios, and local restaurants around the plaza.",
    address: "2107 Old Town Rd NW, Albuquerque, NM 87104", lat: 35.0987, lng: -106.6687,
    image: "https://upload.wikimedia.org/wikipedia/commons/8/81/Equestrian_statue_of_Don_Francisco_Cuervo_Y_Valdes_at_Old_Town_Albuquerque.jpg",
    gradient: "linear-gradient(135deg, #B24592, #F15F79)", rating: 4.6, priceLevel: 2,
    hours: "Most shops open daily 10AM–5PM", website: "https://albuquerqueoldtown.com",
    tags: ["historic", "shopping", "art", "native-american"], isKidFriendly: true, isOutdoor: true, isAccessible: true,
  },
  {
    id: "p-calvary", name: "Calvary Church", category: "Church", isFeatured: true,
    description: "One of Albuquerque's largest churches, led by Pastor Skip Heitzig. Known for verse-by-verse Bible teaching, multiple weekend services, and a warm community on the Westside near Osuna Road.",
    address: "4001 Osuna Rd NE, Albuquerque, NM 87109", lat: 35.1399, lng: -106.6245,
    image: "https://calvarynm.church/wp-content/uploads/2022/09/Calvary-Church-with-Skip-Heitzig.jpg",
    gradient: "linear-gradient(135deg, #4568DC, #B06AB3)", rating: 4.7, priceLevel: 1,
    hours: "Sun services 9AM & 11AM, Wed 7PM", phone: "(505) 344-1818", website: "https://calvarynm.church",
    tags: ["evangelical", "bible-teaching", "large-church", "westside"], isKidFriendly: true, isAccessible: true,
  },
  {
    id: "p-biopark", name: "ABQ BioPark", category: "Park", isFeatured: true,
    description: "World-class zoo, aquarium, botanic garden, and Tingley Beach. Over 250 animal species and 10,000+ plant species. One of ABQ's best family destinations.",
    address: "2601 Central Ave NW, Albuquerque, NM 87104", lat: 35.0946, lng: -106.6656,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/75/Albuquerque_Aquarium.jpg",
    gradient: "linear-gradient(135deg, #1FA2FF, #12D8FA, #A6FFCB)", rating: 4.7, priceLevel: 2,
    hours: "Daily 9AM–5PM", phone: "(505) 768-2000", website: "https://cabq.gov/biopark",
    tags: ["zoo", "aquarium", "family", "nature"], isKidFriendly: true, isAccessible: true,
  },
];

// For backwards compat — used as initial data before OSM loads
export const ALL_PLACES: Place[] = FEATURED_PLACES;

// Load pre-baked Google Places data from public/data/google-places.json
export async function fetchGooglePlacesData(): Promise<Place[]> {
  try {
    const res = await fetch("/data/google-places.json");
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];
    return data as Place[];
  } catch {
    return [];
  }
}

// Merge static featured places with Google Places (dedup by name)
export function mergePlaces(base: Place[], google: Place[]): Place[] {
  const seenNames = new Set(base.map(p => p.name.toLowerCase().trim()));
  const newOnes = google.filter(p => !seenNames.has(p.name.toLowerCase().trim()));
  return [...base, ...newOnes];
}
