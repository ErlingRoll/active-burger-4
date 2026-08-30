import {
  getEnemyDefinition,
  type EnemyBehaviorDefinition,
  type EnemySplitDefinition,
} from '../../../content/enemies/Enemies'
import { getPostSpawnSpeedMultiplier } from '../../../content/enemies/EnemyAcceleration'
import { getEliteModifierDefinition } from '../../../content/enemies/EliteModifiers'
import type { EnemyState, GameState } from '../../state/GameState'
import { SpatialHash } from '../../spatial/SpatialHash'

export interface ChildSpawnRequest {
  definitionId: string
  x: number
  y: number
  xpRewardOverride?: number
  canDropLoot?: boolean
}

export interface EnemyCombatTarget {
  id: number
  x: number
  y: number
  radius: number
}

type EnemyBehaviorComponent = (
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
) => void

interface EnemyMovementSnapshot {
  id: number
  x: number
  y: number
  radius: number
}

interface Vector2 {
  x: number
  y: number
}

const ENEMY_SEPARATION_RADIUS = 72
const ENEMY_SEPARATION_PADDING = 8
const ENEMY_SEPARATION_STRENGTH = 0.85
const MAX_INTERCEPT_PREDICTION_SECONDS = 1.5

function getEffectiveEnemyBehavior(
  enemy: Readonly<EnemyState>,
): EnemyBehaviorDefinition {
  const behaviorOverride = enemy.eliteModifier
    ? getEliteModifierDefinition(enemy.eliteModifier).behaviorOverride
    : undefined
  return behaviorOverride ?? getEnemyDefinition(enemy.definitionId).behavior
}

export function getEnemyCombatTarget(
  state: Readonly<GameState>,
  enemy: Readonly<EnemyState>,
): EnemyCombatTarget {
  const target: EnemyCombatTarget = {
    id: state.player.id,
    x: state.player.x,
    y: state.player.y,
    radius: state.player.radius,
  }
  let targetDistanceSquared =
    (target.x - enemy.x) ** 2 + (target.y - enemy.y) ** 2
  for (const summon of state.summons) {
    if (summon.hp <= 0) {
      continue
    }
    const distanceSquared =
      (summon.x - enemy.x) ** 2 + (summon.y - enemy.y) ** 2
    if (distanceSquared >= targetDistanceSquared) {
      continue
    }
    target.id = summon.id
    target.x = summon.x
    target.y = summon.y
    target.radius = 13
    targetDistanceSquared = distanceSquared
  }
  return target
}

function moveTowardTarget(
  state: Readonly<GameState>,
  target: Readonly<EnemyCombatTarget>,
  enemy: EnemyState,
  distanceToMaintain: number,
  fixedStepSeconds: number,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  moveTowardPoint(
    state,
    enemy,
    target.x,
    target.y,
    distanceToMaintain,
    fixedStepSeconds,
    movementIndex,
  )
}

function moveTowardPoint(
  state: Readonly<GameState>,
  enemy: EnemyState,
  targetX: number,
  targetY: number,
  distanceToMaintain: number,
  fixedStepSeconds: number,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  const offsetX = targetX - enemy.x
  const offsetY = targetY - enemy.y
  const distance = Math.hypot(offsetX, offsetY)
  const remainingDistance = Math.max(0, distance - distanceToMaintain)
  const separation = getSeparationVector(enemy, movementIndex)
  const separationMagnitude = Math.hypot(separation.x, separation.y)
  if (remainingDistance <= 0 && separationMagnitude <= 0) {
    return
  }

  const movementDirection = getSteeringDirection(offsetX, offsetY, separation)
  const separationMovement = Math.min(
    1,
    separationMagnitude * ENEMY_SEPARATION_STRENGTH,
  )
  const movementDistance = Math.min(
    getEffectiveEnemySpeed(state, enemy) * fixedStepSeconds,
    remainingDistance > 0
      ? remainingDistance
      : getEffectiveEnemySpeed(state, enemy) *
        fixedStepSeconds *
        separationMovement,
  )
  enemy.x += movementDirection.x * movementDistance
  enemy.y += movementDirection.y * movementDistance
}

function moveAwayFromTarget(
  state: Readonly<GameState>,
  target: Readonly<EnemyCombatTarget>,
  enemy: EnemyState,
  distanceToMaintain: number,
  fixedStepSeconds: number,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  const offsetX = enemy.x - target.x
  const offsetY = enemy.y - target.y
  const distance = Math.hypot(offsetX, offsetY)
  const remainingDistance = distanceMaintainDelta(distance, distanceToMaintain)
  const separation = getSeparationVector(enemy, movementIndex)
  const separationMagnitude = Math.hypot(separation.x, separation.y)
  if (remainingDistance <= 0 && separationMagnitude <= 0) {
    return
  }

  const movementDirection = getSteeringDirection(offsetX, offsetY, separation)
  const separationMovement = Math.min(
    1,
    separationMagnitude * ENEMY_SEPARATION_STRENGTH,
  )
  const movementDistance = Math.min(
    getEffectiveEnemySpeed(state, enemy) * fixedStepSeconds,
    remainingDistance > 0
      ? remainingDistance
      : getEffectiveEnemySpeed(state, enemy) *
        fixedStepSeconds *
        separationMovement,
  )
  if (movementDistance <= 0) {
    return
  }

  enemy.x += movementDirection.x * movementDistance
  enemy.y += movementDirection.y * movementDistance
}

function distanceMaintainDelta(distance: number, desiredDistance: number): number {
  return Math.max(0, desiredDistance - distance)
}

function updateChaseBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  const target = getEnemyCombatTarget(state, enemy)
  enemy.targetId = target.id
  moveTowardTarget(
    state,
    target,
    enemy,
    target.radius + enemy.radius,
    fixedStepSeconds,
    movementIndex,
  )
}

function updateStandoffBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  behavior: Extract<EnemyBehaviorDefinition, { kind: 'standoff' }>,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  const target = getEnemyCombatTarget(state, enemy)
  enemy.targetId = target.id
  const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y)
  if (distance < behavior.retreatDistance) {
    moveAwayFromTarget(
      state,
      target,
      enemy,
      behavior.retreatDistance,
      fixedStepSeconds,
      movementIndex,
    )
  } else {
    moveTowardTarget(
      state,
      target,
      enemy,
      behavior.desiredDistance,
      fixedStepSeconds,
      movementIndex,
    )
  }
}

function updateSplitBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  // Splitters use normal chase movement and only perform their special
  // behavior on death. Keeping this component explicit makes death behavior
  // composable.
  updateChaseBehavior(state, enemy, fixedStepSeconds, movementIndex)
}

function getInterceptPoint(
  state: Readonly<GameState>,
  target: Readonly<EnemyCombatTarget>,
  enemy: Readonly<EnemyState>,
  behavior: Extract<EnemyBehaviorDefinition, { kind: 'intercept' }>,
): Vector2 {
  const velocityX = target.id === state.player.id
    ? finiteValue(state.player.movementVelocityX)
    : 0
  const velocityY = target.id === state.player.id
    ? finiteValue(state.player.movementVelocityY)
    : 0
  const velocityLength = Math.hypot(velocityX, velocityY)
  const lateral = velocityLength > 0
    ? { x: -velocityY / velocityLength, y: velocityX / velocityLength }
    : getFallbackLateralDirection(target, enemy)
  const side = enemy.id % 2 === 0 ? 1 : -1
  const predictionSeconds = Math.min(
    MAX_INTERCEPT_PREDICTION_SECONDS,
    Math.max(0, behavior.predictionSeconds),
  )
  return {
    x: target.x + velocityX * predictionSeconds +
      lateral.x * behavior.lateralOffset * side,
    y: target.y + velocityY * predictionSeconds +
      lateral.y * behavior.lateralOffset * side,
  }
}

function getFallbackLateralDirection(
  target: Readonly<EnemyCombatTarget>,
  enemy: Readonly<EnemyState>,
): Vector2 {
  const towardEnemy = normalizeVector(
    enemy.x - target.x,
    enemy.y - target.y,
    enemy.id,
  )
  return {
    x: -towardEnemy.y,
    y: towardEnemy.x,
  }
}

function updateInterceptBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  behavior: Extract<EnemyBehaviorDefinition, { kind: 'intercept' }>,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): void {
  const target = getEnemyCombatTarget(state, enemy)
  enemy.targetId = target.id
  const interceptPoint = getInterceptPoint(state, target, enemy, behavior)
  const interceptDistance = Math.hypot(
    interceptPoint.x - enemy.x,
    interceptPoint.y - enemy.y,
  )
  if (interceptDistance <= behavior.engagementDistance) {
    moveTowardTarget(
      state,
      target,
      enemy,
      target.radius + enemy.radius,
      fixedStepSeconds,
      movementIndex,
    )
    return
  }
  moveTowardPoint(
    state,
    enemy,
    interceptPoint.x,
    interceptPoint.y,
    behavior.engagementDistance,
    fixedStepSeconds,
    movementIndex,
  )
}

const ENEMY_BEHAVIOR_COMPONENTS: Record<
  EnemyBehaviorDefinition['kind'],
  EnemyBehaviorComponent
> = {
  chase: updateChaseBehavior,
  standoff: (state, enemy, fixedStepSeconds, movementIndex) => {
    const behavior = getEffectiveEnemyBehavior(enemy)
    if (behavior.kind === 'standoff') {
      updateStandoffBehavior(
        state,
        enemy,
        fixedStepSeconds,
        behavior,
        movementIndex,
      )
    }
  },
  split: updateSplitBehavior,
  intercept: (state, enemy, fixedStepSeconds, movementIndex) => {
    const behavior = getEffectiveEnemyBehavior(enemy)
    if (behavior.kind === 'intercept') {
      updateInterceptBehavior(
        state,
        enemy,
        fixedStepSeconds,
        behavior,
        movementIndex,
      )
    }
  },
}

export function updateEnemyBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  movementIndex = createEnemyMovementIndex(state),
): void {
  if ((enemy.frozenRemainingDuration ?? 0) > 0) {
    return
  }
  const behavior = getEffectiveEnemyBehavior(enemy)
  ENEMY_BEHAVIOR_COMPONENTS[behavior.kind](
    state,
    enemy,
    fixedStepSeconds,
    movementIndex,
  )
}

export function updateEnemyBehaviors(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const movementIndex = createEnemyMovementIndex(state)
  for (const enemy of [...state.enemies]
    .sort((left, right) => left.id - right.id)) {
    updateEnemyBehavior(state, enemy, fixedStepSeconds, movementIndex)
  }
}

function createEnemyMovementIndex(
  state: Readonly<GameState>,
): SpatialHash<EnemyMovementSnapshot> {
  const movementIndex = new SpatialHash<EnemyMovementSnapshot>()
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue
    }
    movementIndex.insert(enemy.id, enemy.x, enemy.y, enemy.radius, {
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius,
    })
  }
  return movementIndex
}

function getSeparationVector(
  enemy: Readonly<EnemyState>,
  movementIndex: SpatialHash<EnemyMovementSnapshot>,
): Vector2 {
  let separationX = 0
  let separationY = 0
  const nearby = movementIndex.queryRadius(
    enemy.x,
    enemy.y,
    ENEMY_SEPARATION_RADIUS + enemy.radius,
  )
  for (const candidate of nearby) {
    if (candidate.id === enemy.id) {
      continue
    }
    const offsetX = enemy.x - candidate.x
    const offsetY = enemy.y - candidate.y
    const distance = Math.hypot(offsetX, offsetY)
    const influenceRadius = Math.max(
      ENEMY_SEPARATION_RADIUS,
      enemy.radius + candidate.radius + ENEMY_SEPARATION_PADDING,
    )
    if (distance >= influenceRadius) {
      continue
    }
    const influence = (influenceRadius - distance) / influenceRadius
    const away = distance > 0
      ? { x: offsetX / distance, y: offsetY / distance }
      : getOverlapDirection(enemy.id, candidate.id)
    separationX += away.x * influence
    separationY += away.y * influence
  }
  return { x: separationX, y: separationY }
}

function getOverlapDirection(firstId: number, secondId: number): Vector2 {
  const pairSeed = Math.min(firstId, secondId) * 0.6180339887498949 +
    Math.max(firstId, secondId) * 0.41421356237309503
  const angle = (pairSeed * Math.PI * 2) % (Math.PI * 2)
  const direction = firstId < secondId ? 1 : -1
  return {
    x: Math.cos(angle) * direction,
    y: Math.sin(angle) * direction,
  }
}

function getSteeringDirection(
  goalX: number,
  goalY: number,
  separation: Vector2,
): Vector2 {
  const goalLength = Math.hypot(goalX, goalY)
  const goal = goalLength > 0
    ? { x: goalX / goalLength, y: goalY / goalLength }
    : { x: 0, y: 0 }
  const length = Math.hypot(separation.x, separation.y)
  const x = goal.x + separation.x * ENEMY_SEPARATION_STRENGTH
  const y = goal.y + separation.y * ENEMY_SEPARATION_STRENGTH
  const combinedLength = Math.hypot(x, y)
  if (combinedLength > 0) {
    return { x: x / combinedLength, y: y / combinedLength }
  }
  return length > 0
    ? { x: separation.x / length, y: separation.y / length }
    : goal
}

function normalizeVector(x: number, y: number, fallbackId: number): Vector2 {
  const length = Math.hypot(x, y)
  if (length > 0) {
    return { x: x / length, y: y / length }
  }
  const angle = (fallbackId * 0.6180339887498949 * Math.PI * 2) % (Math.PI * 2)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function finiteValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getEffectiveEnemySpeed(
  state: Readonly<GameState>,
  enemy: Readonly<EnemyState>,
): number {
  const chillStacks = Math.min(3, Math.max(0, enemy.chillStacks ?? 0))
  return enemy.speed *
    getPostSpawnSpeedMultiplier(state.time, enemy.spawnTime) *
    (1 - chillStacks * 0.15)
}

export function getSplitChildren(
  enemy: EnemyState,
): readonly ChildSpawnRequest[] {
  const behavior = getEnemyDefinition(enemy.definitionId).behavior
  if (behavior.kind !== 'split') {
    return []
  }

  return createSplitChildren(enemy, behavior.split)
}

function createSplitChildren(
  enemy: EnemyState,
  split: EnemySplitDefinition,
): ChildSpawnRequest[] {
  const children: ChildSpawnRequest[] = []
  for (let index = 0; index < split.childCount; index += 1) {
    const angle = (Math.PI * 2 * index) / split.childCount
    children.push({
      definitionId: split.childDefinitionId,
      x: enemy.x + Math.cos(angle) * split.spreadRadius,
      y: enemy.y + Math.sin(angle) * split.spreadRadius,
      xpRewardOverride: split.childrenAwardXp ? undefined : 0,
      canDropLoot: false,
    })
  }
  return children
}
