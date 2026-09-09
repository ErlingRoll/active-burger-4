import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemInstance } from './InventoryTypes'

/**
 * What one item is worth if it is salvaged.
 *
 * Category-specific worth is passed in rather than imported: a fish's Essence
 * depends on its species and its size, and that calculation lives in the
 * fishing module, which already depends on this one. The definition's flat
 * salvage value is the fallback for everything else.
 */
export function getInventoryItemEssence(
  item: InventoryItemInstance,
  getEssence?: (item: InventoryItemInstance) => number | null,
): number {
  const calculated = getEssence?.(item)
  if (calculated !== null && calculated !== undefined) {
    return calculated
  }
  return getInventoryItemDefinition(item.definitionId)?.salvageEssence ?? 0
}

/**
 * What a shelf is worth all together, counting stacks.
 *
 * Shown against whatever the bag is currently filtered to, so the number
 * answers the question the filter just asked: what is this pile of fish worth
 * if I clear it out.
 */
export function getInventoryEssenceTotal(
  items: readonly InventoryItemInstance[],
  getEssence?: (item: InventoryItemInstance) => number | null,
): number {
  return items.reduce(
    (total, item) => total + getInventoryItemEssence(item, getEssence) * item.quantity,
    0,
  )
}
