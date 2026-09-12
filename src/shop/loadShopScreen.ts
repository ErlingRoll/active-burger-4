import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import type { AppServices } from '../services/AppServices'
import type { ShopPriceBand, ShopStockLine } from './ShopTypes'

/**
 * What the shop needs before it can paint: the price bands, today's shelf,
 * and the bag it will buy from. Fetched by the navigator while the previous
 * screen is still showing, so the shop opens populated.
 *
 * This module ships in the entry chunk and must stay small: it imports
 * service types only and never the screen, or the route split collapses. An
 * architecture test holds that line.
 */
export interface ShopScreenData {
  bands: ShopPriceBand[]
  stock: ShopStockLine[]
  items: InventoryItemInstance[]
}

export async function loadShopScreen(services: AppServices): Promise<ShopScreenData | null> {
  const shop = services.shop.service
  if (!shop) {
    return null
  }
  const [bands, stock, items] = await Promise.all([
    shop.loadPriceBands(),
    shop.loadStock(),
    services.inventory.service?.loadInventory() ?? Promise.resolve([]),
  ])
  return { bands, stock, items }
}
