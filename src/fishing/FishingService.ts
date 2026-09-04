import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRarity, type Rarity } from '../content/rarity/Rarity'
import {
  isFishingMode,
  type FishingMode,
  type FishingCatch,
} from './FishingContent'

export interface BeginFishingInput {
  attemptId: string
  mode: FishingMode
  baitDefinitionId: string
  baitInstanceId: string | null
  rodInstanceId: string | null
}

export interface FishingAttemptPreparation {
  attemptId: string
  mode: FishingMode
  status: 'pending' | 'completed'
  resolveAt: string
  pityAt: string
  wasProcessed: boolean
}

export interface ResolveFishingInput {
  attemptId: string
  manualSuccess: boolean
}

export interface FishingAttemptResult extends FishingCatch {
  attemptId: string
  itemInstanceId: string
  wasProcessed: boolean
}

export interface FishingService {
  beginAttempt(input: BeginFishingInput): Promise<FishingAttemptPreparation>
  resolveAttempt(input: ResolveFishingInput): Promise<FishingAttemptResult>
}

interface RpcFishingPreparationRow {
  attempt_id: string
  mode_id: FishingMode
  status: 'pending' | 'completed'
  resolve_at: string
  pity_at: string
  was_processed: boolean
}

interface RpcFishingResultRow {
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

function isAttemptStatus(value: unknown): value is 'pending' | 'completed' {
  return value === 'pending' || value === 'completed'
}

function isRpcFishingPreparationRow(value: unknown): value is RpcFishingPreparationRow {
  return isRecord(value) &&
    isNonEmptyString(value.attempt_id) &&
    isFishingMode(value.mode_id) &&
    isAttemptStatus(value.status) &&
    isNonEmptyString(value.resolve_at) &&
    Number.isFinite(Date.parse(value.resolve_at)) &&
    isNonEmptyString(value.pity_at) &&
    Number.isFinite(Date.parse(value.pity_at)) &&
    typeof value.was_processed === 'boolean'
}

function isRpcFishingResultRow(value: unknown): value is RpcFishingResultRow {
  return isRecord(value) &&
    isNonEmptyString(value.attempt_id) &&
    isNonEmptyString(value.item_instance_id) &&
    isNonEmptyString(value.fish_definition_id) &&
    isRecord(value.fish_metadata) &&
    isNonEmptyString(value.fish_metadata.speciesId) &&
    isRarity(value.fish_metadata.rarity) &&
    typeof value.fish_metadata.sizePercentile === 'number' &&
    value.fish_metadata.sizePercentile >= 0 &&
    value.fish_metadata.sizePercentile <= 1 &&
    typeof value.was_processed === 'boolean'
}

function invalidResponse(message: string): Error {
  return new Error(`Fishing persistence returned an invalid response: ${message}`)
}

function assertAttemptId(attemptId: string): void {
  if (!isNonEmptyString(attemptId)) {
    throw new Error('Fishing attempt ID must be non-empty.')
  }
}

function assertOptionalInstanceId(instanceId: string | null, label: string): void {
  if (instanceId !== null && !isNonEmptyString(instanceId)) {
    throw new Error(`${label} must be non-empty when provided.`)
  }
}

export function createFishingService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): FishingService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async beginAttempt(input): Promise<FishingAttemptPreparation> {
      assertAttemptId(input.attemptId)
      if (!isFishingMode(input.mode)) {
        throw new Error(`Unknown fishing mode: ${input.mode}`)
      }
      if (!isNonEmptyString(input.baitDefinitionId)) {
        throw new Error('Fishing bait definition ID must be non-empty.')
      }
      assertOptionalInstanceId(input.baitInstanceId, 'Fishing bait instance ID')
      assertOptionalInstanceId(input.rodInstanceId, 'Fishing rod instance ID')

      const response = await getClient().rpc('begin_fishing_attempt', {
        p_attempt_id: input.attemptId,
        p_mode_id: input.mode,
        p_bait_definition_id: input.baitDefinitionId,
        p_bait_instance_id: input.baitInstanceId,
        p_rod_instance_id: input.rodInstanceId,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcFishingPreparationRow(response.data[0])) {
        throw invalidResponse('expected one preparation row')
      }
      const row = response.data[0]
      return {
        attemptId: row.attempt_id,
        mode: row.mode_id,
        status: row.status,
        resolveAt: row.resolve_at,
        pityAt: row.pity_at,
        wasProcessed: row.was_processed,
      }
    },

    async resolveAttempt(input): Promise<FishingAttemptResult> {
      assertAttemptId(input.attemptId)
      if (typeof input.manualSuccess !== 'boolean') {
        throw new Error('Fishing manual interaction result must be boolean.')
      }

      const response = await getClient().rpc('resolve_fishing_attempt', {
        p_attempt_id: input.attemptId,
        p_manual_success: input.manualSuccess,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcFishingResultRow(response.data[0])) {
        throw invalidResponse('expected one resolved catch row')
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
