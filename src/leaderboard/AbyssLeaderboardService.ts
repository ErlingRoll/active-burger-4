import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AbyssLeaderboardEntry {
  profileId: string
  displayName: string
  /** The deepest Abyss floor this player has reached, across every attempt. */
  deepestFloor: number
  rank: number
}

export interface AbyssLeaderboardService {
  load(): Promise<AbyssLeaderboardEntry[]>
}

interface AbyssLeaderboardRow {
  profile_id: string
  display_name: string
  deepest_floor: number
  rank: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbyssLeaderboardRow(value: unknown): value is AbyssLeaderboardRow {
  return isRecord(value) &&
    typeof value.profile_id === 'string' &&
    typeof value.display_name === 'string' &&
    typeof value.deepest_floor === 'number' &&
    Number.isInteger(value.deepest_floor) &&
    value.deepest_floor > 0 &&
    typeof value.rank === 'number' &&
    Number.isInteger(value.rank) &&
    value.rank > 0
}

export function createAbyssLeaderboardService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): AbyssLeaderboardService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async load(): Promise<AbyssLeaderboardEntry[]> {
      const response = await getClient().rpc('get_abyss_depth_leaderboard')
      if (response.error) {
        throw response.error
      }
      // Ten places and, when the reader placed outside them, their own row.
      if (!Array.isArray(response.data) ||
        !response.data.every(isAbyssLeaderboardRow) ||
        response.data.length > 11) {
        throw new Error('Abyss leaderboard returned an invalid response.')
      }
      return response.data.map((entry) => ({
        profileId: entry.profile_id,
        displayName: entry.display_name,
        deepestFloor: entry.deepest_floor,
        rank: entry.rank,
      }))
    },
  }
}
