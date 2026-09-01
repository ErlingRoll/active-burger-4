import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface BugReportImage {
  dataUrl: string
  fileName: string
  mediaType: string
}

export interface BugReportDungeonContext {
  dungeonId: string
  dungeonName: string
  currentFloor: number
  maxFloor: number
  playstyleId: string
  worldModifierIds: readonly string[]
  runId?: string
}

export interface SubmitBugReportInput {
  userId: string
  username: string
  description: string
  image?: BugReportImage
  dungeon: BugReportDungeonContext
}

export interface BugReportFloorSnapshot {
  id: number
  runId: string
  floor: number
  payload: unknown
  savedAt: string
}

export interface BugReport {
  id: number
  userId: string
  username: string | null
  submittedAt: string
  bug: string
  imageData: string | null
  imageName: string | null
  imageType: string | null
  dungeon: BugReportDungeonContext
  savedFloorId: number | null
}

export interface BugReportService {
  submit(input: SubmitBugReportInput): Promise<void>
  loadAll(): Promise<BugReport[]>
  loadFloorSnapshot(snapshotId: number): Promise<BugReportFloorSnapshot>
}

interface BugReportRow {
  id: number
  user_id: string
  username: string | null
  submitted_at: string
  bug: string
  image_data: string | null
  image_name: string | null
  image_type: string | null
  dungeon_info: BugReportDungeonContext
  floor_snapshot_id: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBugReportRow(value: unknown): value is BugReportRow {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.user_id === 'string' &&
    (value.username === null || typeof value.username === 'string') &&
    typeof value.submitted_at === 'string' &&
    typeof value.bug === 'string' &&
    (value.image_data === null || typeof value.image_data === 'string') &&
    (value.image_name === null || typeof value.image_name === 'string') &&
    (value.image_type === null || typeof value.image_type === 'string') &&
    isRecord(value.dungeon_info) &&
    typeof value.dungeon_info.dungeonId === 'string' &&
    typeof value.dungeon_info.dungeonName === 'string' &&
    typeof value.dungeon_info.currentFloor === 'number' &&
    Number.isInteger(value.dungeon_info.currentFloor) &&
    typeof value.dungeon_info.maxFloor === 'number' &&
    Number.isInteger(value.dungeon_info.maxFloor) &&
    typeof value.dungeon_info.playstyleId === 'string' &&
    Array.isArray(value.dungeon_info.worldModifierIds) &&
    value.dungeon_info.worldModifierIds.every((id) => typeof id === 'string')
    && (value.floor_snapshot_id === null ||
      (typeof value.floor_snapshot_id === 'number' && Number.isSafeInteger(value.floor_snapshot_id)))
}

export function createBugReportService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): BugReportService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async submit(input): Promise<void> {
      let savedFloorId: number | null = null
      if (input.dungeon.runId) {
        const snapshotResponse = await getClient()
          .from('dungeon_run_snapshots')
          .select('id')
          .eq('run_id', input.dungeon.runId)
          .eq('floor_number', input.dungeon.currentFloor)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (snapshotResponse.error) {
          throw snapshotResponse.error
        }
        if (snapshotResponse.data !== null) {
          if (!isRecord(snapshotResponse.data) ||
            typeof snapshotResponse.data.id !== 'number' ||
            !Number.isSafeInteger(snapshotResponse.data.id)) {
            throw new Error('Saved floor snapshot returned an invalid response.')
          }
          savedFloorId = snapshotResponse.data.id
        }
      }
      const response = await getClient()
        .from('bug_reports')
        .insert({
          user_id: input.userId,
          username: input.username.trim() || input.userId,
          bug: input.description.trim(),
          image_data: input.image?.dataUrl ?? null,
          image_name: input.image?.fileName ?? null,
          image_type: input.image?.mediaType ?? null,
          dungeon_info: input.dungeon,
          floor_snapshot_id: savedFloorId,
        })
      if (response.error) {
        throw response.error
      }
    },

    async loadAll(): Promise<BugReport[]> {
      const response = await getClient()
        .from('bug_reports')
        .select('id, user_id, username, submitted_at, bug, image_data, image_name, image_type, dungeon_info, floor_snapshot_id')
        .order('submitted_at', { ascending: false })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isBugReportRow)) {
        throw new Error('Bug reports returned an invalid response.')
      }
      return response.data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        submittedAt: row.submitted_at,
        bug: row.bug,
        imageData: row.image_data,
        imageName: row.image_name,
        imageType: row.image_type,
        dungeon: row.dungeon_info,
        savedFloorId: row.floor_snapshot_id,
      }))
    },

    async loadFloorSnapshot(snapshotId): Promise<BugReportFloorSnapshot> {
      const response = await getClient()
        .from('dungeon_run_snapshots')
        .select('id, run_id, floor_number, payload, saved_at')
        .eq('id', snapshotId)
        .maybeSingle()
      if (response.error) {
        throw response.error
      }
      if (!response.data || !isRecord(response.data) ||
        typeof response.data.id !== 'number' ||
        !Number.isSafeInteger(response.data.id) ||
        typeof response.data.run_id !== 'string' ||
        typeof response.data.floor_number !== 'number' ||
        !Number.isInteger(response.data.floor_number) ||
        !('payload' in response.data) ||
        typeof response.data.saved_at !== 'string') {
        throw new Error('Saved floor snapshot returned an invalid response.')
      }
      return {
        id: response.data.id,
        runId: response.data.run_id,
        floor: response.data.floor_number,
        payload: response.data.payload,
        savedAt: response.data.saved_at,
      }
    },
  }
}
