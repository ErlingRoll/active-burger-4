import type { EnemyState, GameState } from '../state/GameState'
import { SpatialHash } from '../spatial/SpatialHash'

export interface TargetQuery {
  originX: number
  originY: number
  maxRange: number
}

export function createEnemySpatialHash(
  state: Pick<GameState, 'enemies'>,
): SpatialHash<EnemyState> {
  const spatialHash = new SpatialHash<EnemyState>()
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      spatialHash.insert(enemy.id, enemy.x, enemy.y, enemy.radius, enemy)
    }
  }
  return spatialHash
}

/**
 * Finds the nearest living enemy within range. Distance is the primary
 * ordering key and EntityId is the stable tie-breaker, so this never depends
 * on the order in which enemies happen to be stored.
 */
export function findNearestEnemy(
  query: TargetQuery,
  state: Pick<GameState, 'enemies'>,
  spatialHash = createEnemySpatialHash(state),
): EnemyState | undefined {
  if (query.maxRange < 0) {
    return undefined
  }

  const maxRangeSquared = query.maxRange * query.maxRange
  let nearest: EnemyState | undefined
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  for (const enemy of spatialHash.queryRadius(
    query.originX,
    query.originY,
    query.maxRange,
  )) {
    const offsetX = enemy.x - query.originX
    const offsetY = enemy.y - query.originY
    const distanceSquared = offsetX * offsetX + offsetY * offsetY

    if (distanceSquared > maxRangeSquared) {
      continue
    }

    if (
      distanceSquared < nearestDistanceSquared ||
      (distanceSquared === nearestDistanceSquared &&
        (nearest === undefined || enemy.id < nearest.id))
    ) {
      nearest = enemy
      nearestDistanceSquared = distanceSquared
    }
  }

  return nearest
}
