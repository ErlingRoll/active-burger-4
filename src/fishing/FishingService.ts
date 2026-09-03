import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRarity, type Rarity } from '../content/rarity/Rarity'
import {
  isFishingSpotId,
  type FishingCatch,
} from './FishingContent'

export interface StartFishingInput {
  attemptId: string
  spotId: string
  baitDefinitionId: string
  rodInstanceId: string | null
}

export interface FishingAttemptResult extends FishingCatch {
  attemptId: string
  itemInstanceId: string
  wasProcessed: boolean
}

export interface FishingService {
  startAttempt(input: StartFishingInput): Promise<FishingAttemptResult>
}

interface RpcFishingAttemptRow {
  attempt_id: string
  item_instance_id: string
  fish_definition_id: string
  fish_metadata: {
    speciesId: string
    rarity: Rarity
    sizePercentile: number
  }
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRpcFishingAttemptRow(value: unknown): value is RpcFishingAttemptRow {
  if (!isRecord(value) ||
    !isNonEmptyString(value.attempt_id) ||
    !isNonEmptyString(value.item_instance_id) ||
    !isNonEmptyString(value.fish_definition_id) ||
    !isRecord(value.fish_metadata) ||
    !isNonEmptyString(value.fish_metadata.speciesId) ||
    !isRarity(value.fish_metadata.rarity) ||
    typeof value.fish_metadata.sizePercentile !== 'number' ||
    value.fish_metadata.sizePercentile < 0 ||
    value.fish_metadata.sizePercentile > 1 ||
    typeof value.was_processed !== 'boolean') {
    return false
  }
  return true
}

function invalidResponse(): Error {
  return new Error('Fishing persistence returned an invalid response.')
}

export function createFishingService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): FishingService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async startAttempt(input): Promise<FishingAttemptResult> {
      if (!isNonEmptyString(input.attemptId)) {
        throw new Error('Fishing attempt ID must be non-empty.')
      }
      if (!isFishingSpotId(input.spotId)) {
        throw new Error(`Unknown fishing spot: ${input.spotId}`)
      }
      if (!isNonEmptyString(input.baitDefinitionId)) {
        throw new Error('Fishing bait definition ID must be non-empty.')
      }
      if (input.rodInstanceId !== null && !isNonEmptyString(input.rodInstanceId)) {
        throw new Error('Fishing rod instance ID must be non-empty when provided.')
      }
      const response = await getClient().rpc('start_fishing_attempt', {
        p_attempt_id: input.attemptId,
        p_spot_id: input.spotId,
        p_bait_definition_id: input.baitDefinitionId,
        p_rod_instance_id: input.rodInstanceId,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcFishingAttemptRow(response.data[0])) {
        throw invalidResponse()
      }
      const row = response.data[0]
      return {
        attemptId: row.attempt_id,
        itemInstanceId: row.item_instance_id,
        definitionId: row.fish_definition_id,
        metadata: row.fish_metadata,
        wasProcessed: row.was_processed,
      }
    },
  }
}
