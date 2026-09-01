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
  description: string
  image?: BugReportImage
  dungeon: BugReportDungeonContext
}

export interface BugReport {
  id: number
  userId: string
  submittedAt: string
  bug: string
  imageData: string | null
  imageName: string | null
  imageType: string | null
  dungeon: BugReportDungeonContext
}

export interface BugReportService {
  submit(input: SubmitBugReportInput): Promise<void>
  loadAll(): Promise<BugReport[]>
}

interface BugReportRow {
  id: number
  user_id: string
  submitted_at: string
  bug: string
  image_data: string | null
  image_name: string | null
  image_type: string | null
  dungeon_info: BugReportDungeonContext
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBugReportRow(value: unknown): value is BugReportRow {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.user_id === 'string' &&
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
}

export function createBugReportService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): BugReportService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async submit(input): Promise<void> {
      const response = await getClient()
        .from('bug_reports')
        .insert({
          user_id: input.userId,
          bug: input.description.trim(),
          image_data: input.image?.dataUrl ?? null,
          image_name: input.image?.fileName ?? null,
          image_type: input.image?.mediaType ?? null,
          dungeon_info: input.dungeon,
        })
      if (response.error) {
        throw response.error
      }
    },

    async loadAll(): Promise<BugReport[]> {
      const response = await getClient()
        .from('bug_reports')
        .select('id, user_id, submitted_at, bug, image_data, image_name, image_type, dungeon_info')
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
        submittedAt: row.submitted_at,
        bug: row.bug,
        imageData: row.image_data,
        imageName: row.image_name,
        imageType: row.image_type,
        dungeon: row.dungeon_info,
      }))
    },
  }
}
