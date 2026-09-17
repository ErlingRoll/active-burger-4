import type { DivineGambaMachineConfig } from './types.ts'

/**
 * The board as the physics sees it: pegs, walls, a floor and the pockets.
 *
 * The geometry is in peg pitches. Row `r` holds `r + 3` pegs centred on the
 * board, so the last row holds `rows + 2` and the `rows + 1` gaps between
 * them are the pockets. A ball that clears the last row lands in the pocket
 * beneath it; the walls sit half a pitch outside the outermost pegs so the
 * outer pockets are reachable but not wide.
 */
export interface DivineGambaPeg {
  x: number
  y: number
}

export interface DivineGambaMachine {
  rows: number
  pegRows: DivineGambaPeg[][]
  /** The top of the board, where balls are released. */
  releaseY: number
  /** Past this line a ball has landed. */
  floorY: number
  halfWidth: number
  ballRadius: number
  pegRadius: number
  /** Multiplies gravity. One is the board as built. */
  gravityScale: number
  /** Multiplies the random nudge of a peg hit. One is the board as built. */
  jitterScale: number
  /** Sideways speed added away from the centre on every peg hit. Zero is no effect. */
  scatterImpulse: number
  split: { chanceBasisPoints: number; row: number } | null
}

export const ROW_PITCH = 1
export const FIRST_ROW_Y = 1.5
export const BALL_RADIUS = 0.27
export const PEG_RADIUS = 0.16
/** The outward nudge a scattering effect at 10000 basis points adds per hit, in pitches per second. */
const REFERENCE_SCATTER = 4

export function rowY(row: number): number {
  return FIRST_ROW_Y + row * ROW_PITCH
}

export function pocketCentreX(rows: number, pocketIndex: number): number {
  return (pocketIndex - rows / 2) * ROW_PITCH
}

export function buildMachine(config: DivineGambaMachineConfig): DivineGambaMachine {
  const pegRows: DivineGambaPeg[][] = []
  for (let row = 0; row < config.rows; row += 1) {
    const count = row + 3
    const pegs: DivineGambaPeg[] = []
    for (let index = 0; index < count; index += 1) {
      pegs.push({ x: (index - (count - 1) / 2) * ROW_PITCH, y: rowY(row) })
    }
    pegRows.push(pegs)
  }
  let gravityScale = 1
  let jitterScale = 1
  let scatterImpulse = 0
  let split: DivineGambaMachine['split'] = null
  for (const effect of config.effects) {
    if (effect.kind === 'scatter') {
      scatterImpulse += REFERENCE_SCATTER * effect.strengthBasisPoints / 10000
    } else if (effect.kind === 'gravity') {
      gravityScale *= effect.percent / 100
    } else if (effect.kind === 'jitter') {
      jitterScale *= effect.percent / 100
    } else if (effect.kind === 'split' && split === null) {
      split = { chanceBasisPoints: effect.chanceBasisPoints, row: effect.row }
    }
  }
  return {
    rows: config.rows,
    pegRows,
    releaseY: 0,
    floorY: rowY(config.rows) + 0.5,
    halfWidth: (config.rows + 3) / 2 * ROW_PITCH,
    ballRadius: BALL_RADIUS,
    pegRadius: PEG_RADIUS,
    gravityScale,
    jitterScale,
    scatterImpulse,
    split,
  }
}
