import type { BossState, EnemyState, GameState } from '../state/GameState'
import { SpatialHash } from '../spatial/SpatialHash'
import {
  DEFAULT_TARGET_PRIORITY_ID,
  TARGET_FEATURE_KEYS,
  TARGET_PRIORITY_BALANCE,
  getTargetPriorityPolicy,
  type TargetFeatureKey,
  type TargetPriorityId,
} from '../../content/behaviors/TargetPriorities'
import { getEnemyDefinition } from '../../content/enemies/Enemies'
import { getEnemyAbilityForDefinition } from '../../content/enemies/EnemyAbilities'
import { getEliteModifierIds } from '../../content/enemies/EliteModifiers'
import { getBossSkillDefinition } from '../../content/bosses/Bosses'

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
  /** Which authored priority orders the reachable candidates. */
  priorityId?: TargetPriorityId
}

function clampUnit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/**
 * How far the candidate's own attacks reach, as a fraction of the longest
 * reach in the roster. The same computation the behavior system uses to decide
 * whether a threat is a ranged one.
 */
function getCandidateAttackRange(target: Readonly<EnemyState | BossState>): number {
  if ('bossDefinitionId' in target) {
    return Math.max(
      0,
      ...target.skills.map((skill) => getBossSkillDefinition(skill.skillId).range ?? 0),
    )
  }
  return getEnemyAbilityForDefinition(target.definitionId)?.range ?? 0
}

function getTargetFeature(
  feature: TargetFeatureKey,
  target: Readonly<EnemyState | BossState>,
  distance: number,
  engagementRange: number,
): number {
  switch (feature) {
    case 'boss':
      return 'bossDefinitionId' in target ? 1 : 0
    case 'eliteModifierCount':
      return getEliteModifierIds(target).length
    case 'missingHealthRatio': {
      /*
       * A ward counts as health. Without it a Wardbound elite behind a full
       * ward reads as nearly dead and draws every attack for nothing.
       */
      const effective = target.hp + (target.wardHp ?? 0)
      const maximum = target.maxHp + (target.wardMaxHp ?? 0)
      return maximum > 0 ? 1 - clampUnit(effective / maximum) : 1
    }
    case 'standoff':
      return !('bossDefinitionId' in target) &&
        getEnemyDefinition(target.definitionId).behavior.kind === 'standoff'
        ? 1
        : 0
    case 'abilityRange':
      return clampUnit(
        getCandidateAttackRange(target) / TARGET_PRIORITY_BALANCE.abilityRangeReference,
      )
    case 'proximity':
      return 1 - clampUnit(distance / Math.max(1, engagementRange))
  }
}

/**
 * How much the active priority wants this candidate.
 *
 * A zero weight is skipped rather than multiplied, which is what makes the
 * default free and correct at once: under `nearest` every weight is zero, so
 * no fact is computed and every candidate scores a literal zero. Multiplying
 * instead would be enough to break it, because `0 * NaN` is `NaN` and one
 * candidate with no maximum health would poison the comparison.
 */
export function getTargetPriorityScore(
  target: Readonly<EnemyState | BossState>,
  distance: number,
  options: PrimaryTargetOptions,
): number {
  return scoreCandidate(
    getTargetPriorityPolicy(options.priorityId ?? DEFAULT_TARGET_PRIORITY_ID).weights,
    target,
    distance,
    options,
  )
}

function scoreCandidate(
  weights: Readonly<Record<TargetFeatureKey, number>>,
  target: Readonly<EnemyState | BossState>,
  distance: number,
  options: PrimaryTargetOptions,
): number {
  let score = 0
  for (const feature of TARGET_FEATURE_KEYS) {
    const weight = weights[feature]
    if (weight === 0) {
      continue
    }
    score += weight *
      getTargetFeature(feature, target, distance, options.getEngagementRange(target))
  }
  return score
}

function isWeighted(weights: Readonly<Record<TargetFeatureKey, number>>): boolean {
  return TARGET_FEATURE_KEYS.some((feature) => weights[feature] !== 0)
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
 * Ordering is the priority's score descending, then distance ascending, then
 * EntityId ascending, so the choice never depends on the order enemies happen
 * to be stored in.
 */
export function selectPrimaryTarget(
  state: Pick<GameState, 'enemies'> & Partial<Pick<GameState, 'bosses'>>,
  options: PrimaryTargetOptions,
): (EnemyState | BossState) | undefined {
  const weights = getTargetPriorityPolicy(
    options.priorityId ?? DEFAULT_TARGET_PRIORITY_ID,
  ).weights
  /*
   * Under the default nothing is weighed, so no candidate is scored and not
   * even a square root is taken: the loop below is exactly the nearest-first
   * scan it replaced.
   */
  const weighted = isWeighted(weights)
  let best: EnemyState | BossState | undefined
  let bestScore = Number.NEGATIVE_INFINITY
  let bestDistanceSquared = Number.POSITIVE_INFINITY

  const consider = (target: EnemyState | BossState): void => {
    if (target.hp <= 0 || !isWithinEngagementRange(target, options)) {
      return
    }
    const offsetX = target.x - options.originX
    const offsetY = target.y - options.originY
    const targetDistanceSquared = offsetX * offsetX + offsetY * offsetY
    const score = weighted
      ? scoreCandidate(weights, target, Math.sqrt(targetDistanceSquared), options)
      : 0
    if (
      score > bestScore ||
      (score === bestScore &&
        (targetDistanceSquared < bestDistanceSquared ||
          (targetDistanceSquared === bestDistanceSquared &&
            (best === undefined || target.id < best.id))))
    ) {
      best = target
      bestScore = score
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
