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

export type SettingsRecord = SettingsDto & { id: 'settings' }
export type BasicProfileRecord = BasicProfileDto & { id: 'profile' }
