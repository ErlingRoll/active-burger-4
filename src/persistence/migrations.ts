import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  isBehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'
import { normalizeWorldModifierIds } from '../content/modifiers/WorldModifiers'
import {
  DEFAULT_PLAYSTYLE_ID,
  isPlaystyleId,
} from '../content/playstyles/Playstyles'
import {
  DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  PERSISTENCE_SCHEMA_VERSION,
  type BasicProfileDto,
  type SettingsDto,
} from './types'

export const DEFAULT_SETTINGS: Readonly<SettingsDto> = Object.freeze({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  selectedBehaviorProfileId: DEFAULT_BEHAVIOR_PROFILE_ID,
  selectedDungeonMaxFloorContractId: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  selectedWorldModifierIds: [],
  selectedPlaystyleId: DEFAULT_PLAYSTYLE_ID,
})

export const DEFAULT_BASIC_PROFILE: Readonly<BasicProfileDto> = Object.freeze({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  unlockedDungeonMaxFloorIds: [DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID],
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Converts old or partially-written settings into the current DTO shape. */
export function migrateSettings(value: unknown): SettingsDto {
  const candidate = isRecord(value) ? value : {}
  const selectedBehaviorProfileId = isBehaviorProfileId(
    candidate.selectedBehaviorProfileId ??
      candidate.selectedBehaviorProfile ??
      candidate.behaviorProfileId,
  )
    ? (candidate.selectedBehaviorProfileId ??
        candidate.selectedBehaviorProfile ??
        candidate.behaviorProfileId) as SettingsDto['selectedBehaviorProfileId']
    : DEFAULT_SETTINGS.selectedBehaviorProfileId
  const selectedDungeonMaxFloorCandidate =
    candidate.selectedDungeonMaxFloorContractId ??
    candidate.selectedDungeonMaxFloorId ??
    candidate.dungeonMaxFloorContractId ??
    candidate.selectedDungeonLengthContractId ??
    candidate.selectedDungeonLengthId ??
    candidate.dungeonLengthContractId
  const selectedDungeonMaxFloorContractId =
    typeof selectedDungeonMaxFloorCandidate === 'string' &&
    selectedDungeonMaxFloorCandidate.length > 0
      ? migrateLegacyDungeonContractId(selectedDungeonMaxFloorCandidate)
      : DEFAULT_SETTINGS.selectedDungeonMaxFloorContractId

  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    selectedBehaviorProfileId,
    selectedDungeonMaxFloorContractId,
    selectedWorldModifierIds: normalizeWorldModifierIds(
      Array.isArray(candidate.selectedWorldModifierIds)
        ? candidate.selectedWorldModifierIds
        : [],
    ),
    selectedPlaystyleId: isPlaystyleId(candidate.selectedPlaystyleId)
      ? candidate.selectedPlaystyleId
      : DEFAULT_PLAYSTYLE_ID,
  }
}

/** Converts old or partially-written profile data into the current DTO shape. */
export function migrateBasicProfile(value: unknown): BasicProfileDto {
  const candidate = isRecord(value) ? value : {}
  const source = candidate.unlockedDungeonMaxFloorIds ??
    candidate.unlockedDungeonLengthIds ??
    candidate.unlockedDungeonLengths
  const unlockedDungeonMaxFloorIds = Array.isArray(source)
    ? source
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map(migrateLegacyDungeonContractId)
    : []
  const uniqueIds = [...new Set(unlockedDungeonMaxFloorIds)]
  if (!uniqueIds.includes(DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID)) {
    uniqueIds.unshift(DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID)
  }
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    unlockedDungeonMaxFloorIds: uniqueIds,
  }
}

function migrateLegacyDungeonContractId(contractId: string): string {
  switch (contractId) {
    case 'default-dungeon-10-minute':
      return DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID
    case 'default-dungeon-15-minute':
      return 'default-dungeon-20-floor'
    case 'default-dungeon-20-minute':
      return 'default-dungeon-50-floor'
    default:
      return contractId
  }
}
