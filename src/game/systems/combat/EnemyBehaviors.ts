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
}

type EnemyBehaviorComponent = (
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
) => void

function moveTowardPlayer(
  state: GameState,
  enemy: EnemyState,
  distanceToMaintain: number,
  fixedStepSeconds: number,
): void {
  const offsetX = state.player.x - enemy.x
  const offsetY = state.player.y - enemy.y
  const distance = Math.hypot(offsetX, offsetY)
  if (distance <= distanceToMaintain || distance === 0) {
    return
  }

  const movementDistance = Math.min(
    enemy.speed * fixedStepSeconds,
    distance - distanceToMaintain,
  )
  const movementRatio = movementDistance / distance
  enemy.x += offsetX * movementRatio
  enemy.y += offsetY * movementRatio
}

function moveAwayFromPlayer(
  state: GameState,
  enemy: EnemyState,
  distanceToMaintain: number,
  fixedStepSeconds: number,
): void {
  const offsetX = enemy.x - state.player.x
  const offsetY = enemy.y - state.player.y
  const distance = Math.hypot(offsetX, offsetY)
  const angle =
    distance === 0
      ? (enemy.id * 0.6180339887498949 * Math.PI * 2) % (Math.PI * 2)
      : Math.atan2(offsetY, offsetX)
  const movementDistance = Math.min(
    enemy.speed * fixedStepSeconds,
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
  moveTowardPlayer(
    state,
    enemy,
    state.player.radius + enemy.radius,
    fixedStepSeconds,
  )
}

function updateStandoffBehavior(
  state: GameState,
  enemy: EnemyState,
  fixedStepSeconds: number,
  behavior: Extract<EnemyBehaviorDefinition, { kind: 'standoff' }>,
): void {
  const distance = Math.hypot(
    state.player.x - enemy.x,
    state.player.y - enemy.y,
  )
  if (distance < behavior.retreatDistance) {
    moveAwayFromPlayer(state, enemy, behavior.retreatDistance, fixedStepSeconds)
  } else {
    moveTowardPlayer(state, enemy, behavior.desiredDistance, fixedStepSeconds)
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
  const behavior = getEnemyDefinition(enemy.definitionId).behavior
  ENEMY_BEHAVIOR_COMPONENTS[behavior.kind](
    state,
    enemy,
    fixedStepSeconds,
  )
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
    })
  }
  return children
}
