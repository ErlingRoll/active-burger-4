import type { EntityIdAllocator } from '../../ids'
import type { GameState, StairsState } from '../../state/GameState'

export const STAIRS_RADIUS = 48
export const FLOOR_TRANSITION_DURATION_SECONDS = 1
export const FLOOR_TRANSITION_SECONDS = FLOOR_TRANSITION_DURATION_SECONDS

export function spawnStairs(
  state: GameState,
  allocator: EntityIdAllocator,
  position: { x: number; y: number },
  isFinal = false,
): StairsState {
  const stairs: StairsState = {
    id: allocator.createEntityId(),
    x: position.x,
    y: position.y,
    radius: STAIRS_RADIUS,
    spawnedAt: state.time,
    floorNumber: state.run.floor ?? 1,
    isFinal,
    rewardsCollected: false,
  }
  state.stairs = stairs
  return stairs
}

export function isPlayerTouchingStairs(
  state: Readonly<GameState>,
  stairs?: Readonly<StairsState>,
): boolean {
  const activeStairs = stairs ?? state.stairs
  if (!activeStairs) {
    return false
  }
  const dx = state.player.x - activeStairs.x
  const dy = state.player.y - activeStairs.y
  const range = state.player.radius + activeStairs.radius
  return dx * dx + dy * dy <= range * range
}

export function updateStairs(
  state: GameState,
  onTouch: (stairs: StairsState) => void,
): boolean {
  const stairs = state.stairs
  if (!stairs || stairs.rewardsCollected || !isPlayerTouchingStairs(state, stairs)) {
    return false
  }
  onTouch(stairs)
  return true
}
