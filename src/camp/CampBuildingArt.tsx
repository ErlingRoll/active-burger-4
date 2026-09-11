import type { ReactElement } from 'react'
import type { CampBuildingId } from '../content/camp/CampTypes'

/**
 * The buildings, drawn.
 *
 * Each plot on the Camp screen carries a small picture of what stands on it,
 * in the same flat silhouette style as the pond's fish and the bag's icons.
 * Every picture shares one viewbox and one ground line so the eight plots
 * read as one settlement rather than eight stickers, and colour is kept to
 * the parts that are lit: a lantern by a door, the coals of the forge, the
 * violet of the anchor, the smoke off the smokehouse. The rest is the same
 * dark timber and stone the ground is made of.
 */

export type CampPlotId = CampBuildingId | 'trophy-hall'

interface CampBuildingArtProps {
  plotId: CampPlotId
  /** Level zero draws the same picture as a footprint: what the plot could be. */
  built: boolean
}

const TIMBER = '#3b2a1e'
const TIMBER_LIGHT = '#5a3f2b'
const STONE = '#3a4150'
const STONE_LIGHT = '#556074'
const LANTERN = '#fbbf24'
const EMBER = '#f97316'
const RIFT = '#a78bfa'
const WATER = '#22d3ee'
const PINE = '#1a2e22'

function Lantern({ x, y }: { x: number, y: number }) {
  return (
    <g className="camp-art-lantern">
      <circle cx={x} cy={y} r="7" fill={LANTERN} opacity="0.22" />
      <rect x={x - 2} y={y - 3} width="4" height="6" rx="1" fill={LANTERN} />
    </g>
  )
}

function Storehouse() {
  return (
    <>
      <rect x="28" y="36" width="64" height="30" fill={TIMBER} />
      <polygon points="24,38 60,14 96,38" fill={TIMBER_LIGHT} />
      <rect x="54" y="46" width="12" height="20" fill="#120c08" />
      <rect x="34" y="42" width="8" height="7" fill="#120c08" />
      <rect x="78" y="42" width="8" height="7" fill="#120c08" />
      <rect x="20" y="66" width="80" height="3" fill={STONE} />
      <Lantern x={72} y={50} />
    </>
  )
}

function Woodline() {
  return (
    <>
      <polygon points="18,66 30,24 42,66" fill={PINE} />
      <polygon points="36,66 50,16 64,66" fill="#22392b" />
      <polygon points="58,66 68,30 78,66" fill={PINE} />
      <rect x="82" y="56" width="26" height="6" rx="3" fill={TIMBER_LIGHT} />
      <rect x="86" y="50" width="18" height="6" rx="3" fill={TIMBER} />
      <rect x="90" y="44" width="10" height="6" rx="3" fill={TIMBER_LIGHT} />
      <rect x="10" y="58" width="8" height="8" fill={TIMBER} />
      <line x1="14" y1="58" x2="22" y2="46" stroke={STONE_LIGHT} strokeWidth="2" />
      <rect x="20" y="42" width="6" height="6" fill={STONE_LIGHT} />
      <rect x="6" y="66" width="108" height="3" fill={STONE} />
    </>
  )
}

function Quarry() {
  return (
    <>
      <polygon points="40,66 52,30 70,22 96,18 112,66" fill={STONE} />
      <polygon points="56,66 64,40 80,32 96,30 104,66" fill={STONE_LIGHT} />
      <rect x="66" y="50" width="12" height="10" fill={STONE} />
      <rect x="80" y="54" width="10" height="8" fill={STONE} />
      <rect x="12" y="52" width="22" height="10" fill={TIMBER} />
      <circle cx="17" cy="65" r="4" fill={TIMBER_LIGHT} />
      <circle cx="29" cy="65" r="4" fill={TIMBER_LIGHT} />
      <rect x="15" y="46" width="6" height="6" fill={STONE_LIGHT} />
      <rect x="23" y="46" width="6" height="6" fill={STONE_LIGHT} />
      <rect x="6" y="66" width="108" height="3" fill={STONE} />
    </>
  )
}

function TackleBench() {
  return (
    <>
      <ellipse cx="86" cy="66" rx="30" ry="6" fill={WATER} opacity="0.32" />
      <rect x="18" y="44" width="46" height="5" fill={TIMBER_LIGHT} />
      <rect x="22" y="49" width="4" height="17" fill={TIMBER} />
      <rect x="56" y="49" width="4" height="17" fill={TIMBER} />
      <line x1="30" y1="44" x2="62" y2="14" stroke={STONE_LIGHT} strokeWidth="2" />
      <path d="M62 14 q 10 8 6 22" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
      <rect x="34" y="36" width="10" height="8" fill={STONE} />
      <circle cx="46" cy="38" r="3" fill={LANTERN} />
      <rect x="6" y="66" width="70" height="3" fill={STONE} />
    </>
  )
}

function RiftAnchor() {
  return (
    <>
      <ellipse cx="60" cy="64" rx="30" ry="6" fill={RIFT} opacity="0.18" />
      <ellipse cx="60" cy="64" rx="18" ry="3.5" fill={RIFT} opacity="0.3" />
      <polygon points="48,64 56,20 62,10 68,26 72,64" fill="#4c1d95" />
      <polygon points="54,64 58,26 62,14 64,30 66,64" fill={RIFT} opacity="0.9" />
      <polygon points="36,64 40,44 46,64" fill="#4c1d95" />
      <polygon points="76,64 82,40 88,64" fill="#4c1d95" />
      <circle cx="62" cy="12" r="6" fill={RIFT} opacity="0.4" className="camp-art-pulse" />
      <rect x="20" y="66" width="80" height="3" fill={STONE} />
    </>
  )
}

function Smokehouse() {
  return (
    <>
      <rect x="36" y="38" width="48" height="28" fill={TIMBER} />
      <polygon points="32,40 60,20 88,40" fill={TIMBER_LIGHT} />
      <rect x="70" y="22" width="8" height="14" fill={STONE} />
      <rect x="56" y="48" width="10" height="18" fill="#120c08" />
      <circle cx="74" cy="16" r="4" fill="#94a3b8" opacity="0.45" className="camp-art-smoke camp-art-smoke-one" />
      <circle cx="78" cy="8" r="5" fill="#94a3b8" opacity="0.3" className="camp-art-smoke camp-art-smoke-two" />
      <circle cx="84" cy="2" r="6" fill="#94a3b8" opacity="0.18" className="camp-art-smoke camp-art-smoke-three" />
      <Lantern x={46} y={52} />
      <rect x="28" y="66" width="64" height="3" fill={STONE} />
    </>
  )
}

function Forge() {
  return (
    <>
      <rect x="30" y="34" width="36" height="32" fill={STONE} />
      <rect x="40" y="22" width="16" height="14" fill={STONE_LIGHT} />
      <rect x="36" y="46" width="24" height="14" rx="2" fill="#1a0a04" />
      <ellipse cx="48" cy="56" rx="9" ry="3" fill={EMBER} className="camp-art-coals" />
      <ellipse cx="48" cy="55" rx="4" ry="1.6" fill={LANTERN} className="camp-art-coals" />
      <rect x="76" y="50" width="26" height="6" rx="1" fill={STONE} />
      <rect x="84" y="56" width="10" height="8" fill={STONE_LIGHT} />
      <rect x="80" y="64" width="18" height="3" fill={STONE} />
      <rect x="22" y="66" width="80" height="3" fill={STONE} />
    </>
  )
}

function TrophyHall() {
  return (
    <>
      <rect x="20" y="34" width="80" height="32" fill={TIMBER} />
      <polygon points="16,36 60,12 104,36" fill={TIMBER_LIGHT} />
      <rect x="54" y="46" width="12" height="20" fill="#120c08" />
      <rect x="30" y="40" width="8" height="14" fill={RIFT} opacity="0.55" />
      <rect x="82" y="40" width="8" height="14" fill={EMBER} opacity="0.55" />
      <rect x="12" y="66" width="96" height="3" fill={STONE} />
    </>
  )
}

const ART: Record<CampPlotId, () => ReactElement> = {
  storehouse: Storehouse,
  woodline: Woodline,
  quarry: Quarry,
  'tackle-bench': TackleBench,
  'rift-anchor': RiftAnchor,
  smokehouse: Smokehouse,
  forge: Forge,
  'trophy-hall': TrophyHall,
}

export function CampBuildingArt({ plotId, built }: CampBuildingArtProps) {
  const Picture = ART[plotId]
  return (
    <svg
      className="camp-plot-art"
      viewBox="0 0 120 72"
      aria-hidden="true"
      focusable="false"
      data-built={built ? 'true' : 'false'}
    >
      <Picture />
    </svg>
  )
}
