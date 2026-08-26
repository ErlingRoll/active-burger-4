import {
  getEntityPackThreatScore,
  type ThreatScoreDefinition,
} from '../../../content/behaviors/ThreatScoring'
import type {
  EnemyState,
  GameState,
  PlayerMovementCandidate,
} from '../../state/GameState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import { getPlayerDodgeCandidate } from '../movement/DodgeSystem'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfilePolicy,
  type BehaviorProfileId,
  type BehaviorProfilePolicy,
  type BehaviorProfileThresholds,
} from '../../../content/behaviors/BehaviorProfiles'

const BALANCED_POLICY = getBehaviorProfilePolicy(DEFAULT_BEHAVIOR_PROFILE_ID)

/** Backwards-compatible exports for callers that use the balanced policy. */
export const BEHAVIOR_INTENT_PRIORITIES = BALANCED_POLICY.intentPriorities
export const BEHAVIOR_INTENT_BALANCE = {
  ...BALANCED_POLICY.thresholds,
  commitmentSeconds: BALANCED_POLICY.commitmentSeconds,
  hysteresisPriority: BALANCED_POLICY.hysteresisPriority,
} as const

type ThreatEntity = EnemyState | NonNullable<GameState['bosses']>[number]

function livingThreats(state: GameState): ThreatEntity[] {
  return [
    ...state.enemies,
    ...(state.bosses ?? []),
  ]
    .filter((entity) => entity.hp > 0)
    .sort((left, right) => left.id - right.id)
}

function distanceSquared(
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
): number {
  const x = leftX - rightX
  const y = leftY - rightY
  return x * x + y * y
}

function direction(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fallbackId: number,
): { directionX: number; directionY: number } {
  const x = toX - fromX
  const y = toY - fromY
  const length = Math.hypot(x, y)
  if (length > 0) {
    return { directionX: x / length, directionY: y / length }
  }
  // Entity IDs make coincident entities deterministic without using RNG.
  return { directionX: fallbackId % 2 === 0 ? 1 : -1, directionY: 0 }
}

function threatScore(
  entity: ThreatEntity,
  threats: readonly ThreatEntity[],
  packRadius: number,
): number {
  return getEntityPackThreatScore(
    entity,
    threats,
    packRadius,
  )
}

function nearestPickup(
  state: GameState,
  kind: 'gear' | 'xp',
): GameState['pickups'][number] | undefined {
  return [...(state.pickups ?? [])]
    .filter((pickup) => pickup.kind === kind)
    .sort((left, right) =>
      distanceSquared(state.player.x, state.player.y, left.x, left.y) -
        distanceSquared(state.player.x, state.player.y, right.x, right.y) ||
      left.id - right.id,
    )[0]
}

function chooseCombatTarget(
  state: GameState,
  threats: readonly ThreatEntity[],
  thresholds: BehaviorProfileThresholds,
): ThreatEntity | undefined {
  const currentTarget = threats.find((entity) => entity.id === state.player.targetId)
  if (currentTarget) {
    return currentTarget
  }
  return [...threats]
    .sort((left, right) => {
      const scoreOrder =
        threatScore(right, threats, thresholds.packRadius) -
        threatScore(left, threats, thresholds.packRadius)
      if (scoreOrder !== 0) {
        return scoreOrder
      }
      const distanceOrder =
        distanceSquared(state.player.x, state.player.y, left.x, left.y) -
        distanceSquared(state.player.x, state.player.y, right.x, right.y)
      return distanceOrder || left.id - right.id
    })[0]
}

function createPickupCandidate(
  state: GameState,
  pickup: GameState['pickups'][number],
  speed: number,
  source: 'gear' | 'xp',
): PlayerMovementCandidate | undefined {
  const vector = direction(
    state.player.x,
    state.player.y,
    pickup.x,
    pickup.y,
    pickup.id,
  )
  if (
    distanceSquared(state.player.x, state.player.y, pickup.x, pickup.y) <=
    (state.player.radius + pickup.radius) ** 2
  ) {
    return undefined
  }
  return {
    source,
    ...vector,
    speed,
    priority: BEHAVIOR_INTENT_PRIORITIES[source],
    pickupId: pickup.id,
  }
}

function createKiteCandidate(
  state: GameState,
  threats: readonly ThreatEntity[],
  speed: number,
  totalThreatScore: number,
  policy: BehaviorProfilePolicy,
): PlayerMovementCandidate | undefined {
  const nearby = threats.filter((entity) => {
    const range = policy.thresholds.threatRadius + entity.radius
    return distanceSquared(state.player.x, state.player.y, entity.x, entity.y) <=
      range * range
  })
  if (nearby.length === 0) {
    return undefined
  }

  const strongest = chooseCombatTarget(state, nearby, policy.thresholds)
  if (totalThreatScore < policy.thresholds.kiteThreatScore) {
    return undefined
  }

  const nearestThreatDistance = nearby.reduce(
    (nearest, entity) => Math.min(
      nearest,
      Math.sqrt(distanceSquared(state.player.x, state.player.y, entity.x, entity.y)),
    ),
    Number.POSITIVE_INFINITY,
  )
  const isSingleManageableThreat = nearby.length === 1 &&
    !nearby[0].eliteModifier &&
    !('bossDefinitionId' in nearby[0]) &&
    threatScore(nearby[0], threats, policy.thresholds.packRadius) <=
      policy.thresholds.kiteThreatScore
  const engagementDistance = getDerivedPlayerStats(state.player).attackRange +
    state.player.radius
  if (isSingleManageableThreat && nearestThreatDistance >= engagementDistance) {
    return undefined
  }

  let awayX = 0
  let awayY = 0
  for (const entity of nearby) {
    const dx = state.player.x - entity.x
    const dy = state.player.y - entity.y
    const length = Math.hypot(dx, dy)
    const weight =
      threatScore(entity, threats, policy.thresholds.packRadius) /
      Math.max(1, length * length)
    if (length > 0) {
      awayX += dx / length * weight
      awayY += dy / length * weight
    }
  }
  const fallbackId = strongest?.id ?? state.player.id
  const vector = direction(
    0,
    0,
    awayX,
    awayY,
    fallbackId,
  )
  return {
    source: 'kite',
    ...vector,
    speed,
    priority: BEHAVIOR_INTENT_PRIORITIES.kite,
    targetId: strongest?.id,
  }
}

function createCombatRangeCandidate(
  state: GameState,
  target: ThreatEntity | undefined,
  speed: number,
): PlayerMovementCandidate | undefined {
  if (!target) {
    return undefined
  }
  const attackRange = Math.max(0, getDerivedPlayerStats(state.player).attackRange)
  // Movement holds the same center-to-center engagement boundary as targeting.
  const desiredDistance = attackRange + state.player.radius + target.radius
  const currentDistance = Math.sqrt(
    distanceSquared(state.player.x, state.player.y, target.x, target.y),
  )
  if (currentDistance <= desiredDistance) {
    return undefined
  }
  return {
    source: 'combat-range',
    ...direction(state.player.x, state.player.y, target.x, target.y, target.id),
    speed,
    priority: BEHAVIOR_INTENT_PRIORITIES['combat-range'],
    targetId: target.id,
  }
}

function createHoldCandidate(): PlayerMovementCandidate {
  return {
    source: 'hold',
    directionX: 0,
    directionY: 0,
    speed: 0,
    priority: BEHAVIOR_INTENT_PRIORITIES.hold,
  }
}

/**
 * Produces all player intents in their authored precedence order. The
 * controller is the only caller that applies one of these movements.
 */
export function getPlayerBehaviorCandidates(
  state: GameState,
): PlayerMovementCandidate[] {
  const profileId: BehaviorProfileId =
    state.player.behaviorController?.profileId ?? DEFAULT_BEHAVIOR_PROFILE_ID
  const policy = getBehaviorProfilePolicy(profileId)
  const playerStats = getDerivedPlayerStats(state.player)
  const threats = livingThreats(state)
  const playerThreats = threats.filter((entity) => {
    const range = policy.thresholds.threatRadius + entity.radius
    return distanceSquared(state.player.x, state.player.y, entity.x, entity.y) <=
      range * range
  })
  const totalThreatScore = playerThreats.reduce(
    (total, entity) =>
      total + threatScore(entity, threats, policy.thresholds.packRadius),
    0,
  )

  const candidates: PlayerMovementCandidate[] = []
  const dodge = getPlayerDodgeCandidate(state)
  if (dodge) {
    candidates.push({
      ...dodge,
      priority: policy.intentPriorities.dodge,
    })
  }

  const gearPickup = nearestPickup(state, 'gear')
  const xpPickup = nearestPickup(state, 'xp')
  const nearestThreatDistance = playerThreats.reduce(
    (nearest, entity) => Math.min(
      nearest,
      Math.sqrt(distanceSquared(state.player.x, state.player.y, entity.x, entity.y)),
    ),
    Number.POSITIVE_INFINITY,
  )
  if (
    gearPickup &&
    totalThreatScore <= policy.thresholds.safeGearThreatScore &&
    nearestThreatDistance >= policy.thresholds.safeGearDistance
  ) {
    const gear = createPickupCandidate(
      state,
      gearPickup,
      playerStats.movementSpeed,
      'gear',
    )
    if (gear) {
      candidates.push({
        ...gear,
        priority: policy.intentPriorities.gear,
      })
    }
  }
  if (
    xpPickup &&
    totalThreatScore <= policy.thresholds.safeGearThreatScore &&
    nearestThreatDistance >= policy.thresholds.safeGearDistance
  ) {
    const xp = createPickupCandidate(
      state,
      xpPickup,
      playerStats.movementSpeed,
      'xp',
    )
    if (xp) {
      candidates.push({
        ...xp,
        priority: policy.intentPriorities.xp,
      })
    }
  }

  const kite = createKiteCandidate(
    state,
    playerThreats,
    playerStats.movementSpeed,
    totalThreatScore,
    policy,
  )
  if (kite) {
    candidates.push({
      ...kite,
      priority: policy.intentPriorities.kite,
    })
  }

  const combatTarget = chooseCombatTarget(state, threats, policy.thresholds)
  const combatRange = createCombatRangeCandidate(
    state,
    combatTarget,
    playerStats.movementSpeed,
  )
  if (combatRange) {
    candidates.push({
      ...combatRange,
      priority: policy.intentPriorities['combat-range'],
    })
  }

  candidates.push({
    ...createHoldCandidate(),
    priority: policy.intentPriorities.hold,
  })
  return candidates
}

export const evaluateBehaviorIntents = getPlayerBehaviorCandidates
export const createBehaviorCandidates = getPlayerBehaviorCandidates

export function getThreatScore(
  entity: ThreatEntity,
  threats: readonly ThreatEntity[] = [entity],
): number {
  return threatScore(entity, threats, BALANCED_POLICY.thresholds.packRadius)
}

export function getPackThreatScore(
  entity: ThreatEntity,
  threats: readonly ThreatEntity[],
): number {
  return threatScore(entity, threats, BALANCED_POLICY.thresholds.packRadius)
}

export type { ThreatScoreDefinition }
