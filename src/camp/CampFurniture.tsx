import type { CSSProperties, ReactElement } from 'react'

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
 * door. Decoration only: hidden from readers, and not drawn on a phone,
 * whose grid has no gaps to stand in.
 */

const TIMBER = '#3b2a1e'
const TIMBER_LIGHT = '#5a3f2b'
const TIMBER_EDGE = '#6b4a30'
const CANVAS = '#3a2e22'
const LANTERN = '#fbbf24'

type FurnitureKind = 'lantern' | 'tent' | 'cart' | 'crates'

interface FurniturePlacement {
  kind: FurnitureKind
  /** Left edge, as a share of the ground's width. */
  x: number
  /** Top edge, as a share of the ground's height. */
  y: number
  /** Width, as a share of the ground's width; the height follows the drawing. */
  w: number
}

/** Where each thing stands. The plots' places are in camp.css; these fill the gaps between them. */
const CAMP_FURNITURE: readonly FurniturePlacement[] = [
  { kind: 'lantern', x: 34.5, y: 33, w: 1.5 },
  { kind: 'lantern', x: 57.5, y: 65, w: 1.5 },
  { kind: 'lantern', x: 50.5, y: 84, w: 1.5 },
  { kind: 'tent', x: 24.5, y: 27, w: 8.5 },
  { kind: 'cart', x: 47, y: 63, w: 6 },
  { kind: 'crates', x: 51, y: 40.5, w: 5.5 },
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

const FURNITURE: Record<FurnitureKind, () => ReactElement> = {
  lantern: LanternPost,
  tent: Tent,
  cart: Cart,
  crates: Crates,
}

export function CampFurniture() {
  return (
    <div className="camp-furniture" aria-hidden="true">
      {CAMP_FURNITURE.map((placement, index) => {
        const Picture = FURNITURE[placement.kind]
        const style: CSSProperties = { left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.w}%` }
        return (
          <span key={index} className="camp-furniture-piece" data-kind={placement.kind} style={style}>
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
