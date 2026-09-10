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
 * What the player's primary target is chosen from.
 *
 * The engagement range is injected rather than computed here, because it
 * depends on the equipped weapon and belongs to the combat system. Passing it
 * in is what keeps this module a leaf that the combat system may import.
 */
export interface PrimaryTargetOptions {
  originX: number
  originY: number
  /** The distance inside which a candidate can be attacked at all. */
  getEngagementRange: (target: Readonly<EnemyState | BossState>) => number
}

/**
 * Whether a candidate is close enough to be attacked.
 *
 * `Math.hypot` rather than a squared comparison, deliberately: this is the
 * gate the combat system has always used, and the two can disagree in the last
 * bit exactly at the boundary. Ordering below still uses squared distance,
 * which is only ever compared against another squared distance.
 */
function isWithinEngagementRange(
  target: Readonly<EnemyState | BossState>,
  options: PrimaryTargetOptions,
): boolean {
  return Math.hypot(target.x - options.originX, target.y - options.originY) <=
    options.getEngagementRange(target)
}

/**
 * Chooses the player's primary target: the enemy the basic attack aims at, and
 * the point an area weapon centres on.
 *
 * One policy in one place. The combat system had two implementations of it —
 * one scanning for a minimum, one sorting an array — which agreed only because
 * nobody had changed either. Both now come here.
 *
 * Ordering is distance ascending, then EntityId ascending, so the choice never
 * depends on the order enemies happen to be stored in.
 */
export function selectPrimaryTarget(
  state: Pick<GameState, 'enemies'> & Partial<Pick<GameState, 'bosses'>>,
  options: PrimaryTargetOptions,
): (EnemyState | BossState) | undefined {
  let best: EnemyState | BossState | undefined
  let bestDistanceSquared = Number.POSITIVE_INFINITY

  const consider = (target: EnemyState | BossState): void => {
    if (target.hp <= 0 || !isWithinEngagementRange(target, options)) {
      return
    }
    const offsetX = target.x - options.originX
    const offsetY = target.y - options.originY
    const targetDistanceSquared = offsetX * offsetX + offsetY * offsetY
    if (
      targetDistanceSquared < bestDistanceSquared ||
      (targetDistanceSquared === bestDistanceSquared &&
        (best === undefined || target.id < best.id))
    ) {
      best = target
      bestDistanceSquared = targetDistanceSquared
    }
  }

  for (const enemy of state.enemies) {
    consider(enemy)
  }
  for (const boss of state.bosses ?? []) {
    consider(boss)
  }

  return best
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

  spatialHash.forEachRadiusUnsorted(
    query.originX,
    query.originY,
    query.maxRange,
    (enemy) => {
    if (enemy.id === query.excludeTargetId) {
      return
    }
    const offsetX = enemy.x - query.originX
    const offsetY = enemy.y - query.originY
    const distanceSquared = offsetX * offsetX + offsetY * offsetY

    if (distanceSquared > maxRangeSquared) {
      return
    }

    if (
      distanceSquared < nearestDistanceSquared ||
      (distanceSquared === nearestDistanceSquared &&
        (nearest === undefined || enemy.id < nearest.id))
    ) {
      nearest = enemy
      nearestDistanceSquared = distanceSquared
    }
    },
  )

  return nearest
}
