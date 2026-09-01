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

export interface BugReportService {
  submit(input: SubmitBugReportInput): Promise<void>
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
  }
}
