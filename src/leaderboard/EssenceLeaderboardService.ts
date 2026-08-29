import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EssenceLeaderboardEntry {
  profileId: string
  displayName: string
  essence: number
}

export interface EssenceLeaderboardService {
  load(): Promise<EssenceLeaderboardEntry[]>
}

interface EssenceLeaderboardRow {
  profile_id: string
  display_name: string
  essence_balance: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEssenceLeaderboardRow(value: unknown): value is EssenceLeaderboardRow {
  return isRecord(value) &&
    typeof value.profile_id === 'string' &&
    typeof value.display_name === 'string' &&
    typeof value.essence_balance === 'number' &&
    Number.isFinite(value.essence_balance)
}

export function createEssenceLeaderboardService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): EssenceLeaderboardService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async load(): Promise<EssenceLeaderboardEntry[]> {
      const response = await getClient().rpc('get_essence_leaderboard')
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) ||
        !response.data.every(isEssenceLeaderboardRow) ||
        response.data.length > 10) {
        throw new Error('Essence leaderboard returned an invalid response.')
      }
      return response.data.map((entry) => ({
        profileId: entry.profile_id,
        displayName: entry.display_name,
        essence: entry.essence_balance,
      }))
    },
  }
}
