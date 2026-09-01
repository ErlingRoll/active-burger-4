import type { BehaviorProfileId } from '../content/behaviors/BehaviorProfiles'
import type { WorldModifierId } from '../content/modifiers/WorldModifiers'
import type { PlaystyleId } from '../content/playstyles/Playstyles'
import type { GameKeybinds } from '../input/Keybinds'

export const PERSISTENCE_SCHEMA_VERSION = 3

/** The implicit contract represented by the default dungeon run. */
export const DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID = 'default-dungeon-10-floor'

export type DungeonMaxFloorContractId = string

export interface SettingsDto {
  schemaVersion: number
  selectedBehaviorProfileId: BehaviorProfileId
  selectedDungeonMaxFloorContractId: DungeonMaxFloorContractId
  selectedWorldModifierIds: WorldModifierId[]
  selectedPlaystyleId: PlaystyleId
  keybinds: GameKeybinds
}

export interface BasicProfileDto {
  schemaVersion: number
  /** Contract IDs, rather than display names or mutable content objects. */
  unlockedDungeonMaxFloorIds: string[]
}

export type SettingsRecord = SettingsDto & { id: 'settings' }
export type BasicProfileRecord = BasicProfileDto & { id: 'profile' }

export interface HiddenBugReportRecord {
  id: string
  userId: string
  reportId: number
}
