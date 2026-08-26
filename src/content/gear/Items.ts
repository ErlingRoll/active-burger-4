import type { Rarity } from '../rarity/Rarity'
import {
  createGearModifier,
  type GearModifier,
} from './ModifierPools'

export type ItemId = string
export type EquipmentSlot =
  | 'weapon'
  | 'helmet'
  | 'armor'
  | 'boots'
  | 'ring'
  | 'amulet'

export type WeaponArchetype = 'sword' | 'bow' | 'wand'

export const EQUIPMENT_SLOTS = [
  'weapon',
  'helmet',
  'armor',
  'boots',
  'ring',
  'amulet',
] as const satisfies readonly EquipmentSlot[]

export const WEAPON_ARCHETYPES = [
  'sword',
  'bow',
  'wand',
] as const satisfies readonly WeaponArchetype[]

interface ItemDefinitionBase {
  id: ItemId
  name: string
  rarity: Rarity
  modifiers: readonly GearModifier[]
}

interface WeaponItemDefinition extends ItemDefinitionBase {
  slot: 'weapon'
  weaponArchetype: WeaponArchetype
}

interface NonWeaponItemDefinition extends ItemDefinitionBase {
  slot: Exclude<EquipmentSlot, 'weapon'>
  weaponArchetype?: never
}

export type ItemDefinition = WeaponItemDefinition | NonWeaponItemDefinition

/** Item IDs are content keys, not display names or runtime entity IDs. */
export const ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && ITEM_ID_PATTERN.test(value)
}

export function isWeaponArchetype(value: unknown): value is WeaponArchetype {
  return typeof value === 'string' &&
    WEAPON_ARCHETYPES.some((archetype) => archetype === value)
}

export const ITEM_DEFINITIONS = {
  'iron-cleaver': {
    id: 'iron-cleaver',
    name: 'Iron Cleaver',
    rarity: 'common',
    slot: 'weapon',
    weaponArchetype: 'sword',
    modifiers: [
      createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
    ],
  },
  'hunters-bow': {
    id: 'hunters-bow',
    name: "Hunter's Bow",
    rarity: 'uncommon',
    slot: 'weapon',
    weaponArchetype: 'bow',
    modifiers: [
      createGearModifier('hunters-bow', 'attack-speed', 5, 6),
      createGearModifier('hunters-bow', 'increased-projectile-damage', 5, 8),
    ],
  },
  'starcall-wand': {
    id: 'starcall-wand',
    name: 'Starcall Wand',
    rarity: 'rare',
    slot: 'weapon',
    weaponArchetype: 'wand',
    modifiers: [
      createGearModifier('starcall-wand', 'flat-lightning-damage', 5, 2),
      createGearModifier('starcall-wand', 'increased-projectile-damage', 4, 14),
      createGearModifier('starcall-wand', 'basic-attack-extra-projectiles', 4, 1),
    ],
  },
  'watchers-helm': {
    id: 'watchers-helm',
    name: "Watcher's Helm",
    rarity: 'uncommon',
    slot: 'helmet',
    modifiers: [
      createGearModifier('watchers-helm', 'max-hp', 4, 24),
      createGearModifier('watchers-helm', 'elemental-resistance', 5, 8),
    ],
  },
  'bastion-plate': {
    id: 'bastion-plate',
    name: 'Bastion Plate',
    rarity: 'rare',
    slot: 'armor',
    modifiers: [
      createGearModifier('bastion-plate', 'max-hp', 3, 38),
      createGearModifier('bastion-plate', 'physical-resistance', 4, 16),
      createGearModifier('bastion-plate', 'chaos-resistance', 5, 9),
    ],
  },
  'swiftstride-boots': {
    id: 'swiftstride-boots',
    name: 'Swiftstride Boots',
    rarity: 'epic',
    slot: 'boots',
    modifiers: [
      createGearModifier('swiftstride-boots', 'movement-speed', 3, 11),
      createGearModifier('swiftstride-boots', 'attack-speed', 5, 6),
      createGearModifier('swiftstride-boots', 'attack-range', 4, 20),
      createGearModifier('swiftstride-boots', 'elemental-resistance', 5, 7),
    ],
  },
  'duelists-band': {
    id: 'duelists-band',
    name: "Duelist's Band",
    rarity: 'rare',
    slot: 'ring',
    modifiers: [
      createGearModifier('duelists-band', 'flat-lightning-damage', 3, 5),
      createGearModifier('duelists-band', 'crit-chance', 4, 6),
      createGearModifier('duelists-band', 'attack-speed', 4, 9),
    ],
  },
  'starcaller-amulet': {
    id: 'starcaller-amulet',
    name: 'Starcaller Amulet',
    rarity: 'legendary',
    slot: 'amulet',
    modifiers: [
      createGearModifier('starcaller-amulet', 'flat-lightning-damage', 2, 7),
      createGearModifier('starcaller-amulet', 'increased-elemental-damage', 3, 24),
      createGearModifier('starcaller-amulet', 'crit-multiplier', 4, 28),
      createGearModifier('starcaller-amulet', 'attack-range', 3, 28),
      createGearModifier('starcaller-amulet', 'elemental-resistance', 4, 18),
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
