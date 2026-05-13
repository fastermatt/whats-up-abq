/**
 * christian-artists.ts
 *
 * Canonical list of Christian music artists used to auto-tag events.
 * Matching is case-insensitive substring — "for king & country" matches
 * a title like "For King + Country - Live in Albuquerque".
 *
 * To add an artist: append to the relevant section below and re-run
 * scripts/tag-christian-music.mjs to backfill existing events.
 *
 * Sources: K-LOVE, GMA/Dove Awards rosters, Winter Jam lineups,
 * Wikipedia CCM/Christian rock lists, Bandsintown Christian genre.
 */

// Exported as lowercase strings — matching code does .toLowerCase() on both sides
export const CHRISTIAN_ARTISTS: readonly string[] = [
  // ── Contemporary Worship ────────────────────────────────────────────────────
  'hillsong united',
  'hillsong worship',
  'hillsong young & free',
  'hillsong',
  'elevation worship',
  'bethel music',
  'bethel worship',
  'jesus culture',
  'maverick city music',
  'upperroom',
  'gateway worship',
  'north point worship',
  'planetshakers',
  'housefires',
  'passion',
  'passion worship',
  'christ fellowship worship',
  'kari jobe',
  'cody carnes',
  'corey asbury',
  'kristene dimarco',
  'amanda cook',
  'william matthews',
  'steffany gretzinger',
  'josh baldwin',
  'john mark mcmillan',
  'sean feucht',
  'kim walker-smith',
  'martin smith',
  'delirious',
  'tasha cobbs leonard',
  'travis greene',
  'israel houghton',
  'new breed',

  // ── CCM / Pop ───────────────────────────────────────────────────────────────
  'chris tomlin',
  'lauren daigle',
  'mercyme',
  'mercy me',
  'casting crowns',
  'matthew west',
  'crowder',
  'david crowder band',
  'zach williams',
  'brandon lake',
  'tobymac',
  'toby mac',
  'jeremy camp',
  'anne wilson',
  'katy nichole',
  'we the kingdom',
  'dante bowe',
  'phil wickham',
  'amy grant',
  'michael w. smith',
  'steven curtis chapman',
  'mandisa',
  'francesca battistelli',
  'britt nicole',
  'natalie grant',
  'ellie holcomb',
  'mark schultz',
  'sidewalk prophets',
  '10th avenue north',
  'tenth avenue north',
  'big daddy weave',
  'danny gokey',
  'jordan feliz',
  'colton dixon',
  'plumb',
  'group 1 crew',
  'meredith andrews',
  'all sons & daughters',
  'rend collective',
  'for king & country',
  'for king and country',
  'tauren wells',
  'ben fuller',
  'caleb and john',
  'cece winans',
  'cece winans',
  'kirk franklin',
  'tamela mann',
  'hezekiah walker',
  'fred hammond',
  'newsong',
  'the newsboys',
  'newsboys',
  'forrest frank',
  'hulvey',
  'emerson day',
  'evan craft',
  'ryan stevenson',
  'jason gray',
  'mike donehey',
  'andrew peterson',
  'david dunn',
  'unspoken',
  'blanca',
  'jasmine murray',
  'jenny and tyler',
  'the young escape',
  'citizens',
  'citizens & saints',
  'the modern post',
  'ghost ship',

  // ── Christian Rock / Alternative ────────────────────────────────────────────
  'skillet',
  'switchfoot',
  'third day',
  'audio adrenaline',
  'dc talk',
  'dcTalk',
  'jars of clay',
  'relient k',
  'thousand foot krutch',
  'disciple',
  'kutless',
  'building 429',
  'flyleaf',
  'lacey sturm',
  'fireflight',
  'superchick',
  'pillar',
  'hawk nelson',
  'remedy drive',
  'seventh day slumber',
  'stryper',
  'petra',
  'white heart',
  'newsboys united',
  'red (christian band)',
  'stellar kart',
  'family force 5',
  'haste the day',
  'the letter black',
  'decypher down',
  'paramore (christian)',
  'esterlyn',
  'tenth avenue north',
  'anberlin',
  'sanctus real',
  'downhere',
  'barlow girl',
  'superchick',
  'krystal meyers',
  'everyday sunday',
  'the afters',
  'addison road',
  'leeland',
  'needtobreathe',
  'need to breathe',

  // ── Christian Hip-Hop ────────────────────────────────────────────────────────
  'lecrae',
  'andy mineo',
  'trip lee',
  'kb (christian)',
  'nf (christian rapper)',
  'nf',
  'derek minor',
  'propaganda (christian)',
  'social club misfits',
  'flame',
  'shai linne',
  'whatuprg',
  'da truth',
  'beautiful eulogy',
  'sho baraka',
  'eshon burgundy',
  'wande',
  'nobigdyl.',
  'tedashii',
  'pro (christian rapper)',
  'json (christian rapper)',
  '116',
  'reach records',

  // ── Gospel ──────────────────────────────────────────────────────────────────
  "le'andria johnson",
  'le andria johnson',
  'donnie mcclurkin',
  'yolanda adams',
  'bebe winans',
  'winans',
  'marvin sapp',
  'tye tribbett',
  'richard smallwood',
  'shirley caesar',
  'andrae crouch',
  'andrae crouch',

  // ── Spanish / Latin Christian ────────────────────────────────────────────────
  'evan craft',          // already above but also key for NM/ABQ
  'funky aztecs (christian)',
  'marcos witt',
  'alex zurdo',
  'funky',
  'jesús adrián romero',
  'jesus adrian romero',
  'lilly goodman',
  'danilo montero',
  'redimi2',
] as const

/**
 * Pre-built Set for O(1) lookups — used by the tagging script and
 * optionally at query time.
 */
export const CHRISTIAN_ARTIST_SET = new Set(CHRISTIAN_ARTISTS)

/**
 * Returns true if the given event title contains a known Christian artist name.
 * Case-insensitive substring match (handles "For King + Country" vs "& Country").
 */
export function isChristianMusicEvent(title: string): boolean {
  const lower = title.toLowerCase()
  // Replace common punctuation variants so "For King + Country" matches "For King & Country"
  const normalized = lower.replace(/[+&]/g, ' ').replace(/\s+/g, ' ')
  return CHRISTIAN_ARTISTS.some(artist => {
    const a = artist.replace(/[+&]/g, ' ').replace(/\s+/g, ' ')
    return normalized.includes(a)
  })
}
