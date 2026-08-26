import type { BehaviorProfileId } from '../content/behaviors/BehaviorProfiles'
import type { WorldModifierId } from '../content/modifiers/WorldModifiers'
import type { PlaystyleId } from '../content/playstyles/Playstyles'

export const PERSISTENCE_SCHEMA_VERSION = 2

/** The implicit contract represented by the default ten-floor dungeon run. */
export const DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID = 'default-dungeon-10-floor'

export type DungeonMaxFloorContractId = string

export interface SettingsDto {
  schemaVersion: number
  selectedBehaviorProfileId: BehaviorProfileId
  selectedDungeonMaxFloorContractId: DungeonMaxFloorContractId
  selectedWorldModifierIds: WorldModifierId[]
  selectedPlaystyleId: PlaystyleId
}

export interface BasicProfileDto {
  schemaVersion: number
  /** Contract IDs, rather than display names or mutable content objects. */
  unlockedDungeonMaxFloorIds: string[]
}

export type SettingsRecord = SettingsDto & { id: 'settings' }
export type BasicProfileRecord = BasicProfileDto & { id: 'profile' }
