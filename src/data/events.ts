export type EventCategory =
  | "Movie"
  | "Live Music"
  | "Festival"
  | "Theater & Comedy"
  | "Farmers Market"
  | "Arts & Culture"
  | "Food & Drink"
  | "Outdoors"
  | "Sports"
  | "Community"
  | "Nightlife"
  | "Family";

export type EventSource =
  | "ABQ365"
  | "The Paper ABQ"
  | "City of ABQ"
  | "Fandango"
  | "Bandsintown"
  | "Eventbrite"
  | "ABQToDo"
  | "Meetup"
  | "SeatGeek"
  | "Visit ABQ"
  | "Old Town ABQ"
  | "Downtown ABQ";

export interface Event {
  id: string;
  title: string;
  category: EventCategory;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  location: string;
  address: string;
  description: string;
  price: string;
  priceNum: number;       // 0=free, >0=price floor
  image: string;
  gradient: string;
  featured?: boolean;
  tags?: string[];
  isKidFriendly?: boolean;
  is21Plus?: boolean;
  isOutdoor?: boolean;
  isAccessible?: boolean;
  source: EventSource;
  website?: string;
  ticketUrl?: string;
  accessibility?: string;
  // Movies only
  movieRating?: string;   // PG, PG-13, R, etc.
  movieRuntime?: string;  // "2h 15m"
  movieGenre?: string;
  theaters?: string[];
}

const U = (id: string, w = 800, h = 500) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

// ─── Cinema images for movies ──────────────────────────────────────────────────
const CINEMA_IMG  = U("1489599849927-2ee91cede3ba");
const CINEMA2_IMG = U("1524985069026-dd778c4ab7db");


// ABQ Theaters
const ABQ_THEATERS = [
  "AMC Albuquerque 12 & IMAX",
  "Cinemark Century Rio 24 XD",
  "Regal Winrock Stadium 16 IMAX",
];
const ALL_THEATERS = [
  "AMC Albuquerque 12 & IMAX",
  "Cinemark Century Rio 24 XD",
  "Regal Winrock Stadium 16 IMAX",
  "ICON Cinemas",
];

export const ALL_EVENTS: Event[] = [

  // ═══════════════════════════════════════════════════════════
  // MOVIES — Now Playing (March 17 – April 3, 2026)
  // ═══════════════════════════════════════════════════════════
  {
    id: "mv-1",
    title: "Project Hail Mary",
    category: "Movie",
    date: "2026-03-17",
    endDate: "2026-04-09",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "Ryan Gosling stars in this stunning sci-fi adaptation of Andy Weir's bestselling novel. An astronaut wakes alone on a deep-space mission with no memory of how he got there — and discovers the fate of Earth rests entirely on his shoulders. Director Phil Lord delivers a film already being called one of the decade's great science fiction experiences.",
    price: "$13–$22",
    priceNum: 13,
    image: "https://upload.wikimedia.org/wikipedia/en/3/3b/Project_Hail_Mary_poster.jpg",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #0f2027 100%)",
    featured: true,
    movieRating: "PG-13",
    movieRuntime: "2h 15m",
    movieGenre: "Sci-Fi / Adventure",
    theaters: ALL_THEATERS,
    tags: ["sci-fi", "Ryan Gosling", "based on book", "IMAX"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/albuquerque_nm_movietimes",
    accessibility: "All theaters offer closed captioning devices & audio description",
  },
  {
    id: "mv-2",
    title: "Hoppers",
    category: "Movie",
    date: "2026-03-17",
    endDate: "2026-04-09",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "Pixar's newest animated adventure follows Mabel, an animal-obsessed kid who discovers technology that lets her 'hop' into robotic creatures and experience a hidden world beneath our feet. A visually breathtaking, heartfelt film with Pixar's signature emotional depth — expect tears and standing ovations.",
    price: "$13–$20",
    priceNum: 13,
    image: CINEMA_IMG,
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    featured: false,
    movieRating: "PG",
    movieRuntime: "1h 48m",
    movieGenre: "Animated / Family",
    theaters: ALL_THEATERS,
    tags: ["Pixar", "animated", "family", "kids"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/albuquerque_nm_movietimes",
  },
  {
    id: "mv-3",
    title: "The Bride!",
    category: "Movie",
    date: "2026-03-17",
    endDate: "2026-03-29",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "Maggie Gyllenhaal directs and Jessie Buckley stars in this bold, feminist reimagining of the Bride of Frankenstein — set in 1930s Chicago. A gothic thriller that's being called the most audacious film of the year, blending horror, romance, and sharp social commentary with stunning cinematography.",
    price: "$13–$18",
    priceNum: 13,
    image: CINEMA2_IMG,
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)",
    featured: false,
    movieRating: "R",
    movieRuntime: "2h 3m",
    movieGenre: "Horror / Drama",
    theaters: ABQ_THEATERS,
    tags: ["horror", "gothic", "Maggie Gyllenhaal", "art house"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
  },
  {
    id: "mv-4",
    title: "Snow White",
    category: "Movie",
    date: "2026-03-21",
    endDate: "2026-04-12",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "Disney's stunning live-action reimagining of the classic fairy tale stars Rachel Zegler as Snow White and Gal Gadot as the Evil Queen. A lavish, musical fantasy with breathtaking production design and new original songs from the composers of La La Land.",
    price: "$13–$22",
    priceNum: 13,
    image: "https://upload.wikimedia.org/wikipedia/en/1/1f/Snow_White_%282025_film%29_final_poster.jpg",
    gradient: "linear-gradient(135deg, #dc2626 0%, #9f1239 100%)",
    featured: false,
    movieRating: "PG",
    movieRuntime: "1h 55m",
    movieGenre: "Musical / Fantasy",
    theaters: ALL_THEATERS,
    tags: ["Disney", "musical", "live-action", "family"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/albuquerque_nm_movietimes",
  },
  {
    id: "mv-lobo-1",
    title: "Lobo Theater: Classic Film Night — Casablanca",
    category: "Movie",
    date: "2026-03-21",
    time: "7:30 PM",
    endTime: "9:45 PM",
    location: "The Lobo Theater",
    address: "3013 Central Ave NE, Albuquerque, NM 87106",
    description:
      "The historic Lobo Theater on Route 66 — Albuquerque's beloved art-house cinema — presents Casablanca (1942) in a digitally restored 4K print. Pre-show cocktail hour at 6:30 PM with themed drinks. The Lobo is one of Albuquerque's most treasured cultural landmarks, with its original 1939 neon sign illuminating Nob Hill.",
    price: "$12",
    priceNum: 12,
    image: "https://static.wixstatic.com/media/196694_6ff81fbc7923461aae31da31d5400fa9%7Emv2.png/v1/fit/w_2500,h_1330,al_c/196694_6ff81fbc7923461aae31da31d5400fa9%7Emv2.png",
    gradient: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    featured: false,
    movieRating: "NR",
    movieRuntime: "1h 42m",
    movieGenre: "Classic / Drama",
    theaters: ["The Lobo Theater"],
    tags: ["classic film", "Route 66", "art house", "historic venue"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "The Paper ABQ",
    website: "https://www.loboabq.com",
    accessibility: "Historic venue with accessible seating",
  },
  {
    id: "mv-5",
    title: "A Minecraft Movie",
    category: "Movie",
    date: "2026-04-04",
    endDate: "2026-05-03",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "The biggest video game movie ever made hits theaters. Jack Black stars as Steve alongside Jason Momoa in a live-action/animated adventure that takes a group of misfits from our world into the Overworld — where they must battle the Ender Dragon to save both realms. Directed by Jared Hess.",
    price: "$13–$22",
    priceNum: 13,
    image: "https://upload.wikimedia.org/wikipedia/en/6/66/A_Minecraft_Movie_poster.jpg",
    gradient: "linear-gradient(135deg, #16a34a 0%, #0891b2 100%)",
    featured: true,
    movieRating: "PG",
    movieRuntime: "1h 55m",
    movieGenre: "Action / Comedy / Family",
    theaters: ALL_THEATERS,
    tags: ["Minecraft", "Jack Black", "family", "video game"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/albuquerque_nm_movietimes",
  },
  {
    id: "mv-6",
    title: "Super Mario Galaxy Movie",
    category: "Movie",
    date: "2026-04-04",
    endDate: "2026-05-10",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "The massive sequel to The Super Mario Bros. Movie takes Mario and friends to space — across galaxies, through black holes, and toward a final showdown with Bowser on a moon-sized airship. Chris Pratt, Anya Taylor-Joy, and Charlie Day return, joined by new cast. The most anticipated animated movie of 2026.",
    price: "$13–$22",
    priceNum: 13,
    image: U("1446776811953-b23d57bd21aa"),
    gradient: "linear-gradient(135deg, #dc2626 0%, #7c3aed 100%)",
    featured: true,
    movieRating: "PG",
    movieRuntime: "2h 2m",
    movieGenre: "Animated / Adventure",
    theaters: ALL_THEATERS,
    tags: ["Mario", "animated", "Nintendo", "family", "sequel"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/albuquerque_nm_movietimes",
  },
  {
    id: "mv-7",
    title: "Ready or Not 2",
    category: "Movie",
    date: "2026-04-10",
    endDate: "2026-05-03",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "Samara Weaving returns as Grace in this wickedly funny horror-thriller sequel. Having survived one murderous family, Grace is drawn into an even deadlier game — this time on an international stage. Sharper, wilder, and bloodier than the original.",
    price: "$13–$18",
    priceNum: 13,
    image: U("1440404653325-ab127d49abc1"),
    gradient: "linear-gradient(135deg, #7f1d1d 0%, #1c1917 100%)",
    featured: false,
    movieRating: "R",
    movieRuntime: "1h 52m",
    movieGenre: "Horror / Comedy",
    theaters: ABQ_THEATERS,
    tags: ["horror", "sequel", "Samara Weaving", "dark comedy"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
  },
  {
    id: "mv-8",
    title: "Michael",
    category: "Movie",
    date: "2026-04-24",
    endDate: "2026-05-17",
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description:
      "Antoine Fuqua's epic biopic of Michael Jackson, starring Jaafar Jackson as his uncle. The film explores Michael's extraordinary rise, creative genius, personal relationships, and the controversies that defined his later years — told through the lens of his art and the people who knew him best.",
    price: "$13–$22",
    priceNum: 13,
    image: "https://upload.wikimedia.org/wikipedia/en/e/e2/Michael_2023_film_poster.jpg",
    gradient: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
    featured: true,
    movieRating: "PG-13",
    movieRuntime: "2h 28m",
    movieGenre: "Biopic / Drama / Music",
    theaters: ALL_THEATERS,
    tags: ["Michael Jackson", "biopic", "music", "Antoine Fuqua"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/albuquerque_nm_movietimes",
  },

  // ═══════════════════════════════════════════════════════════
  // LIVE MUSIC — MARCH 21-22
  // ═══════════════════════════════════════════════════════════
  {
    id: "m21-2",
    title: "Toadies · Rubberneck 30th Anniversary",
    category: "Live Music",
    date: "2026-03-21",
    time: "8:00 PM",
    endTime: "11:00 PM",
    location: "El Rey Theater",
    address: "622 Central Ave SW, Albuquerque, NM 87102",
    description:
      "Alt-rock legends the Toadies perform their landmark 1994 album Rubberneck in its blistering entirety, celebrating 30 years of 'Possum Kingdom' and 'Tyler.' The intimate El Rey Theater on historic Route 66 is the perfect stage for an unforgettable night of nostalgia and pure Texas rock.",
    price: "$35",
    priceNum: 35,
    image: U("1540039155733-5bb30b53aa14"),
    gradient: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    featured: true,
    tags: ["alt-rock", "90s", "indie", "Route 66"],
    isKidFriendly: false,
    is21Plus: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Bandsintown",
    website: "https://elreyabq.com",
    ticketUrl: "https://www.bandsintown.com",
    accessibility: "ADA entrance on 7th St",
  },
  {
    id: "m21-comedy",
    title: "ABQ Comedy Underground",
    category: "Theater & Comedy",
    date: "2026-03-21",
    time: "7:30 PM",
    endTime: "10:00 PM",
    location: "Burt's Tiki Lounge",
    address: "313 Gold Ave SW, Albuquerque, NM 87102",
    description:
      "Albuquerque's best underground comedy showcase returns with six local and touring comics doing tight 10-minute sets. Host Orlando Leyba (as seen on Comedy Central) leads a night that ranges from sharp political observation to absurdist New Mexico-themed bits. 21+ after 9 PM.",
    price: "$12",
    priceNum: 12,
    image: U("1486891088084-ca484d1a4c45"),
    gradient: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
    featured: false,
    tags: ["comedy", "stand-up", "local", "touring comics"],
    isKidFriendly: false,
    is21Plus: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Eventbrite",
    website: "https://www.eventbrite.com/d/nm--albuquerque/comedy/",
  },

  // ═══════════════════════════════════════════════════════════
  // FARMERS MARKET — MARCH 21-22
  // ═══════════════════════════════════════════════════════════
  {
    id: "m21-1",
    title: "Old Town Artisan Market",
    category: "Farmers Market",
    date: "2026-03-21",
    time: "9:00 AM",
    endTime: "3:00 PM",
    location: "Old Town Plaza",
    address: "Plaza Don Luis, 303 Romero St NW, Albuquerque, NM 87104",
    description:
      "Wander the 300-year-old adobe streets of Old Town and shop 60+ local vendors selling handcrafted Native American jewelry, Pueblo pottery, hand-woven Río Grande textiles, and freshly roasted Hatch green chile. Live folk music fills the plaza all morning.",
    price: "Free",
    priceNum: 0,
    image: "https://upload.wikimedia.org/wikipedia/commons/8/81/Equestrian_statue_of_Don_Francisco_Cuervo_Y_Valdes_at_Old_Town_Albuquerque.jpg",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    featured: true,
    tags: ["native art", "crafts", "outdoor", "local"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "Old Town ABQ",
    website: "https://www.albuquerqueoldtown.com/events/",
    accessibility: "Wheelchair accessible plaza",
  },

  // ═══════════════════════════════════════════════════════════
  // OUTDOORS — MARCH 21-22
  // ═══════════════════════════════════════════════════════════
  {
    id: "m21-3",
    title: "Bosque Trail Sunrise Hike",
    category: "Outdoors",
    date: "2026-03-21",
    time: "6:30 AM",
    endTime: "9:30 AM",
    location: "Rio Grande Nature Center",
    address: "2901 Candelaria Rd NW, Albuquerque, NM 87107",
    description:
      "A guided sunrise walk through the Rio Grande bosque. A naturalist leads the group through the 2,200-acre cottonwood forest as sandhill cranes bugle overhead and the Sandia Mountains glow pink. Binoculars provided; all skill levels welcome.",
    price: "$8",
    priceNum: 8,
    image: "https://www.rgnc.org/wp-content/uploads/2026/03/IMG_0803-scaled.jpeg",
    gradient: "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)",
    tags: ["nature", "birding", "guided", "walking"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "ABQ365",
    website: "https://rgnc.org",
    accessibility: "Paved and packed gravel paths",
  },
  {
    id: "m21-4",
    title: "Sandia Mountains Snowshoe Tour",
    category: "Outdoors",
    date: "2026-03-21",
    time: "9:00 AM",
    endTime: "1:00 PM",
    location: "Sandia Crest",
    address: "Sandia Crest Rd, Tijeras, NM 87059",
    description:
      "Strap on snowshoes and explore the 10,678-foot summit of the Sandia Mountains with a certified guide. Breathtaking 360° views stretching 11,000 sq. miles. Rentals on site. Hot green chile stew at the Sandia Crest House café at the top.",
    price: "$25",
    priceNum: 25,
    image: U("1464822759023-fed622ff2c3b"),
    gradient: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
    tags: ["snowshoe", "mountain", "winter", "views"],
    isKidFriendly: false,
    isOutdoor: true,
    isAccessible: false,
    source: "ABQToDo",
    website: "https://www.fs.usda.gov/cibola",
    accessibility: "Requires moderate fitness; uneven terrain",
  },

  // ═══════════════════════════════════════════════════════════
  // COMMUNITY — MARCH 21-22
  // ═══════════════════════════════════════════════════════════
  {
    id: "m21-5",
    title: "Nob Hill Block Party · Spring Edition",
    category: "Community",
    date: "2026-03-21",
    time: "12:00 PM",
    endTime: "7:00 PM",
    location: "Nob Hill District",
    address: "Central Ave NE between Girard & Washington, Albuquerque",
    description:
      "Nob Hill transforms Central Ave into a spring street festival. Three live music stages, 20+ food vendors, pop-up art galleries, and free kids' activities. The friendliest block party of the year on Albuquerque's most eclectic mile.",
    price: "Free",
    priceNum: 0,
    image: U("1527529482837-4698179dc6ce"),
    gradient: "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)",
    featured: true,
    tags: ["block party", "music", "food", "kids"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "Downtown ABQ",
    website: "https://dtabqmainstreet.org/events",
    accessibility: "Fully accessible street-level event",
  },
  {
    id: "m21-flea",
    title: "Albuquerque Flea Market",
    category: "Community",
    date: "2026-03-21",
    time: "7:00 AM",
    endTime: "2:00 PM",
    location: "Expo New Mexico",
    address: "300 San Pedro Dr NE, Albuquerque, NM 87108",
    description:
      "500+ vendors selling vintage furniture, vinyl records, retro clothing, hand-tooled leather, fresh tamales, and everything in between. The legendary ABQ Flea Market runs every Saturday and Sunday rain or shine — one of the Southwest's largest.",
    price: "$1",
    priceNum: 1,
    image: U("1510812431401-41d2bd2722f3"),
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    tags: ["vintage", "flea market", "shopping"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "ABQToDo",
    website: "https://www.exponm.com/flea-market",
  },
  {
    id: "m22-2",
    title: "Sunday Brunch Jazz at Hotel Andaluz",
    category: "Food & Drink",
    date: "2026-03-22",
    time: "10:00 AM",
    endTime: "2:00 PM",
    location: "Hotel Andaluz Rooftop",
    address: "125 2nd St NW, Albuquerque, NM 87102",
    description:
      "Perched atop the historic 1939 Hotel Andaluz — a Conrad Hilton masterpiece — this Sunday jazz brunch features bottomless mimosas, a chef-curated New Mexican menu (blue corn huevos rancheros, green chile hollandaise), and a live jazz trio with the Sandia Mountains as backdrop.",
    price: "$48",
    priceNum: 48,
    image: U("1414235077428-338989a2e8c0"),
    gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
    tags: ["brunch", "jazz", "rooftop", "mimosas"],
    isKidFriendly: false,
    isOutdoor: true,
    isAccessible: true,
    source: "Visit ABQ",
    website: "https://hotelandaluz.com/dining",
    ticketUrl: "https://hotelandaluz.com/dining",
    accessibility: "Elevator access to rooftop",
  },
  {
    id: "m22-1",
    title: "ABQ Philharmonic: Beethoven & the Southwest",
    category: "Arts & Culture",
    date: "2026-03-22",
    time: "3:00 PM",
    endTime: "5:30 PM",
    location: "Popejoy Hall, UNM",
    address: "203 Cornell Dr NE, Albuquerque, NM 87106",
    description:
      "The Albuquerque Philharmonic opens its spring season with Beethoven's thundering Eroica Symphony paired with a world premiere by local composer Elena Naranjo, whose piece 'Río' draws from the Rio Grande soundscape and traditional Pueblo music.",
    price: "$20–$60",
    priceNum: 20,
    image: U("1508700115892-45ecd05ae2ad"),
    gradient: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
    featured: true,
    tags: ["classical", "orchestra", "world premiere"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "ABQ365",
    website: "https://popejoypresents.com",
    ticketUrl: "https://popejoypresents.com",
    accessibility: "Fully accessible; assisted listening devices available",
  },
  {
    id: "m22-yoga",
    title: "Petroglyph Yoga at Sunset",
    category: "Outdoors",
    date: "2026-03-22",
    time: "5:30 PM",
    endTime: "7:00 PM",
    location: "Petroglyph National Monument",
    address: "6001 Unser Blvd NW, Albuquerque, NM 87120",
    description:
      "Practice slow-flow yoga among 3,000-year-old rock carvings on the Petroglyph National Monument basalt fields. As the sun dips below the West Mesa, the sky turns deep orange. Bring your mat and water. All levels welcome.",
    price: "$15",
    priceNum: 15,
    image: "https://upload.wikimedia.org/wikipedia/commons/0/02/Petroglyph_National_Monument_Aerial_%2852260985771%29.jpg",
    gradient: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
    tags: ["yoga", "wellness", "petroglyphs", "sunset"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: false,
    source: "Meetup",
    website: "https://www.nps.gov/petr",
    accessibility: "Moderate walking on uneven volcanic rock",
  },

  // ═══════════════════════════════════════════════════════════
  // MARCH 28-29
  // ═══════════════════════════════════════════════════════════
  {
    id: "m28-1",
    title: "Rio Grande Jazz Festival",
    category: "Live Music",
    date: "2026-03-28",
    time: "2:00 PM",
    endTime: "9:00 PM",
    location: "Tingley Beach Park",
    address: "1800 Tingley Dr SW, Albuquerque, NM 87104",
    description:
      "Eight jazz acts over seven glorious hours beside the Rio Grande. Contemporary, Latin, and traditional jazz from local legends to touring artists. Bring a blanket; food trucks and craft vendors on site. One of ABQ's most scenic outdoor festivals.",
    price: "$22",
    priceNum: 22,
    image: U("1470229538611-c3a906b5e7d2"),
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)",
    featured: true,
    tags: ["jazz", "outdoor", "riverside", "food trucks"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "ABQ365",
    website: "https://abqjazzfest.org",
    ticketUrl: "https://abqjazzfest.org/tickets",
    accessibility: "Fully accessible park",
  },
  {
    id: "m28-2",
    title: "ABQ Spring Farmers Market",
    category: "Farmers Market",
    date: "2026-03-28",
    time: "7:30 AM",
    endTime: "12:00 PM",
    location: "Rail Yards, Barelas",
    address: "777 1st St SW, Albuquerque, NM 87102",
    description:
      "Spring's arrival brings 80+ New Mexico vendors to the iconic 1914 Rail Yards locomotive repair shops. Pick up heritage tomato starts, organic microgreens, fresh-ground coffee, Navajo fry bread, handmade soaps, and cut flower arrangements in a stunning industrial setting.",
    price: "Free",
    priceNum: 0,
    image: U("1488459716781-31db52582fe9"),
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    featured: true,
    tags: ["local produce", "fresh food", "crafts", "historic venue"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "The Paper ABQ",
    website: "https://railyardsmarket.org",
    accessibility: "Accessible historic industrial building",
  },
  {
    id: "m28-3",
    title: "Luke Bryan · Country on Tour",
    category: "Live Music",
    date: "2026-03-28",
    time: "7:30 PM",
    endTime: "10:30 PM",
    location: "Isleta Amphitheater",
    address: "5601 University Blvd SE, Albuquerque, NM 87106",
    description:
      "Country superstar Luke Bryan brings his arena tour to Isleta Amphitheater under the New Mexico stars. The open-air amphitheater on the banks of the Rio Grande is one of the country's great outdoor concert settings. Lawn seating available.",
    price: "$39–$150",
    priceNum: 39,
    image: U("1501386761578-eac5c94b800a"),
    gradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    featured: true,
    tags: ["country", "amphitheater", "outdoor"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "SeatGeek",
    website: "https://www.isletaamp.com",
    ticketUrl: "https://seatgeek.com/cities/albuquerque",
    accessibility: "ADA seats available; contact box office",
  },
  {
    id: "m28-4",
    title: "Meow Wolf ABQ Opening Night",
    category: "Arts & Culture",
    date: "2026-03-28",
    time: "6:00 PM",
    endTime: "11:00 PM",
    location: "Meow Wolf Albuquerque",
    address: "1975 Old Town Rd NW, Albuquerque, NM 87104",
    description:
      "The creators of Santa Fe's Omega Mart open their newest immersive art experience in Albuquerque. Step through portals into alien supermarkets, cosmic kitchens, and Southwestern dreamscapes created by 100+ NM artists. Grand opening: live DJs, cocktails, artist meet-and-greets.",
    price: "$35",
    priceNum: 35,
    image: "https://webassets.meowwolf.com/cdn.prod/5dad7a19f43e6f31a9e92718/5f80a2cc5d23e71099517470_MeowWolfTreehouse.jpg",
    gradient: "linear-gradient(135deg, #9333ea 0%, #ec4899 100%)",
    featured: true,
    tags: ["immersive", "art", "opening night"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "City of ABQ",
    website: "https://meowwolf.com",
    ticketUrl: "https://meowwolf.com/tickets",
    accessibility: "Fully accessible; sensory-friendly hours available",
  },
  {
    id: "m28-pickleball",
    title: "ABQ Pickleball Open",
    category: "Sports",
    date: "2026-03-28",
    time: "8:00 AM",
    endTime: "6:00 PM",
    location: "Jerry Cline Community Center",
    address: "8823 Horizon Blvd NE, Albuquerque, NM 87113",
    description:
      "New Mexico's biggest pickleball tournament with 400+ players competing in age and skill brackets from beginner to pro. Spectator day passes include exhibition matches, vendor village, and free clinics from certified instructors.",
    price: "Free to watch",
    priceNum: 0,
    image: U("1599058917212-d750089bc07e"),
    gradient: "linear-gradient(135deg, #eab308 0%, #16a34a 100%)",
    tags: ["tournament", "pickleball", "sports"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Eventbrite",
    website: "https://abqpickleball.com",
    accessibility: "Fully accessible courts and facilities",
  },
  {
    id: "m28-theater",
    title: "UNM Theater: Death of a Salesman",
    category: "Theater & Comedy",
    date: "2026-03-28",
    time: "7:00 PM",
    endTime: "10:00 PM",
    location: "Rodey Theatre, UNM",
    address: "203 Cornell Dr NE, Albuquerque, NM 87106",
    description:
      "UNM's Department of Theatre & Dance presents Arthur Miller's American masterpiece in a stunning new production that transplants Willy Loman's story to contemporary Albuquerque. Director Maria Padilla's vision transforms the classic into a vivid portrait of the modern Southwest.",
    price: "$15–$25",
    priceNum: 15,
    image: U("1503095396-9c0b0111a4be"),
    gradient: "linear-gradient(135deg, #292524 0%, #44403c 100%)",
    tags: ["theater", "drama", "UNM", "Arthur Miller"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "ABQ365",
    website: "https://theatredance.unm.edu",
    accessibility: "Fully accessible theater",
  },
  {
    id: "m29-food",
    title: "ABQ Food Truck Sunday Rally",
    category: "Food & Drink",
    date: "2026-03-29",
    time: "11:00 AM",
    endTime: "5:00 PM",
    location: "Balloon Fiesta Park",
    address: "5000 Balloon Fiesta Pkwy NE, Albuquerque, NM 87113",
    description:
      "30 of ABQ's most beloved food trucks gather for the weekly Sunday rally. Korean-NM fusion burritos, Nashville hot chicken, wood-fired pizza, vegan green chile bowls, churro ice cream, and craft beers from local breweries. Live acoustic music sets the scene.",
    price: "Free entry",
    priceNum: 0,
    image: U("1565557623262-b51c2513a641"),
    gradient: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
    tags: ["food trucks", "local eats", "craft beer"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "ABQToDo",
    website: "https://abqfoodtrucks.com",
    accessibility: "Paved parking lot, fully accessible",
  },
  {
    id: "m29-art",
    title: "Desert Light Exhibition Opening",
    category: "Arts & Culture",
    date: "2026-03-29",
    time: "10:00 AM",
    endTime: "5:00 PM",
    location: "UNM Art Museum",
    address: "203 Cornell Dr NE, Albuquerque, NM 87106",
    description:
      "Opening day of a landmark exhibition celebrating New Mexico light — the quality of luminescence that has drawn artists to the state for over a century. 120 works spanning landscape painting, experimental photography, and video installation.",
    price: "Free",
    priceNum: 0,
    image: U("1571115177098-24ec42ed204d"),
    gradient: "linear-gradient(135deg, #f97316 0%, #fbbf24 100%)",
    tags: ["art", "museum", "opening", "NM art"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "City of ABQ",
    website: "https://unmartmuseum.org",
    accessibility: "Fully accessible museum",
  },

  // ═══════════════════════════════════════════════════════════
  // APRIL 4-5
  // ═══════════════════════════════════════════════════════════
  {
    id: "a04-1",
    title: "Downtown Growers' Market — Opening Day",
    category: "Farmers Market",
    date: "2026-04-04",
    time: "8:00 AM",
    endTime: "12:00 PM",
    location: "Robinson Park",
    address: "810 Copper Ave NW, Albuquerque, NM 87102",
    description:
      "It's back! The Downtown Growers' Market kicks off its 30th anniversary season at Robinson Park — ABQ's longest-running, producer-only market. 80+ vendors with spring produce, fresh-cut flowers, organic seedlings, honey, artisan bread, and handcrafted goods every Saturday through November.",
    price: "Free",
    priceNum: 0,
    image: U("1464226184884-fa280b87c399"),
    gradient: "linear-gradient(135deg, #16a34a 0%, #65a30d 100%)",
    featured: true,
    tags: ["30th anniversary", "local", "producer-only", "opening day"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "The Paper ABQ",
    website: "https://www.downtowngrowers.org",
    accessibility: "Accessible park, paved paths",
  },
  {
    id: "a04-2",
    title: "Peso Pluma · Arena World Tour",
    category: "Live Music",
    date: "2026-04-04",
    time: "8:00 PM",
    endTime: "11:00 PM",
    location: "Isleta Amphitheater",
    address: "5601 University Blvd SE, Albuquerque, NM 87106",
    description:
      "Mexican superstar Peso Pluma brings his electrifying arena tour to Isleta Amphitheater. The corridos tumbados pioneer delivers a two-hour show with stunning production. Supporting acts include rising stars from the norteño and trap regional Mexican scene.",
    price: "$45–$180",
    priceNum: 45,
    image: U("1429962714451-bb934ecdc4ec"),
    gradient: "linear-gradient(135deg, #dc2626 0%, #7c3aed 100%)",
    featured: true,
    tags: ["regional Mexican", "corridos", "arena"],
    isKidFriendly: false,
    isOutdoor: true,
    isAccessible: true,
    source: "SeatGeek",
    website: "https://www.isletaamp.com",
    ticketUrl: "https://seatgeek.com/cities/albuquerque",
    accessibility: "ADA accessible; contact venue",
  },
  {
    id: "a05-1",
    title: "Rail Yards Market · Spring Opening",
    category: "Farmers Market",
    date: "2026-04-05",
    time: "9:00 AM",
    endTime: "2:00 PM",
    location: "Historic Rail Yards",
    address: "777 1st St SW, Albuquerque, NM 87102",
    description:
      "The Rail Yards Market celebrates its spring opening in Albuquerque's 1914 locomotive repair shops — a stunning market venue open only on Sundays. Local growers, artisans, restaurateurs, and live musicians fill the soaring machine shops with community energy.",
    price: "Free",
    priceNum: 0,
    image: U("1507003211169-0a1dd7228f2d"),
    gradient: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
    featured: true,
    tags: ["historic venue", "community", "local", "opening"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "The Paper ABQ",
    website: "https://railyardsmarket.org",
    accessibility: "Accessible historic building",
  },
  {
    id: "a05-2",
    title: "Green Chile Cheeseburger Smackdown",
    category: "Food & Drink",
    date: "2026-04-05",
    time: "11:00 AM",
    endTime: "6:00 PM",
    location: "Expo New Mexico",
    address: "300 San Pedro Dr NE, Albuquerque, NM 87108",
    description:
      "30 competing restaurants battle for ABQ's Best Green Chile Cheeseburger. Buy a tasting pass and vote for the People's Choice. Side competitions: best green chile stew, breakfast burrito, and 'most creative chile application.' Live mariachi. Marble Brewery cold on tap.",
    price: "$35 tasting pass",
    priceNum: 35,
    image: U("1568901346375-491d9cd1bdbf"),
    gradient: "linear-gradient(135deg, #16a34a 0%, #dc2626 100%)",
    featured: true,
    tags: ["green chile", "competition", "New Mexico cuisine"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "ABQ365",
    website: "https://abqgreenchileburgerfest.com",
    accessibility: "Accessible fairgrounds",
  },
  {
    id: "a05-3",
    title: "ABQ BioPark: Spring Baby Animal Day",
    category: "Family",
    date: "2026-04-05",
    time: "9:00 AM",
    endTime: "5:00 PM",
    location: "ABQ BioPark Zoo",
    address: "903 10th St SW, Albuquerque, NM 87102",
    description:
      "Spring babies have arrived! Meet newborn Nubian ibex, Humboldt penguin chicks, and African wild dog pups. Keeper talks every hour. Craft stations, face painting, and the new African Savanna exhibit make this ABQ's best family day.",
    price: "$15 adults / $9 kids",
    priceNum: 15,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/75/Albuquerque_Aquarium.jpg",
    gradient: "linear-gradient(135deg, #0891b2 0%, #0d9488 100%)",
    tags: ["zoo", "family", "baby animals", "spring"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "City of ABQ",
    website: "https://www.cabq.gov/culturalservices/biopark/zoo",
    accessibility: "Fully accessible zoo grounds",
  },

  // ═══════════════════════════════════════════════════════════
  // APRIL 11-12
  // ═══════════════════════════════════════════════════════════
  {
    id: "a11-2",
    title: "Machine Gun Kelly · Mainstream Sellout Tour",
    category: "Live Music",
    date: "2026-04-11",
    time: "7:00 PM",
    endTime: "10:30 PM",
    location: "Kiva Auditorium",
    address: "401 2nd St NW, Albuquerque, NM 87102",
    description:
      "Pop-punk icon Machine Gun Kelly brings his explosive live show to the historic Kiva Auditorium in Downtown ABQ. Known for one of music's highest-energy live performances, MGK delivers 2+ hours of hits. Jelly Roll opens at 7PM.",
    price: "$50–$130",
    priceNum: 50,
    image: U("1493225457124-a3eb161ffa5f"),
    gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
    featured: true,
    tags: ["pop-punk", "rock", "arena", "downtown"],
    isKidFriendly: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Bandsintown",
    website: "https://www.kiva-auditorium.com",
    ticketUrl: "https://www.bandsintown.com",
    accessibility: "ADA accessible; contact box office",
  },
  {
    id: "a11-stars",
    title: "Adobe & Stars Astronomy Night",
    category: "Outdoors",
    date: "2026-04-11",
    time: "8:00 PM",
    endTime: "11:30 PM",
    location: "Petroglyph National Monument",
    address: "6001 Unser Blvd NW, Albuquerque, NM 87120",
    description:
      "The ABQ Astronomy Society hosts monthly dark-sky stargazing on the West Mesa. Six research-grade telescopes reveal Saturn's rings, Jupiter's moons, and spring nebulae. NM boasts some of the darkest skies in the country — expert guides included.",
    price: "$12",
    priceNum: 12,
    image: U("1419242902214-272b3f66ee7a"),
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    featured: true,
    tags: ["astronomy", "dark sky", "telescope"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "Meetup",
    website: "https://abqastronomy.org",
    accessibility: "Flat desert terrain, some walking required",
  },
  {
    id: "a12-1",
    title: "Rio Grande Arts & Crafts Festival",
    category: "Arts & Culture",
    date: "2026-04-12",
    time: "10:00 AM",
    endTime: "6:00 PM",
    location: "Expo New Mexico",
    address: "300 San Pedro Dr NE, Albuquerque, NM 87108",
    description:
      "The Spring edition of the beloved Rio Grande Arts & Crafts Festival with 150 juried artists from across the country. Browse handcrafted jewelry, sculpture, ceramics, textiles, and fine art. Live music, chef demos, a Kids' Creation Station, and culinary tastings.",
    price: "$8 / Kids free",
    priceNum: 8,
    image: U("1416339442589-b0b46b0ff3cf"),
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    featured: true,
    tags: ["juried art", "crafts", "jewelry", "ceramics"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Visit ABQ",
    website: "https://riograndefestivals.com/spring-show",
    ticketUrl: "https://riograndefestivals.com/spring-show",
    accessibility: "Accessible fairgrounds",
  },

  // ═══════════════════════════════════════════════════════════
  // APRIL 18-19
  // ═══════════════════════════════════════════════════════════
  {
    id: "a18-2",
    title: "Mariachi Spectacular de Albuquerque",
    category: "Live Music",
    date: "2026-04-18",
    time: "6:00 PM",
    endTime: "10:00 PM",
    location: "Kiva Auditorium",
    address: "401 2nd St NW, Albuquerque, NM 87102",
    description:
      "One of the premier mariachi events in the Southwest brings together top professional ensembles from New Mexico, Arizona, and California. Jaw-dropping performances in colorful trajes de charro — soaring vocals and the sound of vihuela fill the historic Kiva.",
    price: "$25–$75",
    priceNum: 25,
    image: U("1460661419201-fd4cecdf8a8b"),
    gradient: "linear-gradient(135deg, #dc2626 0%, #fbbf24 100%)",
    featured: true,
    tags: ["mariachi", "Mexican culture", "live music"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "ABQ365",
    website: "https://mariachispectacular.com",
    ticketUrl: "https://mariachispectacular.com/tickets",
    accessibility: "Accessible auditorium",
  },
  {
    id: "a18-cycling",
    title: "Turquoise Trail Gran Fondo",
    category: "Sports",
    date: "2026-04-18",
    time: "7:00 AM",
    endTime: "3:00 PM",
    location: "Nob Hill (Start)",
    address: "Central Ave & Carlisle Blvd NE, Albuquerque, NM",
    description:
      "Annual road cycling event along the Turquoise Trail Scenic Byway through Sandia foothills and Tijeras Canyon. Three distances: 25, 50, and 100 miles. Supported rest stops with green chile energy snacks, mechanical support, and a finisher fiesta.",
    price: "$45–$80",
    priceNum: 45,
    image: U("1476480862126-209bfaa8edc8"),
    gradient: "linear-gradient(135deg, #0891b2 0%, #16a34a 100%)",
    tags: ["cycling", "gran fondo", "Turquoise Trail"],
    isKidFriendly: false,
    isOutdoor: true,
    isAccessible: false,
    source: "Eventbrite",
    website: "https://abqgranfondo.com",
    accessibility: "Road cycling event; physical demands required",
  },
  {
    id: "a19-comedy",
    title: "All-Star Comedy Night at Nob Hill",
    category: "Theater & Comedy",
    date: "2026-04-19",
    time: "7:00 PM",
    endTime: "10:00 PM",
    location: "The Box Performance Space",
    address: "1025 Lomas Blvd NW, Albuquerque, NM 87102",
    description:
      "Four touring comedians — including a Netflix special regular — take the stage at The Box, one of ABQ's best intimate comedy venues. From sharp cultural commentary to absurdist Southwest humor, this lineup covers all the bases. One of the month's hottest comedy tickets.",
    price: "$20",
    priceNum: 20,
    image: U("1516450360452-9312f5e86fc7"),
    gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
    tags: ["comedy", "stand-up", "touring", "intimate venue"],
    isKidFriendly: false,
    is21Plus: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Eventbrite",
    website: "https://www.eventbrite.com/d/nm--albuquerque/comedy/",
    ticketUrl: "https://www.eventbrite.com/d/nm--albuquerque/comedy/",
    accessibility: "Accessible venue, parking lot",
  },
  {
    id: "a19-salsa",
    title: "Salsa & Bachata Night",
    category: "Nightlife",
    date: "2026-04-19",
    time: "8:00 PM",
    endTime: "1:00 AM",
    location: "Casa de Benavidez",
    address: "8032 4th St NW, Albuquerque, NM 87114",
    description:
      "ABQ's most popular Latin dance night. Free beginner salsa lesson at 8 PM, social dancing 9 PM–1 AM with a live Latin band and DJ sets. The floor fills with everyone from first-timers to competition dancers sharing the joy of Latin rhythms.",
    price: "$15",
    priceNum: 15,
    image: U("1533174072545-7a4b6ad7a6c3"),
    gradient: "linear-gradient(135deg, #dc2626 0%, #f97316 100%)",
    tags: ["salsa", "bachata", "dancing", "Latin"],
    isKidFriendly: false,
    is21Plus: false,
    isOutdoor: false,
    isAccessible: true,
    source: "Meetup",
    website: "https://casadebenavidez.com",
    accessibility: "Accessible venue, parking lot",
  },

  // ═══════════════════════════════════════════════════════════
  // APRIL 24-25 — Gathering of Nations
  // ═══════════════════════════════════════════════════════════
  {
    id: "e24-1",
    title: "Gathering of Nations — The Last Dance",
    category: "Festival",
    date: "2026-04-24",
    endDate: "2026-04-25",
    time: "10:00 AM",
    endTime: "10:00 PM",
    location: "Tingley Coliseum, Expo NM",
    address: "300 San Pedro Dr NE, Albuquerque, NM 87108",
    description:
      "The world's largest Native American powwow — and its final edition. 'The Last Dance' brings together 800+ tribes and 3,000 dancers and singers from across North America for two unmissable days. Awe-inspiring traditional dances, drum competitions, crowning of Miss Indian World, Indian Traders Market, Stage 49 contemporary Indigenous music, and the Horse & Rider Regalia Parade.",
    price: "$20/day · $35 weekend",
    priceNum: 20,
    image: U("1506905925346-21bda4d32df4"),
    gradient: "linear-gradient(135deg, #92400e 0%, #dc2626 100%)",
    featured: true,
    tags: ["Native American", "powwow", "cultural", "The Last Dance", "historic"],
    isKidFriendly: true,
    isOutdoor: false,
    isAccessible: true,
    source: "Visit ABQ",
    website: "https://www.gatheringofnations.com",
    ticketUrl: "https://www.gatheringofnations.com/tickets",
    accessibility: "Accessible arena venue",
  },
  {
    id: "a25-symphony",
    title: "Symphony Under Stars: John Williams Night",
    category: "Live Music",
    date: "2026-04-25",
    time: "7:30 PM",
    endTime: "10:00 PM",
    location: "Balloon Fiesta Park",
    address: "5000 Balloon Fiesta Pkwy NE, Albuquerque, NM 87113",
    description:
      "The New Mexico Symphony Orchestra performs John Williams' most beloved film scores outdoors — Star Wars, Indiana Jones, Schindler's List, E.T. Bring a blanket, a picnic, and the whole family. Gates open at 6 PM; food vendors and wine available on site.",
    price: "$25 · $12 students",
    priceNum: 25,
    image: U("1508739773316-c4218c6546f4"),
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)",
    featured: true,
    tags: ["symphony", "film scores", "outdoor", "family"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "ABQ365",
    website: "https://nmsymphony.org",
    ticketUrl: "https://nmsymphony.org/tickets",
    accessibility: "Open field venue, accessible parking",
  },

  // ═══════════════════════════════════════════════════════════
  // MAY 2-3
  // ═══════════════════════════════════════════════════════════
  {
    id: "m02-1",
    title: "Cinco de Mayo Festival Preview",
    category: "Festival",
    date: "2026-05-02",
    time: "12:00 PM",
    endTime: "8:00 PM",
    location: "Old Town Albuquerque",
    address: "Old Town Plaza, Albuquerque, NM 87104",
    description:
      "Old Town kicks off Cinco de Mayo week with a live mariachi stage, ballet folklórico performances, traditional Mexican cuisine, artisan markets, and ABQ's famous lowrider car show starting at 2 PM. A celebration of the deep Mexican-American cultural roots of Nuevo México.",
    price: "Free",
    priceNum: 0,
    image: U("1543702054-5e85e40a04f3"),
    gradient: "linear-gradient(135deg, #dc2626 0%, #16a34a 100%)",
    featured: true,
    tags: ["Cinco de Mayo", "mariachi", "lowriders", "free"],
    isKidFriendly: true,
    isOutdoor: true,
    isAccessible: true,
    source: "Old Town ABQ",
    website: "https://www.albuquerqueoldtown.com/events/",
    accessibility: "Accessible historic plaza",
  },
  {
    id: "m03-2",
    title: "ABQ Hot Air Balloon Champagne Flight",
    category: "Outdoors",
    date: "2026-05-03",
    time: "6:00 AM",
    endTime: "9:00 AM",
    location: "Balloon Fiesta Park",
    address: "5000 Balloon Fiesta Pkwy NE, Albuquerque, NM 87113",
    description:
      "Albuquerque is the balloon capital of the world — experience it at sunrise. Rainbow Ryders' luxury flights launch at dawn, drift over the Rio Grande valley with the Sandia Mountains glowing pink, and land with a traditional champagne toast. Small groups of 4–12 passengers.",
    price: "$180/person",
    priceNum: 180,
    image: U("1472791108553-c9405341e956"),
    gradient: "linear-gradient(135deg, #0891b2 0%, #f97316 100%)",
    featured: true,
    tags: ["hot air balloon", "sunrise", "ABQ icon", "champagne"],
    isKidFriendly: false,
    isOutdoor: true,
    isAccessible: false,
    source: "Visit ABQ",
    website: "https://www.rainbowryders.com",
    ticketUrl: "https://www.rainbowryders.com/book",
    accessibility: "Requires ability to step into basket",
  },

  // ═══════════════════════════════════════════════════════════
  // MAY 15-16 — BOOTS IN THE PARK (REAL!)
  // ═══════════════════════════════════════════════════════════
  {
    id: "bitp-1",
    title: "Boots in the Park 2026 · Post Malone & Jelly Roll",
    category: "Festival",
    date: "2026-05-15",
    endDate: "2026-05-16",
    time: "12:00 PM",
    endTime: "11:00 PM",
    location: "Balloon Fiesta Park",
    address: "5000 Balloon Fiesta Pkwy NE, Albuquerque, NM 87113",
    description:
      "The biggest music event of the year in Albuquerque. Post Malone headlines Saturday; Jelly Roll headlines Friday. Also: Carín León, Jessie Murph, Koe Wetzel, Cody Jinks, The Band Perry, Randy Rogers Band, and 15+ more across multiple stages including the brand-new Texas Country Stage. Line dancing, whiskey & tequila tastings, craft food, immersive art installations. Don't miss this.",
    price: "$89–$350+",
    priceNum: 89,
    image: "https://bootsinthepark.com/wp-content/uploads/2025/07/Share.jpg",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
    featured: true,
    tags: ["Post Malone", "Jelly Roll", "country", "music festival", "multi-day"],
    isKidFriendly: false,
    is21Plus: false,
    isOutdoor: true,
    isAccessible: true,
    source: "SeatGeek",
    website: "https://www.visitalbuquerque.org/event/boots-in-the-park/61852/",
    ticketUrl: "https://www.vividseats.com/boots-in-the-park-tickets-albuquerque-balloon-fiesta-park-5-15-2026--concerts-music-festivals/production/6194492",
    accessibility: "Accessible grounds; ADA viewing areas available",
  },
];

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES: { label: EventCategory; emoji: string; color: string }[] = [
  { label: "Movie",          emoji: "🎬", color: "#6366f1" },
  { label: "Live Music",     emoji: "🎸", color: "#dc2626" },
  { label: "Festival",       emoji: "🎉", color: "#f97316" },
  { label: "Theater & Comedy", emoji: "🎭", color: "#7c3aed" },
  { label: "Farmers Market", emoji: "🌽", color: "#16a34a" },
  { label: "Arts & Culture", emoji: "🎨", color: "#ea580c" },
  { label: "Food & Drink",   emoji: "🍽️", color: "#ca8a04" },
  { label: "Outdoors",       emoji: "🌲", color: "#0891b2" },
  { label: "Sports",         emoji: "🏆", color: "#65a30d" },
  { label: "Community",      emoji: "🏘️", color: "#9333ea" },
  { label: "Nightlife",      emoji: "🌙", color: "#1d4ed8" },
  { label: "Family",         emoji: "👨‍👩‍👧", color: "#0d9488" },
];

// ─── Source meta ──────────────────────────────────────────────────────────────
export const SOURCE_META: Record<EventSource, { color: string; url: string }> = {
  "ABQ365":      { color: "#f97316", url: "https://www.visitalbuquerque.org/abq365/events/" },
  "The Paper ABQ": { color: "#3b82f6", url: "https://calendar.abq.news/" },
  "City of ABQ": { color: "#dc2626", url: "https://www.cabq.gov/events" },
  "Fandango":    { color: "#1d4ed8", url: "https://www.fandango.com/albuquerque_nm_movietimes" },
  "Bandsintown": { color: "#16a34a", url: "https://www.bandsintown.com/c/albuquerque-nm" },
  "Eventbrite":  { color: "#ff6b35", url: "https://www.eventbrite.com/d/nm--albuquerque/events/" },
  "ABQToDo":     { color: "#0891b2", url: "https://abqtodo.com/" },
  "Meetup":      { color: "#e11d48", url: "https://www.meetup.com/cities/us/nm/albuquerque/" },
  "SeatGeek":    { color: "#0ea5e9", url: "https://seatgeek.com/cities/albuquerque" },
  "Visit ABQ":   { color: "#7c3aed", url: "https://www.visitalbuquerque.org/abq365/events/" },
  "Old Town ABQ":{ color: "#b45309", url: "https://www.albuquerqueoldtown.com/events/" },
  "Downtown ABQ":{ color: "#64748b", url: "https://dtabqmainstreet.org/events" },
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
export function getEventHour(time: string): number {
  if (time === "Various showtimes") return 14; // treat movies as afternoon
  const p = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!p) return 12;
  let h = parseInt(p[1]);
  const period = p[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h;
}

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getUpcomingWeekend(): [string, string] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  let daysToSat = (6 - dow + 7) % 7;
  if (daysToSat === 0 && dow === 6) daysToSat = 0;
  else if (dow === 0) daysToSat = 6;
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return [formatDate(sat), formatDate(sun)];
}

// Accepts optional extra events (e.g. from Ticketmaster JSON) merged with static
export function getEventsForRange(start: string, end: string, extra: Event[] = []): Event[] {
  const all = extra.length ? mergeEvents(ALL_EVENTS, extra) : ALL_EVENTS;
  return all.filter((e) => {
    const eEnd = e.endDate || e.date;
    return eEnd >= start && e.date <= end;
  });
}

// Merge static + live events, deduplicate by title+date
export function mergeEvents(base: Event[], live: Event[]): Event[] {
  const seen = new Set(base.map(e => `${e.title.toLowerCase()}|${e.date}`));
  const newOnes = live.filter(e => !seen.has(`${e.title.toLowerCase()}|${e.date}`));
  return [...base, ...newOnes];
}

// Compute event dates from any event array
export function computeEventDates(events: Event[]): Set<string> {
  return new Set(
    events.flatMap((e) => {
      if (!e.endDate) return [e.date];
      const dates: string[] = [];
      const cur = new Date(e.date + "T12:00:00");
      const last = new Date(e.endDate + "T12:00:00");
      while (cur <= last) { dates.push(formatDate(cur)); cur.setDate(cur.getDate() + 1); }
      return dates;
    })
  );
}

export const EVENT_DATES = computeEventDates(ALL_EVENTS);

// Load live events from pre-baked Ticketmaster JSON (public/data/ticketmaster-events.json)
export async function fetchLiveEvents(): Promise<Event[]> {
  try {
    const res = await fetch("/data/ticketmaster-events.json");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Load places from pre-baked Google Places JSON (public/data/google-places.json)
export async function fetchLivePlaces(): Promise<unknown[]> {
  try {
    const res = await fetch("/data/google-places.json");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
