import { getInventoryItemRarityOrder } from './InventoryRarity'
import { getInventoryItemEssence } from './InventoryValue'
import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemInstance } from './InventoryTypes'

export type InventoryItemComparator = (
  left: InventoryItemInstance,
  right: InventoryItemInstance,
) => number

export interface InventorySortOptions {
  getEssence?: (item: InventoryItemInstance) => number | null
  precedingComparators?: readonly InventoryItemComparator[]
}

export function compareInventoryDefaults(
  left: InventoryItemInstance,
  right: InventoryItemInstance,
  getEssence?: (item: InventoryItemInstance) => number | null,
): number {
  const leftDefinition = getInventoryItemDefinition(left.definitionId)
  const rightDefinition = getInventoryItemDefinition(right.definitionId)
  const typeComparison = (leftDefinition?.category ?? '').localeCompare(
    rightDefinition?.category ?? '',
  )
  if (typeComparison !== 0) {
    return typeComparison
  }

  const rarityComparison = getInventoryItemRarityOrder(right) - getInventoryItemRarityOrder(left)
  if (rarityComparison !== 0) {
    return rarityComparison
  }

  return getInventoryItemEssence(right, getEssence) - getInventoryItemEssence(left, getEssence)
}

export function sortInventoryItems(
  items: readonly InventoryItemInstance[],
  options: InventorySortOptions = {},
): InventoryItemInstance[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      for (const comparator of options.precedingComparators ?? []) {
        const comparison = comparator(left.item, right.item)
        if (comparison !== 0) {
          return comparison
        }
      }
      return compareInventoryDefaults(left.item, right.item, options.getEssence) || left.index - right.index
    })
    .map(({ item }) => item)
}
