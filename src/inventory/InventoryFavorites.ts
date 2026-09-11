import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemDefinitionId, InventoryItemInstance } from './InventoryTypes'

/**
 * Where a star on this item lives.
 *
 * A stackable item is one slot standing for every row of its kind, and more
 * rows arrive as the player plays, so starring the slot has to star the
 * definition or the next sweep takes the new ones. Anything else is one row
 * with its own roll — a rod with its modifiers, a fish with its size — and the
 * star belongs to that row alone.
 */
export type InventoryFavoriteScope = 'instance' | 'definition'

export function getInventoryFavoriteScope(item: InventoryItemInstance): InventoryFavoriteScope {
  return getInventoryItemDefinition(item.definitionId)?.stackable ? 'definition' : 'instance'
}

/** Whether a sweep leaves this item alone, from either shape of favorite. */
export function isInventoryItemFavorite(
  item: InventoryItemInstance,
  favoriteDefinitionIds: ReadonlySet<InventoryItemDefinitionId>,
): boolean {
  return item.favorite || favoriteDefinitionIds.has(item.definitionId)
}
