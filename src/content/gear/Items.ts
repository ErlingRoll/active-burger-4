import type { Rarity } from '../rarity/Rarity'
import type { StatModifier } from '../stats/Stats'

export type ItemId = string
export type EquipmentSlot =
  | 'weapon'
  | 'helmet'
  | 'armor'
  | 'boots'
  | 'ring'
  | 'amulet'

export const EQUIPMENT_SLOTS = [
  'weapon',
  'helmet',
  'armor',
  'boots',
  'ring',
  'amulet',
] as const satisfies readonly EquipmentSlot[]

export interface ItemDefinition {
  id: ItemId
  name: string
  rarity: Rarity
  slot: EquipmentSlot
  modifiers: readonly StatModifier[]
}

/** Item IDs are content keys, not display names or runtime entity IDs. */
export const ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && ITEM_ID_PATTERN.test(value)
}

/**
 * A deliberately small first catalog. Every modifier is a plain stat
 * modifier; item-specific effects and tags belong to a later content task.
 */
export const ITEM_DEFINITIONS = {
  'iron-cleaver': {
    id: 'iron-cleaver',
    name: 'Iron Cleaver',
    rarity: 'common',
    slot: 'weapon',
    modifiers: [
      {
        stat: 'attackDamage',
        operation: 'add',
        value: 3,
        sourceId: 'item:iron-cleaver',
      },
    ],
  },
  'watchers-helm': {
    id: 'watchers-helm',
    name: "Watcher's Helm",
    rarity: 'uncommon',
    slot: 'helmet',
    modifiers: [
      {
        stat: 'maxHp',
        operation: 'add',
        value: 20,
        sourceId: 'item:watchers-helm',
      },
    ],
  },
  'bastion-plate': {
    id: 'bastion-plate',
    name: 'Bastion Plate',
    rarity: 'rare',
    slot: 'armor',
    modifiers: [
      {
        stat: 'maxHp',
        operation: 'add',
        value: 45,
        sourceId: 'item:bastion-plate',
      },
    ],
  },
  'swiftstride-boots': {
    id: 'swiftstride-boots',
    name: 'Swiftstride Boots',
    rarity: 'epic',
    slot: 'boots',
    modifiers: [
      {
        stat: 'movementSpeed',
        operation: 'multiply',
        value: 1.15,
        sourceId: 'item:swiftstride-boots',
      },
    ],
  },
  'duelists-band': {
    id: 'duelists-band',
    name: "Duelist's Band",
    rarity: 'rare',
    slot: 'ring',
    modifiers: [
      {
        stat: 'attackDamage',
        operation: 'add',
        value: 2,
        sourceId: 'item:duelists-band',
      },
      {
        stat: 'attackSpeed',
        operation: 'multiply',
        value: 1.15,
        sourceId: 'item:duelists-band',
      },
    ],
  },
  'starcaller-amulet': {
    id: 'starcaller-amulet',
    name: 'Starcaller Amulet',
    rarity: 'legendary',
    slot: 'amulet',
    modifiers: [
      {
        stat: 'attackDamage',
        operation: 'multiply',
        value: 1.1,
        sourceId: 'item:starcaller-amulet',
      },
      {
        stat: 'attackRange',
        operation: 'add',
        value: 20,
        sourceId: 'item:starcaller-amulet',
      },
    ],
  },
} as const satisfies Record<string, ItemDefinition>

export const INITIAL_ITEMS: readonly ItemDefinition[] = Object.values(ITEM_DEFINITIONS)

/** Resolves content data at the content-to-game boundary. */
export function getItemDefinition(
  itemId: ItemId,
  itemDefinitions: readonly ItemDefinition[] = INITIAL_ITEMS,
): ItemDefinition {
  const definition = itemDefinitions.find((candidate) => candidate.id === itemId)
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemId}`)
  }

  return definition
}
