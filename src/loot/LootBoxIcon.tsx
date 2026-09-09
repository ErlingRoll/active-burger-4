import { Rarity } from '../content/rarity/Rarity'
import type { LootBoxRarity } from './LootBoxes'

/**
 * The boxes.
 *
 * A loot box used to be the character ▣ beside its name, which made a
 * legendary and a common look identical in the one place a player is deciding
 * which to open. They are drawn now, and what changes with the rarity is not
 * only the colour: the band count, the lock, and what sits above the lid all
 * escalate, so the difference survives being seen small, in a colour-blind
 * palette, or out of the corner of an eye.
 *
 * One chest, five dressings. Drawing five separate chests would have meant
 * five silhouettes to keep in register every time the shape changed.
 */
interface LootBoxIconProps {
  rarity: LootBoxRarity
  /** Marks the box as mid-opening, so the lid lifts and the seams light up. */
  opening?: boolean
  className?: string
}

interface LootBoxDressing {
  /** Studs down the chest band, the plainest signal of worth. */
  readonly studs: number
  /** A gem on the lock plate, from `rare` upward. */
  readonly gem: boolean
  /** Rays behind the chest, for the two rarities worth announcing. */
  readonly rays: boolean
  /** A crown above the lid. Legendary only, and the reason it reads instantly. */
  readonly crown: boolean
}

const DRESSINGS: Readonly<Record<LootBoxRarity, LootBoxDressing>> = {
  [Rarity.Common]: { studs: 0, gem: false, rays: false, crown: false },
  [Rarity.Uncommon]: { studs: 2, gem: false, rays: false, crown: false },
  [Rarity.Rare]: { studs: 3, gem: true, rays: false, crown: false },
  [Rarity.Epic]: { studs: 4, gem: true, rays: true, crown: false },
  [Rarity.Legendary]: { studs: 5, gem: true, rays: true, crown: true },
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export function LootBoxIcon({ rarity, opening = false, className }: LootBoxIconProps) {
  const dressing = DRESSINGS[rarity]
  const studPositions = Array.from(
    { length: dressing.studs },
    (_, index) => 12 + ((index + 1) * 40) / (dressing.studs + 1),
  )

  return (
    <svg
      className={`loot-box-icon${className === undefined ? '' : ` ${className}`}`}
      data-rarity={rarity}
      data-opening={opening ? 'true' : undefined}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {dressing.rays ? (
        <g className="loot-box-icon-rays">
          {RAY_ANGLES.map((angle) => (
            <rect
              key={angle}
              x="31"
              y="4"
              width="2"
              height="12"
              rx="1"
              transform={`rotate(${angle} 32 34)`}
            />
          ))}
        </g>
      ) : null}

      {dressing.crown ? (
        <path
          className="loot-box-icon-crown"
          d="M24 13.5 27.5 8l4.5 4 4.5-4 3.5 5.5-2 4h-12z"
        />
      ) : null}

      {/* The chest, drawn as a body and a lid so the lid alone can lift. */}
      <g className="loot-box-icon-lid">
        <path className="loot-box-icon-shell" d="M12 30V26a20 8 0 0 1 40 0v4z" />
        <rect className="loot-box-icon-band" x="12" y="27" width="40" height="3.5" rx="1.2" />
      </g>

      <g className="loot-box-icon-body">
        <path className="loot-box-icon-shell" d="M12 31h40v16a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5z" />
        <rect className="loot-box-icon-band" x="12" y="31" width="40" height="3" rx="1" />
        {studPositions.map((x) => (
          <circle className="loot-box-icon-stud" key={x} cx={x} cy="45.5" r="1.5" />
        ))}
      </g>

      {/* The lock plate sits across the seam, which is what makes the two
          halves read as one chest rather than two stacked shapes. */}
      <rect className="loot-box-icon-lock" x="27" y="28" width="10" height="11" rx="2" />
      {dressing.gem ? (
        <path className="loot-box-icon-gem" d="M32 30.5l3 3-3 3-3-3z" />
      ) : (
        <circle className="loot-box-icon-keyhole" cx="32" cy="33.5" r="1.6" />
      )}

      {/* What is inside, seen only once the lid is up. */}
      <g className="loot-box-icon-glow">
        <ellipse cx="32" cy="31" rx="17" ry="4" />
      </g>
    </svg>
  )
}
