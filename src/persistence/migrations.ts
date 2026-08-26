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
  DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  PERSISTENCE_SCHEMA_VERSION,
  type BasicProfileDto,
  type SettingsDto,
} from './types'

export const DEFAULT_SETTINGS: Readonly<SettingsDto> = Object.freeze({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  selectedBehaviorProfileId: DEFAULT_BEHAVIOR_PROFILE_ID,
  selectedDungeonLengthContractId: DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  selectedWorldModifierIds: [],
  selectedPlaystyleId: DEFAULT_PLAYSTYLE_ID,
})

export const DEFAULT_BASIC_PROFILE: Readonly<BasicProfileDto> = Object.freeze({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  unlockedDungeonLengthIds: [DEFAULT_DUNGEON_LENGTH_CONTRACT_ID],
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
  const selectedDungeonLengthCandidate =
    candidate.selectedDungeonLengthContractId ??
    candidate.selectedDungeonLengthId ??
    candidate.dungeonLengthContractId
  const selectedDungeonLengthContractId =
    typeof selectedDungeonLengthCandidate === 'string' &&
    selectedDungeonLengthCandidate.length > 0
      ? selectedDungeonLengthCandidate
      : DEFAULT_SETTINGS.selectedDungeonLengthContractId

  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    selectedBehaviorProfileId,
    selectedDungeonLengthContractId,
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
  const source = candidate.unlockedDungeonLengthIds ?? candidate.unlockedDungeonLengths
  const unlockedDungeonLengthIds = Array.isArray(source)
    ? source.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const uniqueIds = [...new Set(unlockedDungeonLengthIds)]
  if (!uniqueIds.includes(DEFAULT_DUNGEON_LENGTH_CONTRACT_ID)) {
    uniqueIds.unshift(DEFAULT_DUNGEON_LENGTH_CONTRACT_ID)
  }
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    unlockedDungeonLengthIds: uniqueIds,
  }
}
