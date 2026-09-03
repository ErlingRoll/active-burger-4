import { getSupabaseClient, type AuthEnvironment } from '../../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isRunModeId,
  isRunPreparationSnapshot,
  type RunModeId,
  type RunPreparationSnapshot,
} from '../../game/RunModes'

export type DungeonRunStatus =
  | 'active'
  | 'paused'
  | 'victory'
  | 'defeat'
  | 'forfeited'
export type DungeonRunTerminalOutcome = 'victory' | 'defeat'
export type DungeonRunSnapshotKind = 'start' | 'floor' | 'victory' | 'death' | 'forfeit'

export interface DungeonRunMetadata {
  runId: string
  status: DungeonRunStatus
  modeId: RunModeId
  preparation: RunPreparationSnapshot
  seed: number
  dungeonId: string
  characterClassId: string
  currentFloor: number
  maxFloor: number
  gameVersion: string
  startedAt: string
  updatedAt: string
}

export interface DungeonRunSnapshotRecord {
  kind: DungeonRunSnapshotKind
  floor: number
  payload: unknown
  capturedAt: string
}

export interface ActiveDungeonRun extends DungeonRunMetadata {
  checkpoint: DungeonRunSnapshotRecord
}

export interface CreateDungeonRunInput {
  runId: string
  seed: number
  modeId: RunModeId
  preparation: RunPreparationSnapshot
  contractId: string
  worldModifierIds: readonly string[]
  maxFloor: number
  startedAt: string
  dungeonId: string
  characterClassId: string
  gameVersion: string
  checkpoint: unknown
}

export interface SaveFloorCheckpointInput {
  runId: string
  floor: number
  checkpoint: unknown
}

export interface CompleteDungeonRunInput {
  runId: string
  outcome: DungeonRunTerminalOutcome
  completedAt: string
  checkpoint: unknown
  level: number
  killCount: number
  worldModifierIds: readonly string[]
}

export interface DungeonRunReward {
  essenceAwarded: number
  essenceBalance: number
  wasProcessed: boolean
}

export interface CompletedDungeonRun {
  metadata: DungeonRunMetadata
  snapshot: DungeonRunSnapshotRecord
  reward: DungeonRunReward
}

export interface ForfeitedDungeonRun extends CompletedDungeonRun {
  outcome: 'defeat'
}

export interface DungeonRunPersistenceService {
  loadActiveRun(): Promise<ActiveDungeonRun | null>
  createRun(input: CreateDungeonRunInput): Promise<ActiveDungeonRun>
  saveFloorCheckpoint(input: SaveFloorCheckpointInput): Promise<ActiveDungeonRun>
  pauseRun(runId: string): Promise<void>
  completeRun(input: CompleteDungeonRunInput): Promise<CompletedDungeonRun>
  forfeitRun(runId: string): Promise<ForfeitedDungeonRun>
}

interface DungeonRunRow {
  id: string
  status: DungeonRunStatus
  mode_id: RunModeId
  preparation: RunPreparationSnapshot
  contract_id: string
  world_modifier_ids: string[]
  seed: number
  dungeon_id: string
  class_id: string
  game_version: string
  max_floor: number
  current_floor: number
  started_at: string
  updated_at: string
}

interface DungeonRunSnapshotRow {
  snapshot_kind: DungeonRunSnapshotKind
  floor_number: number
  payload: unknown
  saved_at: string
}

interface RpcCheckpointRow {
  run_id: string
  floor_number: number
  snapshot_id: number
  saved_at: string
}

interface RpcStartRow {
  run_id: string
  status: DungeonRunStatus
  started_at: string
  was_created: boolean
}

interface RpcRunRewardRow {
  run_id: string
  essence_awarded: number
  essence_balance: number
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRunStatus(value: unknown): value is DungeonRunStatus {
  return value === 'active' ||
    value === 'paused' ||
    value === 'victory' ||
    value === 'defeat' ||
    value === 'forfeited'
}

function isSnapshotKind(value: unknown): value is DungeonRunSnapshotKind {
  return value === 'start' ||
    value === 'floor' ||
    value === 'victory' ||
    value === 'death' ||
    value === 'forfeit'
}

function isDungeonRunRow(value: unknown): value is DungeonRunRow {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    isRunStatus(value.status) &&
    isRunModeId(value.mode_id) &&
    isRunPreparationSnapshot(value.preparation) &&
    typeof value.contract_id === 'string' &&
    Array.isArray(value.world_modifier_ids) &&
    value.world_modifier_ids.every((id) => typeof id === 'string') &&
    typeof value.seed === 'number' &&
    Number.isSafeInteger(value.seed) &&
    typeof value.dungeon_id === 'string' &&
    typeof value.class_id === 'string' &&
    typeof value.game_version === 'string' &&
    Number.isInteger(value.max_floor) &&
    typeof value.max_floor === 'number' &&
    value.max_floor >= 1 &&
    Number.isInteger(value.current_floor) &&
    typeof value.current_floor === 'number' &&
    value.current_floor >= 1 &&
    typeof value.started_at === 'string' &&
    typeof value.updated_at === 'string'
}

function isDungeonRunSnapshotRow(value: unknown): value is DungeonRunSnapshotRow {
  return isRecord(value) &&
    isSnapshotKind(value.snapshot_kind) &&
    Number.isInteger(value.floor_number) &&
    typeof value.floor_number === 'number' &&
    value.floor_number >= 1 &&
    'payload' in value &&
    typeof value.saved_at === 'string'
}

function toMetadata(row: DungeonRunRow): DungeonRunMetadata {
  return {
    runId: row.id,
    status: row.status,
    modeId: row.mode_id,
    preparation: row.preparation,
    seed: row.seed,
    dungeonId: row.dungeon_id,
    characterClassId: row.class_id,
    currentFloor: row.current_floor,
    maxFloor: row.max_floor,
    gameVersion: row.game_version,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  }
}

function toSnapshot(row: DungeonRunSnapshotRow): DungeonRunSnapshotRecord {
  return {
    kind: row.snapshot_kind,
    floor: row.floor_number,
    payload: row.payload,
    capturedAt: row.saved_at,
  }
}

function invalidResponse(message: string): Error {
  return new Error(`Dungeon run persistence returned an invalid response: ${message}`)
}

function parseCheckpointResponse(data: unknown): RpcCheckpointRow {
  const row = Array.isArray(data) && data.length === 1 ? data[0] : undefined
  if (!isRecord(row) ||
    typeof row.run_id !== 'string' ||
    typeof row.floor_number !== 'number' ||
    !Number.isInteger(row.floor_number) ||
    typeof row.snapshot_id !== 'number' ||
    !Number.isInteger(row.snapshot_id) ||
    typeof row.saved_at !== 'string') {
    throw invalidResponse('expected one checkpoint response')
  }
  return {
    run_id: row.run_id,
    floor_number: row.floor_number,
    snapshot_id: row.snapshot_id,
    saved_at: row.saved_at,
  }
}

function parseStartResponse(data: unknown): RpcStartRow {
  const row = Array.isArray(data) && data.length === 1 ? data[0] : undefined
  if (!isRecord(row) ||
    typeof row.run_id !== 'string' ||
    !isRunStatus(row.status) ||
    typeof row.started_at !== 'string' ||
    typeof row.was_created !== 'boolean') {
    throw invalidResponse('expected one start response')
  }
  return {
    run_id: row.run_id,
    status: row.status,
    started_at: row.started_at,
    was_created: row.was_created,
  }
}

function parseRewardResponse(data: unknown): RpcRunRewardRow {
  const row = Array.isArray(data) && data.length === 1 ? data[0] : undefined
  if (!isRecord(row) ||
    typeof row.run_id !== 'string' ||
    typeof row.essence_awarded !== 'number' ||
    typeof row.essence_balance !== 'number' ||
    typeof row.was_processed !== 'boolean') {
    throw invalidResponse('expected one reward response')
  }
  return {
    run_id: row.run_id,
    essence_awarded: row.essence_awarded,
    essence_balance: row.essence_balance,
    was_processed: row.was_processed,
  }
}

export function createDungeonRunPersistenceService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): DungeonRunPersistenceService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  const loadActiveRun = async (): Promise<ActiveDungeonRun | null> => {
    const client = getClient()
    const runResponse = await client
      .from('dungeon_runs')
      .select(
        'id, status, mode_id, preparation, contract_id, world_modifier_ids, seed, dungeon_id, class_id, game_version, max_floor, current_floor, started_at, updated_at',
      )
      .in('status', ['active', 'paused'])
      .maybeSingle()
    if (runResponse.error) {
      throw runResponse.error
    }
    if (runResponse.data === null) {
      return null
    }
    if (!isDungeonRunRow(runResponse.data)) {
      throw invalidResponse('active run row shape')
    }

    const snapshotResponse = await client
      .from('dungeon_run_snapshots')
      .select('snapshot_kind, floor_number, payload, saved_at')
      .eq('run_id', runResponse.data.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (snapshotResponse.error) {
      throw snapshotResponse.error
    }
    if (!snapshotResponse.data || !isDungeonRunSnapshotRow(snapshotResponse.data)) {
      throw invalidResponse('active run checkpoint shape')
    }
    return {
      ...toMetadata(runResponse.data),
      checkpoint: toSnapshot(snapshotResponse.data),
    }
  }

  const loadCheckpoint = async (
    runId: string,
  ): Promise<DungeonRunSnapshotRecord> => {
    const response = await getClient()
      .from('dungeon_run_snapshots')
      .select('snapshot_kind, floor_number, payload, saved_at')
      .eq('run_id', runId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (response.error) {
      throw response.error
    }
    if (!response.data || !isDungeonRunSnapshotRow(response.data)) {
      throw invalidResponse('checkpoint row shape')
    }
    return toSnapshot(response.data)
  }

  return {
    loadActiveRun,

    async createRun(input): Promise<ActiveDungeonRun> {
      const response = await getClient().rpc('start_dungeon_run', {
        p_run_id: input.runId,
        p_seed: input.seed,
        p_contract_id: input.contractId,
        p_world_modifier_ids: [...input.worldModifierIds],
        p_max_floor: input.maxFloor,
        p_started_at: input.startedAt,
        p_dungeon_id: input.dungeonId,
        p_mode_id: input.modeId,
        p_class_id: input.characterClassId,
        p_game_version: input.gameVersion,
        p_preparation: input.preparation,
        p_initial_payload: input.checkpoint,
      })
      if (response.error) {
        throw response.error
      }
      const row = parseStartResponse(response.data)
      const activeRun = await loadActiveRun()
      if (!activeRun || activeRun.runId !== row.run_id) {
        throw invalidResponse('started run was not readable')
      }
      return activeRun
    },

    async saveFloorCheckpoint(input): Promise<ActiveDungeonRun> {
      const response = await getClient().rpc('checkpoint_dungeon_run', {
        p_run_id: input.runId,
        p_floor_number: input.floor,
        p_payload: input.checkpoint,
      })
      if (response.error) {
        throw response.error
      }
      parseCheckpointResponse(response.data)
      const [runResponse, checkpoint] = await Promise.all([
        getClient()
          .from('dungeon_runs')
          .select(
            'id, status, mode_id, preparation, contract_id, world_modifier_ids, seed, dungeon_id, class_id, game_version, max_floor, current_floor, started_at, updated_at',
          )
          .eq('id', input.runId)
          .single(),
        loadCheckpoint(input.runId),
      ])
      if (runResponse.error) {
        throw runResponse.error
      }
      if (!isDungeonRunRow(runResponse.data)) {
        throw invalidResponse('updated run row shape')
      }
      return { ...toMetadata(runResponse.data), checkpoint }
    },

    async pauseRun(runId): Promise<void> {
      const response = await getClient().rpc('pause_dungeon_run', {
        p_run_id: runId,
      })
      if (response.error) {
        throw response.error
      }
    },

    async completeRun(input): Promise<CompletedDungeonRun> {
      const response = await getClient().rpc('complete_dungeon_run', {
        p_run_id: input.runId,
        p_outcome: input.outcome,
        p_completed_at: input.completedAt,
        p_result_payload: {
          checkpoint: input.checkpoint,
          level: input.level,
          killCount: input.killCount,
          outcome: input.outcome,
          worldModifierIds: input.worldModifierIds,
        },
      })
      if (response.error) {
        throw response.error
      }
      const reward = parseRewardResponse(response.data)
      const rowResponse = await getClient()
        .from('dungeon_runs')
        .select(
          'id, status, mode_id, preparation, contract_id, world_modifier_ids, seed, dungeon_id, class_id, game_version, max_floor, current_floor, started_at, updated_at',
        )
        .eq('id', input.runId)
        .single()
      if (rowResponse.error) {
        throw rowResponse.error
      }
      if (!isDungeonRunRow(rowResponse.data)) {
        throw invalidResponse('completed run row shape')
      }
      const snapshot = await loadCheckpoint(input.runId)
      return {
        metadata: toMetadata(rowResponse.data),
        snapshot,
        reward: {
          essenceAwarded: reward.essence_awarded,
          essenceBalance: reward.essence_balance,
          wasProcessed: reward.was_processed,
        },
      }
    },

    async forfeitRun(runId): Promise<ForfeitedDungeonRun> {
      const response = await getClient().rpc('forfeit_dungeon_run', {
        p_run_id: runId,
        p_forfeited_at: new Date().toISOString(),
      })
      if (response.error) {
        throw response.error
      }
      const reward = parseRewardResponse(response.data)
      const rowResponse = await getClient()
        .from('dungeon_runs')
        .select(
          'id, status, mode_id, preparation, contract_id, world_modifier_ids, seed, dungeon_id, class_id, game_version, max_floor, current_floor, started_at, updated_at',
        )
        .eq('id', runId)
        .single()
      if (rowResponse.error) {
        throw rowResponse.error
      }
      if (!isDungeonRunRow(rowResponse.data)) {
        throw invalidResponse('forfeited run row shape')
      }
      const checkpoint = await loadCheckpoint(runId)
      return {
        outcome: 'defeat',
        metadata: toMetadata(rowResponse.data),
        snapshot: checkpoint,
        reward: {
          essenceAwarded: reward.essence_awarded,
          essenceBalance: reward.essence_balance,
          wasProcessed: reward.was_processed,
        },
      }
    },
  }
}
