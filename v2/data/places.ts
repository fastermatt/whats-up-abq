/**
 * Curated "Things To Do" in Albuquerque — permanent attractions, not time-based events.
 * Each entry links directly to the venue's own website.
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

export const PLACES: Place[] = [

  // ── OUTDOORS ──────────────────────────────────────────────────────────────

  {
    id: 'sandia-peak-tramway',
    name: 'Sandia Peak Tramway',
    tagline: 'Ride the world\'s longest aerial tramway',
    description:
      'Ascend 10,378 feet above the Rio Grande Valley in 15 minutes. Views stretch 11,000 square miles on a clear day — bring a layer, it\'s 30°F cooler up top.',
    category: 'outdoors',
    website: 'https://sandiapeak.com',
    address: '30 Tramway Rd NE, Albuquerque, NM 87122',
    neighborhood: 'Northeast Heights',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Sandia_Peak_Tram_2.jpg/1200px-Sandia_Peak_Tram_2.jpg',
    tags: ['tram', 'mountain', 'views', 'hiking'],
    free: false,
    hours: 'Wed–Mon · 9am–8pm (seasonal)',
    featured: true,
  },
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
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Petroglyph_National_Monument_NPS.jpg/1200px-Petroglyph_National_Monument_NPS.jpg',
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
    website: 'https://www.cabq.gov/culturalservices/biopark/tingley-beach',
    address: '1800 Tingley Dr SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    tags: ['fishing', 'family', 'free', 'river'],
    free: true,
    hours: 'Sunrise–sunset daily',
  },
  {
    id: 'garfield-skate-park',
    name: 'Garfield Skate Park',
    tagline: 'ABQ\'s most-loved free public skate park',
    description:
      'A full concrete skate park with bowls, rails, and street features — well-maintained, free, and open all day. Popular with all skill levels from kids to pros.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/parks/garfield-park',
    address: '2300 Garfield Ave SE, Albuquerque, NM 87106',
    neighborhood: 'Barelas',
    tags: ['skate park', 'free', 'skateboarding', 'scooter', 'BMX'],
    free: true,
    hours: 'Sunrise–sunset daily',
    featured: true,
  },
  {
    id: 'alamosa-skate-park',
    name: 'Alamosa Skate Park',
    tagline: 'Westside concrete skate park, free and uncrowded',
    description:
      'A large outdoor concrete skate park on the Westside with diverse terrain for street skating, transition skating, and beginners. Free, open to everyone.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation',
    address: '6900 Gonzales Rd SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    tags: ['skate park', 'free', 'skateboarding', 'concrete'],
    free: true,
    hours: 'Sunrise–sunset daily',
  },
  {
    id: 'manzano-mesa-skate-park',
    name: 'Manzano Mesa Skate Park',
    tagline: 'Southeast skate park with great mountain views',
    description:
      'A well-designed public skate facility in the Southeast Heights with bowls and street elements — good sightlines to the Manzano Mountains.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation',
    address: '7320 Copper Ave NE, Albuquerque, NM 87108',
    neighborhood: 'Southeast Heights',
    tags: ['skate park', 'free', 'skateboarding', 'bowls'],
    free: true,
    hours: 'Sunrise–sunset daily',
  },
  {
    id: 'rio-grande-pool',
    name: 'Rio Grande Pool',
    tagline: 'Outdoor public pool open all summer',
    description:
      'One of ABQ\'s classic outdoor public pools — open June through August with lap lanes, a leisure area, and affordable day passes.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation-centers/pools',
    address: '1410 Iron Ave SW, Albuquerque, NM 87102',
    neighborhood: 'Barelas',
    tags: ['pool', 'swimming', 'summer', 'family', 'affordable'],
    free: false,
    hours: 'June–August · check website for session times',
  },
  {
    id: 'los-altos-pool',
    name: 'Los Altos Pool',
    tagline: 'Neighborhood outdoor pool in the Northeast Heights',
    description:
      'A popular neighborhood outdoor pool serving the Northeast Heights — open mid-June through mid-August with day passes, lessons, and lap swim.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation-centers/pools',
    address: '10140 Lomas Blvd NE, Albuquerque, NM 87112',
    neighborhood: 'Northeast Heights',
    tags: ['pool', 'swimming', 'summer', 'lessons'],
    free: false,
    hours: 'Mid-June to mid-August · check website for schedule',
  },
  {
    id: 'west-mesa-aquatic-center',
    name: 'West Mesa Aquatic Center',
    tagline: 'Year-round indoor pool on the Westside',
    description:
      'An indoor aquatic center with a lap pool, leisure pool, water slide, and hot tub — open year-round, one of the few indoor options in ABQ.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/recreation-centers/west-mesa-community-center',
    address: '5400 Glenrio Rd NW, Albuquerque, NM 87105',
    neighborhood: 'Westside',
    tags: ['pool', 'swimming', 'indoor', 'year-round', 'water slide'],
    free: false,
    hours: 'Mon–Fri 6am–9pm · Sat 8am–6pm · Sun noon–6pm',
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
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Albuquerque_Museum_exterior.jpg/1200px-Albuquerque_Museum_exterior.jpg',
    tags: ['museum', 'art', 'history', 'sculpture garden'],
    free: false,
    hours: 'Tue–Sun 9am–5pm · Free Sundays 9am–noon',
    featured: true,
  },
  {
    id: 'indian-pueblo-cultural-center',
    name: 'Indian Pueblo Cultural Center',
    tagline: 'The living story of New Mexico\'s 19 Pueblos',
    description:
      'Owned and operated by the 19 Pueblos of New Mexico — art, history, and regular dance performances tell the story of Pueblo peoples in their own words.',
    category: 'arts',
    website: 'https://www.indianpueblo.org',
    address: '2401 12th St NW, Albuquerque, NM 87104',
    neighborhood: 'North Valley',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/indian-pueblo-cultural-center.webp',
    tags: ['pueblo', 'native american', 'museum', 'dance', 'cultural'],
    free: false,
    hours: 'Daily 9am–5pm',
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
    tags: ['flamenco', 'museum', 'Latino heritage', 'cultural', 'theater'],
    free: false,
    hours: 'Tue–Sun 10am–5pm',
  },
  {
    id: 'explora-science-center',
    name: 'Explora Science Center',
    tagline: '250+ hands-on science exhibits for all ages',
    description:
      'Hands-on science center with a high-wire bicycle, bubble studio, and electricity experiments. Technically for kids — adults love it too.',
    category: 'arts',
    website: 'https://www.explora.us',
    address: '1701 Mountain Rd NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['science', 'interactive', 'kids', 'STEM'],
    free: false,
    hours: 'Mon–Sat 10am–5pm · Sun noon–5pm',
  },
  {
    id: '516-arts',
    name: '516 ARTS',
    tagline: 'Contemporary art connecting local and global',
    description:
      'Downtown ABQ\'s leading contemporary art space — challenging exhibitions that connect New Mexico artists to national and international conversations.',
    category: 'arts',
    website: 'https://www.516arts.org',
    address: '516 Central Ave SW, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
    tags: ['contemporary art', 'gallery', 'free', 'downtown'],
    free: true,
    hours: 'Wed–Sat noon–5pm',
  },
  {
    id: 'kimo-theatre',
    name: 'KiMo Theatre',
    tagline: 'Stunning Pueblo Deco landmark since 1927',
    description:
      'One of America\'s most visually striking theaters — Pueblo Revival meets Art Deco with longhorn skulls, Native motifs, and original hand-painted murals.',
    category: 'arts',
    website: 'https://www.cabq.gov/kimo',
    address: '423 Central Ave NW, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/KiMo_Theatre_Albuquerque.jpg/1200px-KiMo_Theatre_Albuquerque.jpg',
    tags: ['theater', 'historic', 'architecture', 'live performance'],
    free: false,
  },
  {
    id: 'harwood-art-center',
    name: 'Harwood Art Center',
    tagline: 'Community art school and public gallery',
    description:
      'A vibrant art center in the Sawmill neighborhood offering classes, exhibitions, and open studios. The rotating gallery features local and emerging artists.',
    category: 'arts',
    website: 'https://www.harwoodartcenter.org',
    address: '1114 7th St NW, Albuquerque, NM 87102',
    neighborhood: 'Sawmill',
    tags: ['gallery', 'classes', 'community', 'local art'],
    free: true,
    hours: 'Mon–Fri 9am–5pm',
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

  // ── FOOD & DRINK ─────────────────────────────────────────────────────────

  {
    id: 'marble-brewery',
    name: 'Marble Brewery',
    tagline: 'ABQ\'s flagship craft brewery since 2008',
    description:
      'The downtown taproom that started the ABQ craft beer scene. Marble\'s Red Ale and Pilsner are local institutions.',
    category: 'food-drink',
    website: 'https://www.marblebrewery.com',
    address: '111 Marble Ave NW, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/marble-brewery.webp',
    tags: ['brewery', 'craft beer', 'taproom', 'local'],
    free: false,
    hours: 'Mon–Thu 11am–11pm · Fri–Sat 11am–midnight · Sun noon–9pm',
    featured: true,
  },
  {
    id: 'sawmill-market',
    name: 'Sawmill Market',
    tagline: 'ABQ\'s indoor food hall with 20+ local vendors',
    description:
      'New Mexico\'s first large-scale food hall — green chile cheeseburgers, ramen, sushi, tacos, coffee, and craft cocktails all under one roof.',
    category: 'food-drink',
    website: 'https://www.sawmillmarket.com',
    address: '1909 Bellamah Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Sawmill',
    tags: ['food hall', 'local vendors', 'green chile', 'lunch', 'dinner'],
    free: false,
    hours: 'Mon–Thu 11am–9pm · Fri–Sat 11am–10pm · Sun 11am–8pm',
    featured: true,
  },
  {
    id: 'tractor-brewing',
    name: 'Tractor Brewing Co.',
    tagline: 'Neighborhood brewery with a big backyard',
    description:
      'Wells Park\'s beloved neighborhood taproom known for its outdoor beer garden, live music, and rotating taps.',
    category: 'food-drink',
    website: 'https://www.tractorbrewing.com',
    address: '118 Tulane Dr SE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill',
    tags: ['brewery', 'craft beer', 'live music', 'patio'],
    free: false,
    hours: 'Daily 2pm–10pm (check location)',
  },
  {
    id: 'la-cumbre-brewing',
    name: 'La Cumbre Brewing Co.',
    tagline: 'Home of Project Dank — ABQ\'s most-awarded IPA',
    description:
      'Multiple GABF medal winner known for aggressive, hop-forward beers. The IPA flight is required homework.',
    category: 'food-drink',
    website: 'https://www.lacumbrebrewing.com',
    address: '3313 Girard Blvd NE, Albuquerque, NM 87107',
    neighborhood: 'North Valley',
    tags: ['brewery', 'IPA', 'craft beer', 'taproom'],
    free: false,
    hours: 'Mon–Thu 3pm–9pm · Fri 2pm–10pm · Sat noon–10pm · Sun noon–8pm',
  },
  {
    id: 'frontier-restaurant',
    name: 'Frontier Restaurant',
    tagline: 'ABQ\'s 24/7 institution — green chile and sweet rolls',
    description:
      'Open 24 hours across from UNM. Frontier\'s sweet rolls and green chile are practically a religion. The original John Wayne painting watches over everyone.',
    category: 'food-drink',
    website: 'https://www.frontierrestaurant.com',
    address: '2400 Central Ave SE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill/UNM',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/frontier-restaurant.webp',
    tags: ['green chile', 'New Mexican food', '24-hours', 'institution'],
    free: false,
    hours: 'Open 24 hours',
  },
  {
    id: 'gruet-winery',
    name: 'Gruet Winery',
    tagline: 'Award-winning New Mexico sparkling wine',
    description:
      'New Mexico\'s most celebrated winery — méthode champenoise sparkling wines that consistently beat French Champagnes in blind tastings.',
    category: 'food-drink',
    website: 'https://www.gruetwinery.com',
    address: '8400 Pan American Fwy NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    image: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/place-photos/gruet-winery.webp',
    tags: ['wine', 'sparkling', 'tasting', 'New Mexico'],
    free: false,
    hours: 'Mon–Fri 10am–5pm · Sat noon–5pm',
  },
  {
    id: 'zacatecas',
    name: 'Zacatecas Tacos & Tequila',
    tagline: 'Street tacos and 200+ tequilas in Nob Hill',
    description:
      'The rooftop patio is the spot for watching Nob Hill while working through their massive tequila list and some of the best tacos in the city.',
    category: 'food-drink',
    website: 'https://www.zacatecasabq.com',
    address: '3423 Central Ave NE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill',
    tags: ['tacos', 'tequila', 'rooftop', 'Mexican'],
    free: false,
    hours: 'Mon–Thu 11am–10pm · Fri–Sat 11am–11pm · Sun 11am–9pm',
  },
  {
    id: 'durans-new-mexico-kitchen',
    name: 'Duran\'s New Mexican Kitchen',
    tagline: 'Old-school New Mexican food done right',
    description:
      'Hand-rolled tortillas, scratch posole, and real-deal red and green chile. Cash-friendly, no reservations, worth every minute of the wait.',
    category: 'food-drink',
    website: 'https://www.duransnm.com',
    address: '1800 Central Ave SW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['New Mexican', 'green chile', 'red chile', 'tortillas'],
    free: false,
    hours: 'Mon–Fri 7am–8pm · Sat 8am–8pm',
  },

  // ── ENTERTAINMENT ─────────────────────────────────────────────────────────

  {
    id: 'meow-wolf-albuquerque',
    name: 'Meow Wolf Albuquerque',
    tagline: 'Immersive art experience inside a haunted mystery',
    description:
      'An immersive, interactive art experience you walk through, explore, and get completely lost in. Not just for kids — plan 2+ hours.',
    category: 'entertainment',
    website: 'https://meowwolf.com/visit/albuquerque',
    address: '3022 Coors Bypass NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    tags: ['immersive art', 'interactive', 'family', 'experience'],
    free: false,
    hours: 'Mon–Thu noon–8pm · Fri–Sun 10am–10pm',
    featured: true,
  },
  {
    id: 'cliffs-amusement-park',
    name: 'Cliff\'s Amusement Park',
    tagline: 'ABQ\'s neighborhood amusement park since 1959',
    description:
      'A local institution with roller coasters, a log flume, go-karts, and classic carnival rides — all with the Sandias as a backdrop.',
    category: 'entertainment',
    website: 'https://www.cliffsamusementpark.com',
    address: '4800 Osuna Rd NE, Albuquerque, NM 87109',
    neighborhood: 'North Albuquerque Acres',
    tags: ['amusement park', 'roller coaster', 'family', 'summer'],
    free: false,
    hours: 'Seasonal — check website for schedule',
  },
  {
    id: 'abq-escape-rooms',
    name: 'Escape Room ABQ',
    tagline: 'Award-winning escape experiences downtown',
    description:
      'Some of New Mexico\'s best-designed escape rooms — from thriller scenarios to family-friendly puzzles. Great for groups.',
    category: 'entertainment',
    website: 'https://www.escaperooms.abq.com',
    address: '300 Broadway Blvd NE, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
    tags: ['escape room', 'groups', 'puzzles'],
    free: false,
    hours: 'By reservation — check website',
  },
  {
    id: 'route-66-casino',
    name: 'Route 66 Casino Hotel',
    tagline: 'Concerts, casino, and classic road-trip nostalgia',
    description:
      'Laguna Pueblo\'s Route 66 Casino brings in national touring acts, has one of the best buffets in the region, and a sprawling gaming floor.',
    category: 'entertainment',
    website: 'https://www.rt66casino.com',
    address: '14500 Central Ave SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    tags: ['casino', 'concerts', 'gaming', 'Route 66'],
    free: false,
    hours: 'Open 24 hours',
  },

  // ── FAMILY ────────────────────────────────────────────────────────────────

  {
    id: 'albuquerque-biopark-zoo',
    name: 'ABQ BioPark Zoo',
    tagline: 'New Mexico\'s largest zoo in the heart of the city',
    description:
      'Home to 250+ species including African elephants, komodo dragons, and Amur tigers — connects to the Aquarium and Botanic Garden.',
    category: 'family',
    website: 'https://www.cabq.gov/culturalservices/biopark/zoo',
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
    website: 'https://www.cabq.gov/culturalservices/biopark/aquarium',
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
    website: 'https://www.cabq.gov/culturalservices/biopark/botanic-garden',
    address: '2601 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
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
    tags: ['dinosaurs', 'science', 'planetarium', 'museum', 'family'],
    free: false,
    hours: 'Daily 9am–5pm',
  },
  {
    id: 'national-museum-nuclear-science',
    name: 'National Museum of Nuclear Science',
    tagline: 'The atomic bomb story, told in Albuquerque',
    description:
      'Traces the Manhattan Project to the present — with B-29 bombers, missiles, and a Little Boy replica out in the heritage park.',
    category: 'family',
    website: 'https://www.nuclearmuseum.org',
    address: '601 Eubank Blvd SE, Albuquerque, NM 87123',
    neighborhood: 'Kirtland AFB',
    tags: ['nuclear', 'history', 'STEM', 'Manhattan Project', 'aviation'],
    free: false,
    hours: 'Mon–Sat 9am–5pm',
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
      'Wander 300-year-old plazas, adobe architecture, and dozens of galleries and shops around the historic San Felipe de Neri Church. Free to explore.',
    category: 'history',
    website: 'https://albuquerqueoldtown.com',
    address: 'Old Town Plaza, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Albuquerque_Old_Town_Plaza.jpg/1200px-Albuquerque_Old_Town_Plaza.jpg',
    tags: ['historic', 'plaza', 'church', 'galleries', 'shopping', 'free'],
    free: true,
    hours: 'Plaza always open · shops daily 10am–5pm',
    featured: true,
  },
  {
    id: 'san-felipe-de-neri-church',
    name: 'San Felipe de Neri Church',
    tagline: 'One of the oldest churches in the United States',
    description:
      'The original church was built in 1706 — the current structure dates to 1793. An active parish with free self-guided tours.',
    category: 'history',
    website: 'https://www.sanfelipedeneri.org',
    address: '2005 N Plaza St NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['church', 'historic', 'adobe', 'Catholic', '1706'],
    free: true,
    hours: 'Open daily · hours vary',
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
    tags: ['Route 66', 'neon', 'historic', 'walkable', 'free'],
    free: true,
  },
  {
    id: 'albuquerque-rattlesnake-museum',
    name: 'American International Rattlesnake Museum',
    tagline: 'World\'s largest collection of live rattlesnake species',
    description:
      'A quirky Old Town gem housing 35+ live rattlesnake species along with fossils and a surprising collection of rattlesnake artifacts from pop culture.',
    category: 'history',
    website: 'https://www.rattlesnakes.com',
    address: '202 San Felipe St NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['snakes', 'weird', 'nature', 'museum', 'unique'],
    free: false,
    hours: 'Daily 10am–6pm (seasonal)',
  },
  {
    id: 'turquoise-museum',
    name: 'Turquoise Museum',
    tagline: 'World\'s most comprehensive turquoise collection',
    description:
      'A family-run gem in Old Town with an extraordinary collection of turquoise from 60+ mines worldwide, including New Mexico\'s own ancient Cerrillos mines.',
    category: 'history',
    website: 'https://www.turquoisemuseum.com',
    address: '2107 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['turquoise', 'jewelry', 'gems', 'museum', 'Southwest'],
    free: false,
    hours: 'Mon–Sat 9:30am–5pm',
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
