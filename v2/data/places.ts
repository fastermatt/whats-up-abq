/**
 * Curated "Things To Do" in Albuquerque — permanent attractions, not time-based events.
 * Each entry links directly to the venue's own website.
 *
 * Policy: Only city, county, state, federal, and public-university-operated venues.
 * Private businesses and nonprofits will be added as sponsored listings in the future.
 *
 * Add / edit entries here; no DB migration needed.
 * Images: `image` field is optional — if omitted, card shows a category-colored
 * gradient with the category emoji (intentional, never misleading).
 */

export type PlaceCategory =
  | 'outdoors'
  | 'arts'
  | 'food-drink'
  | 'entertainment'
  | 'family'
  | 'history'

export type Place = {
  id: string
  name: string
  tagline: string     // ≤ 8 words — the hook
  description: string // 1–2 sentences
  category: PlaceCategory
  website: string     // direct link to venue's own website (not Visit ABQ)
  address: string
  neighborhood: string
  image?: string      // real photo URL — if omitted, shows emoji + color gradient
  tags: string[]
  free: boolean
  hours?: string
  featured?: boolean
}

// ── Category metadata ────────────────────────────────────────────────────────

export const PLACE_CATEGORIES: {
  slug: PlaceCategory
  label: string
  emoji: string
  // Tailwind gradient classes for cards with no photo
  gradientFrom: string
  gradientTo: string
}[] = [
  { slug: 'outdoors',      label: 'Outdoors',       emoji: '🌵', gradientFrom: 'from-[#4f6249]', gradientTo: 'to-[#006a62]' },
  { slug: 'arts',          label: 'Arts & Culture',  emoji: '🎨', gradientFrom: 'from-[#7d3725]', gradientTo: 'to-[#9a442d]' },
  { slug: 'food-drink',    label: 'Food & Drink',    emoji: '🍺', gradientFrom: 'from-[#92400e]', gradientTo: 'to-[#b45309]' },
  { slug: 'entertainment', label: 'Entertainment',   emoji: '🎭', gradientFrom: 'from-[#312e81]', gradientTo: 'to-[#4338ca]' },
  { slug: 'family',        label: 'Family',          emoji: '👨‍👩‍👧', gradientFrom: 'from-[#065f46]', gradientTo: 'to-[#0d9488]' },
  { slug: 'history',       label: 'History',         emoji: '🏛️', gradientFrom: 'from-[#44403c]', gradientTo: 'to-[#78716c]' },
]

// ── The list ─────────────────────────────────────────────────────────────────
// All entries are operated by: City of Albuquerque, Bernalillo County,
// State of New Mexico, federal agencies, or public universities (UNM).

export const PLACES: Place[] = [

  // ── OUTDOORS ──────────────────────────────────────────────────────────────

  {
    id: 'petroglyph-national-monument',
    name: 'Petroglyph National Monument',
    tagline: '20,000 ancient rock carvings on volcanic basalt',
    description:
      'Walk among lava flows and petroglyphs carved by ancestral Puebloans over 700 years. Boca Negra Canyon is the easiest access point.',
    category: 'outdoors',
    website: 'https://www.nps.gov/petr',
    address: '6001 Unser Blvd NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/petroglyph-national-monument.webp',
    tags: ['hiking', 'history', 'petroglyphs', 'NPS'],
    free: true,
    hours: 'Visitor center: 8am–5pm · Trails: sunrise–sunset',
    featured: true,
  },
  {
    id: 'rio-grande-nature-center',
    name: 'Rio Grande Nature Center',
    tagline: 'Bosque birding and river trails',
    description:
      'Explore 170 acres of cottonwood forest and wetlands along the Rio Grande. The glassed-in observatory overlooks a pond where sandhill cranes winter.',
    category: 'outdoors',
    website: 'https://www.rgnc.org',
    address: '2901 Candelaria Rd NW, Albuquerque, NM 87107',
    neighborhood: 'North Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/rio-grande-nature-center.webp',
    tags: ['birding', 'hiking', 'bosque', 'river', 'nature'],
    free: false,
    hours: 'Daily 8am–5pm',
  },
  {
    id: 'paseo-del-bosque-trail',
    name: 'Paseo del Bosque Trail',
    tagline: '16 miles of paved greenway through cottonwood forest',
    description:
      'A car-free paved trail running the length of the city along the Rio Grande, through cathedral cottonwoods. Perfect for cycling, running, or a long walk.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/parks/paseo-del-bosque-trail',
    address: 'Multiple access points along the Rio Grande',
    neighborhood: 'Rio Grande Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/paseo-del-bosque-trail.webp',
    tags: ['cycling', 'running', 'trail', 'free', 'river'],
    free: true,
    hours: 'Sunrise–sunset daily',
  },
  {
    id: 'elena-gallegos-open-space',
    name: 'Elena Gallegos Open Space',
    tagline: 'Sandia foothills trails at the edge of the city',
    description:
      'Over 640 acres of high-desert foothills at the base of the Sandias with 12 miles of multi-use trails through juniper and piñon with panoramic city views.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/open-space/lands/elena-gallegos-open-space',
    address: '7100 Tramway Blvd NE, Albuquerque, NM 87122',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/elena-gallegos-open-space.webp',
    tags: ['hiking', 'mountain biking', 'dog friendly', 'foothills'],
    free: false,
    hours: '$1/car weekdays · $2/car weekends',
  },
  {
    id: 'tingley-beach',
    name: 'Tingley Beach',
    tagline: 'Urban fishing ponds and model boat lake — all free',
    description:
      'Three stocked ponds for fishing, a model-boat sailing pond, and walking paths through the cottonwoods — right in the middle of the city.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/artsculture/biopark/tingley',
    address: '1800 Tingley Dr SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/tingley-beach.webp',
    tags: ['fishing', 'family', 'free', 'river'],
    free: true,
    hours: 'Sunrise–sunset daily',
  },
  {
    id: 'north-domingo-baca-skate-park',
    name: 'North Domingo Baca Skate Park',
    tagline: 'Northeast\'s flagship lit skate park open until 11pm',
    description:
      'Half concrete, half modular — quarter pipes, ramps, rails, and a metal half-pipe with night lighting. Open until 11pm in summer. Helmets required under 18.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/north-domingo-baca-skate-park',
    address: '8301 Wyoming Blvd NE, Albuquerque, NM 87113',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/north-domingo-baca-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'BMX', 'night lighting'],
    free: true,
    hours: 'Summer 7am–11pm · Winter 9am–10pm',
    featured: true,
  },
  {
    id: 'alamosa-skate-park',
    name: 'Alamosa Skate Park',
    tagline: 'Westside concrete skate park, free and uncrowded',
    description:
      'A large outdoor concrete skate park on the Westside with diverse terrain for street skating, transition skating, and beginners. Free, open to everyone.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/alamosa-skate-park',
    address: '6900 Gonzales Rd SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/alamosa-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'concrete'],
    free: true,
    hours: 'Summer 7am–11pm · Winter 9am–10pm',
  },
  {
    id: 'los-altos-skate-park',
    name: 'Los Altos Skate Park',
    tagline: 'Northeast concrete park for all skill levels',
    description:
      'A well-maintained public skate facility in the Northeast Heights with concrete terrain for street skating and beginners. Free, lit, and open late.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/los-altos-skate-park',
    address: '10140 Lomas Blvd NE, Albuquerque, NM 87112',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/los-altos-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'northeast'],
    free: true,
    hours: 'Summer 7am–11pm · Winter 9am–10pm',
  },
  {
    id: 'tower-skate-park',
    name: 'Tower Skate Park',
    tagline: 'Westside modular park with half-pipe and dog park',
    description:
      'A free public skate park on the Westside with a 5-foot half-pipe, rain bowl rail, pyramid with hubba, and fun box — lit until 11pm in summer. Adjacent dog park and walking trail.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/tower-skate-park',
    address: '700 82nd St SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/tower-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'BMX', 'half-pipe'],
    free: true,
    hours: 'Summer 7am–11pm · Winter 9am–10pm',
  },

  {
    id: 'rio-grande-pool',
    name: 'Rio Grande Pool',
    tagline: 'Outdoor summer pool next to Tingley Beach',
    description:
      'A 25-meter shallow outdoor pool open Memorial Day through Labor Day — just north of the BioPark Zoo. Lap swim, open swim, and lessons available.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/outdoor-pools/rio-grande-pool',
    address: '1410 Iron Ave SW, Albuquerque, NM 87102',
    neighborhood: 'Barelas',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/rio-grande-pool.webp',
    tags: ['pool', 'swimming', 'summer', 'family', 'affordable'],
    free: false,
    hours: 'Memorial Day – Labor Day · check website for session times',
  },
  {
    id: 'los-altos-pool',
    name: 'Los Altos Pool',
    tagline: 'Year-round indoor pool in the Northeast Heights',
    description:
      'An indoor neighborhood pool open year-round in the Northeast Heights with lap swim, lessons, and recreation swimming. One of ABQ\'s most-used public pools.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/los-altos-pool',
    address: '10100 Lomas Blvd NE, Albuquerque, NM 87123',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/los-altos-pool.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'lessons'],
    free: false,
    hours: 'Check website for current schedule',
  },
  {
    id: 'west-mesa-aquatic-center',
    name: 'West Mesa Aquatic Center',
    tagline: 'Year-round indoor pool with water slide on the Westside',
    description:
      'An indoor aquatic center with a lap pool, leisure pool, water slide, and hot tub — open year-round, one of the few indoor options in ABQ.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/west-mesa-aquatic-center',
    address: '6705 Fortuna Rd NW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/west-mesa-aquatic-center.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'water slide'],
    free: false,
    hours: 'Check website for current schedule',
  },
  {
    id: 'highland-pool',
    name: 'Highland Pool',
    tagline: 'Central ABQ indoor pool with 3-meter diving board',
    description:
      'A year-round indoor 25m×25yd pool in the heart of the city — one of the few with a 3-meter diving board. Also has a 1-meter board and an outdoor wading pool.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/highland-pool',
    address: '400 Jackson St SE, Albuquerque, NM 87108',
    neighborhood: 'Nob Hill',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/highland-pool.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'diving board'],
    free: false,
    hours: 'Check website for current schedule',
  },
  {
    id: 'valley-pool',
    name: 'Valley Pool',
    tagline: 'Solar-heated indoor pool with UV water treatment',
    description:
      'A 25-yard year-round indoor pool in the North Valley with 1-meter diving boards and an outdoor wading pool — renovated with solar heating and UV water treatment.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/valley-pool',
    address: '1505 Candelaria Rd NW, Albuquerque, NM 87107',
    neighborhood: 'North Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/valley-pool.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'solar', 'diving board'],
    free: false,
    hours: 'Check website for current schedule',
  },

  // ── GOLF ─────────────────────────────────────────────────────────────────
  // Five city-operated courses — best golf value in Albuquerque

  {
    id: 'arroyo-del-oso-golf',
    name: 'Arroyo del Oso Golf Course',
    tagline: '27-hole course in Bear Canyon Arroyo',
    description:
      'Nestled in Bear Canyon Arroyo, this 27-hole Northeast course is known for interesting topography — rolling fairways, water hazards, and sand traps. Open since 1965.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/arroyo-del-oso',
    address: '7001 Osuna Rd NE, Albuquerque, NM 87109',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/arroyo-del-oso-golf.webp',
    tags: ['golf', 'city golf', '27-hole', 'affordable'],
    free: false,
    hours: 'Dawn to dusk daily (closed Christmas)',
  },
  {
    id: 'ladera-golf',
    name: 'Ladera Golf Course',
    tagline: 'Championship 18-hole course with volcano views',
    description:
      '18-hole championship course (7,107 yards from back tees) plus a 9-hole executive course on the Westside — four lakes, lighted driving range, and mountain vistas.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/ladera',
    address: '3401 Ladera Dr NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/ladera-golf.webp',
    tags: ['golf', 'city golf', '18-hole', 'driving range', 'affordable'],
    free: false,
    hours: 'Dawn to dusk daily (closed Christmas)',
  },
  {
    id: 'los-altos-golf',
    name: 'Los Altos Golf Course',
    tagline: 'ABQ\'s oldest city course — 18 holes plus a par-3 nine',
    description:
      'The oldest of ABQ\'s city courses (opened 1960) — 18 holes with two lakes and mature trees, plus a separate 9-hole executive par-3. Banquet facilities and grill on site.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/los-altos',
    address: '9717 Copper Ave NE, Albuquerque, NM 87123',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/los-altos-golf.webp',
    tags: ['golf', 'city golf', '18-hole', 'affordable', 'senior'],
    free: false,
    hours: 'Dawn to dusk daily (closed Christmas)',
  },
  {
    id: 'puerto-del-sol-golf',
    name: 'Puerto del Sol Golf Course',
    tagline: 'Central ABQ 9-hole course for a quick round',
    description:
      'A compact 9-hole city course near UNM — a great option for a quick round or beginning golfers. Affordable green fees, centrally located.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/puerto-del-sol',
    address: '1800 Girard Blvd SE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill',
    tags: ['golf', 'city golf', '9-hole', 'affordable', 'beginner'],
    free: false,
    hours: 'Dawn to dusk daily (closed Christmas)',
  },
  {
    id: 'balloon-fiesta-golf',
    name: 'Golf Center at Balloon Fiesta Park',
    tagline: 'Driving range and par-3 course by the balloon museum',
    description:
      'A compact golf facility at Balloon Fiesta Park with a driving range and par-3 course — perfect for practice or a quick loop with Sandia Mountain views.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/golf-center-at-balloon-fiesta-park',
    address: 'Alameda Blvd NE & Balloon Museum Dr NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/balloon-fiesta-golf.webp',
    tags: ['golf', 'city golf', 'driving range', 'par-3', 'affordable'],
    free: false,
    hours: 'Check website for current hours',
  },

  {
    id: 'balloon-fiesta-park',
    name: 'Balloon Fiesta Park',
    tagline: '86-acre launch field open year-round for free',
    description:
      'Home of the International Balloon Fiesta every October, but open year-round as a free public park — 86 acres of launch field for walking, sports, and events. Lighted driving range and pitch & putt on site.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/parks/balloon-fiesta-park',
    address: 'Balloon Museum Dr NE & Alameda Blvd NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/balloon-fiesta-park.webp',
    tags: ['balloons', 'park', 'free', 'events', 'golf', 'driving range'],
    free: true,
    hours: 'Open year-round (closed during Balloon Fiesta Oct)',
    featured: true,
  },

  {
    id: 'bosque-trail',
    name: 'Bosque Trail',
    tagline: 'Walk through ancient cottonwoods along the river',
    description:
      'The unpaved Bosque Trail runs alongside the Rio Grande through dense riverine forest. In fall, the cottonwoods turn gold — one of the best free shows in the city.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/open-space',
    address: 'Multiple Rio Grande access points',
    neighborhood: 'Rio Grande Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/bosque-trail.webp',
    tags: ['hiking', 'nature', 'free', 'fall color'],
    free: true,
    hours: 'Sunrise–sunset daily',
  },

  // ── ARTS & CULTURE ────────────────────────────────────────────────────────
  // City of ABQ and State of NM cultural institutions

  {
    id: 'albuquerque-museum',
    name: 'Albuquerque Museum',
    tagline: 'Art and history from the Rio Grande to the Southwest',
    description:
      'From 400 years of Rio Grande valley history to contemporary Southwestern art — the sculpture garden alone is worth the trip. Free Sunday mornings.',
    category: 'arts',
    website: 'https://www.albuquerquemuseum.org',
    address: '2000 Mountain Rd NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/albuquerque-museum.webp',
    tags: ['museum', 'art', 'history', 'sculpture garden'],
    free: false,
    hours: 'Tue–Sun 9am–5pm · Free Sundays 9am–noon',
    featured: true,
  },
  {
    id: 'national-hispanic-cultural-center',
    name: 'National Hispanic Cultural Center',
    tagline: 'World-class flamenco, art, and Latino heritage',
    description:
      'A 55-acre campus celebrating Hispanic art and culture — home to the José Griego y Maestas Torreon fresco and regular flamenco performances.',
    category: 'arts',
    website: 'https://www.nhccnm.org',
    address: '1701 4th St SW, Albuquerque, NM 87102',
    neighborhood: 'South Broadway',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/national-hispanic-cultural-center.webp',
    tags: ['flamenco', 'museum', 'Latino heritage', 'cultural', 'theater'],
    free: false,
    hours: 'Tue–Sun 10am–5pm',
  },
  {
    id: 'kimo-theatre',
    name: 'KiMo Theatre',
    tagline: 'Stunning Pueblo Deco landmark since 1927',
    description:
      'One of America\'s most visually striking theaters — Pueblo Revival meets Art Deco with longhorn skulls, Native motifs, and original hand-painted murals.',
    category: 'arts',
    website: 'https://www.cabq.gov/artsculture/kimo',
    address: '423 Central Ave NW, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/kimo-theatre.webp',
    tags: ['theater', 'historic', 'architecture', 'live performance'],
    free: false,
  },
  {
    id: 'popejoy-hall',
    name: 'Popejoy Hall',
    tagline: 'ABQ\'s premier Broadway and classical venue',
    description:
      'On the UNM campus — New Mexico\'s largest performing arts venue for Broadway touring productions, symphony performances, and major musical acts.',
    category: 'arts',
    website: 'https://www.popejoypresents.com',
    address: '203 Cornell Dr SE, Albuquerque, NM 87106',
    neighborhood: 'UNM',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/popejoy-hall.webp',
    tags: ['broadway', 'symphony', 'performance', 'UNM'],
    free: false,
  },

  // ── FAMILY ────────────────────────────────────────────────────────────────
  // City of ABQ BioPark system + State of NM museums

  {
    id: 'albuquerque-biopark-zoo',
    name: 'ABQ BioPark Zoo',
    tagline: 'New Mexico\'s largest zoo in the heart of the city',
    description:
      'Home to 250+ species including African elephants, komodo dragons, and Amur tigers — connects to the Aquarium and Botanic Garden.',
    category: 'family',
    website: 'https://www.cabq.gov/artsculture/biopark/zoo',
    address: '903 10th St SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/albuquerque-biopark-zoo.webp',
    tags: ['zoo', 'animals', 'family', 'elephants', 'children'],
    free: false,
    hours: 'Daily 9am–5pm',
    featured: true,
  },
  {
    id: 'abq-aquarium',
    name: 'ABQ BioPark Aquarium',
    tagline: 'Sharks and rays — landlocked edition',
    description:
      'A surprisingly excellent aquarium with a 285,000-gallon shark tank, jellyfish gallery, and Gulf of Mexico exhibit.',
    category: 'family',
    website: 'https://www.cabq.gov/artsculture/biopark/aquarium',
    address: '2601 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/abq-aquarium.webp',
    tags: ['aquarium', 'sharks', 'family', 'children'],
    free: false,
    hours: 'Daily 9am–5pm',
  },
  {
    id: 'abq-botanic-garden',
    name: 'ABQ BioPark Botanic Garden',
    tagline: 'Butterfly pavilion and Mediterranean gardens',
    description:
      'Ten acres of formal gardens, a butterfly pavilion, a children\'s fantasy garden — connected to the Aquarium by a seasonal river cruise.',
    category: 'family',
    website: 'https://www.cabq.gov/artsculture/biopark/garden',
    address: '2601 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/abq-botanic-garden.webp',
    tags: ['botanical garden', 'butterflies', 'flowers', 'family'],
    free: false,
    hours: 'Daily 9am–5pm',
  },
  {
    id: 'nm-museum-natural-history',
    name: 'NM Museum of Natural History',
    tagline: 'Dinosaurs, volcanoes, and a planetarium',
    description:
      'Walk among real Seismosaurus bones, watch a planetarium show, and explore New Mexico\'s volcanic past — a genuine natural science gem.',
    category: 'family',
    website: 'https://nmnaturalhistory.org',
    address: '1801 Mountain Rd NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/nm-museum-natural-history.webp',
    tags: ['dinosaurs', 'science', 'planetarium', 'museum', 'family'],
    free: false,
    hours: 'Daily 9am–5pm',
  },
  {
    id: 'balloon-museum',
    name: 'Anderson-Abruzzo Balloon Museum',
    tagline: 'The full history of ballooning in the Balloon Capital',
    description:
      'Named after ABQ\'s famous balloon adventurers, covering 250+ years of ballooning history from the first hydrogen balloon to modern record-setting flights.',
    category: 'family',
    website: 'https://www.balloonmuseum.com',
    address: '9201 Balloon Museum Dr NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/balloon-museum.webp',
    tags: ['balloons', 'aviation', 'history', 'Albuquerque', 'family'],
    free: false,
    hours: 'Tue–Sun 9am–5pm',
  },

  // ── HISTORY ───────────────────────────────────────────────────────────────

  {
    id: 'old-town-albuquerque',
    name: 'Old Town Albuquerque',
    tagline: 'Founded in 1706 — the original heart of the city',
    description:
      'Wander 300-year-old plazas and adobe architecture around the historic San Felipe de Neri Church. Free to explore anytime.',
    category: 'history',
    website: 'https://albuquerqueoldtown.com',
    address: 'Old Town Plaza, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/old-town-albuquerque.webp',
    tags: ['historic', 'plaza', 'adobe', 'free', 'walkable'],
    free: true,
    hours: 'Plaza always open · shops daily 10am–5pm',
    featured: true,
  },
  {
    id: 'route-66',
    name: 'Central Avenue (Historic Route 66)',
    tagline: 'The Main Street of America runs through ABQ',
    description:
      'One of the longest surviving stretches of original Route 66 — vintage motels, neon signs, and decades of American road culture, all live and walkable.',
    category: 'history',
    website: 'https://www.rt66nm.org',
    address: 'Central Ave, Albuquerque, NM',
    neighborhood: 'Route 66 Corridor',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/route-66.webp',
    tags: ['Route 66', 'neon', 'historic', 'walkable', 'free'],
    free: true,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getPlaces(category?: PlaceCategory | null): Place[] {
  if (!category) return PLACES
  return PLACES.filter(p => p.category === category)
}

export function getFeaturedPlaces(limit = 8): Place[] {
  const featured = PLACES.filter(p => p.featured)
  if (featured.length >= limit) return featured.slice(0, limit)
  const rest = PLACES.filter(p => !p.featured)
  return [...featured, ...rest].slice(0, limit)
}
