import type {
  DodgeState,
  DodgeMovementCandidate,
  GameState,
  TelegraphState,
} from '../../state/GameState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import { applyMovementCandidate } from '../behavior/MovementCandidate'

function pointDistanceSquared(
  px: number,
  py: number,
  x: number,
  y: number,
): number {
  const dx = px - x
  const dy = py - y
  return dx * dx + dy * dy
}

function segmentDistanceSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return pointDistanceSquared(px, py, ax, ay)
  }
  const projection = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
  )
  return pointDistanceSquared(px, py, ax + projection * dx, ay + projection * dy)
}

function telegraphDistanceSquared(
  playerX: number,
  playerY: number,
  telegraph: TelegraphState,
): number {
  const first = telegraph.points[0]
  const last = telegraph.points[telegraph.points.length - 1]
  if (!first || !last) {
    return pointDistanceSquared(playerX, playerY, telegraph.x, telegraph.y)
  }
  return telegraph.kind === 'charge' ||
    telegraph.kind === 'flame-line' ||
    telegraph.kind === 'enemy-projectile'
    ? segmentDistanceSquared(playerX, playerY, first.x, first.y, last.x, last.y)
    : pointDistanceSquared(playerX, playerY, telegraph.x, telegraph.y)
}

/**
 * Produces a movement candidate only in response to an active telegraph. A
 * quiet run remains stationary and fully deterministic; movement is applied by
 * the behavior controller.
 */
export function getPlayerDodgeCandidate(
  state: GameState,
): DodgeMovementCandidate | undefined {
  const player = state.player
  const dodge: DodgeState = player.dodge ??= {
    mode: 'autonomous',
    level: 1,
    reactionTime: 0.1,
    lastDirectionX: 0,
    lastDirectionY: 0,
  }

  const telegraphs = [...(state.telegraphs ?? [])]
    .filter(
      (telegraph) =>
        telegraph.remainingDuration > 0 &&
        telegraph.remainingDuration <=
          Math.max(0, telegraph.duration - dodge.reactionTime),
    )
    .sort((left, right) => left.id - right.id)

  let directionX = 0
  let directionY = 0
  for (const telegraph of telegraphs) {
    const distanceSquared = telegraphDistanceSquared(player.x, player.y, telegraph)
    const dangerRadius = telegraph.radius + player.radius
    if (distanceSquared > dangerRadius * dangerRadius) {
      continue
    }

    const first = telegraph.points[0]
    const last = telegraph.points[telegraph.points.length - 1]
    const awayX = first && last &&
      (telegraph.kind === 'charge' ||
        telegraph.kind === 'flame-line' ||
        telegraph.kind === 'enemy-projectile')
      ? player.x - (first.x + last.x) / 2
      : player.x - telegraph.x
    const awayY = first && last &&
      (telegraph.kind === 'charge' || telegraph.kind === 'flame-line')
      ? player.y - (first.y + last.y) / 2
      : player.y - telegraph.y
    const length = Math.hypot(awayX, awayY)
    if (length > 0) {
      directionX += awayX / length
      directionY += awayY / length
    } else {
      // Entity IDs are stable, so the fallback is stable even at the origin.
      directionX += telegraph.id % 2 === 0 ? 1 : -1
    }
  }

  const directionLength = Math.hypot(directionX, directionY)
  if (directionLength === 0) {
    return undefined
  }
  directionX /= directionLength
  directionY /= directionLength
  dodge.lastDirectionX = directionX
  dodge.lastDirectionY = directionY
  return {
    source: 'dodge',
    directionX,
    directionY,
    speed: getDerivedPlayerStats(player).movementSpeed,
    priority: 100,
  }
}

export const getDodgeCandidate = getPlayerDodgeCandidate
export const createDodgeCandidate = getPlayerDodgeCandidate

/** Legacy name retained while callers migrate to the candidate contract. */
export function updatePlayerDodge(
  state: GameState,
  fixedStepSeconds = 0,
): DodgeMovementCandidate | undefined {
  const candidate = getPlayerDodgeCandidate(state)
  if (candidate) {
    applyMovementCandidate(state, candidate, fixedStepSeconds)
  }
  return candidate
}
