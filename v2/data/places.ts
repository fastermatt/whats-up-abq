/**
 * Curated "Things To Do" in Albuquerque — permanent attractions, not time-based events.
 * Each entry links directly to the venue's own website for hours and info.
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
// Visit the linked website directly for current hours and admission info.

export const PLACES: Place[] = [

  // ── OUTDOORS ──────────────────────────────────────────────────────────────

  {
    id: 'petroglyph-national-monument',
    name: 'Petroglyph National Monument',
    tagline: '20,000 ancient rock carvings on volcanic basalt',
    description:
      'Explore vast lava flows inscribed with ancestral Puebloan petroglyphs carved over 700 years ago. The easily accessible Boca Negra Canyon offers the best vantage points to uncover these historic artworks.',
    category: 'outdoors',
    website: 'https://www.nps.gov/petr',
    address: '6001 Unser Blvd NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/petroglyph-national-monument.webp',
    tags: ['hiking', 'history', 'petroglyphs', 'NPS'],
    free: true,
    featured: true,
  },
  {
    id: 'rio-grande-nature-center',
    name: 'Rio Grande Nature Center',
    tagline: 'Bosque birding and river trails',
    description:
      'Meander through 170 acres of cottonwood forest and riverside wetlands along the Rio Grande. An enclosed observatory overlooks a pond favored by migrating sandhill cranes — an essential wildlife stop.',
    category: 'outdoors',
    website: 'https://www.rgnc.org',
    address: '2901 Candelaria Rd NW, Albuquerque, NM 87107',
    neighborhood: 'North Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/rio-grande-nature-center.webp',
    tags: ['birding', 'hiking', 'bosque', 'river', 'nature'],
    free: false,
  },
  {
    id: 'paseo-del-bosque-trail',
    name: 'Paseo del Bosque Trail',
    tagline: '16 miles of paved greenway through cottonwood forest',
    description:
      'This car-free paved trail follows the Rio Grande through cathedral cottonwoods the entire length of the city. Perfect for a long run, leisurely bike ride, or reflective walk through the heart of ABQ.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/parks/paseo-del-bosque-trail',
    address: 'Multiple access points along the Rio Grande',
    neighborhood: 'Rio Grande Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/paseo-del-bosque-trail.webp',
    tags: ['cycling', 'running', 'trail', 'free', 'river'],
    free: true,
  },
  {
    id: 'elena-gallegos-open-space',
    name: 'Elena Gallegos Open Space',
    tagline: 'Sandia foothills trails with panoramic city views',
    description:
      'Traverse 12 miles of multi-use paths across 640 acres of high-desert juniper and piñon at the base of the Sandias. Every trail rewards you with sweeping views of the city and the Rio Grande valley below.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/open-space/lands/elena-gallegos-open-space',
    address: '7100 Tramway Blvd NE, Albuquerque, NM 87122',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/elena-gallegos-open-space.webp',
    tags: ['hiking', 'mountain biking', 'dog friendly', 'foothills'],
    free: false,
  },
  {
    id: 'tingley-beach',
    name: 'Tingley Beach',
    tagline: 'Urban fishing ponds and model boat lake — all free',
    description:
      'Three stocked fishing ponds alongside a dedicated model boat sailing lake, with lush cottonwood walking paths. An unexpected green escape right in the middle of the city — free and open daily.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/artsculture/biopark/tingley',
    address: '1800 Tingley Dr SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/tingley-beach.webp',
    tags: ['fishing', 'family', 'free', 'river'],
    free: true,
  },
  {
    id: 'north-domingo-baca-skate-park',
    name: 'North Domingo Baca Skate Park',
    tagline: 'Northeast\'s flagship lit skate park, open until 11pm',
    description:
      'This massive facility combines modular ramps and concrete sections with a metal half-pipe under brilliant lighting. The go-to spot for skaters looking to practice late into the evening.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/north-domingo-baca-skate-park',
    address: '8301 Wyoming Blvd NE, Albuquerque, NM 87113',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/north-domingo-baca-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'BMX', 'night lighting'],
    free: true,
    featured: true,
  },
  {
    id: 'alamosa-skate-park',
    name: 'Alamosa Skate Park',
    tagline: 'Largest skate park in the Southwest — 35,000 sq ft',
    description:
      'Featuring 35,000 square feet of specialized concrete terrain including a full pipe and a 12-foot bowl — the biggest and most impressive skate facility in the entire Southwest.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/alamosa-skate-park',
    address: '6900 Gonzales Rd SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/alamosa-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'concrete'],
    free: true,
  },
  {
    id: 'los-altos-skate-park',
    name: 'Los Altos Skate Park',
    tagline: 'Northeast concrete haven for all skill levels',
    description:
      'A well-maintained public facility featuring diverse street terrain ideal for beginners and seasoned skaters alike. Free, lit, and open late — a solid neighborhood option in the Northeast Heights.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/los-altos-skate-park',
    address: '10140 Lomas Blvd NE, Albuquerque, NM 87112',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/los-altos-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'northeast'],
    free: true,
  },
  {
    id: 'tower-skate-park',
    name: 'Tower Skate Park',
    tagline: 'Westside modular park with half-pipe and dog park',
    description:
      'A highly functional public park with a 5-foot half-pipe, pyramid hubba, rain bowl rail, and fun box — lit until 11pm in summer. The adjacent dog park makes it a perfect afternoon destination for everyone.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/skate-parks/tower-skate-park',
    address: '700 82nd St SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/tower-skate-park.webp',
    tags: ['skate park', 'free', 'skateboarding', 'BMX', 'half-pipe'],
    free: true,
  },

  {
    id: 'rio-grande-pool',
    name: 'Rio Grande Pool',
    tagline: 'Outdoor summer splash next to the BioPark Zoo',
    description:
      'A 25-meter outdoor pool available seasonally for families right next to the city\'s main zoo. Open swim, lap swim, and lessons available during the warm months.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/outdoor-pools/rio-grande-pool',
    address: '1410 Iron Ave SW, Albuquerque, NM 87102',
    neighborhood: 'Barelas',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/rio-grande-pool.webp',
    tags: ['pool', 'swimming', 'summer', 'family', 'affordable'],
    free: false,
  },
  {
    id: 'los-altos-pool',
    name: 'Los Altos Pool',
    tagline: 'Year-round indoor oasis in Northeast Heights',
    description:
      'An active neighborhood pool offering lap swimming, classes, and recreation year-round. One of Albuquerque\'s most consistently used public aquatic facilities.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/los-altos-pool',
    address: '10100 Lomas Blvd NE, Albuquerque, NM 87123',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/los-altos-pool.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'lessons'],
    free: false,
  },
  {
    id: 'west-mesa-aquatic-center',
    name: 'West Mesa Aquatic Center',
    tagline: 'Olympic 50m pool and water slides, year-round',
    description:
      'The most comprehensive swimming facility in Albuquerque — a full Olympic 50-meter pool alongside leisure pools, water slides, and an 800-seat stadium, all open year-round.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/west-mesa-aquatic-center',
    address: '6705 Fortuna Rd NW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/west-mesa-aquatic-center.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'water slide'],
    free: false,
  },
  {
    id: 'highland-pool',
    name: 'Highland Pool',
    tagline: 'Central ABQ indoor pool with 3-meter diving board',
    description:
      'A year-round indoor 25m×25yd pool in the heart of the city — one of the few public pools with a rare 3-meter diving board. Also has a 1-meter board and an outdoor wading area.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/highland-pool',
    address: '400 Jackson St SE, Albuquerque, NM 87108',
    neighborhood: 'Nob Hill',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/highland-pool.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'diving board'],
    free: false,
  },
  {
    id: 'valley-pool',
    name: 'Valley Pool',
    tagline: 'Solar-heated indoor pool with UV water treatment',
    description:
      'A year-round indoor pool in the North Valley with 1-meter diving boards and an outdoor wading pool — renovated with solar heating and UV water treatment for a noticeably cleaner swim.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/swimming/indoor-pools/valley-pool',
    address: '1505 Candelaria Rd NW, Albuquerque, NM 87107',
    neighborhood: 'North Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/valley-pool.webp',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'solar', 'diving board'],
    free: false,
  },

  // ── GOLF ─────────────────────────────────────────────────────────────────
  // Five city-operated courses — best golf value in Albuquerque

  {
    id: 'arroyo-del-oso-golf',
    name: 'Arroyo del Oso Golf Course',
    tagline: '27-hole course in scenic Bear Canyon Arroyo',
    description:
      'This historic 27-hole Northeast course is defined by rolling fairways, water hazards, and the natural topography of Bear Canyon Arroyo. A challenging and beautiful round open since 1965.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/arroyo-del-oso',
    address: '7001 Osuna Rd NE, Albuquerque, NM 87109',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/arroyo-del-oso-golf.webp',
    tags: ['golf', 'city golf', '27-hole', 'affordable'],
    free: false,
  },
  {
    id: 'ladera-golf',
    name: 'Ladera Golf Course',
    tagline: 'Championship 18-hole course with volcano views',
    description:
      'A premier 18-hole championship course (7,107 yards from the back tees) with four scenic lakes and a lighted driving range on the Westside. Stunning Sandia and West Mesa volcano views on every hole.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/ladera',
    address: '3401 Ladera Dr NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/ladera-golf.webp',
    tags: ['golf', 'city golf', '18-hole', 'driving range', 'affordable'],
    free: false,
  },
  {
    id: 'los-altos-golf',
    name: 'Los Altos Golf Course',
    tagline: 'ABQ\'s oldest city course, open since 1960',
    description:
      'The oldest city course in Albuquerque, featuring mature trees and two scenic lakes across 18 holes — plus a separate 9-hole executive par-3 perfect for varying skill levels.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/los-altos',
    address: '9717 Copper Ave NE, Albuquerque, NM 87123',
    neighborhood: 'Northeast Heights',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/los-altos-golf.webp',
    tags: ['golf', 'city golf', '18-hole', 'affordable', 'senior'],
    free: false,
  },
  {
    id: 'puerto-del-sol-golf',
    name: 'Puerto del Sol Golf Course',
    tagline: 'Compact 9-hole course near UNM campus',
    description:
      'An affordable and centrally located 9-hole city course near the university — an ideal, low-commitment option for a quick round or new golfers just getting started.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/puerto-del-sol',
    address: '1800 Girard Blvd SE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/puerto-del-sol-golf.webp',
    tags: ['golf', 'city golf', '9-hole', 'affordable', 'beginner'],
    free: false,
  },
  {
    id: 'balloon-fiesta-golf',
    name: 'Golf Center at Balloon Fiesta Park',
    tagline: 'Driving range and par-3 with Sandia views',
    description:
      'A compact facility at the famous park with a 35-tee driving range and 6-hole par-3 course. The perfect warm-up spot or quick round, backed by dramatic Sandia Mountain scenery.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation/golf/golf-center-at-balloon-fiesta-park',
    address: 'Alameda Blvd NE & Balloon Museum Dr NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/balloon-fiesta-golf.webp',
    tags: ['golf', 'city golf', 'driving range', 'par-3', 'affordable'],
    free: false,
  },

  {
    id: 'balloon-fiesta-park',
    name: 'Balloon Fiesta Park',
    tagline: '86-acre launch field open year-round for free',
    description:
      'Home of the International Balloon Fiesta every October, but open year-round as a free public park. Its vast 86 acres provide ample space for walking, sports, and community gatherings.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/parks/balloon-fiesta-park',
    address: 'Balloon Museum Dr NE & Alameda Blvd NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/balloon-fiesta-park.webp',
    tags: ['balloons', 'park', 'free', 'events', 'golf', 'driving range'],
    free: true,
    featured: true,
  },

  {
    id: 'bosque-trail',
    name: 'Bosque Trail',
    tagline: 'Ancient cottonwoods along the Rio Grande',
    description:
      'This unpaved trail runs alongside the Rio Grande through dense riverine forest. In fall, the towering cottonwoods turn gold — one of the city\'s most spectacular and completely free natural shows.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/open-space',
    address: 'Multiple Rio Grande access points',
    neighborhood: 'Rio Grande Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/bosque-trail.webp',
    tags: ['hiking', 'nature', 'free', 'fall color'],
    free: true,
  },

  // ── ARTS & CULTURE ────────────────────────────────────────────────────────
  // City of ABQ and State of NM cultural institutions

  {
    id: 'albuquerque-museum',
    name: 'Albuquerque Museum',
    tagline: 'Southwest history meets contemporary art',
    description:
      'The museum curates 400 years of Rio Grande valley history alongside contemporary Southwestern art — the magnificent sculpture garden alone is a must-see. Free on Sunday mornings.',
    category: 'arts',
    website: 'https://www.albuquerquemuseum.org',
    address: '2000 Mountain Rd NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/albuquerque-museum.webp',
    tags: ['museum', 'art', 'history', 'sculpture garden'],
    free: false,
    featured: true,
  },
  {
    id: 'national-hispanic-cultural-center',
    name: 'National Hispanic Cultural Center',
    tagline: 'Flamenco, art, and Latino heritage hub',
    description:
      'This expansive 55-acre campus celebrates the rich culture of the Hispanic community with world-class exhibits and stunning fresco murals. Regular live flamenco performances make it one of ABQ\'s most vibrant cultural destinations.',
    category: 'arts',
    website: 'https://www.nhccnm.org',
    address: '1701 4th St SW, Albuquerque, NM 87102',
    neighborhood: 'South Broadway',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/national-hispanic-cultural-center.webp',
    tags: ['flamenco', 'museum', 'Latino heritage', 'cultural', 'theater'],
    free: false,
  },
  {
    id: 'kimo-theatre',
    name: 'KiMo Theatre',
    tagline: 'Stunning Pueblo Deco landmark since 1927',
    description:
      'A visual feast combining Art Deco grandeur with unique Native motifs and longhorn skulls. Its preserved interior features original hand-painted murals that make it one of America\'s most architecturally striking theaters.',
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
      'On the UNM campus — New Mexico\'s largest performing arts venue hosting major Broadway touring productions, symphony concerts, and top musical acts. A premiere destination for the performing arts.',
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
      'Home to 250+ species including African elephants, Amur tigers, and komodo dragons — a massive urban wildlife escape connected to the Aquarium and Botanic Garden.',
    category: 'family',
    website: 'https://www.cabq.gov/artsculture/biopark/zoo',
    address: '903 10th St SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/albuquerque-biopark-zoo.webp',
    tags: ['zoo', 'animals', 'family', 'elephants', 'children'],
    free: false,
    featured: true,
  },
  {
    id: 'abq-aquarium',
    name: 'ABQ BioPark Aquarium',
    tagline: 'Sharks and rays — landlocked edition',
    description:
      'A surprisingly excellent aquarium with a 285,000-gallon shark tank, a beautiful jellyfish gallery, and a Gulf of Mexico exhibit. Immersive marine life without leaving the desert.',
    category: 'family',
    website: 'https://www.cabq.gov/artsculture/biopark/aquarium',
    address: '2601 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/abq-aquarium.webp',
    tags: ['aquarium', 'sharks', 'family', 'children'],
    free: false,
  },
  {
    id: 'abq-botanic-garden',
    name: 'ABQ BioPark Botanic Garden',
    tagline: 'Butterfly pavilion and Mediterranean gardens',
    description:
      'Ten acres of formal beauty including a dedicated butterfly pavilion, exotic Mediterranean plantings, and a children\'s fantasy garden. Connected to the Aquarium by a seasonal river cruise.',
    category: 'family',
    website: 'https://www.cabq.gov/artsculture/biopark/garden',
    address: '2601 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/abq-botanic-garden.webp',
    tags: ['botanical garden', 'butterflies', 'flowers', 'family'],
    free: false,
  },
  {
    id: 'nm-museum-natural-history',
    name: 'NM Museum of Natural History',
    tagline: 'Dinosaurs, volcanoes, and a planetarium',
    description:
      'Explore deep time with real Seismosaurus bones, detailed displays of New Mexico\'s volcanic past, and a working planetarium. An unparalleled natural science gem in the heart of Old Town.',
    category: 'family',
    website: 'https://nmnaturalhistory.org',
    address: '1801 Mountain Rd NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/nm-museum-natural-history.webp',
    tags: ['dinosaurs', 'science', 'planetarium', 'museum', 'family'],
    free: false,
  },
  {
    id: 'balloon-museum',
    name: 'Anderson-Abruzzo Balloon Museum',
    tagline: '250 years of ballooning in the Balloon Capital',
    description:
      'Named after ABQ\'s legendary balloon adventurers, this museum chronicles over 250 years of exploration — from early hydrogen flights to modern record-setting attempts. A fascinating deep dive into Albuquerque\'s pioneering airborne history.',
    category: 'family',
    website: 'https://www.balloonmuseum.com',
    address: '9201 Balloon Museum Dr NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/balloon-museum.webp',
    tags: ['balloons', 'aviation', 'history', 'Albuquerque', 'family'],
    free: false,
  },

  // ── HISTORY ───────────────────────────────────────────────────────────────

  {
    id: 'old-town-albuquerque',
    name: 'Old Town Albuquerque',
    tagline: 'Wander the city\'s original 1706 heart',
    description:
      'Stroll through preserved adobe architecture and historic plazas surrounding the San Felipe de Neri Church. A free, time-traveling glimpse into colonial New Mexico life — always open.',
    category: 'history',
    website: 'https://albuquerqueoldtown.com',
    address: 'Old Town Plaza, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/old-town-albuquerque.webp',
    tags: ['historic', 'plaza', 'adobe', 'free', 'walkable'],
    free: true,
    featured: true,
  },
  {
    id: 'route-66',
    name: 'Central Avenue (Historic Route 66)',
    tagline: 'The Main Street of America runs through ABQ',
    description:
      'One of the longest surviving stretches of original Route 66 — vintage motels, neon signs, and decades of American road culture, all live and walkable through the heart of the city.',
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
