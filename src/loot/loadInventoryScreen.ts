import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import type { AppServices } from '../services/AppServices'

/**
 * What the bag needs before it can paint: the shelves and which kinds of
 * item the player has starred. Fetched by the navigator while the previous
 * screen is still showing. Service types only; never the screen.
 */
export interface InventoryScreenData {
  items: InventoryItemInstance[]
  favoriteDefinitionIds: string[]
}

export async function loadInventoryScreen(
  services: AppServices,
): Promise<InventoryScreenData | null> {
  const inventory = services.inventory.service
  if (!inventory) {
    return null
  }
  const [items, favoriteDefinitionIds] = await Promise.all([
    inventory.loadInventory(),
    inventory.loadFavoriteDefinitionIds(),
  ])
  return { items, favoriteDefinitionIds }
}
