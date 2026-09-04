import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isLootBoxRarity, type LootBoxRarity } from './LootBoxes'

export interface LootBoxOpeningResult {
  boxInstanceId: string
  boxRarity: LootBoxRarity
  itemInstanceId: string
  definitionId: string
  quantity: number
  metadata: Record<string, unknown>
  wasProcessed: boolean
}

export interface LootBoxService {
  openBox(
    operationId: string,
    boxInstanceId: string,
  ): Promise<LootBoxOpeningResult>
}

interface LootBoxOpeningRow {
  box_instance_id: string
  box_rarity: LootBoxRarity
  item_instance_id: string
  definition_id: string
  quantity: number
  metadata: Record<string, unknown>
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOpeningRow(value: unknown): value is LootBoxOpeningRow {
  return isRecord(value) &&
    isNonEmptyString(value.box_instance_id) &&
    isLootBoxRarity(value.box_rarity) &&
    isNonEmptyString(value.item_instance_id) &&
    isNonEmptyString(value.definition_id) &&
    typeof value.quantity === 'number' &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity >= 1 &&
    isRecord(value.metadata) &&
    typeof value.was_processed === 'boolean'
}

export function createLootBoxService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): LootBoxService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async openBox(operationId, boxInstanceId): Promise<LootBoxOpeningResult> {
      if (!isNonEmptyString(operationId) || !isNonEmptyString(boxInstanceId)) {
        throw new Error('Loot-box opening IDs must be non-empty.')
      }
      const response = await getClient().rpc('open_loot_box', {
        p_operation_id: operationId,
        p_box_instance_id: boxInstanceId,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isOpeningRow(response.data[0])) {
        throw new Error('Loot-box opening returned an invalid response.')
      }
      const row = response.data[0]
      return {
        boxInstanceId: row.box_instance_id,
        boxRarity: row.box_rarity,
        itemInstanceId: row.item_instance_id,
        definitionId: row.definition_id,
        quantity: row.quantity,
        metadata: row.metadata,
        wasProcessed: row.was_processed,
      }
    },
  }
}
