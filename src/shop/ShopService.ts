import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ShopPriceBand,
  ShopPurchaseResult,
  ShopSaleResult,
  ShopService,
  ShopStockLine,
} from './ShopTypes'

interface PriceBandRow {
  definition_id: string
  sell_price: number
  buy_price: number
  stock_weight: number
  stock_quantity: number
}

interface StockRow {
  definition_id: string
  quantity_offered: number
  quantity_bought: number
  unit_price: number
}

interface SaleRow {
  item_instance_id: string
  definition_id: string
  quantity_sold: number
  essence_awarded: number
  essence_balance: number
  was_processed: boolean
}

interface PurchaseRow {
  definition_id: string
  quantity_bought: number
  essence_spent: number
  essence_balance: number
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPriceBandRow(value: unknown): value is PriceBandRow {
  return isRecord(value) &&
    isNonEmptyString(value.definition_id) &&
    isCount(value.sell_price) &&
    isCount(value.buy_price) &&
    isCount(value.stock_weight) &&
    isCount(value.stock_quantity)
}

function isStockRow(value: unknown): value is StockRow {
  return isRecord(value) &&
    isNonEmptyString(value.definition_id) &&
    isCount(value.quantity_offered) &&
    isCount(value.quantity_bought) &&
    isCount(value.unit_price)
}

function isSaleRow(value: unknown): value is SaleRow {
  return isRecord(value) &&
    isNonEmptyString(value.item_instance_id) &&
    isNonEmptyString(value.definition_id) &&
    isCount(value.quantity_sold) &&
    isCount(value.essence_awarded) &&
    isCount(value.essence_balance) &&
    typeof value.was_processed === 'boolean'
}

function isPurchaseRow(value: unknown): value is PurchaseRow {
  return isRecord(value) &&
    isNonEmptyString(value.definition_id) &&
    isCount(value.quantity_bought) &&
    isCount(value.essence_spent) &&
    isCount(value.essence_balance) &&
    typeof value.was_processed === 'boolean'
}

function invalidResponse(message: string): Error {
  return new Error(`The shop returned an invalid response: ${message}`)
}

function assertOperationId(operationId: string): void {
  if (!isNonEmptyString(operationId)) {
    throw new Error('A non-empty shop operation ID is required.')
  }
}

/**
 * The shop, as the browser sees it.
 *
 * Prices, the day's shelf, and what a transaction costs are all read back from
 * the server rather than sent to it. The client names an item and a quantity
 * and nothing else, so a modified browser can ask to buy something at a price
 * it does not set and sell something for a price it cannot inflate.
 */
export function createShopService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): ShopService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async loadPriceBands(): Promise<ShopPriceBand[]> {
      const response = await getClient()
        .from('shop_price_bands')
        .select('definition_id, sell_price, buy_price, stock_weight, stock_quantity')
        .eq('active', true)
        .order('definition_id', { ascending: true })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isPriceBandRow)) {
        throw invalidResponse('expected a price band array')
      }
      return response.data.map((row) => ({
        definitionId: row.definition_id,
        sellPrice: row.sell_price,
        buyPrice: row.buy_price,
        stockWeight: row.stock_weight,
        stockQuantity: row.stock_quantity,
      }))
    },

    async loadStock(): Promise<ShopStockLine[]> {
      const response = await getClient().rpc('get_shop_stock')
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isStockRow)) {
        throw invalidResponse('expected a shop stock array')
      }
      return response.data.map((row) => ({
        definitionId: row.definition_id,
        quantityOffered: row.quantity_offered,
        quantityBought: row.quantity_bought,
        unitPrice: row.unit_price,
      }))
    },

    async sellItem(
      operationId: string,
      itemInstanceId: string,
      quantity?: number,
    ): Promise<ShopSaleResult> {
      assertOperationId(operationId)
      if (!isNonEmptyString(itemInstanceId)) {
        throw new Error('Inventory item instance ID must be non-empty.')
      }
      const response = await getClient().rpc('sell_to_shop', {
        p_operation_id: operationId,
        p_item_instance_id: itemInstanceId,
        p_quantity: quantity ?? null,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isSaleRow(response.data[0])) {
        throw invalidResponse('expected one sale row')
      }
      const row = response.data[0]
      return {
        itemInstanceId: row.item_instance_id,
        definitionId: row.definition_id,
        quantitySold: row.quantity_sold,
        essenceAwarded: row.essence_awarded,
        essenceBalance: row.essence_balance,
        wasProcessed: row.was_processed,
      }
    },

    async buyItem(
      operationId: string,
      definitionId: string,
      quantity?: number,
    ): Promise<ShopPurchaseResult> {
      assertOperationId(operationId)
      if (!isNonEmptyString(definitionId)) {
        throw new Error('Inventory item definition ID must be non-empty.')
      }
      const response = await getClient().rpc('buy_from_shop', {
        p_operation_id: operationId,
        p_definition_id: definitionId,
        p_quantity: quantity ?? 1,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isPurchaseRow(response.data[0])) {
        throw invalidResponse('expected one purchase row')
      }
      const row = response.data[0]
      return {
        definitionId: row.definition_id,
        quantityBought: row.quantity_bought,
        essenceSpent: row.essence_spent,
        essenceBalance: row.essence_balance,
        wasProcessed: row.was_processed,
      }
    },
  }
}
