import type { CSSProperties, ReactElement } from 'react'
import type { CampBuildingId } from '../content/camp/CampTypes'

/**
 * What stands between the buildings.
 *
 * Eight pictures on a ground are eight pictures; a settlement has things
 * in the gaps. These are drawn in the same box the plots are placed in,
 * at the same shares of it, so they keep their places beside the buildings
 * and along the path whatever the width. Lantern posts light the path,
 * because every warm light on the screen is something that burns; a tent
 * stands in the gap between the Woodline and the Storehouse, a cart waits
 * on the path where it forks, and stores are stacked beside the Storehouse
 * door. A Camp that grows puts more of it out: most pieces wait for a
 * building to reach a level, so an empty Camp is a tent and a lantern and a
 * built one is cluttered with the signs of work. Decoration only, hidden
 * from readers. A phone places its pieces differently, in camp.css, and
 * shows only the ones that fit between two columns.
 */

const TIMBER = '#3b2a1e'
const TIMBER_LIGHT = '#5a3f2b'
const TIMBER_EDGE = '#6b4a30'
const CANVAS = '#3a2e22'
const LANTERN = '#fbbf24'

type FurnitureKind = 'lantern' | 'tent' | 'cart' | 'crates' | 'woodpile' | 'fence'

interface FurniturePlacement {
  /** A stable name, which camp.css uses to place the piece on a phone. */
  id: string
  kind: FurnitureKind
  /** Left edge, as a share of the ground's width. */
  x: number
  /** Top edge, as a share of the ground's height. */
  y: number
  /** Width, as a share of the ground's width; the height follows the drawing. */
  w: number
  /** The building and level that puts this piece out; none means it is there from the start. */
  requires?: { building: CampBuildingId, level: number }
}

/** Where each thing stands, and what has to be built before it does. */
const CAMP_FURNITURE: readonly FurniturePlacement[] = [
  { id: 'lantern-store', kind: 'lantern', x: 34.5, y: 33, w: 1.5 },
  { id: 'tent', kind: 'tent', x: 24.5, y: 27, w: 8.5 },
  { id: 'lantern-front', kind: 'lantern', x: 50.5, y: 84, w: 1.5, requires: { building: 'tackle-bench', level: 1 } },
  { id: 'woodpile', kind: 'woodpile', x: 27, y: 49, w: 5, requires: { building: 'smokehouse', level: 1 } },
  { id: 'lantern-forge', kind: 'lantern', x: 57.5, y: 65, w: 1.5, requires: { building: 'forge', level: 1 } },
  { id: 'cart', kind: 'cart', x: 47, y: 63, w: 6, requires: { building: 'woodline', level: 2 } },
  { id: 'fence', kind: 'fence', x: 79, y: 41, w: 12, requires: { building: 'quarry', level: 2 } },
  { id: 'crates', kind: 'crates', x: 51, y: 40.5, w: 5.5, requires: { building: 'storehouse', level: 2 } },
]

function LanternPost() {
  return (
    <svg viewBox="0 0 20 60" aria-hidden="true">
      <rect x="9" y="12" width="2" height="48" fill={TIMBER} />
      <rect x="6" y="58" width="8" height="2" fill={TIMBER_LIGHT} />
      <rect x="9" y="10" width="6" height="1.5" fill={TIMBER_LIGHT} />
      <g className="camp-art-lantern">
        <circle cx="14" cy="15" r="9" fill={LANTERN} opacity="0.22" />
        <rect x="11.5" y="11" width="5" height="7" rx="1" fill={LANTERN} />
      </g>
    </svg>
  )
}

function Tent() {
  return (
    <svg viewBox="0 0 100 62" aria-hidden="true">
      <ellipse cx="50" cy="58" rx="46" ry="4" fill="#0a130e" opacity="0.7" />
      <polygon points="6,58 50,10 94,58" fill={CANVAS} />
      <polygon points="50,10 94,58 74,58 50,20" fill="#2c221a" />
      <polygon points="38,58 50,30 62,58" fill="#120c08" />
      <line x1="50" y1="10" x2="50" y2="4" stroke={TIMBER_EDGE} strokeWidth="1.5" />
      <circle cx="50" cy="44" r="4" fill={LANTERN} opacity="0.35" />
    </svg>
  )
}

function Cart() {
  return (
    <svg viewBox="0 0 100 62" aria-hidden="true">
      <rect x="18" y="22" width="60" height="22" rx="2" fill={TIMBER_LIGHT} />
      <rect x="22" y="26" width="52" height="14" fill={TIMBER} />
      <circle cx="30" cy="50" r="9" fill="#2c1d13" stroke={TIMBER_EDGE} strokeWidth="2" />
      <circle cx="68" cy="50" r="9" fill="#2c1d13" stroke={TIMBER_EDGE} strokeWidth="2" />
      <line x1="78" y1="28" x2="98" y2="18" stroke={TIMBER_LIGHT} strokeWidth="3" strokeLinecap="round" />
      <circle cx="36" cy="20" r="6" fill={TIMBER_LIGHT} />
      <circle cx="48" cy="17" r="6" fill={TIMBER} />
      <circle cx="60" cy="20" r="6" fill={TIMBER_LIGHT} />
    </svg>
  )
}

function Crates() {
  return (
    <svg viewBox="0 0 100 72" aria-hidden="true">
      {[{ x: 8, y: 40 }, { x: 50, y: 40 }, { x: 29, y: 10 }].map(({ x, y }) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="40" height="30" fill={TIMBER_LIGHT} stroke="#2c1d13" strokeWidth="2" />
          <line x1={x} y1={y} x2={x + 40} y2={y + 30} stroke="#2c1d13" strokeWidth="1.5" />
          <line x1={x + 40} y1={y} x2={x} y2={y + 30} stroke="#2c1d13" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
}

function Woodpile() {
  return (
    <svg viewBox="0 0 100 60" aria-hidden="true">
      <ellipse cx="50" cy="56" rx="46" ry="4" fill="#0a130e" opacity="0.7" />
      {[
        { x: 14, y: 44 }, { x: 38, y: 44 }, { x: 62, y: 44 }, { x: 86, y: 44 },
        { x: 26, y: 26 }, { x: 50, y: 26 }, { x: 74, y: 26 },
        { x: 38, y: 10 }, { x: 62, y: 10 },
      ].map(({ x, y }) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill={TIMBER_LIGHT} stroke="#2c1d13" strokeWidth="2" />
      ))}
    </svg>
  )
}

function Fence() {
  return (
    <svg viewBox="0 0 200 40" aria-hidden="true">
      {[6, 54, 102, 150, 194].map((x) => (
        <rect key={x} x={x - 2} y="8" width="4" height="32" fill={TIMBER} />
      ))}
      <rect x="4" y="14" width="192" height="3" fill={TIMBER_LIGHT} />
      <rect x="4" y="26" width="192" height="3" fill={TIMBER_LIGHT} />
    </svg>
  )
}

const FURNITURE: Record<FurnitureKind, () => ReactElement> = {
  lantern: LanternPost,
  tent: Tent,
  cart: Cart,
  crates: Crates,
  woodpile: Woodpile,
  fence: Fence,
}

interface CampFurnitureProps {
  /** Each building's level, which decides what has been put out. */
  levels: Readonly<Record<CampBuildingId, number>>
}

export function CampFurniture({ levels }: CampFurnitureProps) {
  const standing = CAMP_FURNITURE.filter((placement) =>
    !placement.requires || levels[placement.requires.building] >= placement.requires.level,
  )
  return (
    <div className="camp-furniture" aria-hidden="true">
      {standing.map((placement) => {
        const Picture = FURNITURE[placement.kind]
        const style = {
          '--furniture-x': `${placement.x}%`,
          '--furniture-y': `${placement.y}%`,
          '--furniture-w': `${placement.w}%`,
        } as CSSProperties
        return (
          <span key={placement.id} className="camp-furniture-piece" data-kind={placement.kind} data-piece={placement.id} style={style}>
            <Picture />
          </span>
        )
      })}
    </div>
  )
}

/** The jobs whose output is carried to the Storehouse along the path. */
export type CampHaulRoute = 'woodline' | 'quarry'

/**
 * Figures on the path: one per job with output waiting, walking from its
 * building to the Storehouse with a bundle and back without one. The route
 * follows the path drawn on the ground, as keyframes in camp.css.
 */
export function CampHaulers({ routes }: { routes: readonly CampHaulRoute[] }) {
  if (routes.length === 0) {
    return null
  }
  return (
    <div className="camp-haulers" aria-hidden="true">
      {routes.map((route) => (
        <span key={route} className="camp-hauler" data-route={route}>
          <i className="camp-hauler-figure" />
          <i className="camp-hauler-bundle" />
        </span>
      ))}
    </div>
  )
}
