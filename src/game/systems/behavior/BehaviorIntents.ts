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
import { getEntityThreatScore } from '../../../content/behaviors/ThreatScoring'
import { SpatialHash } from '../../spatial/SpatialHash'
import {
  constrainPlayerMovementDirection,
  getPlayerArenaBounds,
  projectPointToPlayerArena,
} from '../../../game-config/arena'

const BALANCED_POLICY = getBehaviorProfilePolicy(DEFAULT_BEHAVIOR_PROFILE_ID)
const KITE_WALL_MARGIN = 180

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
  threatScores: ReadonlyMap<ThreatEntity, number>,
): ThreatEntity | undefined {
  const currentTarget = threats.find((entity) => entity.id === state.player.targetId)
  if (currentTarget) {
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

function createPickupCandidate(
  state: GameState,
  pickup: GameState['pickups'][number],
  speed: number,
  source: 'gear' | 'xp',
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
    priority: BEHAVIOR_INTENT_PRIORITIES[source],
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
    (threatScores.get(nearby[0]) ?? 0) <=
      policy.thresholds.kiteThreatScore
  const engagementDistance = getDerivedPlayerStats(state.player).attackRange +
    state.player.radius
  if (
    nearby.length > 1 &&
    strongest &&
    Math.sqrt(
      distanceSquared(
        state.player.x,
        state.player.y,
        strongest.x,
        strongest.y,
      ),
    ) > engagementDistance
  ) {
    return undefined
  }
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
      (threatScores.get(entity) ?? 0) /
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
  const bounds = getPlayerArenaBounds(state.player.radius)
  let kiteDirectionX = vector.directionX
  let kiteDirectionY = vector.directionY
  const nearLeftWall = state.player.x <= bounds.minX + KITE_WALL_MARGIN
  const nearRightWall = state.player.x >= bounds.maxX - KITE_WALL_MARGIN
  const nearTopWall = state.player.y <= bounds.minY + KITE_WALL_MARGIN
  const nearBottomWall = state.player.y >= bounds.maxY - KITE_WALL_MARGIN

  if (nearLeftWall && kiteDirectionX < 0) {
    kiteDirectionX = 0
  } else if (nearRightWall && kiteDirectionX > 0) {
    kiteDirectionX = 0
  }
  if (nearTopWall && kiteDirectionY < 0) {
    kiteDirectionY = 0
  } else if (nearBottomWall && kiteDirectionY > 0) {
    kiteDirectionY = 0
  }

  const kiteDirectionLength = Math.hypot(kiteDirectionX, kiteDirectionY)
  if (kiteDirectionLength === 0) {
    const inward = direction(
      state.player.x,
      state.player.y,
      0,
      0,
      fallbackId,
    )
    kiteDirectionX = inward.directionX
    kiteDirectionY = inward.directionY
  } else {
    kiteDirectionX /= kiteDirectionLength
    kiteDirectionY /= kiteDirectionLength
  }
  return {
    source: 'kite',
    directionX: kiteDirectionX,
    directionY: kiteDirectionY,
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
  // Keep the target inside the center-to-center range used by target resolution
  // so basic attacks do not lose their target while the player is repositioning.
  const desiredDistance = attackRange + state.player.radius
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
      speed: getDerivedPlayerStats(state.player).movementSpeed,
      priority: 100,
    }]
  }

  const profileId: BehaviorProfileId =
    controller?.profileId ?? DEFAULT_BEHAVIOR_PROFILE_ID
  const policy = getBehaviorProfilePolicy(profileId)
  const playerStats = getDerivedPlayerStats(state.player)
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

  const stairs = createStairsCandidate(state, playerStats.movementSpeed)
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
    threatScores,
  )
  if (kite) {
    candidates.push({
      ...kite,
      priority: policy.intentPriorities.kite,
    })
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
