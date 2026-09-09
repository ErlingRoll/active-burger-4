import type { CSSProperties } from 'react'

/**
 * The materials.
 *
 * Drawn rather than typeset, for the same reason the baits are: a glyph picked
 * out of a font renders at a different weight and sometimes a different size on
 * every platform, and a slot in the bag is small enough that the difference
 * shows. Sized in `em` and painted from `currentColor` where the shape allows,
 * so a material takes the size of whatever slot holds it.
 */
export type MaterialIconId = 'scrap'

interface MaterialIconProps {
  icon: MaterialIconId
  color?: string
}

export function MaterialIcon({ icon, color }: MaterialIconProps) {
  const style: CSSProperties | undefined = color ? { color } : undefined

  switch (icon) {
    case 'scrap':
      return (
        <svg className="material-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A bent plate, a broken buckle and a coil of bowstring: the three
              things a loadout actually leaves behind, piled rather than
              arranged, so it reads as salvage and not as a finished item. */}
          <path
            fill="currentColor"
            d="M4.5 17.5 9 7.5l6.5 2.5-2.5 8.5Z"
            opacity="0.85"
          />
          <path
            fill="currentColor"
            d="m16 8.5 7.5-2 4 7-5.5 4.5-5-4Z"
            opacity="0.6"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            d="M11 19.5c4 1.5 9 1.5 13 0"
            opacity="0.75"
          />
          <circle cx="22" cy="9.5" r="1.4" fill="#07111f" opacity="0.4" />
        </svg>
      )
    default:
      return null
  }
}
