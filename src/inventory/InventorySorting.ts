import { RARITY_ORDER, isRarity } from '../content/rarity/Rarity'
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

function getItemRarity(item: InventoryItemInstance): number {
  if (isRarity(item.metadata.rarity)) {
    return RARITY_ORDER[item.metadata.rarity]
  }
  const definitionRarity = item.definitionId.split('-').pop()
  return isRarity(definitionRarity) ? RARITY_ORDER[definitionRarity] : -1
}

function getItemEssence(
  item: InventoryItemInstance,
  getEssence?: (item: InventoryItemInstance) => number | null,
): number {
  const calculatedEssence = getEssence?.(item)
  if (calculatedEssence !== null && calculatedEssence !== undefined) {
    return calculatedEssence
  }
  return getInventoryItemDefinition(item.definitionId)?.salvageEssence ?? 0
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

  const rarityComparison = getItemRarity(right) - getItemRarity(left)
  if (rarityComparison !== 0) {
    return rarityComparison
  }

  return getItemEssence(right, getEssence) - getItemEssence(left, getEssence)
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
