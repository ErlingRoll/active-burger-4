/**
 * The consignment shop.
 *
 * Stage one of the market in docs/features/marketplace.md: players sell to the
 * game and buy from a daily shelf, with no player-to-player transfer. Nothing
 * here can move an item between accounts, which is why it can ship long before
 * listings can.
 */

/** What the shop will pay for a thing, and what it charges for one. */
export interface ShopPriceBand {
  definitionId: string
  /** Essence paid to the player, per unit. */
  sellPrice: number
  /** Essence charged to the player, per unit. Always above the sell price. */
  buyPrice: number
  /** Zero means the shop buys it but never sells it. Scrap is the case. */
  stockWeight: number
  stockQuantity: number
}

/** One line of today's shelf, already reduced by what this player has taken. */
export interface ShopStockLine {
  definitionId: string
  quantityOffered: number
  quantityBought: number
  unitPrice: number
}

export interface ShopSaleResult {
  itemInstanceId: string
  definitionId: string
  quantitySold: number
  essenceAwarded: number
  essenceBalance: number
  wasProcessed: boolean
}

export interface ShopPurchaseResult {
  definitionId: string
  quantityBought: number
  essenceSpent: number
  essenceBalance: number
  wasProcessed: boolean
}

export interface ShopService {
  /** The price list. Static content, safe to read once per visit. */
  loadPriceBands(): Promise<ShopPriceBand[]>
  /**
   * Today's shelf for this player.
   *
   * Rolled by the server on first read of a day and remembered, so refreshing
   * cannot reroll what is on offer.
   */
  loadStock(): Promise<ShopStockLine[]>
  sellItem(
    operationId: string,
    itemInstanceId: string,
    quantity?: number,
  ): Promise<ShopSaleResult>
  buyItem(
    operationId: string,
    definitionId: string,
    quantity?: number,
  ): Promise<ShopPurchaseResult>
}

/** How many of a shelf line this player can still take today. */
export function getRemainingStock(line: ShopStockLine): number {
  return Math.max(0, line.quantityOffered - line.quantityBought)
}
