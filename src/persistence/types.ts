import type { BehaviorProfileId } from '../content/behaviors/BehaviorProfiles'
import type { WorldModifierId } from '../content/modifiers/WorldModifiers'
import type { PlaystyleId } from '../content/playstyles/Playstyles'

export const PERSISTENCE_SCHEMA_VERSION = 1

/** The implicit contract represented by the default ten-minute dungeon run. */
export const DEFAULT_DUNGEON_LENGTH_CONTRACT_ID = 'default-dungeon-10-minute'

export type DungeonLengthContractId = string

export interface SettingsDto {
  schemaVersion: number
  selectedBehaviorProfileId: BehaviorProfileId
  selectedDungeonLengthContractId: DungeonLengthContractId
  selectedWorldModifierIds: WorldModifierId[]
  selectedPlaystyleId: PlaystyleId
}

export interface BasicProfileDto {
  schemaVersion: number
  /** Contract IDs, rather than display names or mutable content objects. */
  unlockedDungeonLengthIds: string[]
}

export type PendingRunPhase = 'victory' | 'defeat' | 'results'

/**
 * Deliberately duplicates the small result boundary instead of importing game
 * state. The simulation can hand this DTO to persistence without depending on
 * IndexedDB, Dexie, or React.
 */
export interface CompletedRunResultPayloadDto {
  phase: PendingRunPhase
  elapsedTime: number
  level: number
  xp: number
  killCount: number
  worldModifierIds?: WorldModifierId[]
  worldModifierRewardMultiplier?: number
  outcome?: 'victory'
}

export interface PendingCompletedRunResultDto {
  id: string
  schemaVersion: number
  runId: string
  completedAt: number
  payload: CompletedRunResultPayloadDto
}

export type PendingRunResultDto = PendingCompletedRunResultDto

export type SettingsRecord = SettingsDto & { id: 'settings' }
export type BasicProfileRecord = BasicProfileDto & { id: 'profile' }

export type PendingCompletedRunResultInput = Omit<
  PendingCompletedRunResultDto,
  'id' | 'schemaVersion'
> & { id?: string }
