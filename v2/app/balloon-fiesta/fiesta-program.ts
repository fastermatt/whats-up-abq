export type FiestaHighlight = {
  time: string
  name: string
}

export type MusicArtist = {
  name: string
  time: string
  spotifyUrl: string
  appleMusicUrl: string
}

export type FiestaDay = {
  date: string
  day: string
  dayNumber: number
  theme?: string
  highlights: FiestaHighlight[]
  officialUrl: string
  musicArtists?: MusicArtist[]
  musicNote?: string
}

const spotifySearch = (artist: string) =>
  `https://open.spotify.com/search/${encodeURIComponent(artist)}`

const appleMusicSearch = (artist: string) =>
  `https://music.apple.com/us/search?term=${encodeURIComponent(artist)}`

export const FIESTA_PROGRAM: FiestaDay[] = [
  {
    date: '2026-10-03',
    day: 'Sat, Oct 3',
    dayNumber: 1,
    theme: 'Opening day',
    highlights: [
      { time: '5:45am', name: 'Drone Light Show' },
      { time: '7:00am', name: 'Opening Ceremonies + Mass Ascension' },
      { time: '6:30pm', name: 'Twilight Twinkle Glow' },
      { time: '7:45pm', name: 'Drone Show + AfterGlow fireworks' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-1-schedule/',
  },
  {
    date: '2026-10-04',
    day: 'Sun, Oct 4',
    dayNumber: 2,
    theme: 'Balloons + wheels',
    highlights: [
      { time: '7:00am', name: 'Mass Ascension' },
      { time: '9:00am', name: 'Fiesta of Wheels Car Show' },
      { time: '6:30pm', name: 'Balloon Glow' },
      { time: '7:45pm', name: 'Drone Show + AfterGlow fireworks' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-2-schedule/',
  },
  {
    date: '2026-10-05',
    day: 'Mon, Oct 5',
    dayNumber: 3,
    theme: 'New Mexico Day',
    highlights: [
      { time: '5:45am', name: 'Drone Light Show' },
      { time: '7:00am', name: 'Balloon Launch' },
      { time: '8:00am', name: 'Fly-In Competition Launch' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-3-schedule/',
  },
  {
    date: '2026-10-06',
    day: 'Tue, Oct 6',
    dayNumber: 4,
    theme: 'Coca-Cola Day',
    highlights: [
      { time: '5:45am', name: 'Drone Light Show' },
      { time: '7:00am', name: 'Balloon Launch' },
      { time: '8:00am', name: 'Fly-In Competition Launch' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-4-schedule/',
  },
  {
    date: '2026-10-07',
    day: 'Wed, Oct 7',
    dayNumber: 5,
    theme: 'Flight of the Nations',
    highlights: [
      { time: '5:45am', name: 'Drone Light Show' },
      { time: '7:00am', name: 'Flight of the Nations Mass Ascension' },
      { time: '7:30am', name: 'Fiesta de Los Globitos' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-5-schedule/',
  },
  {
    date: '2026-10-08',
    day: 'Thu, Oct 8',
    dayNumber: 6,
    theme: 'Special Shapes',
    highlights: [
      { time: '7:00am', name: 'Special Shape Rodeo + Balloon Launch' },
      { time: '6:30pm', name: 'Special Shape Glowdeo' },
      { time: '7:45pm', name: 'Drone Show + AfterGlow fireworks' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-6-schedule/',
  },
  {
    date: '2026-10-09',
    day: 'Fri, Oct 9',
    dayNumber: 7,
    theme: 'Kids’ Day + Special Shapes',
    highlights: [
      { time: '4:30am', name: 'Kids’ Day goodie bags begin' },
      { time: '7:00am', name: 'Special Shape Rodeo + Balloon Launch' },
      { time: '6:30pm', name: 'Special Shape Glowdeo' },
      { time: '7:45pm', name: 'Drone Show + AfterGlow fireworks' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-7-schedule/',
  },
  {
    date: '2026-10-10',
    day: 'Sat, Oct 10',
    dayNumber: 8,
    theme: 'Music Fiesta + Night Magic',
    highlights: [
      { time: '7:00am', name: 'Mass Ascension' },
      { time: '3:00pm', name: 'Music Fiesta gates open' },
      { time: '6:30pm', name: 'Night Magic Balloon Glow' },
      { time: '9:00pm', name: 'Drone Show + AfterGlow fireworks' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-8-schedule/',
    musicNote: 'Music Fiesta requires its own ticket plus a separate general-admission ticket for the park.',
    musicArtists: [
      {
        name: 'Nathaniel Krantz',
        time: '4:00pm',
        spotifyUrl: spotifySearch('Nathaniel Krantz'),
        appleMusicUrl: appleMusicSearch('Nathaniel Krantz'),
      },
      {
        name: 'Dasha',
        time: '5:30pm',
        spotifyUrl: spotifySearch('Dasha'),
        appleMusicUrl: appleMusicSearch('Dasha'),
      },
      {
        name: 'Russell Dickerson',
        time: '7:30pm',
        spotifyUrl: spotifySearch('Russell Dickerson'),
        appleMusicUrl: appleMusicSearch('Russell Dickerson'),
      },
    ],
  },
  {
    date: '2026-10-11',
    day: 'Sun, Oct 11',
    dayNumber: 9,
    theme: 'Finale',
    highlights: [
      { time: '5:45am', name: 'Drone Light Show' },
      { time: '7:00am', name: 'Farewell Mass Ascension' },
    ],
    officialUrl: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/day-9-schedule/',
  },
]
