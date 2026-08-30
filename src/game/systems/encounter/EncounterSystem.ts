import type { EncounterDefinition } from '../../../content/encounters/Encounters'
import {
  createDungeonEncounterTimeline,
  getDungeonDefinition,
} from '../../../content/dungeons/Dungeons'
import type { EntityIdAllocator } from '../../ids'
import type { GameState } from '../../state/GameState'
import { spawnBoss } from '../spawning/SpawningSystem'

function nextEncounter(
  state: GameState,
): EncounterDefinition | undefined {
  const completedIds = new Set(state.run.completedEncounterIds ?? [])
  const dungeon = getDungeonDefinition(state.run.dungeonId)
  const floor = state.run.floor ?? 1
  const floorStartedAt = state.run.floorStartedAt ?? 0
  const floorDurationSeconds =
    state.run.floorDurationSeconds ?? dungeon.floorDurationSeconds
  const floorComplete =
    state.time - floorStartedAt >= floorDurationSeconds - 1e-9
  return getEncounterTimeline(state)
    .filter((event) =>
      floorComplete &&
      event.floorNumber === floor,
    )
    .sort((left, right) => {
      if (left.floorNumber !== right.floorNumber) {
        return left.floorNumber - right.floorNumber
      }
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    })
    .find((event) => !completedIds.has(event.id))
}

function getEncounterTimeline(state: GameState): readonly EncounterDefinition[] {
  const dungeon = getDungeonDefinition(state.run.dungeonId)
  return state.run.dungeonMaxFloor === undefined ||
    state.run.dungeonMaxFloor === dungeon.defaultMaxFloor
    ? dungeon.encounterTimeline
    : createDungeonEncounterTimeline(
      state.run.dungeonMaxFloor,
    )
}

export function startBossEncounter(
  state: GameState,
  allocator: EntityIdAllocator,
  definition?: EncounterDefinition,
  manual = false,
): boolean {
  const encounterDefinition =
    definition ?? getEncounterTimeline(state)[0]
  const completedEncounterIds = state.run.completedEncounterIds ?? []
  if (
    !encounterDefinition ||
    encounterDefinition.type !== 'boss' ||
    state.run.phase !== 'playing' ||
    state.encounter?.status === 'active' ||
    state.stairs !== undefined ||
    state.floorTransition !== undefined ||
    completedEncounterIds.includes(encounterDefinition.id) ||
    (state.bosses?.length ?? 0) > 0
  ) {
    return false
  }
  const bossDefinitionIds = encounterDefinition.bossDefinitionIds?.length
    ? encounterDefinition.bossDefinitionIds
    : [encounterDefinition.bossDefinitionId]
  const bossEntityIds = bossDefinitionIds.map((bossDefinitionId, index) =>
    spawnBoss(state, allocator, bossDefinitionId, {
      x: state.player.x + 320 + index * 90,
      y: state.player.y,
    }),
  )
  state.encounter = {
    status: 'active',
    encounterId: encounterDefinition.id,
    bossDefinitionId: encounterDefinition.bossDefinitionId,
    bossEntityId: bossEntityIds[0],
    bossEntityIds,
    startedAt: state.time,
    durationSeconds: encounterDefinition.durationSeconds,
    ...(encounterDefinition.floorNumber !== undefined
      ? { floorNumber: encounterDefinition.floorNumber }
      : {}),
    ...(encounterDefinition.isFinal ? { isFinal: true } : {}),
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
  if (
    state.encounter?.status === 'active' ||
    state.stairs !== undefined ||
    state.floorTransition !== undefined
  ) {
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
  if (encounter.encounterId) {
    const completed = state.run.completedEncounterIds ??= []
    if (!completed.includes(encounter.encounterId)) {
      completed.push(encounter.encounterId)
    }
  }
  return true
}
