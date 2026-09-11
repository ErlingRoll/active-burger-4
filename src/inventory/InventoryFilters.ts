import { RARITY_ORDER } from '../content/rarity/Rarity'
import { isInventoryItemFavorite } from './InventoryFavorites'
import { getInventoryItemRarity } from './InventoryRarity'
import type { SalvageSweepRarity } from './InventorySweepPreference'
import { getInventoryItemDefinition } from './ItemDefinitions'
import type {
  InventoryItemCategory,
  InventoryItemDefinitionId,
  InventoryItemInstance,
} from './InventoryTypes'

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
const SALVAGEABLE_CATEGORIES: readonly InventoryItemCategory[] = ['fish', 'rod', 'artifact']

export function isSalvageableItem(item: InventoryItemInstance): boolean {
  return SALVAGEABLE_CATEGORIES.includes(getInventoryItemCategory(item))
}

export interface SalvageSweepSelection {
  /** What the sweep will take, in shelf order. */
  readonly targets: InventoryItemInstance[]
  /** What it would have taken but for a star. Said in the confirmation. */
  readonly favoritesKept: number
}

/**
 * The categories the sweep clears: what a player accumulates faster than they
 * can use. An artifact is salvageable but never swept, because even a common
 * one is a roll of its own and worth a look before it goes.
 */
const SWEEPABLE_CATEGORIES: readonly InventoryItemCategory[] = ['fish', 'rod']

export interface SalvageSweepSelection {
  /** What the sweep will take, in shelf order. */
  readonly targets: InventoryItemInstance[]
  /** What it would have taken but for a star. Said in the confirmation. */
  readonly favoritesKept: number
}

/**
 * The catch and gear a player would otherwise clear one at a time.
 *
 * Everything sweepable at or below the chosen rarity, minus favorites. Only
 * up to rare: a sweep that could take an epic off the shelf needs a per-item
 * decision, and the point of this action is that it does not. A favorite is
 * the per-item decision, made in advance.
 */
export function selectSalvageSweep(
  items: readonly InventoryItemInstance[],
  maxRarity: SalvageSweepRarity,
  favoriteDefinitionIds: ReadonlySet<InventoryItemDefinitionId>,
): SalvageSweepSelection {
  const targets: InventoryItemInstance[] = []
  let favoritesKept = 0
  for (const item of items) {
    if (!SWEEPABLE_CATEGORIES.includes(getInventoryItemCategory(item))) {
      continue
    }
    const rarity = getInventoryItemRarity(item)
    if (rarity === null || RARITY_ORDER[rarity] > RARITY_ORDER[maxRarity]) {
      continue
    }
    if (isInventoryItemFavorite(item, favoriteDefinitionIds)) {
      favoritesKept += 1
      continue
    }
    targets.push(item)
  }
  return { targets, favoritesKept }
}
