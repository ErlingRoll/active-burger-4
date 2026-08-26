import {
  ENCOUNTER_DEFINITIONS,
  createStoneGolemEncounterTimeline,
  type EncounterDefinition,
} from '../encounters/Encounters'
import { INFERNO_WARDEN_BOSS_ID } from '../bosses/Bosses'

export type DungeonDefinitionId = string
export type DungeonLengthUnlockId = string

/**
 * A length contract describes content that may be enabled by a future unlock.
 * It is intentionally only data: persistence, purchases, and unlock mutation
 * belong to a later meta-progression milestone.
 */
export interface DungeonLengthContract {
  id: string
  lengthSeconds: number
  requiredUnlockId: DungeonLengthUnlockId
}

export interface DungeonDefinition {
  id: DungeonDefinitionId
  name: string
  /** The length used when a run does not request a future length contract. */
  defaultLengthSeconds: number
  /** Every floor occupies this much deterministic simulation time. */
  floorDurationSeconds: number
  /** Applied to authored ordinary enemy HP and contact damage per floor. */
  ordinaryEnemyStatScalingPerFloor: number
  /** Boss events reserve one complete floor and suspend normal spawning. */
  bossFloorDurationSeconds: number
  encounterTimeline: readonly EncounterDefinition[]
  longerLengthContracts: readonly DungeonLengthContract[]
}

export const DEFAULT_DUNGEON_ID: DungeonDefinitionId = 'default-dungeon'
export const DEFAULT_DUNGEON_LENGTH_SECONDS = 10 * 60
export const DUNGEON_FLOOR_DURATION_SECONDS = 120
export const BOSS_FLOOR_EVENT_DURATION_SECONDS = 120
export const ORDINARY_ENEMY_FLOOR_STAT_SCALING = 0.01
export const INFERNO_WARDEN_ENCOUNTER_ID = 'inferno-warden-final'

/** Builds the intermediate timeline for any permitted dungeon final length. */
export function createDungeonEncounterTimeline(
  finalLengthSeconds: number,
  floorDurationSeconds = DUNGEON_FLOOR_DURATION_SECONDS,
): readonly EncounterDefinition[] {
  const intermediateEvents = createStoneGolemEncounterTimeline(
    finalLengthSeconds,
    floorDurationSeconds,
  )
  return [
    ...intermediateEvents,
    {
      id: INFERNO_WARDEN_ENCOUNTER_ID,
      timeSeconds: finalLengthSeconds,
      type: 'boss',
      bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
      durationSeconds: BOSS_FLOOR_EVENT_DURATION_SECONDS,
      floorNumber: Math.floor(finalLengthSeconds / floorDurationSeconds) + 1,
      isFinal: true,
    },
  ]
}

export const DEFAULT_DUNGEON_CONFIG: DungeonDefinition = {
  id: DEFAULT_DUNGEON_ID,
  name: 'The First Depths',
  defaultLengthSeconds: DEFAULT_DUNGEON_LENGTH_SECONDS,
  floorDurationSeconds: DUNGEON_FLOOR_DURATION_SECONDS,
  ordinaryEnemyStatScalingPerFloor: ORDINARY_ENEMY_FLOOR_STAT_SCALING,
  bossFloorDurationSeconds: BOSS_FLOOR_EVENT_DURATION_SECONDS,
  encounterTimeline: ENCOUNTER_DEFINITIONS,
  longerLengthContracts: [
    {
      id: 'default-dungeon-15-minute',
      lengthSeconds: 15 * 60,
      requiredUnlockId: 'dungeon-length-15-minute',
    },
    {
      id: 'default-dungeon-20-minute',
      lengthSeconds: 20 * 60,
      requiredUnlockId: 'dungeon-length-20-minute',
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

/** Returns the one-based floor active at the supplied elapsed run time. */
export function getDungeonFloor(
  timeSeconds: number,
  dungeon: DungeonDefinition = DEFAULT_DUNGEON_CONFIG,
): number {
  return Math.max(
    1,
    Math.floor(Math.max(0, timeSeconds) / dungeon.floorDurationSeconds) + 1,
  )
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

/**
 * Checks a future length contract without changing any unlock state.
 * Persistence and purchase flows intentionally do not exist in this layer.
 */
export function isDungeonLengthUnlocked(
  contract: DungeonLengthContract,
  unlockedIds: ReadonlySet<string> = new Set(),
): boolean {
  return unlockedIds.has(contract.requiredUnlockId)
}

/**
 * Resolves a run length without permitting arbitrary future lengths. A run
 * without a contract always uses the default ten-minute contract.
 */
export function resolveDungeonLengthSeconds(
  dungeon: DungeonDefinition,
  contractId?: string,
  unlockedIds: ReadonlySet<string> = new Set(),
): number {
  if (!contractId) {
    return dungeon.defaultLengthSeconds
  }
  const contract = dungeon.longerLengthContracts.find(
    (candidate) => candidate.id === contractId,
  )
  if (!contract) {
    throw new Error(`Unknown dungeon length contract: ${contractId}`)
  }
  if (!isDungeonLengthUnlocked(contract, unlockedIds)) {
    throw new Error(
      `Dungeon length contract "${contractId}" requires unlock "${contract.requiredUnlockId}"`,
    )
  }
  return contract.lengthSeconds
}
