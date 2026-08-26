import {
  ENCOUNTER_DEFINITIONS,
  type EncounterDefinition,
} from '../../../content/encounters/Encounters'
import type { EntityIdAllocator } from '../../ids'
import type { GameState } from '../../state/GameState'
import { spawnBoss } from '../spawning/SpawningSystem'

function nextEncounter(
  state: GameState,
): EncounterDefinition | undefined {
  return ENCOUNTER_DEFINITIONS
    .filter((event) => event.timeSeconds <= state.time + 1e-9)
    .sort((left, right) => {
      const timeOrder = left.timeSeconds - right.timeSeconds
      if (timeOrder !== 0) {
        return timeOrder
      }
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    })
    .find((event) => event.timeSeconds >= (state.encounter?.startedAt ?? 0))
}

export function startBossEncounter(
  state: GameState,
  allocator: EntityIdAllocator,
  definition = ENCOUNTER_DEFINITIONS[0],
  manual = false,
): boolean {
  if (
    !definition ||
    definition.type !== 'boss' ||
    state.run.phase !== 'playing' ||
    state.encounter?.status === 'active' ||
    state.encounter?.status === 'complete' ||
    (state.bosses?.length ?? 0) > 0
  ) {
    return false
  }
  const id = spawnBoss(state, allocator, definition.bossDefinitionId, {
    x: state.player.x + 320,
    y: state.player.y,
  })
  state.encounter = {
    status: 'active',
    encounterId: definition.id,
    bossDefinitionId: definition.bossDefinitionId,
    bossEntityId: id,
    startedAt: state.time,
    normalSpawnsSuspended: true,
    ...(manual ? { outcome: undefined } : {}),
  }
  return true
}

/** Starts all due timeline events exactly once. */
export function updateEncounter(
  state: GameState,
  allocator: EntityIdAllocator,
): boolean {
  if (state.encounter?.status === 'active' || state.encounter?.status === 'complete') {
    return false
  }
  const definition = nextEncounter(state)
  return definition ? startBossEncounter(state, allocator, definition) : false
}

export function completeBossEncounter(state: GameState): boolean {
  const encounter = state.encounter
  if (!encounter || encounter.status !== 'active') {
    return false
  }
  encounter.status = 'complete'
  encounter.completedAt = state.time
  encounter.outcome = 'victory'
  encounter.normalSpawnsSuspended = false
  return true
}
