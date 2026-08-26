import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  isBehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'
import { normalizeWorldModifierIds } from '../content/modifiers/WorldModifiers'
import {
  DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  PERSISTENCE_SCHEMA_VERSION,
  type BasicProfileDto,
  type CompletedRunResultPayloadDto,
  type PendingCompletedRunResultDto,
  type PendingRunPhase,
  type SettingsDto,
} from './types'

const DEFAULT_PAYLOAD: CompletedRunResultPayloadDto = {
  phase: 'results',
  elapsedTime: 0,
  level: 1,
  xp: 0,
  killCount: 0,
}

export const DEFAULT_SETTINGS: Readonly<SettingsDto> = Object.freeze({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  selectedBehaviorProfileId: DEFAULT_BEHAVIOR_PROFILE_ID,
  selectedDungeonLengthContractId: DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  selectedWorldModifierIds: [],
})

export const DEFAULT_BASIC_PROFILE: Readonly<BasicProfileDto> = Object.freeze({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  unlockedDungeonLengthIds: [DEFAULT_DUNGEON_LENGTH_CONTRACT_ID],
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback))
}

function phase(value: unknown): PendingRunPhase {
  return value === 'victory' || value === 'defeat' || value === 'results'
    ? value
    : DEFAULT_PAYLOAD.phase
}

function migratePayload(value: unknown): CompletedRunResultPayloadDto {
  const candidate = isRecord(value) ? value : {}
  const next: CompletedRunResultPayloadDto = {
    phase: phase(candidate.phase),
    elapsedTime: nonNegativeNumber(
      candidate.elapsedTime ?? candidate.elapsedSeconds,
      DEFAULT_PAYLOAD.elapsedTime,
    ),
    level: Math.max(
      1,
      Math.floor(nonNegativeNumber(candidate.level, DEFAULT_PAYLOAD.level)),
    ),
    xp: nonNegativeNumber(candidate.xp, DEFAULT_PAYLOAD.xp),
    killCount: Math.floor(
      nonNegativeNumber(candidate.killCount, DEFAULT_PAYLOAD.killCount),
    ),
  }
  if (candidate.outcome === 'victory') {
    next.outcome = 'victory'
  }
  const worldModifierIds = normalizeWorldModifierIds(
    Array.isArray(candidate.worldModifierIds) ? candidate.worldModifierIds : [],
  )
  if (worldModifierIds.length > 0) {
    next.worldModifierIds = worldModifierIds
    next.worldModifierRewardMultiplier = finiteNumber(
      candidate.worldModifierRewardMultiplier,
      1,
    )
  }
  return next
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

/** Migrates a queued result without dropping it because a newer field is absent. */
export function migratePendingCompletedRunResult(
  value: unknown,
  fallbackId = '',
): PendingCompletedRunResultDto {
  const candidate = isRecord(value) ? value : {}
  const id =
    typeof candidate.id === 'string' && candidate.id.length > 0
      ? candidate.id
      : fallbackId
  const runId =
    typeof candidate.runId === 'string' && candidate.runId.length > 0
      ? candidate.runId
      : id
  return {
    id,
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    runId,
    completedAt: nonNegativeNumber(candidate.completedAt, 0),
    payload: migratePayload(candidate.payload),
  }
}
