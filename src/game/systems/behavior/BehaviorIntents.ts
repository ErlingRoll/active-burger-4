import type { ThreatScoreDefinition } from '../../../content/behaviors/ThreatScoring'
import {
  getEntityPackThreatScore,
  getEntityThreatScore,
} from './ThreatEvaluation'
import { getEnemyAbilityForDefinition } from '../../../content/enemies/EnemyAbilities'
import { getBossSkillDefinition } from '../../../content/bosses/Bosses'
import { RALLYING_BANNER_SKILL_ID } from '../../../content/skills/Skills'
import type {
  EnemyState,
  GameState,
  PlayerMovementCandidate,
  SkillEffectState,
  TelegraphState,
} from '../../state/GameState'
import {
  getEffectivePlayerMovementSpeed,
} from '../../stats/DerivedStats'
import {
  getImminentTelegraphs,
  getPlayerDodgeCandidate,
} from '../movement/DodgeSystem'
import { isPointInTelegraph } from '../../geometry/TelegraphGeometry'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfilePolicy,
  type BehaviorProfileId,
  type BehaviorProfilePolicy,
  type BehaviorProfileThresholds,
} from '../../../content/behaviors/BehaviorProfiles'
import { SpatialHash } from '../../spatial/SpatialHash'
import {
  clampPlayerPosition,
  constrainPlayerMovementDirection,
  getPlayerArenaBounds,
  projectPointToPlayerArena,
} from '../../../game-config/arena'
import { PLAYER_MOVEMENT } from '../../../game-config/movement'
import { getBasicAttackEngagementRange } from '../combat/CombatSystem'
import {
  getEffectiveEnemySpeed,
  getEnemyCombatTarget,
  getEnemyInterceptPoint,
} from '../combat/EnemyBehaviors'

const BALANCED_POLICY = getBehaviorProfilePolicy(DEFAULT_BEHAVIOR_PROFILE_ID)
const KITE_WALL_MARGIN = 180
const DIRECTION_SAMPLE_COUNT = 16
/** How far ahead enemies are assumed to keep closing when a position is judged. */
const KITE_PREDICTION_SECONDS = 0.75
/** How far a sampled route is followed before it is judged. */
const ROUTE_SAMPLE_SECONDS = 0.5
const PROJECTILE_ROUTE_CLEARANCE = 28
const FLANKER_INTERCEPT_CLEARANCE = 72
const IMMINENT_PROJECTILE_RISK = 10_000
const TELEGRAPH_RISK = 10_000
const DODGE_HIT_COST = 1_000
const DODGE_DEPTH_COST = 0.02
const KITE_WALL_RISK_WEIGHT = 12
/**
 * Below this much predicted pressure a kiting character stops and turns back
 * to fighting. It is the release half of the kite's hysteresis: the entry
 * half is the profile's threat threshold or contact rule, and without a lower
 * exit a character in contact with a slow enemy stepped out of reach, stopped,
 * was touched again, and stepped out again, taking a hit every second.
 */
const KITE_RELEASE_RISK = 0.15
/**
 * How strongly a kiting character is held near the reach of its target, so
 * that it circles rather than flees when both are safe. The pull only charges
 * for drifting further out than it already is, never rewards closing in:
 * closing on a target is the approach's job, and a kite that closed for the
 * sake of the pull was an approach wearing the wrong label.
 */
const KITE_RANGE_WEIGHT = 0.2
/** How much a badly hurt character's kite outranks its urge to close. */
const LOW_HEALTH_KITE_PRIORITY_BONUS = 200
/**
 * The most of a telegraphed ability's reach that counts as pressure around
 * its owner. An Archer's real reach is the whole arena and a boss's charge
 * crosses most of it, and treating those as danger made Cautious flee from
 * every Archer forever; the shot and the charge themselves are dodged when
 * they are telegraphed, so only a standoff distance is kept from the owner.
 */
const TELEGRAPHED_REACH_CAP = 150
/** How close to an attack being ready counts as ready for stepping in. */
const ATTACK_READY_SECONDS = 0.15
/** How much a boss's landing point after a charge counts as the boss being there. */
const CHARGE_LANDING_CLEARANCE = 60
/**
 * Standing still near a boss is a risk of its own, charged per point of the
 * boss's threat. A Ground Slam or Meteor lands on wherever the character is,
 * and the only way to be out of it when it lands is to already be moving, so
 * near a boss the character circles rather than plants its feet.
 */
const BOSS_STILLNESS_RISK = 0.05
/** How far off the straight line an approach will go to avoid a hazard. */
const APPROACH_RISK_WEIGHT = 0.75
const APPROACH_RISK_RADIUS = 420
/** Distance discount when choosing which enemy to walk toward. */
const TARGET_DISTANCE_COST = 0.004
const PICKUP_DISTANCE_COST = 0.35
const PICKUP_PRIORITY_BONUS = 150
const BANNER_APPROACH_MARGIN = 120
const PREDICTION_STEP_SECONDS = 1 / 60

/** Backwards-compatible exports for callers that use the balanced policy. */
export const BEHAVIOR_INTENT_PRIORITIES = BALANCED_POLICY.intentPriorities
export const BEHAVIOR_INTENT_BALANCE = {
  ...BALANCED_POLICY.thresholds,
  commitmentSeconds: BALANCED_POLICY.commitmentSeconds,
  hysteresisPriority: BALANCED_POLICY.hysteresisPriority,
} as const

type ThreatEntity = EnemyState | NonNullable<GameState['bosses']>[number]
type CollectiblePickupKind = 'gear' | 'xp' | 'healing-potion'

interface Direction {
  directionX: number
  directionY: number
}

interface ChargeLanding {
  x: number
  y: number
  radius: number
  score: number
}

/**
 * Everything the evaluator knows about the enemies this tick, computed once
 * and shared by every candidate producer.
 */
interface ThreatContext {
  threats: readonly ThreatEntity[]
  scores: ReadonlyMap<ThreatEntity, number>
  speeds: ReadonlyMap<ThreatEntity, number>
  attackRanges: ReadonlyMap<ThreatEntity, number>
  /** Where a charging boss will be standing when its telegraph resolves. */
  landings: readonly ChargeLanding[]
}

function livingThreats(state: GameState): ThreatEntity[] {
  return [
    ...state.enemies,
    ...(state.bosses ?? []),
  ]
    .filter((entity) => entity.hp > 0)
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
): Direction {
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
    let nearbyPackSize = 0
    spatialHash.forEachRadiusUnsorted(
      entity.x,
      entity.y,
      Math.max(0, packRadius),
      (candidate) => {
      if (candidate.id === entity.id || candidate.hp <= 0) {
        return
      }
      if (
        distanceSquared(entity.x, entity.y, candidate.x, candidate.y) <=
        radiusSquared
      ) {
        nearbyPackSize += 1
      }
      },
    )
    return getEntityThreatScore(entity, nearbyPackSize)
  }
  return getEntityPackThreatScore(entity, threats, packRadius)
}

function isBoss(entity: ThreatEntity): entity is NonNullable<GameState['bosses']>[number] {
  return 'bossDefinitionId' in entity
}

function getThreatSpeed(state: Readonly<GameState>, entity: ThreatEntity): number {
  // A boss's speed is rewritten with its ramp every tick; an enemy's is not.
  return Math.max(0, isBoss(entity) ? entity.speed : getEffectiveEnemySpeed(state, entity))
}

/** The reach a threat is kept away from, beyond its body. */
function getThreatAttackRange(entity: ThreatEntity): number {
  if (isBoss(entity)) {
    return Math.min(
      TELEGRAPHED_REACH_CAP,
      Math.max(
        0,
        ...entity.skills.map((skill) => getBossSkillDefinition(skill.skillId).range ?? 0),
      ),
    )
  }
  const ability = getEnemyAbilityForDefinition(entity.definitionId)
  return ability ? Math.min(ability.range, TELEGRAPHED_REACH_CAP) : 0
}

function createThreatContext(
  state: GameState,
  threats: readonly ThreatEntity[],
  packRadius: number,
  spatialHash: SpatialHash<ThreatEntity>,
): ThreatContext {
  const scores = new Map<ThreatEntity, number>()
  const speeds = new Map<ThreatEntity, number>()
  const attackRanges = new Map<ThreatEntity, number>()
  for (const threat of threats) {
    scores.set(threat, threatScore(threat, threats, packRadius, spatialHash))
    speeds.set(threat, getThreatSpeed(state, threat))
    attackRanges.set(threat, getThreatAttackRange(threat))
  }
  const landings: ChargeLanding[] = []
  for (const telegraph of state.telegraphs ?? []) {
    if (!telegraph.dashesOnResolve || telegraph.remainingDuration <= 0) {
      continue
    }
    const boss = threats.find((threat) => threat.id === telegraph.sourceId)
    const landing = telegraph.points[telegraph.points.length - 1]
    if (!boss || !landing) {
      continue
    }
    landings.push({
      x: landing.x,
      y: landing.y,
      radius: boss.radius,
      score: scores.get(boss) ?? 0,
    })
  }
  return { threats, scores, speeds, attackRanges, landings }
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
  let best: GameState['pickups'][number] | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const pickup of state.pickups ?? []) {
    if (pickup.kind !== kind) {
      continue
    }
    const score = pickupDistance(state, pickup) - pickupValue(state, pickup)
    if (
      score < bestScore ||
      (score === bestScore && (best === undefined || pickup.id < best.id))
    ) {
      best = pickup
      bestScore = score
    }
  }
  return best
}

/**
 * Which enemy to fight. The current target is kept while it is in reach;
 * otherwise the most threatening enemy wins, discounted by how far away it is
 * so the character does not cross the arena past three Slimes to reach a
 * Brute, with distance and then id breaking ties.
 */
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
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const candidate of threats) {
    const candidateDistance = distanceSquared(
      state.player.x,
      state.player.y,
      candidate.x,
      candidate.y,
    )
    const candidateScore = (threatScores.get(candidate) ??
      threatScore(candidate, threats, thresholds.packRadius)) -
      Math.sqrt(candidateDistance) * TARGET_DISTANCE_COST
    if (
      !selected ||
      candidateScore > selectedScore ||
      (candidateScore === selectedScore &&
        (candidateDistance < selectedDistance ||
          (candidateDistance === selectedDistance && candidate.id < selected.id)))
    ) {
      selected = candidate
      selectedScore = candidateScore
      selectedDistance = candidateDistance
    }
  }
  return selected
}

function telegraphRiskAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
): number {
  let risk = 0
  for (const telegraph of state.telegraphs ?? []) {
    if (telegraph.remainingDuration <= 0) {
      continue
    }
    if (isPointInTelegraph(telegraph, x, y, state.player.radius)) {
      risk += TELEGRAPH_RISK
    }
  }
  return risk
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
    if (isBoss(threat) || getEnemyCombatTarget(state, threat).id !== state.player.id) {
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

function wallRiskAt(state: Readonly<GameState>, x: number, y: number): number {
  const bounds = getPlayerArenaBounds(state.player.radius)
  const wallDistance = Math.min(
    x - bounds.minX,
    bounds.maxX - x,
    y - bounds.minY,
    bounds.maxY - y,
  )
  const wallPressure = Math.max(0, KITE_WALL_MARGIN - wallDistance) /
    KITE_WALL_MARGIN
  return wallPressure * wallPressure * KITE_WALL_RISK_WEIGHT
}

/**
 * How much the listed enemies threaten a position, assuming each keeps closing
 * at its real speed for the prediction horizon. A boss mid-charge also counts
 * at the point it will land on.
 */
function threatPressureAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
  threats: readonly ThreatEntity[],
  context: ThreatContext,
): number {
  let risk = 0
  for (const threat of threats) {
    const speed = context.speeds.get(threat) ?? Math.max(0, threat.speed)
    const distance = Math.max(1, Math.hypot(x - threat.x, y - threat.y))
    const predictedDistance = Math.max(
      1,
      distance - speed * KITE_PREDICTION_SECONDS,
    )
    const dangerRange = state.player.radius + threat.radius +
      (context.attackRanges.get(threat) ?? 0)
    const pressureRange = Math.max(1, dangerRange + speed * KITE_PREDICTION_SECONDS)
    const pressure = Math.max(0, (pressureRange - predictedDistance) / pressureRange)
    risk += (context.scores.get(threat) ?? 0) * pressure * pressure
  }
  for (const landing of context.landings) {
    const distance = Math.hypot(x - landing.x, y - landing.y)
    const dangerRange = state.player.radius + landing.radius + CHARGE_LANDING_CLEARANCE
    const pressure = Math.max(0, (dangerRange - distance) / dangerRange)
    risk += landing.score * pressure * pressure
  }
  return risk
}

function kiteRiskAt(
  state: Readonly<GameState>,
  x: number,
  y: number,
  threats: readonly ThreatEntity[],
  context: ThreatContext,
  strongest: ThreatEntity | undefined,
): number {
  let risk = telegraphRiskAt(state, x, y) +
    hostileProjectileRiskAt(state, x, y) +
    flankerInterceptRiskAt(state, x, y, threats, context.scores) +
    wallRiskAt(state, x, y) +
    threatPressureAt(state, x, y, threats, context)

  if (strongest) {
    const desiredDistance = Math.max(
      getBasicAttackEngagementRange(state, strongest),
      Math.hypot(state.player.x - strongest.x, state.player.y - strongest.y),
    )
    const distance = Math.hypot(x - strongest.x, y - strongest.y)
    risk += Math.max(0, distance - desiredDistance) / Math.max(1, desiredDistance) *
      KITE_RANGE_WEIGHT
  }
  return risk
}

/** The sixteen compass directions, each already constrained by the walls. */
function sampleDirections(state: Readonly<GameState>): Direction[] {
  const directions: Direction[] = []
  for (let index = 0; index < DIRECTION_SAMPLE_COUNT; index += 1) {
    const angle = Math.PI * 2 * index / DIRECTION_SAMPLE_COUNT
    directions.push(constrainPlayerMovementDirection(
      state.player.x,
      state.player.y,
      state.player.radius,
      Math.cos(angle),
      Math.sin(angle),
    ))
  }
  return directions
}

function projectAlong(
  state: Readonly<GameState>,
  heading: Direction,
  speed: number,
  seconds: number,
): { x: number; y: number } {
  return projectPointToPlayerArena(
    state.player.x + heading.directionX * speed * seconds,
    state.player.y + heading.directionY * speed * seconds,
    state.player.radius,
  )
}

function finiteVelocity(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Where the character will be at each of the given moments if it steers
 * toward `heading` from now, using the same acceleration model the controller
 * applies. The moments must be ascending. Reversing takes time, which is why
 * a dodge that keeps its current momentum can clear a telegraph that a dodge
 * straight away from the centre cannot.
 */
function predictPositions(
  state: Readonly<GameState>,
  heading: Direction,
  speed: number,
  moments: readonly number[],
): { x: number; y: number }[] {
  let x = state.player.x
  let y = state.player.y
  let velocityX = finiteVelocity(state.player.movementVelocityX)
  let velocityY = finiteVelocity(state.player.movementVelocityY)
  const targetVelocityX = heading.directionX * speed
  const targetVelocityY = heading.directionY * speed
  const targetSpeed = Math.hypot(targetVelocityX, targetVelocityY)
  const positions: { x: number; y: number }[] = []
  let elapsed = 0
  for (const moment of moments) {
    while (elapsed < moment - 1e-9) {
      const step = Math.min(PREDICTION_STEP_SECONDS, moment - elapsed)
      const deltaX = targetVelocityX - velocityX
      const deltaY = targetVelocityY - velocityY
      const deltaLength = Math.hypot(deltaX, deltaY)
      const response = targetSpeed < Math.hypot(velocityX, velocityY)
        ? PLAYER_MOVEMENT.deceleration
        : PLAYER_MOVEMENT.acceleration
      const maxDelta = response * step
      const scale = deltaLength > maxDelta ? maxDelta / deltaLength : 1
      velocityX += deltaX * scale
      velocityY += deltaY * scale
      const proposedX = x + velocityX * step
      const proposedY = y + velocityY * step
      const next = clampPlayerPosition(proposedX, proposedY, state.player.radius)
      if (next.x !== proposedX) {
        velocityX = 0
      }
      if (next.y !== proposedY) {
        velocityY = 0
      }
      x = next.x
      y = next.y
      elapsed += step
    }
    positions.push({ x, y })
  }
  return positions
}

/**
 * Roughly how far inside a telegraph a point is, for separating headings that
 * all fail to clear it. A line is measured from its lane, everything else from
 * its centre; a ring counts whichever of its edges is nearer. It is only a
 * tie-break, so the cone is treated as the disc it is cut from.
 */
function telegraphPenetration(
  telegraph: Readonly<TelegraphState>,
  x: number,
  y: number,
  padding: number,
): number {
  if (telegraph.shape === 'line') {
    const start = telegraph.points[0]
    const end = telegraph.points[telegraph.points.length - 1]
    if (!start || !end) {
      return 0
    }
    const nearest = Math.sqrt(
      segmentDistanceSquared(x, y, start.x, start.y, end.x, end.y),
    )
    return Math.max(0, telegraph.radius + padding - nearest)
  }
  const distance = Math.hypot(x - telegraph.x, y - telegraph.y)
  if (telegraph.shape === 'ring') {
    const inner = telegraph.innerRadius ?? 0
    return Math.max(
      0,
      Math.min(distance + padding - inner, telegraph.radius + padding - distance),
    )
  }
  return Math.max(0, telegraph.radius + padding - distance)
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

/**
 * Steers a dodge somewhere safe rather than merely away.
 *
 * The dodge system decides that a telegraph must be escaped and offers the
 * direction straight away from it. That direction is arbitrary when the
 * telegraph is centred on the character, as a boss's Ground Slam always is,
 * and it was as likely to run into the boss as away from it. Every heading is
 * tried instead: whichever clears the most telegraphs by the time they land
 * wins, and among those the one that ends in the least danger from enemies,
 * projectiles and walls. The original heading is tried first, so it keeps
 * ties.
 */
function refineDodgeCandidate(
  state: GameState,
  dodge: PlayerMovementCandidate,
  threats: readonly ThreatEntity[],
  context: ThreatContext,
  speed: number,
): PlayerMovementCandidate {
  const telegraphs = getImminentTelegraphs(state)
  if (telegraphs.length === 0) {
    return dodge
  }
  const moments = [...new Set(telegraphs.map((telegraph) => telegraph.remainingDuration))]
    .sort((left, right) => left - right)
  const headings: Direction[] = [
    constrainPlayerMovementDirection(
      state.player.x,
      state.player.y,
      state.player.radius,
      dodge.directionX,
      dodge.directionY,
    ),
    ...sampleDirections(state),
  ]

  let best: Direction | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const heading of headings) {
    const positions = predictPositions(state, heading, speed, moments)
    let hits = 0
    let depth = 0
    for (const telegraph of telegraphs) {
      const position = positions[moments.indexOf(telegraph.remainingDuration)]
      if (!position) {
        continue
      }
      if (isPointInTelegraph(telegraph, position.x, position.y, state.player.radius)) {
        hits += 1
        depth += telegraphPenetration(telegraph, position.x, position.y, state.player.radius)
      }
    }
    const final = positions[positions.length - 1] ?? state.player
    const risk = hostileProjectileRiskAt(state, final.x, final.y) +
      flankerInterceptRiskAt(state, final.x, final.y, threats, context.scores) +
      wallRiskAt(state, final.x, final.y) +
      threatPressureAt(state, final.x, final.y, threats, context)
    /*
     * A hit is a hit however deep, so the count dominates. The depth only
     * separates headings that all fail: the one that gets nearest the edge
     * is the one that may clear it on the next tick, which is what keeps a
     * character that cannot outrun a slam running with its momentum rather
     * than turning around into it.
     */
    const score = hits * DODGE_HIT_COST + risk + depth * DODGE_DEPTH_COST
    if (score < bestScore) {
      best = heading
      bestScore = score
    }
  }
  if (!best) {
    return dodge
  }
  if (state.player.dodge) {
    state.player.dodge.lastDirectionX = best.directionX
    state.player.dodge.lastDirectionY = best.directionY
  }
  return { ...dodge, directionX: best.directionX, directionY: best.directionY }
}

function createProjectileDodgeCandidate(
  state: GameState,
  threats: readonly ThreatEntity[],
  speed: number,
  context: ThreatContext,
): PlayerMovementCandidate | undefined {
  const currentX = state.player.x +
    (state.player.movementVelocityX ?? 0) * KITE_PREDICTION_SECONDS
  const currentY = state.player.y +
    (state.player.movementVelocityY ?? 0) * KITE_PREDICTION_SECONDS
  if (hostileProjectileRiskAt(state, currentX, currentY) < IMMINENT_PROJECTILE_RISK) {
    return undefined
  }

  let safestDirection: Direction | undefined
  let safestRisk = Number.POSITIVE_INFINITY
  for (const heading of sampleDirections(state)) {
    const projectedPosition = projectAlong(state, heading, speed, KITE_PREDICTION_SECONDS)
    const risk = kiteRiskAt(
      state,
      projectedPosition.x,
      projectedPosition.y,
      threats,
      context,
      undefined,
    )
    if (risk < safestRisk) {
      safestRisk = risk
      safestDirection = heading
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

/**
 * The profile's thresholds after its health has been taken into account.
 * Below `lowHealthRatio` the kite threshold slides toward its low-health
 * value and the contact tolerance toward zero, so every profile fights more
 * carefully the closer it is to dying.
 */
function resolveThresholds(
  state: Readonly<GameState>,
  thresholds: BehaviorProfileThresholds,
): { thresholds: BehaviorProfileThresholds; caution: number } {
  const healthRatio = state.player.maxHp > 0
    ? Math.max(0, Math.min(1, state.player.hp / state.player.maxHp))
    : 1
  const lowHealthRatio = Math.max(0, Math.min(1, thresholds.lowHealthRatio))
  if (lowHealthRatio <= 0 || healthRatio >= lowHealthRatio) {
    return { thresholds, caution: 0 }
  }
  const caution = (lowHealthRatio - healthRatio) / lowHealthRatio
  /*
   * The low-health threshold is divided by the caution rather than blended
   * with the normal one: Aggressive's normal threshold is "never", and a
   * blend with a million stays a million until the last sliver of health.
   * Contact tolerance and the appetite for stepping in both fade to nothing.
   */
  return {
    caution,
    thresholds: {
      ...thresholds,
      kiteThreatScore: Math.min(
        thresholds.kiteThreatScore,
        thresholds.lowHealthKiteThreatScore / caution,
      ),
      contactThreatScore: thresholds.contactThreatScore * (1 - caution),
      strikeRiskBudget: thresholds.strikeRiskBudget * (1 - caution),
    },
  }
}

function createKiteCandidate(
  state: GameState,
  nearby: readonly ThreatEntity[],
  speed: number,
  totalThreatScore: number,
  thresholds: BehaviorProfileThresholds,
  context: ThreatContext,
): PlayerMovementCandidate | undefined {
  if (nearby.length === 0) {
    return undefined
  }

  const strongest = chooseCombatTarget(state, nearby, thresholds, context.scores)
  let contactThreatScore = 0
  for (const entity of nearby) {
    const contactDistance = state.player.radius + entity.radius
    if (
      distanceSquared(state.player.x, state.player.y, entity.x, entity.y) <=
      contactDistance * contactDistance
    ) {
      contactThreatScore += context.scores.get(entity) ?? 0
    }
  }
  const isInContact = contactThreatScore > thresholds.contactThreatScore
  const isThreatened = totalThreatScore >= thresholds.kiteThreatScore
  let stillnessRisk = 0
  for (const entity of nearby) {
    if (isBoss(entity)) {
      stillnessRisk += (context.scores.get(entity) ?? 0) * BOSS_STILLNESS_RISK
    }
  }
  const stayRisk = kiteRiskAt(
    state,
    state.player.x,
    state.player.y,
    nearby,
    context,
    strongest,
  ) + stillnessRisk
  const wasKiting = state.player.behaviorController?.lastCandidate?.source === 'kite'
  const isPersisting = wasKiting && stayRisk >= KITE_RELEASE_RISK
  if (!isInContact && !isThreatened && !isPersisting && stillnessRisk === 0) {
    return undefined
  }

  /*
   * Hit and run. With the attack ready and the target just out of reach, the
   * character weighs stepping in against staying put, and if the step costs
   * no more than the profile's budget it leaves the approach to close the
   * gap. Once the blow lands and the attack is recharging, the kite is back.
   */
  if (
    strongest &&
    state.player.attackCooldownRemaining <= ATTACK_READY_SECONDS
  ) {
    const reach = getBasicAttackEngagementRange(state, strongest)
    const distance = Math.hypot(
      state.player.x - strongest.x,
      state.player.y - strongest.y,
    )
    if (distance > reach && distance - reach <= speed * KITE_PREDICTION_SECONDS) {
      const toward = direction(
        state.player.x,
        state.player.y,
        strongest.x,
        strongest.y,
        strongest.id,
      )
      const strikePoint = projectAlong(
        state,
        toward,
        Math.min(speed, (distance - reach) / KITE_PREDICTION_SECONDS),
        KITE_PREDICTION_SECONDS,
      )
      const strikeRisk = kiteRiskAt(
        state,
        strikePoint.x,
        strikePoint.y,
        nearby,
        context,
        strongest,
      )
      if (strikeRisk - stayRisk <= thresholds.strikeRiskBudget) {
        return undefined
      }
    }
  }

  const [onlyNearbyThreat] = nearby
  const isSingleManageableThreat = nearby.length === 1 &&
    onlyNearbyThreat !== undefined &&
    !onlyNearbyThreat.eliteModifiers?.length &&
    !onlyNearbyThreat.eliteModifier &&
    !isBoss(onlyNearbyThreat) &&
    (context.scores.get(onlyNearbyThreat) ?? 0) <= thresholds.kiteThreatScore
  // A lone, manageable enemy that is out of reach is fought, not fled, unless
  // the character is already mid-retreat from it: then the retreat finishes
  // at a comfortable distance rather than turning around at the edge of
  // reach, where the enemy would touch it again a moment later.
  if (
    isSingleManageableThreat &&
    !isPersisting &&
    strongest &&
    Math.hypot(
      state.player.x - strongest.x,
      state.player.y - strongest.y,
    ) >= getBasicAttackEngagementRange(state, strongest)
  ) {
    return undefined
  }

  let safestDirection: Direction | undefined
  let safestRisk = Number.POSITIVE_INFINITY
  for (const heading of sampleDirections(state)) {
    const projectedPosition = projectAlong(state, heading, speed, KITE_PREDICTION_SECONDS)
    const risk = kiteRiskAt(
      state,
      projectedPosition.x,
      projectedPosition.y,
      nearby,
      context,
      strongest,
    )
    if (risk < safestRisk) {
      safestRisk = risk
      safestDirection = heading
    }
  }
  // Standing still is a route too. When nowhere is safer than here, the
  // character fights from here instead of pacing.
  if (!safestDirection || stayRisk <= safestRisk) {
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

/**
 * Closes on the target along the least dangerous route rather than the
 * straight one, so an approach bends around a telegraph, a shot or another
 * pack instead of walking through them. The straight heading is tried first
 * and keeps ties, so an open approach is still a straight line.
 */
function createCombatRangeCandidate(
  state: GameState,
  target: ThreatEntity | undefined,
  speed: number,
  context: ThreatContext,
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
  const towardTarget = direction(
    state.player.x,
    state.player.y,
    targetPoint.x,
    targetPoint.y,
    target.id,
  )
  const straight = constrainPlayerMovementDirection(
    state.player.x,
    state.player.y,
    state.player.radius,
    towardTarget.directionX,
    towardTarget.directionY,
  )
  const hazardRadiusSquared = APPROACH_RISK_RADIUS * APPROACH_RISK_RADIUS
  const hazards = context.threats.filter((threat) =>
    threat !== target &&
    distanceSquared(state.player.x, state.player.y, threat.x, threat.y) <=
      hazardRadiusSquared,
  )
  const reach = Math.max(1, speed * ROUTE_SAMPLE_SECONDS)

  let best: Direction | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const heading of [straight, ...sampleDirections(state)]) {
    const projected = projectAlong(state, heading, speed, ROUTE_SAMPLE_SECONDS)
    const progress = (currentDistance -
      Math.sqrt(distanceSquared(projected.x, projected.y, target.x, target.y))) / reach
    const risk = telegraphRiskAt(state, projected.x, projected.y) +
      hostileProjectileRiskAt(state, projected.x, projected.y) +
      flankerInterceptRiskAt(state, projected.x, projected.y, hazards, context.scores) +
      threatPressureAt(state, projected.x, projected.y, hazards, context)
    const score = (1 - progress) + risk * APPROACH_RISK_WEIGHT
    if (score < bestScore) {
      best = heading
      bestScore = score
    }
  }
  if (!best || (best.directionX === 0 && best.directionY === 0)) {
    return undefined
  }
  return {
    source: 'combat-range',
    directionX: best.directionX,
    directionY: best.directionY,
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
  let banner: SkillEffectState | undefined
  let bannerDistanceSquared = Number.POSITIVE_INFINITY
  for (const effect of state.effects) {
    if (
      effect.skillId !== RALLYING_BANNER_SKILL_ID ||
      effect.remainingLifetime <= 0
    ) {
      continue
    }
    const effectDistanceSquared = distanceSquared(
      state.player.x,
      state.player.y,
      effect.x,
      effect.y,
    )
    if (
      effectDistanceSquared < bannerDistanceSquared ||
      (effectDistanceSquared === bannerDistanceSquared &&
        (banner === undefined || effect.id < banner.id))
    ) {
      banner = effect
      bannerDistanceSquared = effectDistanceSquared
    }
  }
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
  const policy: BehaviorProfilePolicy = getBehaviorProfilePolicy(profileId)
  const { thresholds, caution } = resolveThresholds(state, policy.thresholds)
  const movementSpeed = getEffectivePlayerMovementSpeed(state.player)
  const threats = livingThreats(state)
  const context = createThreatContext(
    state,
    threats,
    thresholds.packRadius,
    spatialHash ?? createThreatSpatialIndex(threats),
  )
  const playerThreats = threats.filter((entity) => {
    const range = thresholds.threatRadius + entity.radius
    return distanceSquared(state.player.x, state.player.y, entity.x, entity.y) <=
      range * range
  })
  const totalThreatScore = playerThreats.reduce(
    (total, entity) =>
      total + (context.scores.get(entity) ?? 0),
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
      ...refineDodgeCandidate(state, dodge, playerThreats, context, movementSpeed),
      priority: policy.intentPriorities.dodge,
    })
  }
  const projectileDodge = createProjectileDodgeCandidate(
    state,
    playerThreats,
    movementSpeed,
    context,
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
  const pickupIsSafe = totalThreatScore <= thresholds.safeGearThreatScore &&
    nearestThreatDistance >= thresholds.safeGearDistance
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
  // The more of its health it is missing, the more danger it accepts to reach
  // a potion; a dying character does not wait for the room to clear.
  if (
    healingPickup &&
    missingHealthRatio >= 0.1 &&
    totalThreatScore <=
      Math.max(2, thresholds.safeGearThreatScore) + missingHealthRatio * 6 &&
    nearestThreatDistance >=
      thresholds.safeGearDistance / 2 * (1 - missingHealthRatio)
  ) {
    addPickupCandidate(healingPickup, 'healing')
  }

  const kite = createKiteCandidate(
    state,
    playerThreats,
    movementSpeed,
    totalThreatScore,
    thresholds,
    context,
  )
  if (kite) {
    candidates.push({
      ...kite,
      priority: policy.intentPriorities.kite +
        caution * LOW_HEALTH_KITE_PRIORITY_BONUS,
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
    thresholds,
    context.scores,
  )
  const combatRange = createCombatRangeCandidate(
    state,
    combatTarget,
    movementSpeed,
    context,
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
