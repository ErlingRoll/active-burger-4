import { EquipmentSlot } from '../content/gear/EquipmentSlots'

export type GearSetId = 'giants' | 'astral' | 'splintering'

export type GearSetBonusKind =
  | 'max-hp-percent'
  | 'cooldown-reduction'
  | 'extra-projectiles'

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
  giants: {
    id: 'giants',
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
      { requiredPieces: 2, kind: 'max-hp-percent', value: 10, label: '+10% Max HP' },
      { requiredPieces: 4, kind: 'max-hp-percent', value: 25, label: '+25% Max HP' },
      { requiredPieces: 6, kind: 'max-hp-percent', value: 45, label: '+45% Max HP' },
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

export function getGearSetDefinition(setId: GearSetId): GearSetDefinition {
  return GEAR_SET_DEFINITIONS[setId]
}

export function getActiveGearSetBonuses(
  set: Readonly<GearSetDefinition>,
  equippedPieces: number,
): readonly GearSetBonus[] {
  return set.bonuses.filter((bonus) => equippedPieces >= bonus.requiredPieces)
}
