/**
 * SEO landing page: Outdoor Activities in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Outdoor Activities in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Hiking, biking, the Bosque trail, Petroglyph National Monument — find outdoor events and activities in Albuquerque. Updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/outdoor-activities',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Outdoor Activities in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/outdoor-activities' },
}

const FAQS = [
  {
    q: 'What\'s the best easy hike near Albuquerque?',
    a: 'The Pino Trail at the foot of the Sandias. It\'s about three miles round trip, moderate. Or the Piedra Lisa Trail, which is shorter. Both have great views. Get there early to find parking.',
  },
  {
    q: 'Can I bike the Bosque Trail?',
    a: 'Yes. The trail is mostly paved and flat. You can go for miles. There are access points at Alameda, Montaño, and Rio Bravo. It\'s popular but not crazy crowded.',
  },
  {
    q: 'Is the Sandia Peak Tram worth it?',
    a: 'Yeah, especially at sunset. But it\'s expensive, like $30 round trip. If you\'re fit, hike up instead. The La Luz Trail is tough but you earn the view.',
  },
]

const RELATED_LINKS = [
  { name: 'Cibola National Forest', url: 'https://www.fs.usda.gov/cibola', description: 'Sandia Mountains hiking, camping, and wildlife — right in ABQ\'s backyard.' },
  { name: 'City of ABQ: Parks & Recreation', url: 'https://www.cabq.gov/parksandrecreation', description: 'City parks, trails, and recreation programs including Bosque access points.' },
  { name: 'Petroglyph National Monument', url: 'https://www.nps.gov/petr/index.htm', description: 'Ancient carvings on volcanic rock on ABQ\'s west side — free and genuinely strange.' },
  { name: 'NM Tourism: Outdoor Adventures', url: 'https://www.newmexico.org/things-to-do/outdoor-adventures/', description: 'State tourism guide to hiking, biking, and outdoor activities across New Mexico.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Outdoor', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'outdoor-activities',
        heading: 'Outdoor Activities in Albuquerque',
        lede: `${events.length} outdoor events — hiking, biking, festivals, and everything the desert has to offer.`,
        intro: 'You\'re thirty minutes from the Sandia Mountains. People who live here forget that. They complain about the city noise, but they don\'t drive up the tram or hike the La Luz Trail when it\'s open. That\'s crazy. The Sandias are right there. Bike trails, hiking, rock climbing. You can go from your front door to a pine forest at 10,000 feet in less than an hour. And that\'s just the mountains. The Bosque is a forest of cottonwoods along the Rio Grande. It\'s flat, it\'s easy, it\'s perfect for a walk or a bike ride. You might see eagles. You might see coyotes. You\'ll definitely see runners and dog walkers. The Petroglyph National Monument is on the west side. You can hike through volcanic rock and see ancient carvings. It\'s free, it\'s strange, it\'s one of the most underrated things in the city. Then there\'s the Balloon Fiesta Park – even when there\'s no balloons, it\'s huge, open, good for kite flying or just staring at the sky. The outdoor scene in Albuquerque is not just about the big national parks. It\'s about the daily access. You can walk out your door and be on a trail. No crowds. No permits. Just the desert and the mountains. I sometimes go to the Sandia Crest just to watch the city lights come on. That\'s a thing you can do. Not many cities have that.',
        introExtra: 'My favorite outdoor thing in Albuquerque is the Bosque Trail from Alameda down to Rio Bravo. It\'s about 16 miles, but you don\'t have to do the whole thing. I ride my bike on a Sunday morning. The light through the cottonwoods is unreal. There\'s a stretch where the river is close enough you can hear it. I stop at a bench and just sit. No phone. No noise. It\'s free. It\'s right here. Why don\'t more people do this?',
        emptyHeading: 'No outdoor events listed right now',
        emptyBody: 'New events added daily — check back soon.',
        breadcrumbLabel: 'Outdoor Activities',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
