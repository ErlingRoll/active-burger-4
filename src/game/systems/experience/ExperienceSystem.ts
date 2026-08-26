import { xpRequiredForNextLevel } from '../../../content/progression/XpBalance'
import type { EntityId } from '../../ids'
import type { GameState } from '../../state/GameState'

export function updatePickups(
  state: GameState,
  fixedStepSeconds: number,
  grantExperience: (amount: number) => void,
): void {
  const player = state.player
  const pickups = [...state.pickups].sort((left, right) => left.id - right.id)
  const collectedIds = new Set<EntityId>()

  for (const pickup of pickups) {
    const offsetX = player.x - pickup.x
    const offsetY = player.y - pickup.y
    const distance = Math.hypot(offsetX, offsetY)
    const contactRange = player.radius + pickup.radius

    if (distance <= contactRange || distance === 0) {
      grantExperience(pickup.xpAmount)
      collectedIds.add(pickup.id)
      if (state.run.phase !== 'playing') {
        break
      }
      continue
    }

    if (distance > pickup.attractionRadius) {
      continue
    }

    const movementDistance = Math.min(
      pickup.attractionSpeed * fixedStepSeconds,
      distance - contactRange,
    )
    const movementRatio = movementDistance / distance
    pickup.x += offsetX * movementRatio
    pickup.y += offsetY * movementRatio

    if (
      Math.hypot(player.x - pickup.x, player.y - pickup.y) <= contactRange
    ) {
      grantExperience(pickup.xpAmount)
      collectedIds.add(pickup.id)
    }

    // Once level-up is reached, leave remaining pickups in state. They will
    // be collected after the future upgrade flow resumes the run.
    if (state.run.phase !== 'playing') {
      break
    }
  }

  state.pickups = state.pickups.filter(
    (pickup) => !collectedIds.has(pickup.id),
  )
}

export function grantExperience(state: GameState, amount: number): number {
  const experience = Number.isFinite(amount) ? Math.max(0, amount) : 0
  state.player.xp += experience

  let levelsGained = 0
  while (
    state.player.xp >=
    xpRequiredForNextLevel(state.player.level)
  ) {
    state.player.level += 1
    levelsGained += 1
  }

  return levelsGained
}
