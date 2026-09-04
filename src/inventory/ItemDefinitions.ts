import type {
  InventoryItemCategory,
  InventoryItemDefinition,
} from './InventoryTypes'

export const INVENTORY_ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const INVENTORY_ITEM_DEFINITIONS = {
  'basic-bait': {
    id: 'basic-bait',
    name: 'Basic Bait',
    category: 'bait',
    stackable: false,
    maxStackSize: 1,
    tradeable: false,
    bindOnEquip: false,
    unlimited: true,
    salvageEssence: 0,
  },
  'river-minnow': {
    id: 'river-minnow',
    name: 'River Minnow',
    category: 'fish',
    stackable: false,
    maxStackSize: 1,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
  'revival-koi': {
    id: 'revival-koi',
    name: 'Revival Koi',
    category: 'fish',
    stackable: false,
    maxStackSize: 1,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
  'starter-fishing-rod': {
    id: 'starter-fishing-rod',
    name: 'Starter Fishing Rod',
    category: 'rod',
    stackable: false,
    maxStackSize: 1,
    tradeable: true,
    bindOnEquip: true,
    unlimited: false,
    salvageEssence: 1,
  },
  'loot-box-common': {
    id: 'loot-box-common',
    name: 'Common Loot Box',
    category: 'loot-box',
    stackable: true,
    maxStackSize: 9999,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
  'loot-box-uncommon': {
    id: 'loot-box-uncommon',
    name: 'Uncommon Loot Box',
    category: 'loot-box',
    stackable: true,
    maxStackSize: 9999,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
  'loot-box-rare': {
    id: 'loot-box-rare',
    name: 'Rare Loot Box',
    category: 'loot-box',
    stackable: true,
    maxStackSize: 9999,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
  'loot-box-epic': {
    id: 'loot-box-epic',
    name: 'Epic Loot Box',
    category: 'loot-box',
    stackable: true,
    maxStackSize: 9999,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
  'loot-box-legendary': {
    id: 'loot-box-legendary',
    name: 'Legendary Loot Box',
    category: 'loot-box',
    stackable: true,
    maxStackSize: 9999,
    tradeable: true,
    bindOnEquip: false,
    unlimited: false,
    salvageEssence: 0,
  },
} as const satisfies Record<string, InventoryItemDefinition>

export type KnownInventoryItemDefinitionId = keyof typeof INVENTORY_ITEM_DEFINITIONS

export const ALL_INVENTORY_ITEM_DEFINITIONS: readonly InventoryItemDefinition[] =
  Object.values(INVENTORY_ITEM_DEFINITIONS)

export function isInventoryItemDefinitionId(
  value: unknown,
): value is string {
  return typeof value === 'string' && INVENTORY_ITEM_ID_PATTERN.test(value)
}

export function isInventoryItemCategory(
  value: unknown,
): value is InventoryItemCategory {
  return value === 'fish' ||
    value === 'bait' ||
    value === 'rod' ||
    value === 'loot-box' ||
    value === 'artifact' ||
    value === 'material' ||
    value === 'utility'
}

export function getInventoryItemDefinition(
  definitionId: string,
): InventoryItemDefinition | undefined {
  return isInventoryItemDefinitionId(definitionId)
    ? INVENTORY_ITEM_DEFINITIONS[definitionId as KnownInventoryItemDefinitionId]
    : undefined
}
