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
export type MaterialIconId = 'scrap' | 'timber' | 'stone' | 'rift-shard' | 'roe'

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
    case 'timber':
      return (
        <svg className="material-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* Two logs stacked on a third: the round ends show the rings, so it
              reads as felled wood and not as a plank or a stick. */}
          <rect x="3" y="13" width="20" height="8" rx="4" fill="currentColor" opacity="0.7" />
          <rect x="11" y="4" width="18" height="8" rx="4" fill="currentColor" opacity="0.85" />
          <circle cx="25" cy="8" r="3" fill="#07111f" opacity="0.35" />
          <circle cx="25" cy="8" r="1.2" fill="#07111f" opacity="0.35" />
          <circle cx="7" cy="17" r="3" fill="#07111f" opacity="0.35" />
          <circle cx="7" cy="17" r="1.2" fill="#07111f" opacity="0.35" />
        </svg>
      )
    case 'stone':
      return (
        <svg className="material-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A cut block with one dressed face catching the light, and a chip
              beside it, so it is quarried stone rather than a pebble. */}
          <path fill="currentColor" d="M5 9.5 13 5l12 3.5-1 10.5-12.5 2L4 17Z" opacity="0.85" />
          <path fill="#07111f" d="M13 5l12 3.5-1 10.5-9.5-2.5Z" opacity="0.25" />
          <path fill="currentColor" d="m24 16.5 5-1.5 1 4-4.5 1.5Z" opacity="0.6" />
        </svg>
      )
    case 'rift-shard':
      return (
        <svg className="material-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A long crystal and a chip off it, faceted down one side so the
              light sits on an edge rather than a face. */}
          <path fill="currentColor" d="M13 2 22 8l-3 14-9-4Z" opacity="0.85" />
          <path fill="#07111f" d="M13 2 22 8l-1.5 7L13 9.5Z" opacity="0.3" />
          <path fill="currentColor" d="m4 13 5-2 1 6-4 3Z" opacity="0.6" />
          <path fill="none" stroke="currentColor" strokeWidth="1" d="M25 4v4M23 6h4" opacity="0.7" />
        </svg>
      )
    case 'roe':
      return (
        <svg className="material-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A cluster of eggs, each with a highlight off-centre, packed the
              way they sit in the hand rather than in a grid. */}
          <circle cx="11" cy="14" r="5" fill="currentColor" opacity="0.85" />
          <circle cx="20" cy="11" r="5" fill="currentColor" opacity="0.75" />
          <circle cx="17" cy="18" r="4.2" fill="currentColor" opacity="0.9" />
          <circle cx="9.5" cy="12.5" r="1.4" fill="#fff" opacity="0.45" />
          <circle cx="18.5" cy="9.5" r="1.4" fill="#fff" opacity="0.45" />
          <circle cx="15.8" cy="16.8" r="1.1" fill="#fff" opacity="0.45" />
        </svg>
      )
    default:
      return null
  }
}
