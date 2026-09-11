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
 *
 * A building grows with its level. The first level is the picture; each
 * level after it adds to that picture rather than replacing it, so a
 * raised Storehouse is the same barn with a wing on it and a raised anchor
 * is the same splinter with more of the Abyss come through around it. A
 * building at level zero is drawn at its first level, faint, as the plot's
 * footprint.
 */

export type CampPlotId = CampBuildingId | 'trophy-hall'

interface CampBuildingArtProps {
  plotId: CampPlotId
  /** Level zero draws the same picture as a footprint: what the plot could be. */
  built: boolean
  /** How far the building has been raised; one when unbuilt, for the footprint. */
  level?: number
}

const TIMBER = '#3b2a1e'
const TIMBER_LIGHT = '#5a3f2b'
const STONE = '#3a4150'
const STONE_LIGHT = '#556074'
const LANTERN = '#fbbf24'
const EMBER = '#f97316'
const RIFT = '#a78bfa'
const RIFT_DEEP = '#4c1d95'
const WATER = '#22d3ee'
const PINE = '#1a2e22'
const DOOR = '#120c08'

function Lantern({ x, y }: { x: number, y: number }) {
  return (
    <g className="camp-art-lantern">
      <circle cx={x} cy={y} r="7" fill={LANTERN} opacity="0.22" />
      <rect x={x - 2} y={y - 3} width="4" height="6" rx="1" fill={LANTERN} />
    </g>
  )
}

/** A barn; a wing on it at two; a loft and a second lantern at three. */
function Storehouse({ level }: { level: number }) {
  return (
    <>
      {level >= 2 ? (
        <>
          <rect x="88" y="46" width="24" height="20" fill={TIMBER} />
          <polygon points="86,48 100,34 114,48" fill={TIMBER_LIGHT} />
          <rect x="96" y="52" width="7" height="6" fill={DOOR} />
        </>
      ) : null}
      <rect x="28" y="36" width="64" height="30" fill={TIMBER} />
      <polygon points="24,38 60,14 96,38" fill={TIMBER_LIGHT} />
      {level >= 3 ? (
        <>
          <rect x="50" y="20" width="20" height="14" fill={TIMBER} />
          <polygon points="46,22 60,8 74,22" fill={TIMBER_LIGHT} />
          <rect x="57" y="24" width="6" height="7" fill={DOOR} />
          <Lantern x={60} y={28} />
        </>
      ) : null}
      <rect x="54" y="46" width="12" height="20" fill={DOOR} />
      <rect x="34" y="42" width="8" height="7" fill={DOOR} />
      <rect x="78" y="42" width="8" height="7" fill={DOOR} />
      <rect x="20" y="66" width={level >= 2 ? 96 : 80} height="3" fill={STONE} />
      <Lantern x={72} y={50} />
    </>
  )
}

/** Three pines and a stack; a sawhorse and a taller stack at two. */
function Woodline({ level }: { level: number }) {
  return (
    <>
      <polygon points="18,66 30,24 42,66" fill={PINE} />
      <polygon points="36,66 50,16 64,66" fill="#22392b" />
      <polygon points="58,66 68,30 78,66" fill={PINE} />
      <rect x="82" y="56" width="26" height="6" rx="3" fill={TIMBER_LIGHT} />
      <rect x="86" y="50" width="18" height="6" rx="3" fill={TIMBER} />
      <rect x="90" y="44" width="10" height="6" rx="3" fill={TIMBER_LIGHT} />
      {level >= 2 ? (
        <>
          <rect x="92" y="38" width="6" height="6" rx="3" fill={TIMBER} />
          <line x1="4" y1="48" x2="20" y2="48" stroke={TIMBER_LIGHT} strokeWidth="3" />
          <line x1="6" y1="48" x2="4" y2="66" stroke={TIMBER} strokeWidth="2" />
          <line x1="18" y1="48" x2="20" y2="66" stroke={TIMBER} strokeWidth="2" />
          <line x1="2" y1="50" x2="22" y2="42" stroke={TIMBER_LIGHT} strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="10" y="58" width="8" height="8" fill={TIMBER} />
          <line x1="14" y1="58" x2="22" y2="46" stroke={STONE_LIGHT} strokeWidth="2" />
          <rect x="20" y="42" width="6" height="6" fill={STONE_LIGHT} />
        </>
      )}
      <rect x="6" y="66" width="108" height="3" fill={STONE} />
    </>
  )
}

/** A cut face and a cart; a ladder up the face and a second cart at two. */
function Quarry({ level }: { level: number }) {
  return (
    <>
      <polygon points="40,66 52,30 70,22 96,18 112,66" fill={STONE} />
      <polygon points="56,66 64,40 80,32 96,30 104,66" fill={STONE_LIGHT} />
      <rect x="66" y="50" width="12" height="10" fill={STONE} />
      <rect x="80" y="54" width="10" height="8" fill={STONE} />
      {level >= 2 ? (
        <>
          <line x1="90" y1="30" x2="86" y2="66" stroke={TIMBER_LIGHT} strokeWidth="2" />
          <line x1="98" y1="30" x2="94" y2="66" stroke={TIMBER_LIGHT} strokeWidth="2" />
          {[36, 42, 48, 54, 60].map((y) => (
            <line key={y} x1={90 - (y - 30) / 9} y1={y} x2={98 - (y - 30) / 9} y2={y} stroke={TIMBER_LIGHT} strokeWidth="1.5" />
          ))}
          <rect x="24" y="36" width="8" height="8" fill={STONE_LIGHT} />
          <rect x="34" y="40" width="8" height="8" fill={STONE_LIGHT} />
        </>
      ) : null}
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

/** One splinter; two more and a ring of stones at two; a crown of shards at three. */
function RiftAnchor({ level }: { level: number }) {
  return (
    <>
      <ellipse cx="60" cy="64" rx={level >= 2 ? 40 : 30} ry="6" fill={RIFT} opacity="0.18" />
      <ellipse cx="60" cy="64" rx="18" ry="3.5" fill={RIFT} opacity="0.3" />
      {level >= 2 ? (
        <>
          {[22, 34, 86, 98].map((x) => (
            <rect key={x} x={x - 3} y="58" width="6" height="7" rx="1" fill={STONE} />
          ))}
          <polygon points="26,64 32,36 38,64" fill={RIFT_DEEP} />
          <polygon points="30,64 32,44 34,64" fill={RIFT} opacity="0.7" />
          <polygon points="82,64 88,40 94,64" fill={RIFT_DEEP} />
          <polygon points="86,64 88,46 90,64" fill={RIFT} opacity="0.7" />
        </>
      ) : null}
      <polygon points="48,64 56,20 62,10 68,26 72,64" fill={RIFT_DEEP} />
      <polygon points="54,64 58,26 62,14 64,30 66,64" fill={RIFT} opacity="0.9" />
      <polygon points="36,64 40,44 46,64" fill={RIFT_DEEP} />
      <polygon points="76,64 82,40 88,64" fill={RIFT_DEEP} />
      {level >= 3 ? (
        <g className="camp-art-pulse">
          <polygon points="44,18 47,10 50,18" fill={RIFT} opacity="0.8" />
          <polygon points="72,14 75,6 78,14" fill={RIFT} opacity="0.8" />
          <polygon points="58,6 61,0 64,6" fill={RIFT} opacity="0.8" />
        </g>
      ) : null}
      <circle cx="62" cy="12" r={level >= 3 ? 8 : 6} fill={RIFT} opacity="0.4" className="camp-art-pulse" />
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
      <rect x="56" y="48" width="10" height="18" fill={DOOR} />
      <circle cx="74" cy="16" r="4" fill="#94a3b8" opacity="0.45" className="camp-art-smoke camp-art-smoke-one" />
      <circle cx="78" cy="8" r="5" fill="#94a3b8" opacity="0.3" className="camp-art-smoke camp-art-smoke-two" />
      <circle cx="84" cy="2" r="6" fill="#94a3b8" opacity="0.18" className="camp-art-smoke camp-art-smoke-three" />
      <Lantern x={46} y={52} />
      <rect x="28" y="66" width="64" height="3" fill={STONE} />
    </>
  )
}

/** A hearth and an anvil; a chimney and a quench barrel at two; a roof over it all at three. */
function Forge({ level }: { level: number }) {
  return (
    <>
      {level >= 3 ? (
        <>
          <rect x="20" y="16" width="4" height="50" fill={TIMBER} />
          <rect x="104" y="16" width="4" height="50" fill={TIMBER} />
          <polygon points="14,20 64,4 114,20 114,24 14,24" fill={TIMBER_LIGHT} />
        </>
      ) : null}
      <rect x="30" y="34" width="36" height="32" fill={STONE} />
      {level >= 2 ? (
        <>
          <rect x="40" y="10" width="16" height="26" fill={STONE_LIGHT} />
          <rect x="38" y="8" width="20" height="3" fill={STONE} />
          <circle cx="48" cy="4" r="4" fill="#94a3b8" opacity="0.35" className="camp-art-smoke camp-art-smoke-one" />
          <circle cx="52" cy="-2" r="5" fill="#94a3b8" opacity="0.22" className="camp-art-smoke camp-art-smoke-two" />
          <rect x="70" y="46" width="12" height="16" rx="2" fill={TIMBER} />
          <ellipse cx="76" cy="47" rx="6" ry="2" fill={WATER} opacity="0.45" />
        </>
      ) : (
        <rect x="40" y="22" width="16" height="14" fill={STONE_LIGHT} />
      )}
      <rect x="36" y="46" width="24" height="14" rx="2" fill="#1a0a04" />
      <ellipse cx="48" cy="56" rx="9" ry="3" fill={EMBER} className="camp-art-coals" />
      <ellipse cx="48" cy="55" rx="4" ry="1.6" fill={LANTERN} className="camp-art-coals" />
      <rect x={level >= 2 ? 84 : 76} y="50" width="26" height="6" rx="1" fill={STONE} />
      <rect x={level >= 2 ? 92 : 84} y="56" width="10" height="8" fill={STONE_LIGHT} />
      <rect x={level >= 2 ? 88 : 80} y="64" width="18" height="3" fill={STONE} />
      <rect x="22" y="66" width="80" height="3" fill={STONE} />
    </>
  )
}

function TrophyHall() {
  return (
    <>
      <rect x="20" y="34" width="80" height="32" fill={TIMBER} />
      <polygon points="16,36 60,12 104,36" fill={TIMBER_LIGHT} />
      <rect x="54" y="46" width="12" height="20" fill={DOOR} />
      <rect x="30" y="40" width="8" height="14" fill={RIFT} opacity="0.55" />
      <rect x="82" y="40" width="8" height="14" fill={EMBER} opacity="0.55" />
      <rect x="12" y="66" width="96" height="3" fill={STONE} />
    </>
  )
}

const ART: Record<CampPlotId, (level: number) => ReactElement> = {
  storehouse: (level) => <Storehouse level={level} />,
  woodline: (level) => <Woodline level={level} />,
  quarry: (level) => <Quarry level={level} />,
  'tackle-bench': () => <TackleBench />,
  'rift-anchor': (level) => <RiftAnchor level={level} />,
  smokehouse: () => <Smokehouse />,
  forge: (level) => <Forge level={level} />,
  'trophy-hall': () => <TrophyHall />,
}

export function CampBuildingArt({ plotId, built, level = 1 }: CampBuildingArtProps) {
  return (
    <svg
      className="camp-plot-art"
      viewBox="0 0 120 72"
      aria-hidden="true"
      focusable="false"
      data-built={built ? 'true' : 'false'}
      data-level={Math.max(1, level)}
    >
      {ART[plotId](Math.max(1, level))}
    </svg>
  )
}
