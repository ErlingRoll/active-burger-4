import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '../audio/SoundEffects'
import { RARITY_VISUALS, isRarity, type Rarity } from '../content/rarity/Rarity'
import { LootBoxIcon } from '../loot/LootBoxIcon'
import { BOX_RARITIES, createDivineGambaRandom } from './sim'

export interface DivineGambaRevealBox {
  ballIndex: number
  rarity: string
}

interface DivineGambaCaseRevealProps {
  /** The boxes that fell this drop, in the order the balls landed. */
  boxes: readonly DivineGambaRevealBox[]
  /** The play's seed: the cosmetic tiles are drawn from it, so a replay spins the same reel. */
  seed: number
  /** The machine's rarity weights, so the reel looks like the odds it hides. */
  weights: Readonly<Record<string, number>>
  reducedMotion: boolean
  onDone: () => void
}

/** Tiles on the reel; the winner sits near the end so the reel has room to run. */
const REEL_TILES = 44
const WINNER_INDEX = 37
/** Tile pitch in pixels: width plus gap. Mirrored by the stylesheet. */
const TILE_PITCH = 104
const SPIN_MS = 4200

function asRarity(value: string): Rarity {
  return isRarity(value) ? value : 'common'
}

/**
 * The reel for one box: cosmetic tiles either side of the true rarity, drawn
 * by weight from the play's seed and the ball's index, so two players who
 * won the same box see different reels and one player replaying sees the
 * same one.
 */
function buildReel(seed: number, ballIndex: number, rarity: string, weights: Readonly<Record<string, number>>): { tiles: Rarity[]; jitter: number } {
  const random = createDivineGambaRandom((seed ^ ((ballIndex + 1) * 0x9e3779b9)) >>> 0)
  const pool = BOX_RARITIES.map((name) => ({ name: asRarity(name), weight: Math.max(0, weights[name] ?? 0) }))
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  const draw = (): Rarity => {
    if (total <= 0) {
      return 'common'
    }
    let pick = random.nextUint() % total
    for (const entry of pool) {
      if (pick < entry.weight) {
        return entry.name
      }
      pick -= entry.weight
    }
    return 'common'
  }
  const tiles: Rarity[] = []
  for (let index = 0; index < REEL_TILES; index += 1) {
    tiles.push(index === WINNER_INDEX ? asRarity(rarity) : draw())
  }
  // Where inside the winning tile the marker stops: never dead centre, never
  // on the edge, so the stop reads as chance rather than a snap.
  const jitter = (random.nextUnit() - 0.5) * TILE_PITCH * 0.6
  return { tiles, jitter }
}

/**
 * A box, opened the way a case is: a reel of boxes runs past a marker and
 * slows onto the one that fell. The rarity was decided by the simulation
 * before the reel starts; the reel is theatre, and honest theatre, because
 * it can only stop where the ball's roll already said.
 */
export function DivineGambaCaseReveal({ boxes, seed, weights, reducedMotion, onDone }: DivineGambaCaseRevealProps) {
  const [position, setPosition] = useState(0)
  const box = boxes[position]
  if (box === undefined) {
    return null
  }
  const collect = (): void => {
    if (position + 1 < boxes.length) {
      setPosition(position + 1)
    } else {
      onDone()
    }
  }
  return (
    <CaseReel
      key={position}
      box={box}
      position={position}
      count={boxes.length}
      seed={seed}
      weights={weights}
      reducedMotion={reducedMotion}
      onCollect={collect}
    />
  )
}

interface CaseReelProps {
  box: DivineGambaRevealBox
  position: number
  count: number
  seed: number
  weights: Readonly<Record<string, number>>
  reducedMotion: boolean
  onCollect: () => void
}

/**
 * One box's reel. Mounted fresh per box (the parent keys it by position),
 * so its state starts where a reel starts and never has to be reset.
 */
function CaseReel({ box, position, count, seed, weights, reducedMotion, onCollect }: CaseReelProps) {
  const [phase, setPhase] = useState<'spinning' | 'revealed'>(() => reducedMotion ? 'revealed' : 'spinning')
  const [offset, setOffset] = useState(0)
  const windowRef = useRef<HTMLDivElement>(null)
  const reelRef = useRef<HTMLDivElement>(null)
  const collectRef = useRef<HTMLButtonElement>(null)
  const reel = useMemo(() => buildReel(seed, box.ballIndex, box.rarity, weights), [seed, box, weights])
  const rarity = asRarity(box.rarity)
  const visual = RARITY_VISUALS[rarity]

  // The spin: a frame after mounting, the reel is sent to the winner so the
  // transition runs from its start rather than appearing there.
  useEffect(() => {
    if (reducedMotion) {
      return
    }
    playSound('gamba-box')
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const width = windowRef.current?.clientWidth ?? 0
        setOffset(-(WINNER_INDEX * TILE_PITCH + TILE_PITCH / 2 - width / 2 + reel.jitter))
      })
    })
    return () => { cancelAnimationFrame(frame) }
  }, [reducedMotion, reel])

  // The reel's ticks: one each time a tile crosses the marker.
  useEffect(() => {
    if (phase !== 'spinning' || offset === 0) {
      return
    }
    let frame = 0
    let lastTile = -1
    const width = windowRef.current?.clientWidth ?? 0
    const tick = (): void => {
      const element = reelRef.current
      if (element !== null && typeof getComputedStyle === 'function') {
        const transform = getComputedStyle(element).transform
        const match = /matrix\(([^)]+)\)/.exec(transform)
        const translate = match ? Number(match[1]?.split(',')[4] ?? 0) : 0
        const tile = Math.floor((width / 2 - translate) / TILE_PITCH)
        if (tile !== lastTile) {
          lastTile = tile
          playSound('gamba-reel-tick')
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame) }
  }, [phase, offset])

  // The reveal: the stop, the rarity's own cue, and focus on the button.
  useEffect(() => {
    if (phase !== 'revealed') {
      return
    }
    playSound('gamba-reel-stop')
    playSound(`reveal-${rarity}`)
    collectRef.current?.focus()
  }, [phase, rarity])

  return createPortal(
    <div
      className="divine-gamba-reveal"
      data-phase={phase}
      data-rarity={phase === 'revealed' ? rarity : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening box ${position + 1} of ${count}`}
      style={{ '--reveal-color': visual.color } as React.CSSProperties}
    >
      <div className="divine-gamba-reveal-card">
        <p className="screen-kicker">{count === 1 ? 'A box fell out' : `Box ${position + 1} of ${count}`}</p>
        <div className="divine-gamba-reel-window" ref={windowRef}>
          <div className="divine-gamba-reel-marker" aria-hidden="true" />
          <div
            className="divine-gamba-reel"
            ref={reelRef}
            style={{ transform: `translateX(${offset}px)`, transitionDuration: reducedMotion ? '0ms' : `${SPIN_MS}ms` }}
            onTransitionEnd={(event) => {
              if (event.propertyName === 'transform' && phase === 'spinning') {
                setPhase('revealed')
              }
            }}
          >
            {reel.tiles.map((tile, index) => (
              <div
                className="divine-gamba-reel-tile"
                key={index}
                data-rarity={tile}
                data-winner={index === WINNER_INDEX ? 'true' : undefined}
                style={{ '--tile-color': RARITY_VISUALS[tile].color } as React.CSSProperties}
                aria-hidden="true"
              >
                <LootBoxIcon rarity={tile} />
              </div>
            ))}
          </div>
        </div>
        <div className="divine-gamba-reveal-result" role="status" aria-live="polite">
          {phase === 'revealed' ? (
            <>
              <LootBoxIcon rarity={rarity} opening />
              <strong style={{ color: visual.color }}>{visual.label} loot box</strong>
            </>
          ) : (
            <span>Opening…</span>
          )}
        </div>
        <button
          ref={collectRef}
          className="primary-action"
          type="button"
          data-sfx="confirm"
          disabled={phase !== 'revealed'}
          onClick={onCollect}
        >
          {position + 1 < count ? 'Next box' : 'Collect'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
