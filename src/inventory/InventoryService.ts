import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getInventoryItemDefinition } from './ItemDefinitions'
import type {
  InventoryConsumptionResult,
  InventoryItemCategory,
  InventoryItemConsumption,
  InventoryItemInstance,
  InventoryOperationId,
  InventoryReleaseResult,
  InventoryReservationId,
  InventoryReservationLine,
  InventoryReservationResult,
  InventorySalvageResult,
  InventoryService,
  InventorySourceType,
} from './InventoryTypes'

interface InventoryItemRow {
  id: string
  definition_id: string
  quantity: number
  bound: boolean
  metadata: Record<string, unknown>
  source_type: InventorySourceType
  source_id: string | null
  created_at: string
  updated_at: string
}

interface RpcConsumptionRow {
  item_instance_id: string
  quantity_consumed: number
  was_processed: boolean
}

interface RpcReservationRow {
  reservation_id: string
  item_instance_id: string
  quantity_reserved: number
  was_processed: boolean
}

interface RpcReleaseRow {
  reservation_id: string
  quantity_released: number
  was_processed: boolean
}

interface RpcSalvageRow {
  item_instance_id: string
  essence_awarded: number
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

function isInventorySourceType(value: unknown): value is InventorySourceType {
  return value === 'starter' ||
    value === 'fishing' ||
    value === 'dungeon-reward' ||
    value === 'abyss-reward' ||
    value === 'loot-box' ||
    value === 'market' ||
    value === 'admin' ||
    value === 'system'
}

function isInventoryItemRow(value: unknown): value is InventoryItemRow {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.definition_id) &&
    isPositiveInteger(value.quantity) &&
    typeof value.bound === 'boolean' &&
    isRecord(value.metadata) &&
    isInventorySourceType(value.source_type) &&
    (value.source_id === null || isNonEmptyString(value.source_id)) &&
    isNonEmptyString(value.created_at) &&
    isNonEmptyString(value.updated_at)
}

function isRpcConsumptionRow(value: unknown): value is RpcConsumptionRow {
  return isRecord(value) &&
    isNonEmptyString(value.item_instance_id) &&
    isPositiveInteger(value.quantity_consumed) &&
    typeof value.was_processed === 'boolean'
}

function isRpcReservationRow(value: unknown): value is RpcReservationRow {
  return isRecord(value) &&
    isNonEmptyString(value.reservation_id) &&
    isNonEmptyString(value.item_instance_id) &&
    isPositiveInteger(value.quantity_reserved) &&
    typeof value.was_processed === 'boolean'
}

function isRpcReleaseRow(value: unknown): value is RpcReleaseRow {
  return isRecord(value) &&
    isNonEmptyString(value.reservation_id) &&
    typeof value.quantity_released === 'number' &&
    Number.isSafeInteger(value.quantity_released) &&
    value.quantity_released >= 0 &&
    typeof value.was_processed === 'boolean'
}

function isRpcSalvageRow(value: unknown): value is RpcSalvageRow {
  return isRecord(value) &&
    isNonEmptyString(value.item_instance_id) &&
    typeof value.essence_awarded === 'number' &&
    Number.isSafeInteger(value.essence_awarded) &&
    value.essence_awarded >= 0 &&
    typeof value.was_processed === 'boolean'
}

function invalidResponse(message: string): Error {
  return new Error(`Inventory persistence returned an invalid response: ${message}`)
}

function assertOperationId(operationId: string): void {
  if (!isNonEmptyString(operationId)) {
    throw new Error('Inventory operation ID must be non-empty.')
  }
}

function assertItems(items: readonly unknown[]): void {
  if (items.length === 0) {
    throw new Error('Inventory operation requires at least one item.')
  }
}

function assertConsumptionItems(
  items: readonly InventoryItemConsumption[],
): void {
  assertItems(items)
  for (const item of items) {
    if (!isNonEmptyString(item.itemInstanceId) || !isPositiveInteger(item.quantity)) {
      throw new Error('Inventory item consumption is invalid.')
    }
  }
}

function toItemInstance(row: InventoryItemRow): InventoryItemInstance {
  return {
    itemInstanceId: row.id,
    definitionId: row.definition_id,
    quantity: row.quantity,
    bound: row.bound,
    metadata: row.metadata,
    source: {
      type: row.source_type,
      id: row.source_id,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createInventoryService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): InventoryService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async loadInventory(category?: InventoryItemCategory): Promise<InventoryItemInstance[]> {
      const query = getClient()
        .from('inventory_item_instances')
        .select('*')
        .order('created_at', { ascending: true })
      const response = await query
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isInventoryItemRow)) {
        throw invalidResponse('expected an inventory item array')
      }
      const instances = response.data.map(toItemInstance)
      return category
        ? instances.filter((item) => getInventoryItemDefinition(item.definitionId)?.category === category)
        : instances
    },

    async consumeItems(
      operationId: InventoryOperationId,
      items: readonly InventoryItemConsumption[],
    ): Promise<InventoryConsumptionResult[]> {
      assertOperationId(operationId)
      assertConsumptionItems(items)
      const response = await getClient().rpc('consume_inventory_items', {
        p_operation_id: operationId,
        p_items: items,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isRpcConsumptionRow)) {
        throw invalidResponse('expected consumed item rows')
      }
      return response.data.map((row) => ({
        itemInstanceId: row.item_instance_id,
        quantityConsumed: row.quantity_consumed,
        wasProcessed: row.was_processed,
      }))
    },

    async reserveItems(
      operationId: InventoryOperationId,
      purpose: string,
      items: readonly InventoryReservationLine[],
    ): Promise<InventoryReservationResult[]> {
      assertOperationId(operationId)
      if (!isNonEmptyString(purpose)) {
        throw new Error('Inventory reservation purpose must be non-empty.')
      }
      assertConsumptionItems(items)
      const response = await getClient().rpc('reserve_inventory_items', {
        p_operation_id: operationId,
        p_purpose: purpose,
        p_items: items,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isRpcReservationRow)) {
        throw invalidResponse('expected reserved item rows')
      }
      return response.data.map((row) => ({
        reservationId: row.reservation_id,
        itemInstanceId: row.item_instance_id,
        quantityReserved: row.quantity_reserved,
        wasProcessed: row.was_processed,
      }))
    },

    async releaseReservation(
      operationId: InventoryOperationId,
      reservationId: InventoryReservationId,
    ): Promise<InventoryReleaseResult> {
      assertOperationId(operationId)
      if (!isNonEmptyString(reservationId)) {
        throw new Error('Inventory reservation ID must be non-empty.')
      }
      const response = await getClient().rpc('release_inventory_reservation', {
        p_operation_id: operationId,
        p_reservation_id: reservationId,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcReleaseRow(response.data[0])) {
        throw invalidResponse('expected one released reservation row')
      }
      const row = response.data[0]
      return {
        reservationId: row.reservation_id,
        quantityReleased: row.quantity_released,
        wasProcessed: row.was_processed,
      }
    },

    async salvageItem(
      operationId: InventoryOperationId,
      itemInstanceId: string,
      quantity?: number,
    ): Promise<InventorySalvageResult> {
      assertOperationId(operationId)
      if (!isNonEmptyString(itemInstanceId)) {
        throw new Error('Inventory item instance ID must be non-empty.')
      }
      if (quantity !== undefined && !isPositiveInteger(quantity)) {
        throw new Error('Inventory salvage quantity must be a positive integer.')
      }
      const response = await getClient().rpc('salvage_inventory_item', {
        p_operation_id: operationId,
        p_item_instance_id: itemInstanceId,
        p_quantity: quantity ?? null,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcSalvageRow(response.data[0])) {
        throw invalidResponse('expected one salvaged item row')
      }
      const row = response.data[0]
      return {
        itemInstanceId: row.item_instance_id,
        essenceAwarded: row.essence_awarded,
        wasProcessed: row.was_processed,
      }
    },
  }
}
