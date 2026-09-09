import type { Rarity } from '../content/rarity/Rarity'

export type InventoryItemCategory =
  | 'fish'
  | 'bait'
  | 'rod'
  | 'loot-box'
  | 'artifact'
  | 'material'
  | 'utility'

export type InventoryItemDefinitionId = string
export type InventoryItemInstanceId = string
export type InventoryOperationId = string
export type InventoryReservationId = string

export type InventorySourceType =
  | 'starter'
  | 'fishing'
  | 'dungeon-reward'
  | 'abyss-reward'
  | 'loot-box'
  | 'market'
  | 'admin'
  | 'system'

export interface InventoryItemDefinition {
  id: InventoryItemDefinitionId
  name: string
  flavorText: string | null
  category: InventoryItemCategory
  /**
   * The rarity every instance of this item has.
   *
   * Set where the worth of a thing is a property of the thing rather than of
   * the roll that produced it: one River Worm is exactly as good as any other,
   * where one Moon Carp is not. Items whose rarity varies per instance carry
   * it in their metadata instead and leave this unset.
   */
  rarity?: Rarity
  stackable: boolean
  maxStackSize: number
  tradeable: boolean
  bindOnEquip: boolean
  unlimited: boolean
  salvageEssence: number
}

export interface InventoryItemSource {
  type: InventorySourceType
  id: string | null
}

export interface InventoryItemInstance {
  itemInstanceId: InventoryItemInstanceId
  definitionId: InventoryItemDefinitionId
  quantity: number
  bound: boolean
  metadata: Record<string, unknown>
  source: InventoryItemSource
  createdAt: string
  updatedAt: string
}

export interface InventoryItemGrant {
  definitionId: InventoryItemDefinitionId
  quantity: number
  bound?: boolean
  metadata?: Record<string, unknown>
}

export interface InventoryItemConsumption {
  itemInstanceId: InventoryItemInstanceId
  quantity: number
}

export interface InventoryReservationLine extends InventoryItemConsumption {}

export interface InventoryGrantResult extends InventoryItemInstance {
  wasProcessed: boolean
}

export interface InventoryConsumptionResult {
  itemInstanceId: InventoryItemInstanceId
  quantityConsumed: number
  wasProcessed: boolean
}

export interface InventoryReservationResult {
  reservationId: InventoryReservationId
  itemInstanceId: InventoryItemInstanceId
  quantityReserved: number
  wasProcessed: boolean
}

export interface InventoryReleaseResult {
  reservationId: InventoryReservationId
  quantityReleased: number
  wasProcessed: boolean
}

export interface InventorySalvageResult {
  itemInstanceId: InventoryItemInstanceId
  essenceAwarded: number
  wasProcessed: boolean
}

export interface InventoryCraftResult {
  recipeId: string
  inputDefinitionId: InventoryItemDefinitionId
  inputSpent: number
  outputDefinitionId: InventoryItemDefinitionId
  outputQuantity: number
  wasProcessed: boolean
}

export interface InventoryService {
  loadInventory(category?: InventoryItemCategory): Promise<InventoryItemInstance[]>
  grantDevelopmentItems(
    operationId: InventoryOperationId,
    items: readonly InventoryItemGrant[],
  ): Promise<InventoryGrantResult[]>
  consumeItems(
    operationId: InventoryOperationId,
    items: readonly InventoryItemConsumption[],
  ): Promise<InventoryConsumptionResult[]>
  reserveItems(
    operationId: InventoryOperationId,
    purpose: string,
    items: readonly InventoryReservationLine[],
  ): Promise<InventoryReservationResult[]>
  releaseReservation(
    operationId: InventoryOperationId,
    reservationId: InventoryReservationId,
  ): Promise<InventoryReleaseResult>
  salvageItem(
    operationId: InventoryOperationId,
    itemInstanceId: InventoryItemInstanceId,
    quantity?: number,
  ): Promise<InventorySalvageResult>
  /**
   * Spend a material on the thing its recipe makes.
   *
   * Only the recipe ID and a batch count cross the wire. The server owns the
   * cost, picks which stacks pay it, and grants the output, so a modified
   * browser cannot name its own price.
   */
  craftItem(
    operationId: InventoryOperationId,
    recipeId: string,
    quantity?: number,
  ): Promise<InventoryCraftResult>
}
