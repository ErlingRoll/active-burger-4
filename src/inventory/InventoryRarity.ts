import { RARITY_ORDER, isRarity } from '../content/rarity/Rarity'
import type { Rarity } from '../content/rarity/Rarity'
import type { InventoryItemInstance } from './InventoryTypes'

/**
 * The rarity an item is shown and sorted by.
 *
 * Rarity was read two different ways: the grid took `metadata.rarity` and
 * nothing else, while sorting fell back to the last segment of the definition
 * id. An item that carried its rarity in only one of those places therefore
 * sorted as legendary and drew a colourless ring, which is the sort of
 * disagreement a player reads as the ring being meaningless. One lookup, used
 * everywhere, keeps the ring and the order telling the same story.
 */
export function getInventoryItemRarity(item: InventoryItemInstance): Rarity | null {
  if (isRarity(item.metadata.rarity)) {
    return item.metadata.rarity
  }
  const definitionSuffix = item.definitionId.split('-').pop()
  return isRarity(definitionSuffix) ? definitionSuffix : null
}

/** Rank for sorting. An item with no rarity sorts below every rarity there is. */
export function getInventoryItemRarityOrder(item: InventoryItemInstance): number {
  const rarity = getInventoryItemRarity(item)
  return rarity === null ? -1 : RARITY_ORDER[rarity]
}
