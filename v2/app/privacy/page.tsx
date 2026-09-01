import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy, ABQ Unplugged',
  description:
    'Privacy policy for ABQ Unplugged, a free community events aggregator for Albuquerque, NM. We don\'t sell your data, we just help you find things to do.',
  openGraph: {
    title: 'Privacy Policy, ABQ Unplugged',
    description:
      'Privacy policy for ABQ Unplugged, a free community events aggregator for Albuquerque, NM.',
    url: 'https://abqunplugged.com/privacy',
  },
  alternates: {
    canonical: 'https://abqunplugged.com/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const revalidate = false

export default function PrivacyPage() {
  return (
    <main id="main" className="min-h-dvh bg-cream text-ink">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-terra hover:text-terra-hover transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* H1 */}
        <h1
          className="text-4xl md:text-5xl font-black leading-tight mb-3 text-ink"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Privacy Policy
        </h1>

        <p className="text-sm text-ink-light mb-10">
          Last updated: April 19, 2026
        </p>

        {/* Intro */}
        <p className="text-base md:text-lg leading-relaxed mb-10 text-ink-mid">
          ABQ Unplugged is a free community tool. Our whole purpose is to make it
          easy to find events happening in Albuquerque and get you to them, not to
          collect your data, profile your interests, or sell anything about you to
          anyone. This policy is short because there isn&apos;t much to say.
        </p>

        {/* Sections */}
        <div className="space-y-10">

          {/* What we are */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              What ABQ Unplugged is
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              ABQ Unplugged is an event aggregator. We pull upcoming event listings
              from sources like Ticketmaster, SeatGeek, Eventbrite, Bandsintown,
              the National Hispanic Cultural Centre, and local Albuquerque venues
              and organizations, then display them in one place so you don&apos;t
              have to hunt across a dozen different sites. We don&apos;t host events
              ourselves, and every listing links directly to the original source so
              you can get tickets or learn more there.
            </p>
          </section>

          {/* Our mission */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Our mission: send you somewhere else
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              Most websites are built to keep you on them as long as possible.
              We&apos;re doing the opposite. ABQ Unplugged exists to push traffic
              to event organizers, venues, and ticket sellers, not to accumulate
              it. Every event card has a link out to the source. That&apos;s the
              goal: you find something you&apos;re excited about, you click
              through, and you show up.
            </p>
          </section>

          {/* What we collect */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              What data we collect
            </h2>
            <p className="text-base leading-relaxed text-ink-mid mb-4">
              We keep this minimal by design.
            </p>
            <ul className="space-y-3 text-base text-ink-mid">
              <li className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-terra flex-shrink-0 mt-[0.45rem]" />
                <span>
                  <strong className="text-ink">No account required.</strong>{' '}
                  You can browse every event on the site without creating an account
                  or providing any personal information.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-terra flex-shrink-0 mt-[0.45rem]" />
                <span>
                  <strong className="text-ink">Optional accounts.</strong>{' '}
                  If you create an account (to save events, check in, or track
                  your activity), we store your email address and the activity
                  data you create. You can delete your account at any time by
                  contacting us.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-terra flex-shrink-0 mt-[0.45rem]" />
                <span>
                  <strong className="text-ink">Anonymous analytics.</strong>{' '}
                  We use first-party analytics to understand which pages and
                  event actions are useful. A random browser identifier and a
                  30-minute visit identifier are stored in your browser; we do
                  not fingerprint you or store newsletter email addresses in
                  analytics. Known crawler traffic is reported separately, raw
                  analytics are deleted after 30 days, and the data is not shared
                  with advertisers.
                </span>
              </li>
            </ul>
          </section>

          {/* Cookies */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Cookies
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              We use session cookies for basic site functionality, for example,
              keeping you signed in if you have an account. We do not use
              advertising cookies, tracking pixels, or third-party behavioral
              targeting. We do not sell or share any cookie data with advertisers
              or data brokers.
            </p>
          </section>

          {/* Third-party links */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Third-party links
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              Every event on ABQ Unplugged links to an external site, Ticketmaster,
              Eventbrite, SeatGeek, a venue&apos;s website, or another ticket
              platform. Once you click through to one of those sites, their own
              privacy policies apply. We encourage you to review the privacy
              practices of any external site before purchasing tickets or creating
              an account there.
            </p>
          </section>

          {/* Children */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Children
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              ABQ Unplugged is appropriate for all ages, we list family-friendly
              events alongside everything else. We do not knowingly collect personal
              information from children under 13. If a child has created an account
              and you&apos;d like it removed, contact us at the address below.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Contact
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              Questions, requests, or concerns about this policy:
            </p>
            <p className="text-base text-ink-mid mt-2">
              Matt Carlson
              <br />
              <a
                href="mailto:4mattcarlson@gmail.com"
                className="text-terra hover:text-terra-hover font-semibold underline underline-offset-2 transition-colors"
              >
                4mattcarlson@gmail.com
              </a>
            </p>
          </section>

          {/* Updates */}
          <section className="pb-8 border-b border-sand-light">
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Updates to this policy
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              If we change this policy in a meaningful way, we&apos;ll update the
              date at the top of this page. We don&apos;t anticipate many changes
             , the site&apos;s privacy stance is pretty baked into what it is.
            </p>
          </section>

        </div>

        {/* Back to events CTA */}
        <div className="mt-8">
          <Link
            href="/events"
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-terra text-white font-semibold text-sm hover:bg-terra-hover transition-all duration-300 hover:shadow-lg hover:shadow-terra/20"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Browse Events
          </Link>
        </div>
      </div>
    </main>
  )
}
