import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import type { AppServices } from '../services/AppServices'

/**
 * What the pond needs before it can paint: the bag, for its rods and bait.
 * The pond's own activity feed keeps loading in place; it is a live widget,
 * never the reason the page appeared. Service types only; never the screen.
 */
export interface FishingScreenData {
  items: InventoryItemInstance[]
}

export async function loadFishingScreen(
  services: AppServices,
): Promise<FishingScreenData | null> {
  const inventory = services.inventory.service
  if (!inventory) {
    return null
  }
  return { items: await inventory.loadInventory() }
}
