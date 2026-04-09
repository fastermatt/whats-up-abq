// ─── ABQ Venue Directory ──────────────────────────────────────────────────────
// Curated data for major Albuquerque event spaces.
// Used to power /venue/:slug pages with rich info + filtered event listings.

export interface Venue {
  /** URL-safe slug: must match slugifyVenue(venue.name) */
  slug: string;
  name: string;
  shortName?: string;
  address: string;
  neighborhood: string;
  website?: string;
  phone?: string;
  capacity?: string;
  description: string;
  /** Bullet highlights shown on the venue page */
  highlights: string[];
  /** Categories of events typically hosted here */
  eventTypes: string[];
  image?: string;
  /** Fallback gradient when no image */
  gradient: string;
  /** lat/lng for future map integration */
  lat?: number;
  lng?: number;
  /** Match strings: location names that appear on events at this venue */
  locationAliases: string[];
}

/** Convert a venue name (or event location) to a URL slug */
export function slugifyVenue(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Find a Venue by matching an event's location string against all aliases */
export function getVenueByLocation(location: string): Venue | undefined {
  const loc = location.toLowerCase().trim();
  return ABQ_VENUES.find((v) =>
    v.locationAliases.some((alias) => loc.includes(alias.toLowerCase()))
  );
}

/** Find a Venue by its slug */
export function getVenueBySlug(slug: string): Venue | undefined {
  return ABQ_VENUES.find((v) => v.slug === slug);
}

export const ABQ_VENUES: Venue[] = [
  {
    slug: "el-rey-theater",
    name: "El Rey Theater",
    address: "622 Central Ave SW, Albuquerque, NM 87102",
    neighborhood: "Downtown / EDo",
    website: "https://www.elreyabq.com",
    capacity: "500",
    description:
      "A beloved Albuquerque institution on historic Route 66, El Rey Theater has been the beating heart of the Duke City music scene since 1949. Originally a movie house, it was transformed into one of New Mexico's premier live music venues. Its intimate standing-room floor and balcony create an electric atmosphere for national touring acts, local legends, and everything in between. The vintage marquee out front is one of the most photographed signs in ABQ.",
    highlights: [
      "Historic 1949 venue on Route 66",
      "Capacity ~500 — intimate enough to feel every show",
      "Hosts national touring acts across rock, indie, metal, and hip-hop",
      "Full bar with local New Mexico craft beers",
      "Standing floor + balcony seating options",
    ],
    eventTypes: ["Live Music", "Nightlife", "Comedy"],
    gradient: "linear-gradient(135deg, #7c2d12 0%, #1c1917 100%)",
    lat: 35.0844,
    lng: -106.6625,
    locationAliases: ["el rey theater", "el rey theatre", "el rey abq", "elrey"],
  },
  {
    slug: "sunshine-theater",
    name: "Sunshine Theater",
    address: "120 Central Ave SW, Albuquerque, NM 87102",
    neighborhood: "Downtown",
    website: "https://www.sunshinetheaterlive.com",
    capacity: "850",
    description:
      "The Sunshine Theater is Downtown Albuquerque's largest indoor concert venue, hosting some of the biggest touring acts to visit New Mexico. Originally opened as a movie theater in the 1920s, the Sunshine underwent major renovations to become the general-admission live music powerhouse it is today. With a capacity of around 850, it occupies a sweet spot between intimate club and arena — loud, sweaty, and unforgettable. From metal and punk to hip-hop and electronic, if it's loud, it's probably been on the Sunshine stage.",
    highlights: [
      "ABQ's largest indoor standing venue (~850 cap)",
      "National headliners across all genres",
      "Legendary sound system and production quality",
      "Full bar — 21+ shows and all-ages shows both hosted",
      "Centrally located on Central Ave / Route 66",
    ],
    eventTypes: ["Live Music", "Nightlife", "Comedy", "Theater & Comedy"],
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
    lat: 35.0843,
    lng: -106.6506,
    locationAliases: ["sunshine theater", "sunshine theatre", "sunshine live"],
  },
  {
    slug: "sandia-casino-amphitheater",
    name: "Sandia Casino Amphitheater",
    shortName: "Sandia Amphitheater",
    address: "30 Rainbow Rd NE, Albuquerque, NM 87113",
    neighborhood: "North Albuquerque",
    website: "https://www.sandiacasino.com/entertainment",
    capacity: "4,000",
    description:
      "Set against the dramatic backdrop of the Sandia Mountains, the Sandia Casino Amphitheater is Albuquerque's premier outdoor summer concert destination. With room for up to 4,000 fans, it brings major national headliners to the high desert. The open-air setting and mountain views make even a so-so show feel special — and a great show feel transcendent. Operated by Sandia Pueblo, the venue is renowned for its professional production, ample parking, and full casino amenities next door.",
    highlights: [
      "Stunning Sandia Mountains backdrop",
      "Capacity 4,000 — ABQ's biggest outdoor summer venue",
      "Nationally touring headliners each summer",
      "Reserved seating + lawn general admission sections",
      "Full food, bar, and casino access",
    ],
    eventTypes: ["Live Music", "Festival", "Comedy"],
    gradient: "linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)",
    lat: 35.1563,
    lng: -106.5536,
    locationAliases: [
      "sandia casino amphitheater",
      "sandia casino amphitheatre",
      "sandia amphitheater",
      "sandia casino",
    ],
  },
  {
    slug: "isleta-amphitheater",
    name: "Isleta Amphitheater",
    address: "5601 University Blvd SE, Albuquerque, NM 87106",
    neighborhood: "South Valley",
    website: "https://www.isletaamphitheater.com",
    capacity: "12,500",
    description:
      "Isleta Amphitheater is New Mexico's largest outdoor concert venue, capable of hosting up to 12,500 fans for the biggest touring shows that visit the state. Operated by Live Nation on Isleta Pueblo land, the venue has hosted virtually every major touring act over the past two decades — from country superstars to legacy rock bands and pop icons. The massive lawn section is a summer staple for ABQ music lovers, and the covered pavilion offers reserved seating with sightlines to match.",
    highlights: [
      "New Mexico's largest concert venue (12,500 cap)",
      "Home to the biggest national touring acts",
      "Massive lawn + covered reserved pavilion seating",
      "Summer season May–October",
      "Operated by Live Nation on Isleta Pueblo land",
    ],
    eventTypes: ["Live Music", "Festival", "Comedy"],
    gradient: "linear-gradient(135deg, #065f46 0%, #1c1917 100%)",
    lat: 35.0218,
    lng: -106.6691,
    locationAliases: [
      "isleta amphitheater",
      "isleta amphitheatre",
      "isleta amp",
      "hard rock hotel & casino albuquerque amphitheater",
    ],
  },
  {
    slug: "kiva-auditorium",
    name: "Kiva Auditorium",
    address: "401 2nd St NW, Albuquerque, NM 87102",
    neighborhood: "Downtown",
    website: "https://www.conventioncenters.com/albuquerque",
    capacity: "2,400",
    description:
      "Part of the Albuquerque Convention Center complex, Kiva Auditorium is a 2,400-seat theater in the heart of Downtown ABQ. Named after the ceremonial chambers of Pueblo peoples, it hosts a diverse program including concerts, Broadway touring productions, lectures, graduations, and cultural events. With proper theater seating and excellent acoustics, it occupies the mid-size niche between the small clubs and the full outdoor amphitheaters.",
    highlights: [
      "Fully seated theater — 2,400 capacity",
      "Broadway touring shows, concerts, and cultural events",
      "Connected to the Albuquerque Convention Center",
      "Downtown location near hotels and restaurants",
    ],
    eventTypes: ["Theater & Comedy", "Live Music", "Arts & Culture", "Comedy"],
    gradient: "linear-gradient(135deg, #92400e 0%, #1c1917 100%)",
    lat: 35.0844,
    lng: -106.6516,
    locationAliases: ["kiva auditorium", "kiva", "albuquerque convention center"],
  },
  {
    slug: "popejoy-hall",
    name: "Popejoy Hall",
    address: "203 Cornell Dr NE, Albuquerque, NM 87131",
    neighborhood: "UNM / Nob Hill",
    website: "https://www.popejoypresents.com",
    capacity: "1,985",
    description:
      "Located on the University of New Mexico campus, Popejoy Hall is Albuquerque's home for performing arts. Since 1966 it has hosted world-class ballet, opera, Broadway touring productions, orchestral performances, and internationally acclaimed artists. The hall is operated by Popejoy Presents, the presenting arm of UNM, and is one of the finest mid-size concert halls in the Southwest. Its rich acoustics and elegant interior make it the go-to destination for classical, theatrical, and dance performances in ABQ.",
    highlights: [
      "Premier performing arts venue since 1966",
      "Broadway, ballet, opera, orchestra, and world music",
      "Exceptional acoustics — one of the best in the Southwest",
      "On the UNM campus, surrounded by cultural institutions",
      "Nearly 2,000-seat capacity with full theater seating",
    ],
    eventTypes: ["Theater & Comedy", "Arts & Culture", "Live Music"],
    gradient: "linear-gradient(135deg, #4c1d95 0%, #1c1917 100%)",
    lat: 35.0842,
    lng: -106.6189,
    locationAliases: [
      "popejoy hall",
      "popejoy",
      "popejoy presents",
      "university of new mexico popejoy",
    ],
  },
  {
    slug: "launchpad",
    name: "Launchpad",
    address: "618 Central Ave SW, Albuquerque, NM 87102",
    neighborhood: "Downtown / EDo",
    website: "https://www.launchpadrocks.com",
    capacity: "300",
    description:
      "Right next door to El Rey on Central Ave, Launchpad is Albuquerque's premiere underground rock and metal club. Raw, loud, and proudly DIY, Launchpad has been the launching pad (as advertised) for countless local bands and the intimate home for touring acts that prefer the sweaty, no-frills experience. With a capacity around 300, there are no bad spots in the room — you're always close to the stage. Launchpad is where ABQ's punk, metal, hardcore, and indie scenes live.",
    highlights: [
      "ABQ's top underground rock and metal club",
      "Intimate ~300 capacity — no bad spot in the house",
      "Raw, DIY atmosphere beloved by locals",
      "Hosts touring and local punk, metal, hardcore, indie",
      "Steps from El Rey Theater on Route 66",
    ],
    eventTypes: ["Live Music", "Nightlife"],
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    lat: 35.0844,
    lng: -106.6622,
    locationAliases: ["launchpad", "launch pad abq", "launchpad albuquerque"],
  },
  {
    slug: "meow-wolf-albuquerque",
    name: "Meow Wolf Albuquerque",
    shortName: "Meow Wolf ABQ",
    address: "3101 Coors Blvd NW, Albuquerque, NM 87120",
    neighborhood: "Westside",
    website: "https://meowwolf.com/visit/albuquerque",
    capacity: "1,500",
    description:
      "Meow Wolf Albuquerque — known as Convergence Station — is the Santa Fe-born art collective's immersive experience in the Duke City. While primarily an art installation, the venue regularly hosts events, DJ nights, live music, and special programming inside its mind-bending multi-dimensional world. Attending an event at Meow Wolf ABQ means your concert or party takes place inside one of the most visually spectacular environments in New Mexico.",
    highlights: [
      "Immersive art environment as your event backdrop",
      "Regular DJ nights, live music, and special events",
      "One of the most unique event spaces in New Mexico",
      "Westside location with ample parking",
    ],
    eventTypes: ["Nightlife", "Arts & Culture", "Live Music", "Festival"],
    gradient: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
    lat: 35.1371,
    lng: -106.7223,
    locationAliases: [
      "meow wolf albuquerque",
      "meow wolf abq",
      "convergence station",
    ],
  },
];
