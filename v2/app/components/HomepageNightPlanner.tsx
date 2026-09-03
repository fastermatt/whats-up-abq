'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { EventImage } from '@/app/components/EventImage'
import styles from '@/app/HomepageRedesign.module.css'

export interface PlannerEvent {
  id: string
  title: string
  time: string | null
  venue: string | null
  category: string | null
  price: string | null
  imageUrl: string
  fallback: string
}

interface HomepageNightPlannerProps {
  dateLabel: string
  events: PlannerEvent[]
}

const COMPANY_WEIGHTS: Record<string, string[]> = {
  date: ['Music', 'Comedy', 'Arts & Theater', 'Food & Drink', 'Film'],
  friends: ['Music', 'Comedy', 'Sports', 'Festivals', 'Food & Drink'],
  kids: ['Family', 'Outdoor', 'Community', 'Festivals'],
  solo: ['Arts & Theater', 'Music', 'Film', 'Comedy', 'Outdoor'],
}

function priceNumber(price: string | null) {
  if (!price) return null
  if (/free/i.test(price)) return 0
  const match = price.match(/\$\s?(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function rankEvents(events: PlannerEvent[], company: string, budget: string, seed: number) {
  const preferred = COMPANY_WEIGHTS[company] ?? []
  const ranked = events.map((event, index) => {
    const price = priceNumber(event.price)
    const categoryScore = preferred.includes(event.category ?? '') ? 20 - preferred.indexOf(event.category ?? '') : 0
    const budgetScore = budget === 'free'
      ? price === 0 ? 30 : -30
      : budget === 'under-50'
        ? price === null || price <= 50 ? 12 : -20
        : price !== null && price > 25 ? 8 : 0
    const rotation = (index + seed) % Math.max(events.length, 1)
    return { event, score: categoryScore + budgetScore - rotation / 100 }
  })

  const strict = budget === 'free'
    ? ranked.filter(({ event }) => priceNumber(event.price) === 0)
    : budget === 'under-50'
      ? ranked.filter(({ event }) => {
          const price = priceNumber(event.price)
          return price === null || price <= 50
        })
      : ranked

  return (strict.length ? strict : ranked)
    .sort((a, b) => b.score - a.score)
    .map(({ event }) => event)
}

function summaryText(time: string, company: string, budget: string) {
  const timeLabel = time === 'hour' ? '1 hour' : time === 'evening' ? 'all evening' : '2–3 hours'
  const companyLabel = company === 'date' ? 'a date' : company === 'friends' ? 'friends' : company === 'kids' ? 'the kids' : 'just me'
  const budgetLabel = budget === 'free' ? 'free' : budget === 'splurge' ? 'worth a splurge' : 'under $50'
  return `${timeLabel} · ${companyLabel} · ${budgetLabel}`
}

export default function HomepageNightPlanner({ dateLabel, events }: HomepageNightPlannerProps) {
  const [time, setTime] = useState('2-3')
  const [company, setCompany] = useState('date')
  const [budget, setBudget] = useState('under-50')
  const [seed, setSeed] = useState(0)
  const [mobilePlannerOpen, setMobilePlannerOpen] = useState(false)
  const planRef = useRef<HTMLElement>(null)
  const mobilePlanRef = useRef<HTMLElement>(null)

  const plan = useMemo(() => {
    const max = time === 'hour' ? 1 : time === '2-3' ? 2 : 3
    return rankEvents(events, company, budget, seed).slice(0, max)
  }, [events, time, company, budget, seed])

  function buildPlan(event: React.FormEvent<HTMLFormElement>, target = planRef.current) {
    event.preventDefault()
    setSeed((current) => current + 1)
    if (window.matchMedia('(max-width: 980px)').matches && target) {
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    }
  }

  return (
    <section className={styles.hero} aria-labelledby="homepage-title">
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.dateLine}>{dateLabel}</p>
          <h2 id="homepage-title" className={styles.heroTitle}>Make tonight yours.</h2>
          <p className={styles.lede}>Three quick choices. One Albuquerque night.</p>

          <form className={`${styles.builder} ${styles.desktopBuilder}`} onSubmit={(event) => buildPlan(event)}>
            <div className={styles.field}>
              <label htmlFor="night-time">I have</label>
              <select id="night-time" value={time} onChange={(event) => setTime(event.target.value)}>
                <option value="2-3">2–3 hours</option>
                <option value="evening">All evening</option>
                <option value="hour">Just an hour</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="night-company">I&apos;m with</label>
              <select id="night-company" value={company} onChange={(event) => setCompany(event.target.value)}>
                <option value="date">A date</option>
                <option value="friends">Friends</option>
                <option value="kids">The kids</option>
                <option value="solo">Just me</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="night-budget">Keep it</label>
              <select id="night-budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                <option value="under-50">Under $50</option>
                <option value="free">Free</option>
                <option value="splurge">Worth a splurge</option>
              </select>
            </div>

            <div className={styles.heroActions}>
              <button
                type="submit"
                className={styles.primary}
                data-umami-event="homepage-plan-build"
                data-umami-event-time={time}
                data-umami-event-company={company}
                data-umami-event-budget={budget}
              >
                <span>Build my night</span>
                <span className={styles.buttonArrow} aria-hidden="true"><ArrowRight /></span>
              </button>
              <Link className={styles.browse} href="/events">I&apos;d rather browse everything</Link>
            </div>
          </form>
        </div>

        <article ref={planRef} className={styles.plan} aria-live="polite" aria-label="Tonight's event shortlist">
          <div className={styles.planHead}>
            <h3>Tonight&apos;s field notes</h3>
            <span>{summaryText(time, company, budget)}</span>
          </div>
          <div className={styles.steps}>
            {plan.length > 0 ? plan.map((event, index) => (
              <Link
                key={`${event.id}-${seed}`}
                href={`/events/${event.id}`}
                className={styles.step}
                data-umami-event="homepage-plan-event"
                data-umami-event-id={event.id}
              >
                <span className={styles.stepNum}>{index + 1}</span>
                <span className={styles.stepCopy}>
                  <span className={styles.stepMeta}>{event.time || 'Time TBA'} · {event.category || 'Local event'}</span>
                  <strong className={styles.stepTitle}>{event.title}</strong>
                  <span className={styles.stepPlace}>{event.venue || 'Albuquerque'}</span>
                </span>
                <EventImage
                  src={event.imageUrl}
                  fallback={event.fallback}
                  alt={`Photo for ${event.title}`}
                  className={styles.stepImage}
                  width={240}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                />
              </Link>
            )) : (
              <div className={styles.emptyPlan}>
                Tonight&apos;s listings are still being updated. Browse the full calendar for what&apos;s next.
              </div>
            )}
          </div>
          <Link className={styles.planLink} href="/tonight">
            Open all of tonight <ArrowRight aria-hidden="true" />
          </Link>
        </article>

        <details
          className={styles.mobilePlanner}
          open={mobilePlannerOpen}
          onToggle={(event) => setMobilePlannerOpen(event.currentTarget.open)}
        >
          <summary className={styles.mobilePlannerSummary}>
            <span className={styles.mobilePlannerSummaryIcon} aria-hidden="true"><SlidersHorizontal /></span>
            <span>
              <strong>Plan it for me</strong>
              <small>Three choices, then a short list</small>
            </span>
            <ChevronDown className={styles.mobilePlannerChevron} aria-hidden="true" />
          </summary>

          <div className={styles.mobilePlannerBody}>
            <form className={styles.mobileBuilder} onSubmit={(event) => buildPlan(event, mobilePlanRef.current)}>
              <div className={styles.field}>
                <label htmlFor="mobile-night-time">I have</label>
                <select id="mobile-night-time" value={time} onChange={(event) => setTime(event.target.value)}>
                  <option value="2-3">2–3 hours</option>
                  <option value="evening">All evening</option>
                  <option value="hour">Just an hour</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="mobile-night-company">I&apos;m with</label>
                <select id="mobile-night-company" value={company} onChange={(event) => setCompany(event.target.value)}>
                  <option value="date">A date</option>
                  <option value="friends">Friends</option>
                  <option value="kids">The kids</option>
                  <option value="solo">Just me</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="mobile-night-budget">Keep it</label>
                <select id="mobile-night-budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                  <option value="under-50">Under $50</option>
                  <option value="free">Free</option>
                  <option value="splurge">Worth a splurge</option>
                </select>
              </div>
              <button
                type="submit"
                className={styles.mobilePlannerButton}
                data-umami-event="homepage-plan-build"
                data-umami-event-time={time}
                data-umami-event-company={company}
                data-umami-event-budget={budget}
              >
                Refresh my picks
                <ArrowRight aria-hidden="true" />
              </button>
            </form>

            <article ref={mobilePlanRef} className={styles.mobilePlan} aria-live="polite" aria-label="Your suggested events tonight">
              <p className={styles.mobilePlanLabel}>Your short list · {summaryText(time, company, budget)}</p>
              {plan.length > 0 ? plan.map((event) => (
                <Link
                  key={`mobile-${event.id}-${seed}`}
                  href={`/events/${event.id}`}
                  className={styles.mobilePlanEvent}
                  data-umami-event="homepage-plan-event"
                  data-umami-event-id={event.id}
                >
                  <EventImage
                    src={event.imageUrl}
                    fallback={event.fallback}
                    alt=""
                    className={styles.mobilePlanImage}
                    width={176}
                    loading="lazy"
                  />
                  <span>
                    <small>{event.time || 'Time TBA'} · {event.category || 'Local event'}</small>
                    <strong>{event.title}</strong>
                    <em>{event.venue || 'Albuquerque'}</em>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              )) : (
                <p className={styles.emptyPlan}>Tonight&apos;s listings are still being updated.</p>
              )}
              <Link className={styles.mobilePlanAll} href="/tonight">See everything tonight <ArrowRight aria-hidden="true" /></Link>
            </article>
          </div>
        </details>
      </div>
    </section>
  )
}
