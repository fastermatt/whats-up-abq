/**
 * ABQMapSVG — simplified line-drawing street map of Albuquerque
 * used as a decorative hero background texture.
 *
 * Coordinate system: 1600 × 900 viewBox, origin top-left.
 * Geography is simplified but faithful to actual ABQ layout:
 *   - Rio Grande runs N-S at x≈155-175 (west side)
 *   - I-25 runs diagonal NNW-SSE, Big I junction at ~(370, 450)
 *   - I-40 runs E-W at y≈450
 *   - Central Avenue (Route 66) runs at y≈490
 *   - Sandia Mountain western face: x≈1080-1492, crest at (1308,52)
 *
 * viewBox is set wider/taller than the content so the city reads at ~72%
 * scale — enough to see the Rio Grande + grid + Sandia Mountains simultaneously.
 */
export function ABQMapSVG() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(to right, transparent 0%, rgba(0,0,0,.5) 12%, rgba(0,0,0,.85) 40%, black 65%), ' +
          'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
        maskComposite: 'intersect',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, rgba(0,0,0,.5) 12%, rgba(0,0,0,.85) 40%, black 65%), ' +
          'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskComposite: 'source-in',
      }}
    >
      {/*
        Extended viewport — 15% gutter above/below + 6% left/right gives the pan
        animation edge room without rendering the huge off-screen canvas that -50% caused.
        The mapPan animation only translates 0.8% vertically and 4.5% horizontally,
        so -15% / -6% is ample.
        viewBox "-900 -420 3000 1800" shows the city at ~55% zoom — wide enough that
        the Rio Grande, grid, and Sandia Mountains all read at once with breathing room.
      */}
      <div
        className="absolute animate-map-pan"
        style={{ top: '-15%', bottom: '-15%', left: '-6%', right: '-6%' }}
      >
        <svg
          viewBox="-900 -420 3000 1800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* ── Sandia Mountain terrain fill ────────────────────────────── */}
          {/* Solid silhouette of the mountain block — by far ABQ's most
              distinctive landmark. Fills from the western face (the slope
              visible from the city) across the crest and back down. */}
          <path
            d="M 1080,900 L 1108,792 L 1130,682 L 1152,572 L 1170,468 L 1188,372
               L 1206,288 L 1222,218 L 1240,160 L 1258,112 L 1276,78 L 1292,58
               L 1308,52 L 1326,62 L 1344,86 L 1362,124 L 1382,174 L 1402,240
               L 1422,322 L 1440,412 L 1456,506 L 1468,604 L 1478,704
               L 1486,802 L 1492,900 Z"
            fill="rgba(38,52,74,0.82)"
          />
          {/* Crest highlight — the ridgeline that catches light */}
          <path
            d="M 1240,160 L 1258,112 L 1276,78 L 1292,58 L 1308,52 L 1326,62 L 1344,86 L 1362,124"
            fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.7"
          />
          {/* Western face — the slope visible from the city */}
          <path
            d="M 1080,900 L 1108,792 L 1130,682 L 1152,572 L 1170,468 L 1188,372
               L 1206,288 L 1222,218 L 1240,160"
            fill="none" stroke="white" strokeWidth="2.2" strokeOpacity="0.55"
          />

          {/* ── Rio Grande — wavy N-S corridor on the west side ────────── */}
          <path
            d="M 162,0 C 158,80 168,155 160,235 C 153,308 165,380 158,458
               C 151,528 163,608 157,685 C 151,755 162,830 158,900"
            fill="none" stroke="rgba(160,200,230,0.9)" strokeWidth="4.5" strokeOpacity="0.55"
          />
          {/* River corridor fill */}
          <path
            d="M 158,0 C 154,80 164,155 156,235 C 149,308 161,380 154,458
               C 147,528 159,608 153,685 C 147,755 158,830 154,900
               L 176,900 C 176,830 168,755 172,685 C 178,608 164,528 172,458
               C 179,380 167,308 174,235 C 180,155 170,80 174,0 Z"
            fill="rgba(130,180,210,0.20)"
          />

          {/* ── I-25 — diagonal NNW-SSE freeway ──────────────────────── */}
          <path
            d="M 322,0 L 334,180 L 352,340 L 370,450 L 388,620 L 405,800 L 415,900"
            fill="none" stroke="white" strokeWidth="3.5" strokeOpacity="0.48"
          />

          {/* ── I-40 — E-W freeway, terminates at Tramway ─────────────── */}
          <path
            d="M 0,452 L 370,450 L 1040,452"
            fill="none" stroke="white" strokeWidth="3.5" strokeOpacity="0.48"
          />

          {/* ── Central Avenue / Route 66 ──────────────────────────────── */}
          <path
            d="M 55,491 L 1068,491"
            fill="none" stroke="white" strokeWidth="2.5" strokeOpacity="0.38"
          />

          {/* ── E-W secondary streets ────────────────────────────────── */}
          <line x1="80" y1="142" x2="1048" y2="142" stroke="white" strokeWidth="1.2" strokeOpacity="0.22" />
          <line x1="80" y1="218" x2="1048" y2="218" stroke="white" strokeWidth="1.2" strokeOpacity="0.22" />
          <line x1="80" y1="298" x2="1048" y2="298" stroke="white" strokeWidth="1.2" strokeOpacity="0.22" />
          <line x1="80" y1="355" x2="1048" y2="355" stroke="white" strokeWidth="1.2" strokeOpacity="0.22" />
          <line x1="80" y1="404" x2="1048" y2="404" stroke="white" strokeWidth="1"   strokeOpacity="0.18" />
          <line x1="80" y1="430" x2="1048" y2="430" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="80" y1="515" x2="900" y2="515" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="80" y1="560" x2="920" y2="560" stroke="white" strokeWidth="1.2" strokeOpacity="0.22" />
          <line x1="80" y1="628" x2="800" y2="628" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="200" y1="696" x2="750" y2="698" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />

          {/* ── N-S secondary streets ──────────────────────────────────── */}
          <line x1="96"  y1="0"  x2="96"  y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          <line x1="200" y1="50" x2="200" y2="900" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="232" y1="0"  x2="232" y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          <line x1="264" y1="60" x2="264" y2="900" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="295" y1="80" x2="295" y2="900" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="432" y1="0"  x2="432" y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          <line x1="480" y1="0"  x2="480" y2="750" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="560" y1="0"  x2="560" y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          <line x1="648" y1="0"  x2="648" y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          <line x1="728" y1="0"  x2="728" y2="850" stroke="white" strokeWidth="1"   strokeOpacity="0.16" />
          <line x1="802" y1="0"  x2="802" y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          <line x1="880" y1="0"  x2="880" y2="900" stroke="white" strokeWidth="1.2" strokeOpacity="0.20" />
          {/* Tramway Blvd */}
          <path
            d="M 998,0 C 1004,150 1014,310 1018,452 C 1022,594 1011,740 1002,900"
            fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.11"
          />

          {/* ── ABQ Sunport ─────────────────────────────────────────────── */}
          <line x1="674" y1="648" x2="686" y2="768" stroke="white" strokeWidth="2" strokeOpacity="0.14" />
          <line x1="635" y1="702" x2="730" y2="710" stroke="white" strokeWidth="1.5" strokeOpacity="0.11" />
          <rect x="640" y="648" width="48" height="28" rx="2"
            fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.10" />

          {/* ── Balloon Fiesta Park ─────────────────────────────────────── */}
          <rect x="316" y="166" width="54" height="36" rx="3"
            fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.14" />

          {/* ── Landmark dots ───────────────────────────────────────────── */}
          {/* The Big I */}
          <circle cx="370" cy="450" r="5"   fill="white" fillOpacity="0.5" />
          <circle cx="370" cy="450" r="9"   fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
          {/* Old Town */}
          <circle cx="232" cy="464" r="3.5" fill="white" fillOpacity="0.35" />
          {/* Downtown */}
          <circle cx="332" cy="468" r="3.5" fill="white" fillOpacity="0.35" />
          {/* UNM */}
          <circle cx="455" cy="502" r="3"   fill="white" fillOpacity="0.28" />
          {/* Nob Hill */}
          <circle cx="538" cy="491" r="3"   fill="white" fillOpacity="0.28" />
          {/* Balloon Fiesta Park */}
          <circle cx="343" cy="184" r="3"   fill="white" fillOpacity="0.28" />

          {/* ── Map labels ──────────────────────────────────────────────── */}
          {/* SANDIA MOUNTAINS — large, inside the mountain silhouette */}
          <text
            x="1295" y="420"
            fill="white" fillOpacity="0.55"
            fontSize="14" letterSpacing="3.5" textAnchor="middle"
            transform="rotate(-78 1295 420)"
            style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
          >
            SANDIA MOUNTAINS
          </text>

          {/* RIO GRANDE — rotated along the river */}
          <text
            x="148" y="465" fill="white" fillOpacity="0.32"
            fontSize="8" letterSpacing="1.8" textAnchor="middle"
            transform="rotate(-90 148 465)"
            style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}
          >
            RIO GRANDE
          </text>

          {/* THE BIG I */}
          <text
            x="370" y="438" fill="white" fillOpacity="0.38"
            fontSize="7" letterSpacing="0.8" textAnchor="middle"
            style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
          >
            THE BIG I
          </text>

          {/* CENTRAL AVE · ROUTE 66 */}
          <text
            x="500" y="483" fill="white" fillOpacity="0.28"
            fontSize="7" letterSpacing="2" textAnchor="middle"
            style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
          >
            CENTRAL AVE  ·  ROUTE 66
          </text>

          {/* OLD TOWN */}
          <text
            x="232" y="480" fill="white" fillOpacity="0.26"
            fontSize="6" letterSpacing="0.5" textAnchor="middle"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            OLD TOWN
          </text>

          {/* BALLOON FIESTA */}
          <text
            x="343" y="214" fill="white" fillOpacity="0.24"
            fontSize="5.5" letterSpacing="0.4" textAnchor="middle"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            BALLOON FIESTA
          </text>
        </svg>
      </div>
    </div>
  )
}
