/**
 * Instagram glyph as inline SVG. Not in lucide-react — they removed brand
 * icons in v0.453+ for trademark/legal reasons. Using react-icons or
 * @icons-pack/react-simple-icons would add ~80KB to the bundle for one
 * icon, so we inline.
 *
 * The shape (rounded square + circle + dot) is the universal Instagram
 * glyph and is in widespread use as a brand reference; this matches Meta's
 * own brand-asset SVG within stroke-rounding tolerance.
 */
export function InstagramIcon({
  className,
  style,
  size = 16,
}: {
  className?: string
  style?: React.CSSProperties
  size?: number
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
