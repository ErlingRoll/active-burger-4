import type { CSSProperties } from 'react'

/**
 * The baits.
 *
 * Every bait rendered as the same ◉ glyph, so a Moonwater Lure and the
 * unlimited starter bait were indistinguishable in the bag, in the loot box
 * odds card and in the reward reveal — which is a problem, because which bait
 * is on the hook is the main decision the pond offers. Each one is drawn, and
 * the drawings escalate in the same direction their bonuses do: a lump of
 * dough, a worm, a grub with a light in it, and a machined lure.
 */
export type BaitIconId = 'dough-ball' | 'worm' | 'grub' | 'lure'

interface BaitIconProps {
  icon: BaitIconId
  color?: string
}

export function BaitIcon({ icon, color }: BaitIconProps) {
  const style: CSSProperties | undefined = color ? { color } : undefined

  switch (icon) {
    case 'dough-ball':
      return (
        <svg className="bait-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            d="M16 4v5m0 0c2.5 0 3.5 1.6 3.5 3"
            opacity="0.55"
          />
          <circle cx="16" cy="15" r="5.6" fill="currentColor" />
          <circle cx="14" cy="13" r="1.5" fill="#07111f" opacity="0.28" />
        </svg>
      )
    case 'worm':
      return (
        <svg className="bait-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="4.2"
            strokeLinecap="round"
            d="M5 16c3.5 0 3.5-8 7-8s3.5 8 7 8 3.5-6 6-6"
          />
          <circle cx="25.5" cy="10" r="1" fill="#07111f" />
        </svg>
      )
    case 'grub':
      return (
        <svg className="bait-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path
            fill="currentColor"
            d="M9 12c0-4 3.4-6.5 8-6.5s9 2.6 9 6.5-4.4 6.5-9 6.5-8-2.5-8-6.5Z"
          />
          {/* Segments, the one detail that reads as larva rather than pebble. */}
          <path
            fill="none"
            stroke="#07111f"
            strokeOpacity="0.32"
            strokeWidth="1.1"
            d="M15 6.4v11.2M19 6v12M23 7v10"
          />
          <circle cx="26.5" cy="12" r="2.6" fill="currentColor" opacity="0.55" />
          <circle cx="10.5" cy="10.5" r="1.1" fill="#07111f" opacity="0.5" />
        </svg>
      )
    case 'lure':
      return (
        <svg className="bait-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* The spoon: a machined blade, not something dug out of the bank. */}
          <path
            fill="currentColor"
            d="M12 12c0-4.4 2.9-7.6 6.5-7.6S25 7.6 25 12s-2.9 7.6-6.5 7.6S12 16.4 12 12Z"
          />
          <path
            fill="#f8fafc"
            fillOpacity="0.5"
            d="M15.5 12c0-3 1.3-5.4 3-5.4s3 2.4 3 5.4-1.3 5.4-3 5.4-3-2.4-3-5.4Z"
          />
          <circle cx="9.5" cy="12" r="1.9" fill="currentColor" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            d="M25 12h3m-1.5 0c0 2.4-1.4 3.6-3 3.6"
            opacity="0.7"
          />
        </svg>
      )
  }
}
