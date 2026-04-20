/**
 * Curated "Things To Do" in Albuquerque — permanent attractions, not time-based events.
 * Each entry links directly to the venue's own website.
 *
 * Add / edit entries here; no DB migration needed.
 * Images: `image` field is optional — falls back to category-appropriate
 * Pixabay/Midjourney imagery from getCategoryFallback().
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
  image?: string      // optional specific photo URL; falls back to category image
  tags: string[]
  free: boolean       // true if general admission / access is free
  hours?: string      // optional summary, e.g. "Open daily · sunrise–sunset"
  featured?: boolean  // show near top of grid
}

// ── Category metadata ────────────────────────────────────────────────────────

export const PLACE_CATEGORIES: {
  slug: PlaceCategory
  label: string
  emoji: string
  fallbackCategory: string // maps to getCategoryFallback() key
}[] = [
  { slug: 'outdoors',      label: 'Outdoors',       emoji: '🌵', fallbackCategory: 'outdoor'       },
  { slug: 'arts',          label: 'Arts & Culture',  emoji: '🎨', fallbackCategory: 'arts & theater' },
  { slug: 'food-drink',    label: 'Food & Drink',    emoji: '🍺', fallbackCategory: 'food & drink'   },
  { slug: 'entertainment', label: 'Entertainment',   emoji: '🎭', fallbackCategory: 'festivals'      },
  { slug: 'family',        label: 'Family',          emoji: '👨‍👩‍👧', fallbackCategory: 'family'        },
  { slug: 'history',       label: 'History',         emoji: '🏛️', fallbackCategory: 'community'      },
]

// Returns the fallback category key for getCategoryFallback()
export function placeFallbackCategory(cat: PlaceCategory): string {
  return PLACE_CATEGORIES.find(c => c.slug === cat)?.fallbackCategory ?? 'community'
}

// ── The list ─────────────────────────────────────────────────────────────────

export const PLACES: Place[] = [

  // ── OUTDOORS ──────────────────────────────────────────────────────────────

  {
    id: 'sandia-peak-tramway',
    name: 'Sandia Peak Tramway',
    tagline: 'Ride the world\'s longest aerial tramway',
    description:
      'Ascend 10,378 feet above the Rio Grande Valley in 15 minutes. The views from the top stretch across 11,000 square miles on a clear day — bring a layer, it\'s 30°F cooler up top.',
    category: 'outdoors',
    website: 'https://sandiapeak.com',
    address: '30 Tramway Rd NE, Albuquerque, NM 87122',
    neighborhood: 'Northeast Heights',
    tags: ['tram', 'mountain', 'views', 'hiking'],
    free: false,
    hours: 'Wed–Mon · 9am–8pm (seasonal hours vary)',
    featured: true,
  },
  {
    id: 'petroglyph-national-monument',
    name: 'Petroglyph National Monument',
    tagline: '20,000 ancient rock carvings on volcanic basalt',
    description:
      'Walk among lava flows and carved petroglyphs left by ancestral Puebloans and early Spanish settlers over the last 700 years. Multiple trail systems — Boca Negra Canyon is the easiest access.',
    category: 'outdoors',
    website: 'https://www.nps.gov/petr',
    address: '6001 Unser Blvd NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    tags: ['hiking', 'history', 'petroglyphs', 'free', 'NPS'],
    free: true,
    hours: 'Visitor center: daily 8am–5pm · Trails: sunrise–sunset',
    featured: true,
  },
  {
    id: 'rio-grande-nature-center',
    name: 'Rio Grande Nature Center',
    tagline: 'Bosque birding and river trails',
    description:
      'Explore 170 acres of cottonwood forest and wetlands along the Rio Grande. The glassed-in observatory overlooks a pond where sandhill cranes winter. Trails connect to the Paseo del Bosque.',
    category: 'outdoors',
    website: 'https://www.rgnc.org',
    address: '2901 Candelaria Rd NW, Albuquerque, NM 87107',
    neighborhood: 'North Valley',
    tags: ['birding', 'hiking', 'bosque', 'river', 'nature'],
    free: false,
    hours: 'Daily 8am–5pm',
  },
  {
    id: 'paseo-del-bosque-trail',
    name: 'Paseo del Bosque Trail',
    tagline: '16 miles of paved greenway through cottonwood forest',
    description:
      'A car-free paved trail running the length of the city along the Rio Grande, through cathedral cottonwoods and open bosque. Perfect for cycling, running, or a long walk.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/parks/paseo-del-bosque-trail',
    address: 'Rio Grande Blvd at Montano, Albuquerque, NM',
    neighborhood: 'North Valley',
    tags: ['cycling', 'running', 'trail', 'free', 'river'],
    free: true,
    hours: 'Open daily · sunrise–sunset',
  },
  {
    id: 'elena-gallegos-open-space',
    name: 'Elena Gallegos Open Space',
    tagline: 'Sandia foothills trails at the edge of the city',
    description:
      'Over 640 acres of high desert foothills at the base of the Sandias. Twelve miles of multi-use trails wind through juniper and piñon with panoramic city views.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/open-space/lands/elena-gallegos-open-space',
    address: '7100 Tramway Blvd NE, Albuquerque, NM 87122',
    neighborhood: 'Northeast Heights',
    tags: ['hiking', 'mountain biking', 'dog friendly', 'foothills'],
    free: false,
    hours: 'Daily · $1/car weekdays, $2/car weekends',
  },
  {
    id: 'tingley-beach',
    name: 'Tingley Beach',
    tagline: 'Urban fishing ponds and model boat lake',
    description:
      'Three stocked ponds perfect for fishing, a model-boat sailing pond, and walking paths through the cottonwoods — all free, right in the middle of the city.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/culturalservices/biopark/tingley-beach',
    address: '1800 Tingley Dr SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    tags: ['fishing', 'family', 'free', 'river'],
    free: true,
    hours: 'Daily · sunrise–sunset',
  },
  {
    id: 'bosque-trail',
    name: 'Bosque Trail',
    tagline: 'Walk or bike through ancient cottonwoods',
    description:
      'The unpaved Bosque Trail runs alongside the Paseo del Bosque through dense riverine forest. In fall, the cottonwoods turn gold — one of the best free shows in the city.',
    category: 'outdoors',
    website: 'https://www.cabq.gov/parksandrecreation/open-space',
    address: 'Accessible from multiple Rio Grande entry points',
    neighborhood: 'Rio Grande Valley',
    tags: ['hiking', 'nature', 'free', 'fall color'],
    free: true,
    hours: 'Open daily · sunrise–sunset',
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
      'Owned and operated by the 19 Pueblos of New Mexico, this museum and cultural center tells the story of Pueblo peoples through art, history, and regular dance performances.',
    category: 'arts',
    website: 'https://www.indianpueblo.org',
    address: '2401 12th St NW, Albuquerque, NM 87104',
    neighborhood: 'North Valley',
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
      'A 55-acre campus celebrating Hispanic art, history, and culture — home to the José Griego y Maestas Torreon fresco, the Albuquerque Bernalillo County Library\'s genealogy collection, and regular flamenco performances.',
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
      'Hands-on science center with a high-wire bicycle, bubble studio, electricity experiments, and maker space. Technically for kids — but adults love it too.',
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
      'Downtown Albuquerque\'s leading contemporary art space, presenting challenging exhibitions that connect New Mexico artists to national and international conversations.',
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
      'One of the most visually striking theaters in America — Pueblo Revival meets Art Deco, with longhorn skulls, Native motifs, and original hand-painted murals. Check their schedule for shows.',
    category: 'arts',
    website: 'https://www.cabq.gov/kimo',
    address: '423 Central Ave NW, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
    tags: ['theater', 'historic', 'architecture', 'live performance'],
    free: false,
    hours: 'Lobby open for tours by appointment',
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
    tagline: 'ABQ\'s premier venue for touring Broadway and classical',
    description:
      'On the UNM campus, Popejoy is New Mexico\'s largest performing arts venue — home to Broadway touring productions, symphony performances, and major musical acts.',
    category: 'arts',
    website: 'https://www.popejoypresents.com',
    address: '203 Cornell Dr SE, Albuquerque, NM 87106',
    neighborhood: 'UNM',
    tags: ['broadway', 'symphony', 'performance', 'UNM'],
    free: false,
  },

  // ── FOOD & DRINK ─────────────────────────────────────────────────────────

  {
    id: 'marble-brewery',
    name: 'Marble Brewery',
    tagline: 'ABQ\'s flagship craft brewery since 2008',
    description:
      'The downtown taproom started the ABQ craft beer scene. Now with two locations, Marble\'s Brewpub and Taproom remain the go-to spots for local lagers, IPAs, and Red Ales.',
    category: 'food-drink',
    website: 'https://www.marblebrewery.com',
    address: '111 Marble Ave NW, Albuquerque, NM 87102',
    neighborhood: 'Downtown',
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
      'New Mexico\'s first large-scale food hall brings together the best of ABQ\'s restaurant scene under one roof — Green Chile Cheeseburgers, ramen, sushi, tacos, coffee, and craft cocktails.',
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
      'Wells Park\'s beloved neighborhood taproom is known for its outdoor beer garden, live music, and rotating taps. The Nob Hill location is the original.',
    category: 'food-drink',
    website: 'https://www.tractorbrewing.com',
    address: '118 Tulane Dr SE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill',
    tags: ['brewery', 'craft beer', 'live music', 'patio'],
    free: false,
    hours: 'Daily 2pm–10pm (check location for hours)',
  },
  {
    id: 'la-cumbre-brewing',
    name: 'La Cumbre Brewing Co.',
    tagline: 'Home of Project Dank, ABQ\'s most-awarded IPA',
    description:
      'Multiple GABF medal winner known for aggressive, hop-forward beers. The taproom is unpretentious and the IPA flight is required homework.',
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
      'Open 24 hours across from UNM, Frontier\'s sweet rolls and green chile are practically a religion. The original John Wayne painting watches over everyone.',
    category: 'food-drink',
    website: 'https://www.frontierrestaurant.com',
    address: '2400 Central Ave SE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill/UNM',
    tags: ['green chile', 'New Mexican food', '24-hours', 'institution', 'cheap'],
    free: false,
    hours: 'Open 24 hours',
  },
  {
    id: 'gruet-winery',
    name: 'Gruet Winery',
    tagline: 'Award-winning New Mexico sparkling wine',
    description:
      'New Mexico\'s most celebrated winery, producing méthode champenoise sparkling wines that consistently beat French Champagnes in blind tastings. The tasting room is worth a visit.',
    category: 'food-drink',
    website: 'https://www.gruetwinery.com',
    address: '8400 Pan American Fwy NE, Albuquerque, NM 87113',
    neighborhood: 'North Albuquerque Acres',
    tags: ['wine', 'sparkling', 'tasting', 'New Mexico'],
    free: false,
    hours: 'Mon–Fri 10am–5pm · Sat noon–5pm',
  },
  {
    id: 'zacatecas',
    name: 'Zacatecas Tacos & Tequila',
    tagline: 'Street tacos and 200+ tequilas in Nob Hill',
    description:
      'The rooftop patio is the spot for watching the Nob Hill action while working through their massive tequila list and some of the best tacos in the city.',
    category: 'food-drink',
    website: 'https://www.zacatecasabq.com',
    address: '3423 Central Ave NE, Albuquerque, NM 87106',
    neighborhood: 'Nob Hill',
    tags: ['tacos', 'tequila', 'rooftop', 'Mexican', 'cocktails'],
    free: false,
    hours: 'Mon–Thu 11am–10pm · Fri–Sat 11am–11pm · Sun 11am–9pm',
  },
  {
    id: 'durans-new-mexico-kitchen',
    name: 'Duran\'s New Mexican Kitchen',
    tagline: 'Old-school New Mexican food done right',
    description:
      'A no-frills counter-service staple with hand-rolled tortillas, scratch posole, and real-deal red and green chile. Cash-friendly, no reservations, worth the wait.',
    category: 'food-drink',
    website: 'https://www.duransnm.com',
    address: '1800 Central Ave SW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['New Mexican', 'green chile', 'red chile', 'tortillas', 'local favorite'],
    free: false,
    hours: 'Mon–Fri 7am–8pm · Sat 8am–8pm · Closed Sunday',
  },

  // ── ENTERTAINMENT ─────────────────────────────────────────────────────────

  {
    id: 'meow-wolf-albuquerque',
    name: 'Meow Wolf Albuquerque',
    tagline: 'Immersive art experience inside a haunted house mystery',
    description:
      'The original Santa Fe collective\'s Albuquerque outpost — an immersive, interactive art experience you walk through, explore, and get completely lost in. Not just for kids.',
    category: 'entertainment',
    website: 'https://meowwolf.com/location/albuquerque',
    address: '3022 Coors Bypass NW, Albuquerque, NM 87120',
    neighborhood: 'Westside',
    tags: ['immersive art', 'interactive', 'family', 'psychedelic', 'experience'],
    free: false,
    hours: 'Mon–Thu noon–8pm · Fri–Sun 10am–10pm',
    featured: true,
  },
  {
    id: 'cliffs-amusement-park',
    name: 'Cliff\'s Amusement Park',
    tagline: 'ABQ\'s neighborhood amusement park since 1959',
    description:
      'A local institution with roller coasters, a log flume, go-karts, and classic carnival rides — all on the west side with the Sandias as a backdrop.',
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
    tags: ['escape room', 'groups', 'team building', 'puzzles'],
    free: false,
    hours: 'By reservation — check website',
  },
  {
    id: 'route-66-casino',
    name: 'Route 66 Casino Hotel',
    tagline: 'Concerts, casino, and classic road-trip nostalgia',
    description:
      'Laguna Pueblo\'s Route 66 Casino brings in national touring acts, has one of the best buffets in the region, and a sprawling gaming floor — all with a classic highway aesthetic.',
    category: 'entertainment',
    website: 'https://www.rt66casino.com',
    address: '14500 Central Ave SW, Albuquerque, NM 87121',
    neighborhood: 'Westside',
    tags: ['casino', 'concerts', 'gaming', 'Route 66'],
    free: false,
    hours: 'Open 24 hours',
  },
  {
    id: 'abq-bowling',
    name: 'Cottonwood Bowl',
    tagline: 'Classic bowling and arcade on the Westside',
    description:
      'Full-service bowling alley with arcade games, billiards, a restaurant and bar — good for date nights, group outings, or a rainy-day escape.',
    category: 'entertainment',
    website: 'https://www.cottonwoodbowl.com',
    address: '10200 Coors Bypass NW, Albuquerque, NM 87114',
    neighborhood: 'Westside',
    tags: ['bowling', 'arcade', 'groups', 'date night'],
    free: false,
    hours: 'Daily · check website for hours',
  },

  // ── FAMILY ────────────────────────────────────────────────────────────────

  {
    id: 'albuquerque-biopark-zoo',
    name: 'ABQ BioPark Zoo',
    tagline: 'New Mexico\'s largest zoo in the heart of the city',
    description:
      'Home to 250+ species including African elephants, komodo dragons, and Amur tigers — the Zoo connects to the Aquarium and Botanic Garden via a scenic river walk.',
    category: 'family',
    website: 'https://www.cabq.gov/culturalservices/biopark/zoo',
    address: '903 10th St SW, Albuquerque, NM 87102',
    neighborhood: 'Old Town',
    tags: ['zoo', 'animals', 'family', 'elephants', 'children'],
    free: false,
    hours: 'Daily 9am–5pm',
    featured: true,
  },
  {
    id: 'abq-aquarium',
    name: 'ABQ BioPark Aquarium',
    tagline: 'Sharks, rays, and the Gulf of Mexico — landlocked edition',
    description:
      'A surprisingly excellent aquarium featuring a 285,000-gallon shark tank, jellyfish gallery, and Gulf of Mexico exhibit. Combo tickets with the Zoo and Botanic Garden.',
    category: 'family',
    website: 'https://www.cabq.gov/culturalservices/biopark/aquarium',
    address: '2601 Central Ave NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['aquarium', 'sharks', 'family', 'fish', 'children'],
    free: false,
    hours: 'Daily 9am–5pm',
  },
  {
    id: 'abq-botanic-garden',
    name: 'ABQ BioPark Botanic Garden',
    tagline: 'Butterfly pavilion and Mediterranean gardens',
    description:
      'Ten acres of formal gardens, a butterfly pavilion, a children\'s fantasy garden, and the Med greenhouse — connected to the Aquarium by a seasonal river cruise.',
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
    name: 'NM Museum of Natural History & Science',
    tagline: 'Dinosaurs, volcanoes, and a planetarium',
    description:
      'Walk among real Seismosaurus bones, watch a planetarium show, and learn about New Mexico\'s volcanic landscape — the Albuquerque location is a genuine natural science gem.',
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
    name: 'National Museum of Nuclear Science & History',
    tagline: 'The atomic bomb story, told in Albuquerque',
    description:
      'The official museum of the Atomic Age traces the Manhattan Project to the present — with B-29 bombers, missiles, and Little Boy replica out on the heritage park.',
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
    name: 'Anderson-Abruzzo International Balloon Museum',
    tagline: 'The full history of ballooning in the Balloon Capital',
    description:
      'Named after ABQ\'s famous balloon adventurers, this museum covers 250+ years of ballooning history — from the first hydrogen balloon to modern record-breaking flights.',
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
      'Wander 300-year-old plazas, adobe architecture, and dozens of galleries and shops clustered around the historic San Felipe de Neri Church. Free to explore; perfect for a Sunday morning.',
    category: 'history',
    website: 'https://albuquerqueoldtown.com',
    address: 'Old Town Plaza, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['historic', 'plaza', 'church', 'galleries', 'shopping', 'free'],
    free: true,
    hours: 'Outdoor plaza always open · shops daily 10am–5pm',
    featured: true,
  },
  {
    id: 'san-felipe-de-neri-church',
    name: 'San Felipe de Neri Church',
    tagline: 'One of the oldest churches in the United States',
    description:
      'The original church was built in 1706 — the current structure dates to 1793. An active parish with free self-guided tours, the thick adobe walls make it one of the most photographed spots in ABQ.',
    category: 'history',
    website: 'https://www.sanfelipedeneri.org',
    address: '2005 N Plaza St NW, Albuquerque, NM 87104',
    neighborhood: 'Old Town',
    tags: ['church', 'historic', 'adobe', 'Catholic', '1706'],
    free: true,
    hours: 'Open daily · church hours vary',
  },
  {
    id: 'route-66',
    name: 'Central Avenue (Historic Route 66)',
    tagline: 'The Main Street of America runs through ABQ',
    description:
      'Albuquerque\'s Central Avenue is one of the longest surviving stretches of the original Route 66 — vintage motels, neon signs, and decades of American road culture, live and walkable.',
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
    tagline: 'The world\'s largest collection of rattlesnake species',
    description:
      'A quirky Old Town gem housing 35+ species of live rattlesnakes along with their shed skins, fossils, and a surprising collection of rattlesnake artifacts from pop culture.',
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
    tagline: 'The world\'s most comprehensive turquoise collection',
    description:
      'A family-run gem in Old Town with an extraordinary collection of turquoise from 60+ mines worldwide — including pieces from New Mexico\'s own Cerrillos mines, America\'s oldest turquoise source.',
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

export function getFeaturedPlaces(limit = 6): Place[] {
  const featured = PLACES.filter(p => p.featured)
  // Pad with non-featured if needed
  if (featured.length >= limit) return featured.slice(0, limit)
  const rest = PLACES.filter(p => !p.featured)
  return [...featured, ...rest].slice(0, limit)
}
