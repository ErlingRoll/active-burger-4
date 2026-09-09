import type { CSSProperties } from 'react'

/**
 * The rods.
 *
 * Every rod rendered as the same generic 🎣 glyph, so five rods that differ in
 * rarity and power looked identical in the loot box odds card and the bag.
 * Each is drawn from the same shaft-and-line silhouette, with the ornament
 * escalating the way the loot box's own chest dressing does: a plain stick,
 * a wire-wrapped shaft, driftwood grain, a moonlit halo, and — because a
 * legendary catch is the whole point of chasing one — the Starlit rod trails
 * sparks the others don't get.
 */
export type RodIconId = 'wooden' | 'silverline' | 'tideback' | 'moonwater' | 'starlit'

interface RodIconProps {
  icon: RodIconId
  color?: string
}

export function RodIcon({ icon, color }: RodIconProps) {
  const style: CSSProperties | undefined = color ? { color } : undefined

  switch (icon) {
    case 'wooden':
      return (
        <svg className="rod-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M5 21 25 5" />
          <circle cx="5.5" cy="20.3" r="1.8" fill="currentColor" opacity=".55" />
          <path fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" d="M25 5c2 4.2 1 9.4-1 13.4" />
          <circle cx="23.3" cy="18.7" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'silverline':
      return (
        <svg className="rod-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M5 21 25 5" />
          {/* The wire wrap the name promises. */}
          <path fill="none" stroke="#f8fafc" strokeWidth=".9" strokeLinecap="round" opacity=".75" d="M6.4 19.6 23.6 6.4" />
          <circle cx="5.5" cy="20.3" r="1.8" fill="currentColor" opacity=".6" />
          <path fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" d="M25 5c2 4.2 1 9.4-1 13.4" />
          <circle cx="23.3" cy="18.7" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'tideback':
      return (
        <svg className="rod-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" d="M5 21 25 5" />
          {/* Driftwood grain. */}
          <path
            fill="none"
            stroke="#07111f"
            strokeOpacity=".32"
            strokeWidth="1"
            d="M10.5 17.2 12 15.9M15 13.6 16.5 12.3M20 9.9 21.5 8.6"
          />
          {/* A tide curling under the handle. */}
          <path fill="none" stroke="currentColor" strokeWidth="1" opacity=".6" d="M2 22.5c1.4-1 2.8-1 4.2 0s2.8 1 4.2 0" />
          <path fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" d="M25 5c2 4.2 1 9.4-1 13.4" />
          <circle cx="23.3" cy="18.7" r="1.4" fill="currentColor" />
        </svg>
      )
    case 'moonwater':
      return (
        <svg className="rod-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M5 21 25 5" />
          <circle cx="25" cy="5" r="3.4" fill="currentColor" opacity=".2" />
          <path fill="#f8fafc" opacity=".85" d="M26.7 3a2.7 2.7 0 1 0 0 4.9 3.5 3.5 0 1 1 0-4.9Z" />
          <path fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" d="M25 5c2 4.2 1 9.4-1 13.4" />
          <circle cx="23.3" cy="18.7" r="1.4" fill="currentColor" />
        </svg>
      )
    case 'starlit':
      return (
        <svg className="rod-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" d="M3 22 24 3" />
          <circle cx="24" cy="3" r="6" fill="currentColor" opacity=".3" />
          <path fill="#fffbea" d="m24 3 1.5 3.4 3.7.55-2.7 2.6.65 3.7L24 11.7l-3.15 1.85.65-3.7-2.7-2.6 3.7-.55Z" />
          <path fill="currentColor" opacity=".9" d="m8 16.5.7 1.6 1.75.25-1.3 1.2.3 1.75-1.45-.85-1.45.85.3-1.75-1.3-1.2 1.75-.25Z" />
          <path fill="currentColor" opacity=".7" d="m15.5 10 .55 1.3 1.4.2-1.05.95.25 1.4-1.15-.68-1.15.68.25-1.4-1.05-.95 1.4-.2Z" />
          <path fill="none" stroke="currentColor" strokeWidth="1" opacity=".6" d="M24 3c2.4 4.6 1.2 10.5-1 15" />
          <circle cx="22.4" cy="20.2" r="1.6" fill="currentColor" />
        </svg>
      )
  }
}
