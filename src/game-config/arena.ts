export interface ArenaBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface WorldPosition {
  x: number
  y: number
}

export const ARENA_BOUNDS: Readonly<ArenaBounds> = {
  minX: -1_500,
  maxX: 1_500,
  minY: -1_500,
  maxY: 1_500,
}

const BOUNDARY_EPSILON = 0.000001

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function getPlayerArenaBounds(radius: number): ArenaBounds {
  const safeRadius = Math.min(
    Math.max(0, finiteOr(radius, 0)),
    (ARENA_BOUNDS.maxX - ARENA_BOUNDS.minX) / 2,
    (ARENA_BOUNDS.maxY - ARENA_BOUNDS.minY) / 2,
  )
  const minX = ARENA_BOUNDS.minX + safeRadius
  const maxX = ARENA_BOUNDS.maxX - safeRadius
  const minY = ARENA_BOUNDS.minY + safeRadius
  const maxY = ARENA_BOUNDS.maxY - safeRadius
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  }
}

export function clampPlayerPosition(
  x: number,
  y: number,
  radius: number,
): WorldPosition {
  const bounds = getPlayerArenaBounds(radius)
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, finiteOr(x, 0))),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, finiteOr(y, 0))),
  }
}

export function projectPointToPlayerArena(
  x: number,
  y: number,
  radius: number,
): WorldPosition {
  return clampPlayerPosition(x, y, radius)
}

export function constrainPlayerMovementDirection(
  x: number,
  y: number,
  radius: number,
  directionX: number,
  directionY: number,
): { directionX: number; directionY: number } {
  const length = Math.hypot(directionX, directionY)
  if (!Number.isFinite(length) || length === 0) {
    return { directionX: 0, directionY: 0 }
  }

  const bounds = getPlayerArenaBounds(radius)
  const playerPosition = clampPlayerPosition(x, y, radius)
  const playerX = playerPosition.x
  const playerY = playerPosition.y
  let constrainedX = directionX / length
  let constrainedY = directionY / length

  const atLeftWall = playerX <= bounds.minX + BOUNDARY_EPSILON
  const atRightWall = playerX >= bounds.maxX - BOUNDARY_EPSILON
  const atTopWall = playerY <= bounds.minY + BOUNDARY_EPSILON
  const atBottomWall = playerY >= bounds.maxY - BOUNDARY_EPSILON

  if (atLeftWall && constrainedX < 0) {
    constrainedX = 0
  } else if (atRightWall && constrainedX > 0) {
    constrainedX = 0
  }
  if (atTopWall && constrainedY < 0) {
    constrainedY = 0
  } else if (atBottomWall && constrainedY > 0) {
    constrainedY = 0
  }

  const constrainedLength = Math.hypot(constrainedX, constrainedY)
  if (constrainedLength > 0) {
    return {
      directionX: constrainedX / constrainedLength,
      directionY: constrainedY / constrainedLength,
    }
  }

  // If a wall blocks every requested component, turn inward rather than
  // repeatedly pushing into a corner.
  const inwardX = atLeftWall ? 1 : atRightWall ? -1 : 0
  const inwardY = atTopWall ? 1 : atBottomWall ? -1 : 0
  const inwardLength = Math.hypot(inwardX, inwardY)
  return inwardLength > 0
    ? {
      directionX: inwardX / inwardLength,
      directionY: inwardY / inwardLength,
    }
    : { directionX: 0, directionY: 0 }
}
