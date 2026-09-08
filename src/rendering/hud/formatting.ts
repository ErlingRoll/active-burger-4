import { EquipmentSlot, type EquipmentSlot as EquipmentSlotType } from '../../content/gear/Items'
import { formatGearModifier } from '../../content/gear/ModifierPools'
import type { GameUiSnapshot } from '../../game'

/** Labels and number formatting shared by the gameplay HUD panels. */

export const HUD_SLOT_LABELS: Record<EquipmentSlotType, string> = {
  [EquipmentSlot.Weapon]: 'Weapon',
  [EquipmentSlot.Helmet]: 'Helmet',
  [EquipmentSlot.Armor]: 'Armor',
  [EquipmentSlot.Boots]: 'Boots',
  [EquipmentSlot.Ring]: 'Ring',
  [EquipmentSlot.Amulet]: 'Amulet',
}

/** The HUD omits the tier, which the tooltip shows separately. */
export function formatHudModifier(
  modifier: GameUiSnapshot['skills'][number]['gearModifiers'][number],
): string {
  return formatGearModifier(modifier, { includeTier: false })
}

/** Trims trailing zeros so a cadence reads "1.5" rather than "1.50". */
export function formatCadence(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

export function formatEstimatedDps(value: number | null): string {
  return value === null ? 'N/A' : Math.ceil(value).toString()
}
