import {
  getEnemyDefinition,
  type EnemyBehaviorDefinition,
  type EnemySplitDefinition,
} from '../../../content/enemies/Enemies'
import type { EnemyState, GameState } from '../../state/GameState'

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
) => void

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
  target: Readonly<EnemyCombatTarget>,
  enemy: EnemyState,
  distanceToMaintain: number,
  fixedStepSeconds: number,
): void {
  const offsetX = target.x - enemy.x
  const offsetY = target.y - enemy.y
  const distance = Math.hypot(offsetX, offsetY)
  if (distance <= distanceToMaintain || distance === 0) {
    return
  }

  const movementDistance = Math.min(
    getEffectiveEnemySpeed(enemy) * fixedStepSeconds,
    distance - distanceToMaintain,
  )
  const movementRatio = movementDistance / distance
  enemy.x += offsetX * movementRatio
  enemy.y += offsetY * movementRatio
}

function moveAwayFromTarget(
  target: Readonly<EnemyCombatTarget>,
  enemy: EnemyState,
  distanceToMaintain: number,
  fixedStepSeconds: number,
): void {
  const offsetX = enemy.x - target.x
  const offsetY = enemy.y - target.y
  const distance = Math.hypot(offsetX, offsetY)
  const angle =
    distance === 0
      ? (enemy.id * 0.6180339887498949 * Math.PI * 2) % (Math.PI * 2)
      : Math.atan2(offsetY, offsetX)
  const movementDistance = Math.min(
    getEffectiveEnemySpeed(enemy) * fixedStepSeconds,
    distanceMaintainDelta(distance, distanceToMaintain),
  )
  if (movementDistance <= 0) {
    return
  }

  enemy.x += Math.cos(angle) * movementDistance
  enemy.y += Math.sin(angle) * movementDistance
}

function distanceMaintainDelta(distance: number, desiredDistance: number): number {
  return Math.max(0, desiredDistance - distance)
}

function updateChaseBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
): void {
  const target = getEnemyCombatTarget(state, enemy)
  enemy.targetId = target.id
  moveTowardTarget(
    target,
    enemy,
    target.radius + enemy.radius,
    fixedStepSeconds,
  )
}

function updateStandoffBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  behavior: Extract<EnemyBehaviorDefinition, { kind: 'standoff' }>,
): void {
  const target = getEnemyCombatTarget(state, enemy)
  enemy.targetId = target.id
  const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y)
  if (distance < behavior.retreatDistance) {
    moveAwayFromTarget(target, enemy, behavior.retreatDistance, fixedStepSeconds)
  } else {
    moveTowardTarget(target, enemy, behavior.desiredDistance, fixedStepSeconds)
  }
}

function updateSplitBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
): void {
  // Splitters use normal chase movement and only perform their special
  // behavior on death. Keeping this component explicit makes death behavior
  // composable.
  updateChaseBehavior(state, enemy, fixedStepSeconds)
}

const ENEMY_BEHAVIOR_COMPONENTS: Record<
  EnemyBehaviorDefinition['kind'],
  EnemyBehaviorComponent
> = {
  chase: updateChaseBehavior,
  standoff: (state, enemy, fixedStepSeconds) => {
    const behavior = getEnemyDefinition(enemy.definitionId).behavior
    if (behavior.kind === 'standoff') {
      updateStandoffBehavior(state, enemy, fixedStepSeconds, behavior)
    }
  },
  split: updateSplitBehavior,
}

export function updateEnemyBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
): void {
  if ((enemy.frozenRemainingDuration ?? 0) > 0) {
    return
  }
  const behavior = getEnemyDefinition(enemy.definitionId).behavior
  ENEMY_BEHAVIOR_COMPONENTS[behavior.kind](
    state,
    enemy,
    fixedStepSeconds,
  )
}

function getEffectiveEnemySpeed(enemy: Readonly<EnemyState>): number {
  const chillStacks = Math.min(3, Math.max(0, enemy.chillStacks ?? 0))
  return enemy.speed * (1 - chillStacks * 0.15)
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
