'use client'

import { ArrowUpRight, CalendarDays, Clock3, Headphones, Music2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'
import { FIESTA_PROGRAM } from './fiesta-program'

function safeSource(source: string): string {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(source) ? source : 'direct'
}

export function FiestaAtAGlance({ source }: { source: string }) {
  const cleanSource = safeSource(source)

  function trackProgram(date: string, target: string) {
    trackEvent('fiesta_program_click', { date, target, source: cleanSource })
  }

  function trackArtist(artist: string, service: 'spotify' | 'apple_music') {
    trackEvent('music_artist_click', { artist, service, date: '2026-10-10', source: cleanSource })
  }

  return (
    <section aria-labelledby="fiesta-glance-heading" className="overflow-hidden rounded-[1.75rem] border border-sand-mid bg-[#211c19] text-cream shadow-[0_20px_55px_rgba(74,63,58,0.09)]">
      <div className="border-b border-white/10 px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-terra-light">
              <CalendarDays className="h-4 w-4" /> Official field highlights
            </p>
            <h2 id="fiesta-glance-heading" className="mt-1 text-2xl font-black tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Nine days at a glance
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/65">
              The big moments worth planning around. Times come from Balloon Fiesta’s official 2026 schedule and can still change with weather or operations.
            </p>
          </div>
          <a href="https://www.balloonfiesta.com/plan-your-visit/event-schedule/" target="_blank" rel="noopener noreferrer" onClick={() => trackProgram('all', 'official-full-schedule')} className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-terra-light hover:text-white">
            Full official schedule <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {FIESTA_PROGRAM.map((day) => (
          <article
            key={day.date}
            className={`bg-[#211c19] p-5 ${
              day.musicArtists
                ? 'sm:col-span-2 lg:col-span-2'
                : day.dayNumber === 9
                  ? 'sm:col-span-2 lg:col-span-3'
                  : ''
            }`}
          >
            <div className={day.musicArtists ? 'grid gap-6 lg:grid-cols-[0.75fr_1.25fr]' : ''}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-cream/40">Day {day.dayNumber}</span>
                    <h3 className="mt-0.5 text-base font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>{day.day}</h3>
                    {day.theme && <p className="mt-0.5 text-xs font-bold text-sky-gold">{day.theme}</p>}
                  </div>
                  <a href={day.officialUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open the official schedule for ${day.day}`} onClick={() => trackProgram(day.date, 'official-day-schedule')} className="rounded-full border border-white/15 p-2 text-cream/60 transition hover:border-terra-light hover:text-terra-light">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <ul className={`mt-4 space-y-2.5 ${day.dayNumber === 9 ? 'sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-2.5 sm:space-y-0' : ''}`}>
                  {day.highlights.map((highlight) => (
                    <li key={`${highlight.time}-${highlight.name}`} className="flex items-start gap-2.5 text-xs leading-snug">
                      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terra-light" />
                      <span className="w-14 shrink-0 font-bold text-cream/45">{highlight.time}</span>
                      <span className="font-semibold text-cream/88">{highlight.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {day.musicArtists && (
                <div className="rounded-2xl border border-sky-gold/30 bg-sky-gold/[0.08] p-4 sm:p-5">
                  <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-gold">
                    <Music2 className="h-4 w-4" /> Confirmed Music Fiesta lineup
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {day.musicArtists.map((artist) => (
                      <div key={artist.name} className="rounded-xl border border-white/10 bg-black/15 p-3">
                        <p className="text-[10px] font-bold text-terra-light">{artist.time}</p>
                        <h4 className="mt-0.5 text-sm font-black">{artist.name}</h4>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <a href={artist.spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackArtist(artist.name, 'spotify')} className="inline-flex items-center gap-1 rounded-full bg-[#1DB954] px-2.5 py-1.5 text-[10px] font-extrabold text-black transition hover:brightness-110">
                            <Headphones className="h-3 w-3" /> Spotify
                          </a>
                          <a href={artist.appleMusicUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackArtist(artist.name, 'apple_music')} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-extrabold text-black transition hover:bg-cream">
                            <Music2 className="h-3 w-3" /> Apple Music
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  {day.musicNote && <p className="mt-3 text-[11px] leading-relaxed text-cream/55">{day.musicNote}</p>}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-cream/50 sm:px-7">
        The named 2026 Main Street Stage lineup is not published yet. We’ll add those artists when Balloon Fiesta does; until then, “Entertainment at the Main Street Stage” stays exactly that.
      </div>
    </section>
  )
}
