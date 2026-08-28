import type { Rarity } from '../rarity/Rarity'
import {
  createGearModifier,
  type GearModifier,
} from './ModifierPools'
import {
  getGearSetDefinition,
  type GearSetId,
} from '../../game-config/gear-sets'

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
  baseName?: string
  rarity: Rarity
  modifiers: readonly GearModifier[]
  starterOnly?: boolean
  setId?: GearSetId
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

export function getItemDisplayName(
  item: Readonly<ItemDefinition>,
  setId?: GearSetId,
): string {
  if (!setId || !item.baseName) {
    return item.name
  }
  return `${getGearSetDefinition(setId).name} ${item.baseName}`
}

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
  'knight-training-sword': {
    id: 'knight-training-sword',
    name: 'Knight Training Sword',
    rarity: 'common',
    slot: 'weapon',
    weaponArchetype: 'sword',
    modifiers: [],
    starterOnly: true,
  },
  'ranger-training-bow': {
    id: 'ranger-training-bow',
    name: 'Ranger Training Bow',
    rarity: 'common',
    slot: 'weapon',
    weaponArchetype: 'bow',
    modifiers: [],
    starterOnly: true,
  },
  'necromancer-training-wand': {
    id: 'necromancer-training-wand',
    name: 'Necromancer Training Wand',
    rarity: 'common',
    slot: 'weapon',
    weaponArchetype: 'wand',
    modifiers: [],
    starterOnly: true,
  },
  'iron-cleaver': {
    id: 'iron-cleaver',
    name: "Giant's Cleaver",
    baseName: 'Cleaver',
    rarity: 'common',
    slot: 'weapon',
    weaponArchetype: 'sword',
    modifiers: [
      createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
    ],
    setId: 'giants',
  },
  'hunters-bow': {
    id: 'hunters-bow',
    name: 'Splintering Bow',
    baseName: 'Bow',
    rarity: 'uncommon',
    slot: 'weapon',
    weaponArchetype: 'bow',
    modifiers: [
      createGearModifier('hunters-bow', 'attack-speed', 5, 6),
      createGearModifier('hunters-bow', 'increased-projectile-damage', 5, 8),
    ],
    setId: 'splintering',
  },
  'starcall-wand': {
    id: 'starcall-wand',
    name: 'Astral Wand',
    baseName: 'Wand',
    rarity: 'rare',
    slot: 'weapon',
    weaponArchetype: 'wand',
    modifiers: [
      createGearModifier('starcall-wand', 'flat-lightning-damage', 5, 2),
      createGearModifier('starcall-wand', 'increased-projectile-damage', 4, 14),
      createGearModifier('starcall-wand', 'basic-attack-extra-projectiles', 4, 1),
    ],
    setId: 'astral',
  },
  'watchers-helm': {
    id: 'watchers-helm',
    name: "Giant's Crown",
    baseName: 'Crown',
    rarity: 'uncommon',
    slot: 'helmet',
    modifiers: [
      createGearModifier('watchers-helm', 'max-hp', 4, 24),
      createGearModifier('watchers-helm', 'elemental-resistance', 5, 8),
    ],
    setId: 'giants',
  },
  'bastion-plate': {
    id: 'bastion-plate',
    name: "Giant's Bulwark",
    baseName: 'Bulwark',
    rarity: 'rare',
    slot: 'armor',
    modifiers: [
      createGearModifier('bastion-plate', 'max-hp', 3, 38),
      createGearModifier('bastion-plate', 'physical-resistance', 4, 16),
      createGearModifier('bastion-plate', 'chaos-resistance', 5, 9),
    ],
    setId: 'giants',
  },
  'swiftstride-boots': {
    id: 'swiftstride-boots',
    name: "Giant's Greaves",
    baseName: 'Greaves',
    rarity: 'epic',
    slot: 'boots',
    modifiers: [
      createGearModifier('swiftstride-boots', 'movement-speed', 3, 11),
      createGearModifier('swiftstride-boots', 'attack-speed', 5, 6),
      createGearModifier('swiftstride-boots', 'attack-range', 4, 20),
      createGearModifier('swiftstride-boots', 'elemental-resistance', 5, 7),
    ],
    setId: 'giants',
  },
  'duelists-band': {
    id: 'duelists-band',
    name: "Giant's Signet",
    baseName: 'Signet',
    rarity: 'rare',
    slot: 'ring',
    modifiers: [
      createGearModifier('duelists-band', 'flat-lightning-damage', 3, 5),
      createGearModifier('duelists-band', 'crit-chance', 4, 6),
      createGearModifier('duelists-band', 'attack-speed', 4, 9),
    ],
    setId: 'giants',
  },
  'starcaller-amulet': {
    id: 'starcaller-amulet',
    name: 'Astral Talisman',
    baseName: 'Talisman',
    rarity: 'legendary',
    slot: 'amulet',
    modifiers: [
      createGearModifier('starcaller-amulet', 'flat-lightning-damage', 2, 7),
      createGearModifier('starcaller-amulet', 'increased-elemental-damage', 3, 24),
      createGearModifier('starcaller-amulet', 'crit-multiplier', 4, 28),
      createGearModifier('starcaller-amulet', 'attack-range', 3, 28),
      createGearModifier('starcaller-amulet', 'elemental-resistance', 4, 18),
    ],
    setId: 'astral',
  },
  'giants-amulet': {
    id: 'giants-amulet',
    name: "Giant's Heart",
    baseName: 'Heart',
    rarity: 'legendary',
    slot: 'amulet',
    modifiers: [
      createGearModifier('giants-amulet', 'max-hp', 1, 70),
      createGearModifier('giants-amulet', 'attack-speed', 1, 24),
      createGearModifier('giants-amulet', 'attack-range', 3, 28),
      createGearModifier('giants-amulet', 'crit-chance', 4, 6),
      createGearModifier('giants-amulet', 'elemental-resistance', 4, 18),
    ],
    setId: 'giants',
  },
  'astral-helm': {
    id: 'astral-helm',
    name: 'Astral Circlet',
    baseName: 'Circlet',
    rarity: 'uncommon',
    slot: 'helmet',
    modifiers: [
      createGearModifier('astral-helm', 'max-hp', 4, 24),
      createGearModifier('astral-helm', 'attack-range', 4, 20),
    ],
    setId: 'astral',
  },
  'astral-raiment': {
    id: 'astral-raiment',
    name: 'Astral Raiment',
    baseName: 'Raiment',
    rarity: 'rare',
    slot: 'armor',
    modifiers: [
      createGearModifier('astral-raiment', 'max-hp', 3, 38),
      createGearModifier('astral-raiment', 'physical-resistance', 4, 16),
      createGearModifier('astral-raiment', 'chaos-resistance', 5, 9),
    ],
    setId: 'astral',
  },
  'astral-sabatons': {
    id: 'astral-sabatons',
    name: 'Astral Sabatons',
    baseName: 'Sabatons',
    rarity: 'epic',
    slot: 'boots',
    modifiers: [
      createGearModifier('astral-sabatons', 'movement-speed', 3, 11),
      createGearModifier('astral-sabatons', 'attack-speed', 5, 6),
      createGearModifier('astral-sabatons', 'attack-range', 4, 20),
      createGearModifier('astral-sabatons', 'elemental-resistance', 5, 7),
    ],
    setId: 'astral',
  },
  'astral-ring': {
    id: 'astral-ring',
    name: 'Astral Signet',
    baseName: 'Signet',
    rarity: 'rare',
    slot: 'ring',
    modifiers: [
      createGearModifier('astral-ring', 'flat-lightning-damage', 3, 5),
      createGearModifier('astral-ring', 'crit-chance', 4, 6),
      createGearModifier('astral-ring', 'attack-speed', 4, 9),
    ],
    setId: 'astral',
  },
  'splintering-helm': {
    id: 'splintering-helm',
    name: 'Splintering Hood',
    baseName: 'Hood',
    rarity: 'uncommon',
    slot: 'helmet',
    modifiers: [
      createGearModifier('splintering-helm', 'max-hp', 4, 24),
      createGearModifier('splintering-helm', 'attack-range', 4, 20),
    ],
    setId: 'splintering',
  },
  'splintering-armor': {
    id: 'splintering-armor',
    name: 'Splintering Shell',
    baseName: 'Shell',
    rarity: 'rare',
    slot: 'armor',
    modifiers: [
      createGearModifier('splintering-armor', 'max-hp', 3, 38),
      createGearModifier('splintering-armor', 'physical-resistance', 4, 16),
      createGearModifier('splintering-armor', 'chaos-resistance', 5, 9),
    ],
    setId: 'splintering',
  },
  'splintering-boots': {
    id: 'splintering-boots',
    name: 'Splintering Striders',
    baseName: 'Striders',
    rarity: 'epic',
    slot: 'boots',
    modifiers: [
      createGearModifier('splintering-boots', 'movement-speed', 3, 11),
      createGearModifier('splintering-boots', 'attack-speed', 5, 6),
      createGearModifier('splintering-boots', 'attack-range', 4, 20),
      createGearModifier('splintering-boots', 'elemental-resistance', 5, 7),
    ],
    setId: 'splintering',
  },
  'splintering-ring': {
    id: 'splintering-ring',
    name: 'Splintering Band',
    baseName: 'Band',
    rarity: 'rare',
    slot: 'ring',
    modifiers: [
      createGearModifier('splintering-ring', 'flat-lightning-damage', 3, 5),
      createGearModifier('splintering-ring', 'crit-chance', 4, 6),
      createGearModifier('splintering-ring', 'attack-speed', 4, 9),
    ],
    setId: 'splintering',
  },
  'splintering-amulet': {
    id: 'splintering-amulet',
    name: 'Splintering Pendant',
    baseName: 'Pendant',
    rarity: 'legendary',
    slot: 'amulet',
    modifiers: [
      createGearModifier('splintering-amulet', 'max-hp', 1, 70),
      createGearModifier('splintering-amulet', 'attack-speed', 1, 24),
      createGearModifier('splintering-amulet', 'attack-range', 3, 28),
      createGearModifier('splintering-amulet', 'crit-chance', 4, 6),
      createGearModifier('splintering-amulet', 'elemental-resistance', 4, 18),
    ],
    setId: 'splintering',
  },
} as const satisfies Record<string, ItemDefinition>

export const ALL_ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.values(ITEM_DEFINITIONS)

export const INITIAL_ITEMS: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS.filter(
  (item) => !item.starterOnly,
)

/** Resolves content data at the content-to-game boundary. */
export function getItemDefinition(
  itemId: ItemId,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): ItemDefinition {
  const definition = itemDefinitions.find((candidate) => candidate.id === itemId)
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemId}`)
  }

  return definition
}
