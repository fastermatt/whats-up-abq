import Image from 'next/image'
import { ArrowDown, ArrowUpRight, BusFront, CalendarDays, MapPin, Navigation } from 'lucide-react'

const QUICK_LINKS = [
  {
    label: 'Official schedule',
    detail: 'Live field program',
    href: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/',
    icon: CalendarDays,
  },
  {
    label: 'Park & Ride',
    detail: 'Runs 6 of 9 days',
    href: 'https://www.balloonfiesta.com/Park-Ride',
    icon: BusFront,
  },
  {
    label: 'Navigate with Waze',
    detail: 'Live traffic routing',
    href: 'https://www.waze.com/ul?q=Balloon%20Fiesta%20Park%2C%20Albuquerque%2C%20NM&navigate=yes',
    icon: Navigation,
  },
] as const

export function BalloonFiestaHero({ image }: { image: string }) {
  return (
    <header className="relative isolate overflow-hidden bg-[#1d1917] text-cream">
      <div className="absolute inset-0">
        <Image
          src={image}
          alt="Mass ascension at the Albuquerque International Balloon Fiesta"
          fill
          priority
          className="object-cover object-[62%_42%] sm:object-[68%_44%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,19,17,0.98)_0%,rgba(24,19,17,0.92)_36%,rgba(24,19,17,0.34)_72%,rgba(24,19,17,0.2)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(24,19,17,0.95)_0%,transparent_38%,rgba(24,19,17,0.1)_100%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_center,#fff_0.7px,transparent_0.8px)] [background-size:5px_5px]" />
      </div>

      <div aria-hidden="true" className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-white/15 sm:h-[30rem] sm:w-[30rem]" />
      <div aria-hidden="true" className="absolute -right-6 top-28 h-44 w-44 rounded-full border border-white/10 sm:h-[22rem] sm:w-[22rem]" />

      <div className="relative mx-auto flex min-h-[650px] max-w-6xl flex-col justify-between px-4 pb-5 pt-16 sm:min-h-[620px] sm:px-6 sm:pb-7 sm:pt-20 lg:px-4">
        <div className="max-w-3xl animate-hero-text">
          <div className="mb-7 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-terra-light/40 bg-terra/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd7cb] backdrop-blur-sm">
              Independent local companion
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cream/65">October 3–11, 2026</span>
          </div>

          <h1 className="max-w-3xl text-[clamp(3.25rem,8vw,6.8rem)] font-black leading-[0.88] tracking-[-0.065em] text-white" style={{ fontFamily: 'var(--font-epilogue)' }}>
            The sky is only
            <span className="block font-serif font-normal italic tracking-[-0.045em] text-terra-light">the beginning.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base font-medium leading-relaxed text-cream/78 sm:text-lg">
            Start with Balloon Fiesta. Then let us plan the rest of your Albuquerque day—breakfast, museums, chile, the tram, local events, and a backup when the wind wins.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#day-planner" className="group inline-flex items-center gap-2 rounded-full bg-terra-light px-5 py-3 text-sm font-black text-[#251b18] shadow-[0_12px_35px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:bg-white">
              Build my Fiesta day <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
            </a>
            <a href="https://www.balloonfiesta.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:border-white/55 hover:bg-black/35">
              Go to the official Fiesta site <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-12 grid gap-2.5 animate-hero-row sm:grid-cols-[1.25fr_repeat(3,1fr)]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/30 p-3.5 backdrop-blur-md">
            <MapPin className="h-5 w-5 shrink-0 text-terra-light" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cream/45">Balloon Fiesta Park</p>
              <p className="mt-0.5 text-xs font-bold text-white">4401 Alameda Blvd NE</p>
            </div>
          </div>
          {QUICK_LINKS.map(({ label, detail, href, icon: Icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-2xl border border-white/15 bg-black/30 p-3.5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-terra-light/65 hover:bg-black/45">
              <Icon className="h-5 w-5 shrink-0 text-terra-light" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-xs font-black text-white">{label} <ArrowUpRight className="h-3 w-3 opacity-55 transition group-hover:opacity-100" /></p>
                <p className="mt-0.5 text-[10px] font-medium text-cream/50">{detail}</p>
              </div>
            </a>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-medium leading-relaxed text-cream/45">
          ABQ Unplugged is an independent Albuquerque guide and is not affiliated with Balloon Fiesta. The official Fiesta site and app are the authority for tickets, schedules, weather decisions, and live event status.
        </p>
      </div>
    </header>
  )
}
