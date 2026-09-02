import {
  getEntityPackThreatScore,
  type ThreatScoreDefinition,
} from '../../../content/behaviors/ThreatScoring'
import { getEnemyAbilityForDefinition } from '../../../content/enemies/EnemyAbilities'
import { getBossSkillDefinition } from '../../../content/bosses/Bosses'
import { RALLYING_BANNER_SKILL_ID } from '../../../content/skills/Skills'
import type {
  EnemyState,
  GameState,
  PlayerMovementCandidate,
} from '../../state/GameState'
import {
  getEffectivePlayerMovementSpeed,
} from '../../stats/DerivedStats'
import { getPlayerDodgeCandidate } from '../movement/DodgeSystem'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfilePolicy,
  type BehaviorProfileId,
  type BehaviorProfilePolicy,
  type BehaviorProfileThresholds,
} from '../../../content/behaviors/BehaviorProfiles'
import { getEntityThreatScore } from '../../../content/behaviors/ThreatScoring'
import { SpatialHash } from '../../spatial/SpatialHash'
import {
  constrainPlayerMovementDirection,
  getPlayerArenaBounds,
  projectPointToPlayerArena,
} from '../../../game-config/arena'
import { getBasicAttackEngagementRange } from '../combat/CombatSystem'
import {
  getEnemyCombatTarget,
  getEnemyInterceptPoint,
} from '../combat/EnemyBehaviors'

const BALANCED_POLICY = getBehaviorProfilePolicy(DEFAULT_BEHAVIOR_PROFILE_ID)
const KITE_WALL_MARGIN = 180
const KITE_SAMPLE_COUNT = 16
const KITE_PREDICTION_SECONDS = 0.75
const PROJECTILE_ROUTE_CLEARANCE = 28
const FLANKER_INTERCEPT_CLEARANCE = 72
const IMMINENT_PROJECTILE_RISK = 10_000
const PICKUP_DISTANCE_COST = 0.35
const PICKUP_PRIORITY_BONUS = 150
const BANNER_APPROACH_MARGIN = 120

/** Backwards-compatible exports for callers that use the balanced policy. */
export const BEHAVIOR_INTENT_PRIORITIES = BALANCED_POLICY.intentPriorities
export const BEHAVIOR_INTENT_BALANCE = {
  ...BALANCED_POLICY.thresholds,
  commitmentSeconds: BALANCED_POLICY.commitmentSeconds,
  hysteresisPriority: BALANCED_POLICY.hysteresisPriority,
} as const

type ThreatEntity = EnemyState | NonNullable<GameState['bosses']>[number]
type CollectiblePickupKind = 'gear' | 'xp' | 'healing-potion'

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

function createThreatSpatialIndex(
  threats: readonly ThreatEntity[],
): SpatialHash<ThreatEntity> {
  const hash = new SpatialHash<ThreatEntity>()
  for (const threat of threats) {
    hash.insert(threat.id, threat.x, threat.y, threat.radius, threat)
  }
  return hash
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
  spatialHash?: SpatialHash<ThreatEntity>,
): number {
  if (spatialHash) {
    const radiusSquared = Math.max(0, packRadius) ** 2
    const nearbyPackSize = spatialHash.queryRadiusUnsorted(
      entity.x,
      entity.y,
      Math.max(0, packRadius),
    ).filter((candidate) => {
      if (candidate.id === entity.id || candidate.hp <= 0) {
        return false
      }
      return distanceSquared(entity.x, entity.y, candidate.x, candidate.y) <=
        radiusSquared
    }).length
    return getEntityThreatScore(entity, nearbyPackSize)
  }
  return getEntityPackThreatScore(entity, threats, packRadius)
}

function pickupDistance(
  state: Readonly<GameState>,
  pickup: GameState['pickups'][number],
): number {
  return Math.max(
    0,
    Math.sqrt(distanceSquared(state.player.x, state.player.y, pickup.x, pickup.y)) -
      state.player.radius - pickup.radius,
  )
}

function pickupValue(
  state: Readonly<GameState>,
  pickup: GameState['pickups'][number],
): number {
  if (pickup.kind === 'xp') {
    return Math.min(PICKUP_PRIORITY_BONUS, pickup.xpAmount * 12)
  }
  if (pickup.kind === 'healing-potion') {
    return state.player.maxHp > 0
      ? Math.min(
          PICKUP_PRIORITY_BONUS * 2,
          (1 - Math.max(0, state.player.hp) / state.player.maxHp) *
            PICKUP_PRIORITY_BONUS * 2,
        )
      : PICKUP_PRIORITY_BONUS
  }
  return PICKUP_PRIORITY_BONUS
}

function bestPickup(
  state: GameState,
  kind: CollectiblePickupKind,
): GameState['pickups'][number] | undefined {
  return [...(state.pickups ?? [])]
    .filter((pickup) => pickup.kind === kind)
    .sort((left, right) =>
      pickupDistance(state, left) - pickupValue(state, left) -
        (pickupDistance(state, right) - pickupValue(state, right)) ||
      left.id - right.id,
    )[0]
}

function chooseCombatTarget(
  state: GameState,
  threats: readonly ThreatEntity[],
  thresholds: BehaviorProfileThresholds,
  threatScores: ReadonlyMap<ThreatEntity, number>,
): ThreatEntity | undefined {
  const currentTarget = threats.find((entity) => entity.id === state.player.targetId)
  if (
    currentTarget &&
    Math.sqrt(
      distanceSquared(
        state.player.x,
        state.player.y,
        currentTarget.x,
        currentTarget.y,
      ),
    ) <= getBasicAttackEngagementRange(state, currentTarget)
  ) {
    return currentTarget
  }
  let selected: ThreatEntity | undefined
  let selectedScore = Number.NEGATIVE_INFINITY
  for (const candidate of threats) {
    const candidateScore = threatScores.get(candidate) ??
      threatScore(candidate, threats, thresholds.packRadius)
    if (!selected) {
      selected = candidate
      selectedScore = candidateScore
      continue
    }
    if (candidateScore > selectedScore) {
      selected = candidate
      selectedScore = candidateScore
      continue
    }
    if (candidateScore !== selectedScore) {
      continue
    }
    const candidateDistance = distanceSquared(
      state.player.x,
      state.player.y,
      candidate.x,
      candidate.y,
    )
    const selectedDistance = distanceSquared(
      state.player.x,
      state.player.y,
      selected.x,
      selected.y,
    )
    if (
      candidateDistance < selectedDistance ||
      (candidateDistance === selectedDistance && candidate.id < selected.id)
    ) {
      selected = candidate
      selectedScore = candidateScore
    }
  }
  return selected
}

function getThreatAttackRange(entity: ThreatEntity): number {
  if ('bossDefinitionId' in entity) {
    return Math.max(
      0,
      ...entity.skills.map((skill) => getBossSkillDefinition(skill.skillId).range ?? 0),
    )
  }
  return getEnemyAbilityForDefinition(entity.definitionId)?.range ?? 0
}

function segmentDistanceSquared(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const directionX = endX - startX
  const directionY = endY - startY
  const lengthSquared = directionX * directionX + directionY * directionY
  if (lengthSquared === 0) {
    return distanceSquared(pointX, pointY, startX, startY)
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * directionX + (pointY - startY) * directionY) /
        lengthSquared,
    ),
  )
  return distanceSquared(
    pointX,
    pointY,
    startX + directionX * progress,
    startY + directionY * progress,
  )
}

function telegraphRiskAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
): number {
  return (state.telegraphs ?? []).reduce((risk, telegraph) => {
    if (telegraph.remainingDuration <= 0) {
      return risk
    }
    const first = telegraph.points[0]
    const last = telegraph.points[telegraph.points.length - 1]
    const isLine = telegraph.kind === 'charge' ||
      telegraph.kind === 'flame-line' ||
      telegraph.kind === 'enemy-projectile'
    const distance = isLine && first && last
      ? segmentDistanceSquared(x, y, first.x, first.y, last.x, last.y)
      : distanceSquared(x, y, telegraph.x, telegraph.y)
    const dangerRadius = telegraph.radius + state.player.radius
    return distance <= dangerRadius * dangerRadius ? risk + 10_000 : risk
  }, 0)
}

function hostileProjectileRiskAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
): number {
  const playerVelocityX = (x - state.player.x) / KITE_PREDICTION_SECONDS
  const playerVelocityY = (y - state.player.y) / KITE_PREDICTION_SECONDS
  let risk = 0

  for (const projectile of state.projectiles ?? []) {
    if (
      !projectile.hostile ||
      projectile.targetId !== state.player.id ||
      projectile.remainingLifetime <= 0
    ) {
      continue
    }
    const horizon = Math.min(
      KITE_PREDICTION_SECONDS,
      projectile.remainingLifetime,
    )
    const relativeX = projectile.x - state.player.x
    const relativeY = projectile.y - state.player.y
    const relativeVelocityX = projectile.velocityX - playerVelocityX
    const relativeVelocityY = projectile.velocityY - playerVelocityY
    const relativeVelocityLengthSquared =
      relativeVelocityX * relativeVelocityX +
      relativeVelocityY * relativeVelocityY
    const closestTime = relativeVelocityLengthSquared > 0
      ? Math.max(
        0,
        Math.min(
          horizon,
          -(
            relativeX * relativeVelocityX +
            relativeY * relativeVelocityY
          ) / relativeVelocityLengthSquared,
        ),
      )
      : 0
    const closestX = relativeX + relativeVelocityX * closestTime
    const closestY = relativeY + relativeVelocityY * closestTime
    const closestDistance = Math.hypot(closestX, closestY)
    const collisionRadius = state.player.radius + projectile.radius
    if (closestDistance <= collisionRadius) {
      risk += IMMINENT_PROJECTILE_RISK
      continue
    }
    const clearanceRadius = collisionRadius + PROJECTILE_ROUTE_CLEARANCE
    if (closestDistance < clearanceRadius) {
      risk += (clearanceRadius - closestDistance) / PROJECTILE_ROUTE_CLEARANCE
    }
  }
  return risk
}

function flankerInterceptRiskAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
  threats: readonly ThreatEntity[],
  threatScores: ReadonlyMap<ThreatEntity, number>,
): number {
  const playerVelocityX = (x - state.player.x) / KITE_PREDICTION_SECONDS
  const playerVelocityY = (y - state.player.y) / KITE_PREDICTION_SECONDS
  let risk = 0
  for (const threat of threats) {
    if ('bossDefinitionId' in threat || getEnemyCombatTarget(state, threat).id !== state.player.id) {
      continue
    }
    const intercept = getEnemyInterceptPoint(
      threat,
      state.player,
      playerVelocityX,
      playerVelocityY,
    )
    if (!intercept) {
      continue
    }
    const distance = Math.hypot(x - intercept.x, y - intercept.y)
    const dangerRadius = state.player.radius + threat.radius +
      FLANKER_INTERCEPT_CLEARANCE
    const pressure = Math.max(0, (dangerRadius - distance) / dangerRadius)
    risk += (threatScores.get(threat) ?? 0) * pressure * pressure * 4
  }
  return risk
}

function kiteRiskAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
  threats: readonly ThreatEntity[],
  threatScores: ReadonlyMap<ThreatEntity, number>,
  strongest: ThreatEntity | undefined,
): number {
  const bounds = getPlayerArenaBounds(state.player.radius)
  const wallDistance = Math.min(
    x - bounds.minX,
    bounds.maxX - x,
    y - bounds.minY,
    bounds.maxY - y,
  )
  let risk = telegraphRiskAt(state, x, y) +
    hostileProjectileRiskAt(state, x, y) +
    flankerInterceptRiskAt(state, x, y, threats, threatScores) +
    Math.max(0, KITE_WALL_MARGIN - wallDistance) / KITE_WALL_MARGIN

  for (const threat of threats) {
    const distance = Math.max(1, Math.hypot(x - threat.x, y - threat.y))
    const predictedDistance = Math.max(
      1,
      distance - Math.max(0, threat.speed) * KITE_PREDICTION_SECONDS,
    )
    const dangerRange = state.player.radius + threat.radius +
      getThreatAttackRange(threat)
    const pressureRange = Math.max(1, dangerRange + threat.speed * KITE_PREDICTION_SECONDS)
    const pressure = Math.max(0, (pressureRange - predictedDistance) / pressureRange)
    risk += (threatScores.get(threat) ?? 0) * pressure * pressure
  }

  if (strongest) {
    const desiredDistance = getBasicAttackEngagementRange(state, strongest)
    const distance = Math.hypot(x - strongest.x, y - strongest.y)
    risk += Math.max(0, distance - desiredDistance) / Math.max(1, desiredDistance) * 0.2
  }
  return risk
}

function createProjectileDodgeCandidate(
  state: GameState,
  threats: readonly ThreatEntity[],
  speed: number,
  threatScores: ReadonlyMap<ThreatEntity, number>,
): PlayerMovementCandidate | undefined {
  const currentX = state.player.x +
    (state.player.movementVelocityX ?? 0) * KITE_PREDICTION_SECONDS
  const currentY = state.player.y +
    (state.player.movementVelocityY ?? 0) * KITE_PREDICTION_SECONDS
  if (hostileProjectileRiskAt(state, currentX, currentY) < IMMINENT_PROJECTILE_RISK) {
    return undefined
  }

  let safestDirection: { directionX: number; directionY: number } | undefined
  let safestRisk = Number.POSITIVE_INFINITY
  for (let index = 0; index < KITE_SAMPLE_COUNT; index += 1) {
    const angle = Math.PI * 2 * index / KITE_SAMPLE_COUNT
    const constrainedDirection = constrainPlayerMovementDirection(
      state.player.x,
      state.player.y,
      state.player.radius,
      Math.cos(angle),
      Math.sin(angle),
    )
    const projectedPosition = projectPointToPlayerArena(
      state.player.x + constrainedDirection.directionX * speed * KITE_PREDICTION_SECONDS,
      state.player.y + constrainedDirection.directionY * speed * KITE_PREDICTION_SECONDS,
      state.player.radius,
    )
    const risk = kiteRiskAt(
      state,
      projectedPosition.x,
      projectedPosition.y,
      threats,
      threatScores,
      undefined,
    )
    if (risk < safestRisk) {
      safestRisk = risk
      safestDirection = constrainedDirection
    }
  }
  if (!safestDirection) {
    return undefined
  }
  return {
    source: 'dodge',
    directionX: safestDirection.directionX,
    directionY: safestDirection.directionY,
    speed,
    priority: BEHAVIOR_INTENT_PRIORITIES.dodge,
  }
}

function createPickupCandidate(
  state: GameState,
  pickup: GameState['pickups'][number],
  speed: number,
  source: 'healing' | 'gear' | 'xp',
  priority: number,
): PlayerMovementCandidate | undefined {
  const target = projectPointToPlayerArena(
    pickup.x,
    pickup.y,
    state.player.radius,
  )
  const vector = direction(
    state.player.x,
    state.player.y,
    target.x,
    target.y,
    pickup.id,
  )
  if (
    distanceSquared(state.player.x, state.player.y, pickup.x, pickup.y) <=
    (state.player.radius + pickup.radius) ** 2
  ) {
    return undefined
  }
  if (
    target.x === state.player.x &&
    target.y === state.player.y
  ) {
    return undefined
  }
  return {
    source,
    ...vector,
    speed,
    priority,
    pickupId: pickup.id,
  }
}

function createStairsCandidate(
  state: GameState,
  speed: number,
): PlayerMovementCandidate | undefined {
  const stairs = state.stairs
  if (!stairs) {
    return undefined
  }
  const distance = Math.sqrt(
    distanceSquared(state.player.x, state.player.y, stairs.x, stairs.y),
  )
  if (distance <= state.player.radius + stairs.radius) {
    return {
      source: 'stairs',
      directionX: 0,
      directionY: 0,
      speed: 0,
      priority: Number.MAX_SAFE_INTEGER,
      targetId: stairs.id,
    }
  }
  const target = projectPointToPlayerArena(
    stairs.x,
    stairs.y,
    state.player.radius,
  )
  if (target.x === state.player.x && target.y === state.player.y) {
    return undefined
  }
  return {
    source: 'stairs',
    ...direction(
      state.player.x,
      state.player.y,
      target.x,
      target.y,
      stairs.id,
    ),
    speed,
    priority: Number.MAX_SAFE_INTEGER,
    targetId: stairs.id,
  }
}

function createKiteCandidate(
  state: GameState,
  threats: readonly ThreatEntity[],
  speed: number,
  totalThreatScore: number,
  policy: BehaviorProfilePolicy,
  threatScores: ReadonlyMap<ThreatEntity, number>,
): PlayerMovementCandidate | undefined {
  const nearby = threats.filter((entity) => {
    const range = policy.thresholds.threatRadius + entity.radius
    return distanceSquared(state.player.x, state.player.y, entity.x, entity.y) <=
      range * range
  })
  if (nearby.length === 0) {
    return undefined
  }

  const strongest = chooseCombatTarget(
    state,
    nearby,
    policy.thresholds,
    threatScores,
  )
  if (totalThreatScore < policy.thresholds.kiteThreatScore) {
    return undefined
  }

  const isSingleManageableThreat = nearby.length === 1 &&
    !nearby[0].eliteModifiers?.length &&
    !nearby[0].eliteModifier &&
    !('bossDefinitionId' in nearby[0]) &&
    (threatScores.get(nearby[0]) ?? 0) <=
      policy.thresholds.kiteThreatScore
  if (
    isSingleManageableThreat &&
    strongest &&
    Math.hypot(
      state.player.x - strongest.x,
      state.player.y - strongest.y,
    ) >= getBasicAttackEngagementRange(state, strongest)
  ) {
    return undefined
  }

  let safestDirection: { directionX: number; directionY: number } | undefined
  let safestRisk = Number.POSITIVE_INFINITY
  for (let index = 0; index < KITE_SAMPLE_COUNT; index += 1) {
    const angle = Math.PI * 2 * index / KITE_SAMPLE_COUNT
    const constrainedDirection = constrainPlayerMovementDirection(
      state.player.x,
      state.player.y,
      state.player.radius,
      Math.cos(angle),
      Math.sin(angle),
    )
    const projectedPosition = projectPointToPlayerArena(
      state.player.x + constrainedDirection.directionX * speed * KITE_PREDICTION_SECONDS,
      state.player.y + constrainedDirection.directionY * speed * KITE_PREDICTION_SECONDS,
      state.player.radius,
    )
    const risk = kiteRiskAt(
      state,
      projectedPosition.x,
      projectedPosition.y,
      nearby,
      threatScores,
      strongest,
    )
    if (risk < safestRisk) {
      safestRisk = risk
      safestDirection = constrainedDirection
    }
  }
  if (!safestDirection) {
    return undefined
  }
  return {
    source: 'kite',
    directionX: safestDirection.directionX,
    directionY: safestDirection.directionY,
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
  const desiredDistance = getBasicAttackEngagementRange(state, target)
  const currentDistance = Math.sqrt(
    distanceSquared(state.player.x, state.player.y, target.x, target.y),
  )
  if (currentDistance <= desiredDistance) {
    return undefined
  }
  const targetPoint = projectPointToPlayerArena(
    target.x,
    target.y,
    state.player.radius,
  )
  if (
    targetPoint.x === state.player.x &&
    targetPoint.y === state.player.y
  ) {
    return undefined
  }
  return {
    source: 'combat-range',
    ...direction(
      state.player.x,
      state.player.y,
      targetPoint.x,
      targetPoint.y,
      target.id,
    ),
    speed,
    priority: BEHAVIOR_INTENT_PRIORITIES['combat-range'],
    targetId: target.id,
  }
}

function createBannerCandidate(
  state: GameState,
  speed: number,
  priority: number,
): PlayerMovementCandidate | undefined {
  if (state.player.maxHp <= 0 || state.player.hp >= state.player.maxHp) {
    return undefined
  }
  const banner = [...state.effects]
    .filter((effect) =>
      effect.skillId === RALLYING_BANNER_SKILL_ID && effect.remainingLifetime > 0
    )
    .sort((left, right) =>
      distanceSquared(state.player.x, state.player.y, left.x, left.y) -
        distanceSquared(state.player.x, state.player.y, right.x, right.y) ||
      left.id - right.id,
    )[0]
  if (!banner) {
    return undefined
  }

  const distance = Math.hypot(state.player.x - banner.x, state.player.y - banner.y)
  const safeRadius = banner.radius + state.player.radius
  if (distance > safeRadius + BANNER_APPROACH_MARGIN) {
    return undefined
  }
  if (distance <= safeRadius) {
    return {
      source: 'zone',
      directionX: 0,
      directionY: 0,
      speed: 0,
      priority,
    }
  }
  return {
    source: 'zone',
    ...direction(
      state.player.x,
      state.player.y,
      banner.x,
      banner.y,
      banner.id,
    ),
    speed,
    priority,
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

function constrainCandidateToArena(
  state: GameState,
  candidate: PlayerMovementCandidate,
): PlayerMovementCandidate {
  return {
    ...candidate,
    ...constrainPlayerMovementDirection(
      state.player.x,
      state.player.y,
      state.player.radius,
      candidate.directionX,
      candidate.directionY,
    ),
  }
}

/**
 * Produces all player intents in their authored precedence order. The
 * controller is the only caller that applies one of these movements.
 */
export function getPlayerBehaviorCandidates(
  state: GameState,
  spatialHash?: SpatialHash<ThreatEntity>,
): PlayerMovementCandidate[] {
  const controller = state.player.behaviorController
  if (controller?.freeMode) {
    const directionX = Number.isFinite(controller.freeMovementDirectionX)
      ? controller.freeMovementDirectionX ?? 0
      : 0
    const directionY = Number.isFinite(controller.freeMovementDirectionY)
      ? controller.freeMovementDirectionY ?? 0
      : 0
    return [{
      source: 'free',
      directionX,
      directionY,
      speed: getEffectivePlayerMovementSpeed(state.player),
      priority: 100,
    }]
  }

  const profileId: BehaviorProfileId =
    controller?.profileId ?? DEFAULT_BEHAVIOR_PROFILE_ID
  const policy = getBehaviorProfilePolicy(profileId)
  const movementSpeed = getEffectivePlayerMovementSpeed(state.player)
  const threats = livingThreats(state)
  const threatSpatialIndex = spatialHash ?? createThreatSpatialIndex(threats)
  const threatScores = new Map<ThreatEntity, number>()
  for (const threat of threats) {
    threatScores.set(
      threat,
      threatScore(
        threat,
        threats,
        policy.thresholds.packRadius,
        threatSpatialIndex,
      ),
    )
  }
  const playerThreats = threats.filter((entity) => {
    const range = policy.thresholds.threatRadius + entity.radius
    return distanceSquared(state.player.x, state.player.y, entity.x, entity.y) <=
      range * range
  })
  const totalThreatScore = playerThreats.reduce(
    (total, entity) =>
      total + (threatScores.get(entity) ?? 0),
    0,
  )

  const stairs = createStairsCandidate(state, movementSpeed)
  if (stairs) {
    return [constrainCandidateToArena(state, stairs)]
  }

  const candidates: PlayerMovementCandidate[] = []
  const dodge = getPlayerDodgeCandidate(state)
  if (dodge) {
    candidates.push({
      ...dodge,
      priority: policy.intentPriorities.dodge,
    })
  }
  const projectileDodge = createProjectileDodgeCandidate(
    state,
    playerThreats,
    movementSpeed,
    threatScores,
  )
  if (projectileDodge) {
    candidates.push({
      ...projectileDodge,
      priority: policy.intentPriorities.dodge,
    })
  }

  const gearPickup = bestPickup(state, 'gear')
  const xpPickup = bestPickup(state, 'xp')
  const healingPickup = bestPickup(state, 'healing-potion')
  const nearestThreatDistance = playerThreats.reduce(
    (nearest, entity) => Math.min(
      nearest,
      Math.sqrt(distanceSquared(state.player.x, state.player.y, entity.x, entity.y)),
    ),
    Number.POSITIVE_INFINITY,
  )
  const pickupIsSafe = totalThreatScore <= policy.thresholds.safeGearThreatScore &&
    nearestThreatDistance >= policy.thresholds.safeGearDistance
  const addPickupCandidate = (
    pickup: GameState['pickups'][number] | undefined,
    source: 'healing' | 'gear' | 'xp',
  ): void => {
    if (!pickup) {
      return
    }
    const candidate = createPickupCandidate(
      state,
      pickup,
      movementSpeed,
      source,
      policy.intentPriorities[source] + pickupValue(state, pickup) -
        pickupDistance(state, pickup) * PICKUP_DISTANCE_COST,
    )
    if (candidate) {
      candidates.push(candidate)
    }
  }

  if (pickupIsSafe) {
    addPickupCandidate(gearPickup, 'gear')
    addPickupCandidate(xpPickup, 'xp')
  }
  const missingHealthRatio = state.player.maxHp > 0
    ? Math.max(0, 1 - state.player.hp / state.player.maxHp)
    : 0
  if (
    healingPickup &&
    missingHealthRatio >= 0.1 &&
    totalThreatScore <= Math.max(2, policy.thresholds.safeGearThreatScore) &&
    nearestThreatDistance >= policy.thresholds.safeGearDistance / 2
  ) {
    addPickupCandidate(healingPickup, 'healing')
  }

  const kite = createKiteCandidate(
    state,
    playerThreats,
    movementSpeed,
    totalThreatScore,
    policy,
    threatScores,
  )
  if (kite) {
    candidates.push({
      ...kite,
      priority: policy.intentPriorities.kite,
    })
  }

  const banner = createBannerCandidate(
    state,
    movementSpeed,
    policy.intentPriorities.zone + missingHealthRatio * PICKUP_PRIORITY_BONUS,
  )
  if (banner) {
    candidates.push(banner)
  }

  const combatTarget = chooseCombatTarget(
    state,
    threats,
    policy.thresholds,
    threatScores,
  )
  const combatRange = createCombatRangeCandidate(
    state,
    combatTarget,
    movementSpeed,
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
  return candidates.map((candidate) =>
    constrainCandidateToArena(state, candidate)
  )
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
