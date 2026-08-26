import type { BossState, EnemyState, GameState } from '../state/GameState'
import { SpatialHash } from '../spatial/SpatialHash'

export interface TargetQuery {
  originX: number
  originY: number
  maxRange: number
  excludeTargetId?: number
}

export function createEnemySpatialHash(
  state: Pick<GameState, 'enemies'> & Partial<Pick<GameState, 'bosses'>>,
): SpatialHash<EnemyState | BossState> {
  const spatialHash = new SpatialHash<EnemyState | BossState>()
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      spatialHash.insert(enemy.id, enemy.x, enemy.y, enemy.radius, enemy)
    }
  }
  for (const boss of state.bosses ?? []) {
    if (boss.hp > 0) {
      spatialHash.insert(boss.id, boss.x, boss.y, boss.radius, boss)
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
  state: Pick<GameState, 'enemies'> & Partial<Pick<GameState, 'bosses'>>,
  spatialHash = createEnemySpatialHash(state),
): (EnemyState | BossState) | undefined {
  if (query.maxRange < 0) {
    return undefined
  }

  const maxRangeSquared = query.maxRange * query.maxRange
  let nearest: EnemyState | BossState | undefined
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  for (const enemy of spatialHash.queryRadius(
    query.originX,
    query.originY,
    query.maxRange,
  )) {
    if (enemy.id === query.excludeTargetId) {
      continue
    }
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
