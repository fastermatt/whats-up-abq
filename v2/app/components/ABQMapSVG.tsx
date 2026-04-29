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
 *   - Sandia Mountain western face curves up from x≈1060 east
 */
export function ABQMapSVG() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        // Fade map out on left (text area) and on top/bottom edges
        maskImage:
          'linear-gradient(to right, transparent 0%, rgba(0,0,0,.45) 28%, rgba(0,0,0,.85) 55%, black 75%), ' +
          'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        maskComposite: 'intersect',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, rgba(0,0,0,.45) 28%, rgba(0,0,0,.85) 55%, black 75%), ' +
          'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskComposite: 'source-in',
      }}
    >
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ── Rio Grande — wavy N-S on west side, most visible element ── */}
        <path
          d="M 162,0 C 158,80 168,155 160,235 C 153,308 165,380 158,458 C 151,528 163,608 157,685 C 151,755 162,830 158,900"
          fill="none" stroke="white" strokeWidth="3.5" strokeOpacity="0.22"
        />
        {/* Rio Grande fill — very faint blue-ish tint */}
        <path
          d="M 158,0 C 154,80 164,155 156,235 C 149,308 161,380 154,458 C 147,528 159,608 153,685 C 147,755 158,830 154,900 L 176,900 C 176,830 168,755 172,685 C 178,608 164,528 172,458 C 179,380 167,308 174,235 C 180,155 170,80 174,0 Z"
          fill="rgba(180,210,230,0.06)"
        />

        {/* ── I-25 — diagonal NNW-SSE freeway ── */}
        <path
          d="M 322,0 L 334,180 L 352,340 L 370,450 L 388,620 L 405,800 L 415,900"
          fill="none" stroke="white" strokeWidth="2.8" strokeOpacity="0.2"
        />

        {/* ── I-40 — E-W freeway, terminates at Tramway ── */}
        <path
          d="M 0,452 L 370,450 L 1040,452"
          fill="none" stroke="white" strokeWidth="2.8" strokeOpacity="0.2"
        />

        {/* ── Central Avenue / Route 66 ── */}
        <path
          d="M 55,491 L 1068,491"
          fill="none" stroke="white" strokeWidth="1.8" strokeOpacity="0.16"
        />

        {/* ── E-W secondary streets ── */}
        {/* Paseo del Norte */}
        <line x1="80" y1="142" x2="1048" y2="142" stroke="white" strokeWidth="0.9" strokeOpacity="0.08" />
        {/* Alameda Blvd */}
        <line x1="80" y1="218" x2="1048" y2="218" stroke="white" strokeWidth="0.9" strokeOpacity="0.08" />
        {/* Montgomery Blvd */}
        <line x1="80" y1="298" x2="1048" y2="298" stroke="white" strokeWidth="0.9" strokeOpacity="0.08" />
        {/* Indian School Rd */}
        <line x1="80" y1="355" x2="1048" y2="355" stroke="white" strokeWidth="0.9" strokeOpacity="0.08" />
        {/* Menaul Blvd */}
        <line x1="80" y1="404" x2="1048" y2="404" stroke="white" strokeWidth="0.9" strokeOpacity="0.08" />
        {/* Lomas Blvd */}
        <line x1="80" y1="430" x2="1048" y2="430" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* Coal / Lead area */}
        <line x1="80" y1="515" x2="900" y2="515" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* Gibson Blvd */}
        <line x1="80" y1="560" x2="920" y2="560" stroke="white" strokeWidth="0.9" strokeOpacity="0.08" />
        {/* Cesar Chavez */}
        <line x1="80" y1="628" x2="800" y2="628" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* Sunport / Bridge */}
        <line x1="200" y1="696" x2="750" y2="698" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />

        {/* ── N-S secondary streets ── */}
        {/* Coors Blvd */}
        <line x1="96" y1="0" x2="96" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* Rio Grande Blvd */}
        <line x1="200" y1="50" x2="200" y2="900" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* 4th St */}
        <line x1="232" y1="0" x2="232" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* 8th St */}
        <line x1="264" y1="60" x2="264" y2="900" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* 12th St */}
        <line x1="295" y1="80" x2="295" y2="900" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* University Blvd */}
        <line x1="432" y1="0" x2="432" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* Yale Blvd */}
        <line x1="480" y1="0" x2="480" y2="750" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* San Mateo */}
        <line x1="560" y1="0" x2="560" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* Louisiana */}
        <line x1="648" y1="0" x2="648" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* Wyoming */}
        <line x1="728" y1="0" x2="728" y2="850" stroke="white" strokeWidth="0.7" strokeOpacity="0.06" />
        {/* Eubank */}
        <line x1="802" y1="0" x2="802" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* Juan Tabo */}
        <line x1="880" y1="0" x2="880" y2="900" stroke="white" strokeWidth="0.9" strokeOpacity="0.07" />
        {/* Tramway Blvd — curves slightly following mountain base */}
        <path
          d="M 998,0 C 1004,150 1014,310 1018,452 C 1022,594 1011,740 1002,900"
          fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.08"
        />

        {/* ── Sandia Mountain western face ── */}
        <path
          d="M 1080,900 L 1108,792 L 1130,682 L 1152,572 L 1170,468 L 1188,372 L 1206,288 L 1222,218 L 1240,160 L 1258,112 L 1276,78 L 1292,58 L 1308,52 L 1326,62 L 1344,86 L 1362,124 L 1382,174 L 1402,240 L 1422,322 L 1440,412 L 1456,506 L 1468,604 L 1478,704 L 1486,802 L 1492,900"
          fill="none" stroke="white" strokeWidth="1.4" strokeOpacity="0.12"
        />

        {/* ── ABQ Sunport (airport) — southeast ── */}
        {/* Main N-S runway */}
        <line x1="674" y1="648" x2="686" y2="768" stroke="white" strokeWidth="1.8" strokeOpacity="0.1" />
        {/* Secondary E-W runway */}
        <line x1="635" y1="702" x2="730" y2="710" stroke="white" strokeWidth="1.4" strokeOpacity="0.08" />
        {/* Terminal pad outline */}
        <rect x="640" y="648" width="48" height="28" rx="2"
          fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.07" />

        {/* ── Balloon Fiesta Park — north side ── */}
        <rect x="316" y="166" width="54" height="36" rx="3"
          fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.1" />

        {/* ── Landmark dots ── */}
        {/* Big I junction */}
        <circle cx="370" cy="450" r="4.5" fill="white" fillOpacity="0.35" />
        <circle cx="370" cy="450" r="8" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.15" />
        {/* Old Town */}
        <circle cx="232" cy="464" r="2.8" fill="white" fillOpacity="0.25" />
        {/* Downtown / KiMo */}
        <circle cx="332" cy="468" r="2.8" fill="white" fillOpacity="0.25" />
        {/* UNM */}
        <circle cx="455" cy="502" r="2.5" fill="white" fillOpacity="0.2" />
        {/* Nob Hill */}
        <circle cx="538" cy="491" r="2.5" fill="white" fillOpacity="0.2" />
        {/* Balloon Fiesta Park center */}
        <circle cx="343" cy="184" r="2.5" fill="white" fillOpacity="0.2" />

        {/* ── Tiny map labels ── */}
        <text
          x="500" y="484" fill="white" fillOpacity="0.22"
          fontSize="6.5" letterSpacing="1.8" textAnchor="middle"
          style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
        >
          CENTRAL AVE  ·  ROUTE 66
        </text>
        <text
          x="148" y="465" fill="white" fillOpacity="0.18"
          fontSize="5.5" letterSpacing="1.2" textAnchor="middle"
          transform="rotate(-90 148 465)"
          style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}
        >
          RIO GRANDE
        </text>
        <text
          x="370" y="440" fill="white" fillOpacity="0.28"
          fontSize="5" letterSpacing="0.8" textAnchor="middle"
          style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
        >
          THE BIG I
        </text>
        <text
          x="232" y="480" fill="white" fillOpacity="0.18"
          fontSize="5" letterSpacing="0.5" textAnchor="middle"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          OLD TOWN
        </text>
        <text
          x="1290" y="135" fill="white" fillOpacity="0.14"
          fontSize="7" letterSpacing="1.5" textAnchor="middle"
          transform="rotate(-78 1290 135)"
          style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}
        >
          SANDIA MOUNTAINS
        </text>
        <text
          x="343" y="202" fill="white" fillOpacity="0.16"
          fontSize="4.5" letterSpacing="0.4" textAnchor="middle"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          BALLOON FIESTA
        </text>
      </svg>
    </div>
  )
}
