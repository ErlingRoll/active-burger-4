import {
  ENCOUNTER_DEFINITIONS,
  createInfernoWardenEncounter,
  createStoneGolemEncounterTimeline,
  type EncounterDefinition,
} from '../encounters/Encounters'

export type DungeonDefinitionId = string
export type DungeonMaxFloorUnlockId = string

/** A maximum-floor contract enabled by a meta-progression unlock. */
export interface DungeonMaxFloorContract {
  id: string
  maxFloor: number
  requiredUnlockId: DungeonMaxFloorUnlockId
}

export interface DungeonDefinition {
  id: DungeonDefinitionId
  name: string
  /** Normal floors to clear before the final encounter. */
  defaultMaxFloor: number
  /** Every normal floor occupies this much deterministic simulation time. */
  floorDurationSeconds: number
  /** Applied to authored ordinary enemy HP and contact damage per floor. */
  ordinaryEnemyStatScalingPerFloor: number
  /** Boss events reserve one complete floor and suspend normal spawning. */
  bossFloorDurationSeconds: number
  encounterTimeline: readonly EncounterDefinition[]
  maximumFloorContracts: readonly DungeonMaxFloorContract[]
}

export const DEFAULT_DUNGEON_ID: DungeonDefinitionId = 'default-dungeon'
export const DEFAULT_DUNGEON_MAX_FLOOR = 10
export const DUNGEON_FLOOR_DURATION_SECONDS = 120
export const BOSS_FLOOR_EVENT_DURATION_SECONDS = 120
export const ORDINARY_ENEMY_FLOOR_STAT_SCALING = 0.01

/** Builds boss encounters for every normal floor, ending with Inferno Warden. */
export function createDungeonEncounterTimeline(
  maximumFloor: number,
): readonly EncounterDefinition[] {
  return [
    ...createStoneGolemEncounterTimeline(maximumFloor),
    createInfernoWardenEncounter(maximumFloor),
  ]
}

export const DEFAULT_DUNGEON_CONFIG: DungeonDefinition = {
  id: DEFAULT_DUNGEON_ID,
  name: 'The First Depths',
  defaultMaxFloor: DEFAULT_DUNGEON_MAX_FLOOR,
  floorDurationSeconds: DUNGEON_FLOOR_DURATION_SECONDS,
  ordinaryEnemyStatScalingPerFloor: ORDINARY_ENEMY_FLOOR_STAT_SCALING,
  bossFloorDurationSeconds: BOSS_FLOOR_EVENT_DURATION_SECONDS,
  encounterTimeline: ENCOUNTER_DEFINITIONS,
  maximumFloorContracts: [
    {
      id: 'default-dungeon-20-floor',
      maxFloor: 20,
      requiredUnlockId: 'default-dungeon-20-floor',
    },
    {
      id: 'default-dungeon-50-floor',
      maxFloor: 50,
      requiredUnlockId: 'default-dungeon-50-floor',
    },
    {
      id: 'default-dungeon-100-floor',
      maxFloor: 100,
      requiredUnlockId: 'default-dungeon-100-floor',
    },
  ],
}

export const DUNGEON_DEFINITIONS: Readonly<Record<DungeonDefinitionId, DungeonDefinition>> = {
  [DEFAULT_DUNGEON_ID]: DEFAULT_DUNGEON_CONFIG,
}

export function getDungeonDefinition(
  id: DungeonDefinitionId = DEFAULT_DUNGEON_ID,
): DungeonDefinition {
  const definition = DUNGEON_DEFINITIONS[id]
  if (!definition) {
    throw new Error(`Unknown dungeon definition: ${id}`)
  }
  return definition
}

/**
 * Floor scaling is derived from the authored base each time. Callers must not
 * feed a previously scaled value back into this function.
 */
export function getFloorStatMultiplier(
  floorNumber: number,
  dungeon: DungeonDefinition = DEFAULT_DUNGEON_CONFIG,
): number {
  const floor = Math.max(1, Math.floor(floorNumber))
  return 1 + (floor - 1) * dungeon.ordinaryEnemyStatScalingPerFloor
}

export interface OrdinaryEnemyStats {
  maxHp: number
  contactDamage: number
}

export function scaleOrdinaryEnemyStats(
  authoredStats: OrdinaryEnemyStats,
  floorNumber: number,
  dungeon: DungeonDefinition = DEFAULT_DUNGEON_CONFIG,
): OrdinaryEnemyStats {
  const multiplier = getFloorStatMultiplier(floorNumber, dungeon)
  return {
    maxHp: authoredStats.maxHp * multiplier,
    contactDamage: authoredStats.contactDamage * multiplier,
  }
}

/** Checks a maximum-floor contract without changing unlock state. */
export function isDungeonMaxFloorUnlocked(
  contract: DungeonMaxFloorContract,
  unlockedIds: ReadonlySet<string> = new Set(),
): boolean {
  return unlockedIds.has(contract.requiredUnlockId)
}

/** Resolves a run's maximum normal floor without permitting arbitrary values. */
export function resolveDungeonMaxFloor(
  dungeon: DungeonDefinition,
  contractId?: string,
  unlockedIds: ReadonlySet<string> = new Set(),
): number {
  if (!contractId) {
    return dungeon.defaultMaxFloor
  }
  const contract = dungeon.maximumFloorContracts.find(
    (candidate) => candidate.id === contractId,
  )
  if (!contract) {
    throw new Error(`Unknown dungeon maximum-floor contract: ${contractId}`)
  }
  if (!isDungeonMaxFloorUnlocked(contract, unlockedIds)) {
    throw new Error(
      `Dungeon maximum-floor contract "${contractId}" requires unlock "${contract.requiredUnlockId}"`,
    )
  }
  return contract.maxFloor
}
