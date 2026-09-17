import { buildMachine, type DivineGambaMachine, rowY } from './machine.ts'
import { ballSeed, createDivineGambaRandom, type DivineGambaRandom } from './random.ts'
import { pocketPayout, rollBox } from './rewards.ts'
import type {
  DivineGambaBallOutcome,
  DivineGambaPlayInput,
  DivineGambaPlayOutcome,
} from './types.ts'

/**
 * The Divine Gamba simulation.
 *
 * Runs in the browser to animate a play and in the Edge Function to settle
 * it, and the two must agree to the last digit. That is why it is written the
 * way it is: a fixed timestep, plain doubles, and nothing but addition,
 * subtraction, multiplication, division, `Math.sqrt` and `Math.floor`, all of
 * which IEEE 754 rounds identically on every V8. No `Math.sin`, no
 * `Math.pow`, no `Math.hypot`, no `Math.random`, no `Date`. Iteration is by
 * ball index, then by row, then by peg, always.
 *
 * `SIM_VERSION` is stored on every play. Bump it whenever a change here would
 * alter where a ball lands, so a play begun under one version is never
 * settled by another.
 */
export const SIM_VERSION = 1

export const TICKS_PER_SECOND = 120
const DT = 1 / TICKS_PER_SECOND
const GRAVITY = 36
const RESTITUTION = 0.35
/** Tangential nudge on every peg hit, in pitches per second, spread either side of zero. */
const HIT_JITTER = 0.7
/** Sideways speed kept through a peg hit; below one, a ball settles into a column rather than skating across the board. */
const HIT_DAMPING = 0.92
const RELEASE_SPREAD = 0.34
const RELEASE_SPEED_SPREAD = 0.6
const WALL_RESTITUTION = 0.5
const SCATTER_DEAD_ZONE = 0.05
/** A ball still falling after this many ticks lands in the pocket beneath it. */
const MAX_TICKS = TICKS_PER_SECOND * 8
export const MAX_BALLS_PER_PLAY = 20

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

export function simulatePlay(input: DivineGambaPlayInput): DivineGambaPlayOutcome {
  if (!Number.isInteger(input.ballCount) || input.ballCount < 1 || input.ballCount > MAX_BALLS_PER_PLAY) {
    throw new Error(`A play holds 1 to ${MAX_BALLS_PER_PLAY} balls.`)
  }
  const machine = buildMachine(input.machine)
  const balls: DivineGambaBallOutcome[] = []
  /** Children spawned by a split, dropped after every paid ball has landed. */
  const pending: { parentIndex: number; ball: Ball; fromTick: number }[] = []
  let essenceWon = 0
  let boxCount = 0

  const settle = (outcome: DivineGambaBallOutcome): void => {
    balls.push(outcome)
    essenceWon += outcome.essenceWon
    if (outcome.boxRarity !== null) {
      boxCount += 1
    }
  }

  for (let index = 0; index < input.ballCount; index += 1) {
    const random = createDivineGambaRandom(ballSeed(input.seed, index))
    const ball: Ball = {
      x: (random.nextUnit() - 0.5) * RELEASE_SPREAD,
      y: machine.releaseY,
      vx: (random.nextUnit() - 0.5) * RELEASE_SPEED_SPREAD,
      vy: 0,
    }
    settle(drop(input, machine, ball, index, null, random, (child) => {
      pending.push({ parentIndex: index, ball: child, fromTick: 0 })
    }))
  }

  for (const child of pending) {
    const index = balls.length
    const random = createDivineGambaRandom(ballSeed(input.seed, index))
    settle(drop(input, machine, child.ball, index, child.parentIndex, random, null))
  }

  return { simVersion: SIM_VERSION, balls, essenceWon, boxCount }
}

function drop(
  input: DivineGambaPlayInput,
  machine: DivineGambaMachine,
  ball: Ball,
  ballIndex: number,
  parentIndex: number | null,
  random: DivineGambaRandom,
  onSplit: ((child: Ball) => void) | null,
): DivineGambaBallOutcome {
  const frames: number[] | undefined = input.recordFrames ? [] : undefined
  const hits: number[] | undefined = input.recordFrames ? [] : undefined
  const splitRow = machine.split !== null && onSplit !== null ? machine.split.row : -1
  const splitY = splitRow >= 0 ? rowY(splitRow) : Number.POSITIVE_INFINITY
  let splitRolled = false
  let tick = 0

  for (; tick < MAX_TICKS; tick += 1) {
    if (frames !== undefined) {
      frames.push(ball.x, ball.y)
    }
    // Forces.
    ball.vy += GRAVITY * machine.gravityScale * DT
    // Move.
    ball.x += ball.vx * DT
    ball.y += ball.vy * DT
    // Walls.
    const limit = machine.halfWidth - machine.ballRadius
    if (ball.x < -limit) {
      ball.x = -limit
      if (ball.vx < 0) {
        ball.vx = -ball.vx * WALL_RESTITUTION
      }
    } else if (ball.x > limit) {
      ball.x = limit
      if (ball.vx > 0) {
        ball.vx = -ball.vx * WALL_RESTITUTION
      }
    }
    // Pegs in the rows the ball could be touching.
    if (collide(machine, ball, random) && hits !== undefined) {
      hits.push(tick)
    }
    // A split happens once, the first time the ball passes its row.
    if (!splitRolled && ball.y >= splitY && machine.split !== null && onSplit !== null) {
      splitRolled = true
      if (random.nextBasisPoints() < machine.split.chanceBasisPoints) {
        onSplit({ x: ball.x, y: ball.y, vx: -ball.vx, vy: ball.vy })
      }
    }
    if (ball.y >= machine.floorY) {
      break
    }
  }

  const pocketIndex = pocketUnder(machine, ball.x)
  const boxRarity = rollBox(input.machine, pocketIndex, random)
  return {
    ballIndex,
    parentIndex,
    pocketIndex,
    // The number of ticks simulated, which is also the number of frames.
    landedTick: tick < MAX_TICKS ? tick + 1 : MAX_TICKS,
    essenceWon: pocketPayout(input.machine, pocketIndex, input.stakePrice),
    boxRarity,
    ...(frames === undefined ? {} : { frames }),
    ...(hits === undefined ? {} : { hits }),
  }
}

/** Resolves every peg the ball overlaps. Returns whether any hit was an impact rather than a rest. */
function collide(machine: DivineGambaMachine, ball: Ball, random: DivineGambaRandom): boolean {
  let struck = false
  const reach = machine.ballRadius + machine.pegRadius
  const lowest = Math.floor((ball.y - reach - rowY(0)) + 1)
  const highest = Math.floor((ball.y + reach - rowY(0)) + 1)
  const firstRow = lowest < 0 ? 0 : lowest
  const lastRow = highest >= machine.rows ? machine.rows - 1 : highest
  for (let row = firstRow; row <= lastRow; row += 1) {
    const pegs = machine.pegRows[row]
    if (pegs === undefined) {
      continue
    }
    for (let index = 0; index < pegs.length; index += 1) {
      const peg = pegs[index]
      if (peg === undefined) {
        continue
      }
      const dx = ball.x - peg.x
      if (dx > reach || dx < -reach) {
        continue
      }
      const dy = ball.y - peg.y
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared >= reach * reach) {
        continue
      }
      let nx: number
      let ny: number
      if (distanceSquared === 0) {
        // Balanced dead centre on a peg: the stream decides which way it falls.
        nx = random.nextUnit() < 0.5 ? -1 : 1
        ny = 0
      } else {
        const distance = Math.sqrt(distanceSquared)
        nx = dx / distance
        ny = dy / distance
      }
      ball.x = peg.x + nx * reach
      ball.y = peg.y + ny * reach
      const approach = ball.vx * nx + ball.vy * ny
      if (approach < 0) {
        // Only a real impact counts as a strike; a ball resting on a peg is
        // resolved every tick and would otherwise sound like a drum roll.
        if (approach < -1.5) {
          struck = true
        }
        ball.vx = (ball.vx - (1 + RESTITUTION) * approach * nx) * HIT_DAMPING
        ball.vy -= (1 + RESTITUTION) * approach * ny
        // A scattering board nudges outward on every hit, never in the
        // centre column, where a nudge from both sides would hold a ball
        // between two pegs.
        if (machine.scatterImpulse !== 0) {
          if (ball.x > SCATTER_DEAD_ZONE) {
            ball.vx += machine.scatterImpulse
          } else if (ball.x < -SCATTER_DEAD_ZONE) {
            ball.vx -= machine.scatterImpulse
          }
        }
      }
      const nudge = (random.nextUnit() - 0.5) * HIT_JITTER * machine.jitterScale
      ball.vx += -ny * nudge
      ball.vy += nx * nudge
    }
  }
  return struck
}

function pocketUnder(machine: DivineGambaMachine, x: number): number {
  const index = Math.floor(x + machine.rows / 2 + 0.5)
  if (index < 0) {
    return 0
  }
  return index > machine.rows ? machine.rows : index
}
