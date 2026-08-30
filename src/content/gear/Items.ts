import { Rarity, type Rarity as RarityValue } from '../rarity/Rarity'
import {
  createGearModifier,
  type GearModifier,
} from './ModifierPools'
import {
  getGearSetDefinition,
  type GearSetId,
} from '../../game-config/gear-sets'
import {
  BOW_PRECISION_IMPLICIT_MODIFIER,
  type ItemImplicitModifier,
} from './ImplicitModifiers'
import { EquipmentSlot } from './EquipmentSlots'
export { EquipmentSlot, EQUIPMENT_SLOTS } from './EquipmentSlots'
export {
  BOW_PRECISION_DAMAGE_INCREASE_PERCENT,
  BOW_PRECISION_IMPLICIT_MODIFIER,
  type ItemImplicitModifier,
} from './ImplicitModifiers'

export type ItemId = string
export type WeaponArchetype = 'sword' | 'bow' | 'wand' | 'staff'

export const WEAPON_ARCHETYPES = [
  'sword',
  'bow',
  'wand',
  'staff',
] as const satisfies readonly WeaponArchetype[]

interface ItemDefinitionBase {
  id: ItemId
  name: string
  rarity: RarityValue
  modifiers: readonly GearModifier[]
  implicitModifiers?: readonly ItemImplicitModifier[]
  starterOnly?: boolean
  setId?: GearSetId
}

interface WeaponItemDefinition extends ItemDefinitionBase {
  slot: typeof EquipmentSlot.Weapon
  weaponArchetype: WeaponArchetype
}

interface NonWeaponItemDefinition extends ItemDefinitionBase {
  slot: Exclude<EquipmentSlot, typeof EquipmentSlot.Weapon>
  weaponArchetype?: never
}

export type ItemDefinition = WeaponItemDefinition | NonWeaponItemDefinition

export function getItemDisplayName(
  item: Readonly<ItemDefinition>,
  setId?: GearSetId,
): string {
  if (!setId) {
    return item.name
  }
  return `${getGearSetDefinition(setId).name} ${item.name}`
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
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'sword',
    modifiers: [],
    starterOnly: true,
  },
  'ranger-training-bow': {
    id: 'ranger-training-bow',
    name: 'Ranger Training Bow',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'bow',
    modifiers: [],
    implicitModifiers: [BOW_PRECISION_IMPLICIT_MODIFIER],
    starterOnly: true,
  },
  'necromancer-training-wand': {
    id: 'necromancer-training-wand',
    name: 'Necromancer Training Wand',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'wand',
    modifiers: [],
    starterOnly: true,
  },
  'necromancer-bone-staff': {
    id: 'necromancer-bone-staff',
    name: 'Necromancer Bone Staff',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'staff',
    modifiers: [],
    starterOnly: true,
  },
  'frost-warden-training-wand': {
    id: 'frost-warden-training-wand',
    name: 'Frost Warden Training Wand',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'wand',
    modifiers: [],
    starterOnly: true,
  },
  'ashen-alchemist-training-staff': {
    id: 'ashen-alchemist-training-staff',
    name: 'Ashen Alchemist Training Staff',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'staff',
    modifiers: [],
    starterOnly: true,
  },
  'war-shepherd-training-sword': {
    id: 'war-shepherd-training-sword',
    name: 'War Shepherd Training Sword',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'sword',
    modifiers: [],
    starterOnly: true,
  },
  'iron-cleaver': {
    id: 'iron-cleaver',
    name: 'Cleaver',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'sword',
    modifiers: [
      createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
    ],
  },
  'hunters-bow': {
    id: 'hunters-bow',
    name: 'Bow',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'bow',
    modifiers: [
      createGearModifier('hunters-bow', 'attack-speed', 5, 4),
    ],
    implicitModifiers: [BOW_PRECISION_IMPLICIT_MODIFIER],
  },
  'starcall-wand': {
    id: 'starcall-wand',
    name: 'Wand',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'wand',
    modifiers: [
      createGearModifier('starcall-wand', 'basic-attack-extra-projectiles', 5, 1),
    ],
  },
  'ritual-staff': {
    id: 'ritual-staff',
    name: 'Staff',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Weapon,
    weaponArchetype: 'staff',
    modifiers: [
      createGearModifier('ritual-staff', 'dot-multiplier', 5, 5),
    ],
  },
  helmet: {
    id: 'helmet',
    name: 'Helmet',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Helmet,
    modifiers: [createGearModifier('helmet', 'max-hp', 1, 56)],
  },
  armor: {
    id: 'armor',
    name: 'Armor',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Armor,
    modifiers: [createGearModifier('armor', 'max-hp', 1, 56)],
  },
  boots: {
    id: 'boots',
    name: 'Boots',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Boots,
    modifiers: [createGearModifier('boots', 'movement-speed', 1, 16)],
  },
  ring: {
    id: 'ring',
    name: 'Ring',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Ring,
    modifiers: [createGearModifier('ring', 'flat-lightning-damage', 1, 9)],
  },
  amulet: {
    id: 'amulet',
    name: 'Amulet',
    rarity: Rarity.Common,
    slot: EquipmentSlot.Amulet,
    modifiers: [createGearModifier('amulet', 'max-hp', 1, 56)],
  },
} as const satisfies Record<string, ItemDefinition>

export const ALL_ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.values(ITEM_DEFINITIONS)

export const INITIAL_ITEMS: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS.filter(
  (item) => !item.starterOnly,
)

interface LegacyItemAlias {
  itemId: ItemId
  setId: GearSetId
}

const LEGACY_ITEM_ID_ALIASES: Readonly<Record<string, LegacyItemAlias>> = {
  'iron-cleaver': { itemId: 'iron-cleaver', setId: 'giant' },
  'hunters-bow': { itemId: 'hunters-bow', setId: 'splintering' },
  'starcall-wand': { itemId: 'starcall-wand', setId: 'astral' },
  'watchers-helm': { itemId: 'helmet', setId: 'giant' },
  'bastion-plate': { itemId: 'armor', setId: 'giant' },
  'swiftstride-boots': { itemId: 'boots', setId: 'giant' },
  'duelists-band': { itemId: 'ring', setId: 'giant' },
  'starcaller-amulet': { itemId: 'amulet', setId: 'astral' },
  'giants-amulet': { itemId: 'amulet', setId: 'giant' },
  'astral-helm': { itemId: 'helmet', setId: 'astral' },
  'astral-raiment': { itemId: 'armor', setId: 'astral' },
  'astral-sabatons': { itemId: 'boots', setId: 'astral' },
  'astral-ring': { itemId: 'ring', setId: 'astral' },
  'splintering-helm': { itemId: 'helmet', setId: 'splintering' },
  'splintering-armor': { itemId: 'armor', setId: 'splintering' },
  'splintering-boots': { itemId: 'boots', setId: 'splintering' },
  'splintering-ring': { itemId: 'ring', setId: 'splintering' },
  'splintering-amulet': { itemId: 'amulet', setId: 'splintering' },
}

export function getLegacyItemSetId(itemId: ItemId): GearSetId | undefined {
  return LEGACY_ITEM_ID_ALIASES[itemId]?.setId
}

/** Resolves content data at the content-to-game boundary. */
export function getItemDefinition(
  itemId: ItemId,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): ItemDefinition {
  const alias = LEGACY_ITEM_ID_ALIASES[itemId]
  const definition = itemDefinitions.find((candidate) => candidate.id === itemId) ??
    itemDefinitions.find((candidate) => candidate.id === (alias?.itemId ?? itemId))
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemId}`)
  }

  return definition
}
