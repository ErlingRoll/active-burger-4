import { Rarity } from '../content/rarity/Rarity'
import { getInventoryItemRarity } from './InventoryRarity'
import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemCategory, InventoryItemInstance } from './InventoryTypes'

/** `all`, or one of the categories the player actually owns something in. */
export type InventoryCategoryFilter = 'all' | InventoryItemCategory

export interface InventoryCategoryFilterOption {
  readonly id: InventoryCategoryFilter
  readonly label: string
  readonly count: number
}

/**
 * The order the shelves are read in, most-handled first. Fixed rather than
 * alphabetical so the chips do not reorder themselves as a bag fills up.
 */
const CATEGORY_ORDER: readonly InventoryItemCategory[] = [
  'fish',
  'bait',
  'rod',
  'loot-box',
  'artifact',
  'material',
  'utility',
]

const CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  fish: 'Fish',
  bait: 'Bait',
  rod: 'Rods',
  'loot-box': 'Loot boxes',
  artifact: 'Artifacts',
  material: 'Materials',
  utility: 'Utility',
}

export function getInventoryItemCategory(
  item: InventoryItemInstance,
): InventoryItemCategory {
  return getInventoryItemDefinition(item.definitionId)?.category ?? 'utility'
}

/**
 * The chips to offer, with their counts.
 *
 * Only categories with something in them are listed: a chip that filters to an
 * empty shelf is a dead end, and the bag's whole problem was too much to look
 * at rather than too little.
 */
export function buildInventoryCategoryFilters(
  items: readonly InventoryItemInstance[],
): InventoryCategoryFilterOption[] {
  const counts = new Map<InventoryItemCategory, number>()
  for (const item of items) {
    const category = getInventoryItemCategory(item)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [
    { id: 'all', label: 'All', count: items.length },
    ...CATEGORY_ORDER.flatMap((category): InventoryCategoryFilterOption[] => {
      const count = counts.get(category) ?? 0
      return count === 0
        ? []
        : [{ id: category, label: CATEGORY_LABELS[category], count }]
    }),
  ]
}

export function filterInventoryItems(
  items: readonly InventoryItemInstance[],
  filter: InventoryCategoryFilter,
): InventoryItemInstance[] {
  return filter === 'all'
    ? [...items]
    : items.filter((item) => getInventoryItemCategory(item) === filter)
}

/** The categories a slot can be individually salvaged from. */
const SALVAGEABLE_CATEGORIES: readonly InventoryItemCategory[] = ['fish', 'rod']

export function isSalvageableItem(item: InventoryItemInstance): boolean {
  return SALVAGEABLE_CATEGORIES.includes(getInventoryItemCategory(item))
}

/**
 * The catch and gear a player would otherwise clear one at a time.
 *
 * Deliberately common rarity, and deliberately only the categories a player
 * accumulates faster than they can use: fish and rods. A sweep that could take
 * an epic off the shelf needs a per-item decision, and the point of this
 * action is that it does not.
 */
export function selectCommonSalvage(
  items: readonly InventoryItemInstance[],
): InventoryItemInstance[] {
  return items.filter((item) =>
    isSalvageableItem(item) &&
    getInventoryItemRarity(item) === Rarity.Common,
  )
}
