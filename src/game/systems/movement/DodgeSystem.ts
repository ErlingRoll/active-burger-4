import type { DodgeState, GameState, TelegraphState } from '../../state/GameState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'

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
  return telegraph.kind === 'charge'
    ? segmentDistanceSquared(playerX, playerY, first.x, first.y, last.x, last.y)
    : pointDistanceSquared(playerX, playerY, telegraph.x, telegraph.y)
}

/**
 * Baseline autonomous Dodge movement. It only moves in response to an active
 * telegraph, so a quiet run remains stationary and fully deterministic.
 */
export function updatePlayerDodge(state: GameState, fixedStepSeconds: number): void {
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
    const awayX = first && last && telegraph.kind === 'charge'
      ? player.x - (first.x + last.x) / 2
      : player.x - telegraph.x
    const awayY = first && last && telegraph.kind === 'charge'
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
    return
  }
  directionX /= directionLength
  directionY /= directionLength
  dodge.lastDirectionX = directionX
  dodge.lastDirectionY = directionY
  const speed = getDerivedPlayerStats(player).movementSpeed
  player.x += directionX * speed * Math.max(0, fixedStepSeconds)
  player.y += directionY * speed * Math.max(0, fixedStepSeconds)
}
