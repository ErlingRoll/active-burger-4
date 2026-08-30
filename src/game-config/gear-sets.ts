import { EquipmentSlot } from '../content/gear/EquipmentSlots'

export type GearSetId = 'scholar' | 'giant' | 'astral' | 'splintering'

export type GearSetBonusKind =
  | 'max-hp-percent'
  | 'cooldown-reduction'
  | 'extra-projectiles'
  | 'experience-gain-percent'
  | 'all-resistances'

export interface GearSetBonus {
  requiredPieces: 2 | 4 | 6
  kind: GearSetBonusKind
  value: number
  label: string
}

export interface GearSetDefinition {
  id: GearSetId
  name: string
  slots: readonly EquipmentSlot[]
  bonuses: readonly GearSetBonus[]
}

export const GEAR_SET_DEFINITIONS = {
  scholar: {
    id: 'scholar',
    name: "Scholar's",
    slots: [
      EquipmentSlot.Weapon,
      EquipmentSlot.Helmet,
      EquipmentSlot.Armor,
      EquipmentSlot.Boots,
      EquipmentSlot.Ring,
      EquipmentSlot.Amulet,
    ],
    bonuses: [
      { requiredPieces: 2, kind: 'experience-gain-percent', value: 5, label: '+5% XP gained' },
      { requiredPieces: 4, kind: 'experience-gain-percent', value: 10, label: '+10% XP gained' },
      { requiredPieces: 6, kind: 'experience-gain-percent', value: 15, label: '+15% XP gained' },
    ],
  },
  giant: {
    id: 'giant',
    name: "Giant's",
    slots: [
      EquipmentSlot.Weapon,
      EquipmentSlot.Helmet,
      EquipmentSlot.Armor,
      EquipmentSlot.Boots,
      EquipmentSlot.Ring,
      EquipmentSlot.Amulet,
    ],
    bonuses: [
      { requiredPieces: 2, kind: 'all-resistances', value: 15, label: '+15% all resistances' },
      { requiredPieces: 4, kind: 'all-resistances', value: 15, label: '+15% all resistances' },
      { requiredPieces: 6, kind: 'all-resistances', value: 15, label: '+15% all resistances' },
    ],
  },
  astral: {
    id: 'astral',
    name: 'Astral',
    slots: [
      EquipmentSlot.Weapon,
      EquipmentSlot.Helmet,
      EquipmentSlot.Armor,
      EquipmentSlot.Boots,
      EquipmentSlot.Ring,
      EquipmentSlot.Amulet,
    ],
    bonuses: [
      { requiredPieces: 2, kind: 'cooldown-reduction', value: 10, label: '+10% Cooldown reduction' },
      { requiredPieces: 4, kind: 'cooldown-reduction', value: 20, label: '+20% Cooldown reduction' },
      { requiredPieces: 6, kind: 'cooldown-reduction', value: 30, label: '+30% Cooldown reduction' },
    ],
  },
  splintering: {
    id: 'splintering',
    name: 'Splintering',
    slots: [
      EquipmentSlot.Weapon,
      EquipmentSlot.Helmet,
      EquipmentSlot.Armor,
      EquipmentSlot.Boots,
      EquipmentSlot.Ring,
      EquipmentSlot.Amulet,
    ],
    bonuses: [
      { requiredPieces: 2, kind: 'extra-projectiles', value: 1, label: '+1 extra projectile' },
      { requiredPieces: 4, kind: 'extra-projectiles', value: 2, label: '+2 extra projectiles' },
      { requiredPieces: 6, kind: 'extra-projectiles', value: 3, label: '+3 extra projectiles' },
    ],
  },
} as const satisfies Record<GearSetId, GearSetDefinition>

export const ALL_GEAR_SET_DEFINITIONS: readonly GearSetDefinition[] =
  Object.values(GEAR_SET_DEFINITIONS)

export function isGearSetId(value: unknown): value is GearSetId {
  return typeof value === 'string' &&
    ALL_GEAR_SET_DEFINITIONS.some((set) => set.id === value)
}

/** Normalizes the legacy `giants` ID to the current Giant's set. */
export function normalizeGearSetId(value: unknown): GearSetId | undefined {
  if (value === 'giants') {
    return 'giant'
  }
  return isGearSetId(value) ? value : undefined
}

export function getGearSetDefinition(setId: GearSetId): GearSetDefinition {
  return GEAR_SET_DEFINITIONS[setId]
}

export function getActiveGearSetBonuses(
  set: Readonly<GearSetDefinition>,
  equippedPieces: number,
): readonly GearSetBonus[] {
  return set.bonuses.filter((bonus) => equippedPieces >= bonus.requiredPieces)
}
