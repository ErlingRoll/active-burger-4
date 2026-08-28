export const EquipmentSlot = {
  Weapon: 'weapon',
  Helmet: 'helmet',
  Armor: 'armor',
  Boots: 'boots',
  Ring: 'ring',
  Amulet: 'amulet',
} as const

export type EquipmentSlot = typeof EquipmentSlot[keyof typeof EquipmentSlot]

export const EQUIPMENT_SLOTS = [
  EquipmentSlot.Weapon,
  EquipmentSlot.Helmet,
  EquipmentSlot.Armor,
  EquipmentSlot.Boots,
  EquipmentSlot.Ring,
  EquipmentSlot.Amulet,
] as const satisfies readonly EquipmentSlot[]
