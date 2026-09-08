import type { EquipmentSlot, ItemId } from '../../content/gear/Items'
import type { GearModifier } from '../../content/gear/ModifierPools'
import type { Rarity } from '../../content/rarity/Rarity'
import type { GearSetId } from '../../game-config/gear-sets'

/**
 * Equipment schema types.
 *
 * Separated from `EquipmentState.ts` because `GameState.ts` needs the loadout
 * shape while `EquipmentState.ts` needs `PlayerState`. Keeping the shapes in a
 * leaf module lets both dependencies point at it instead of at each other.
 */

/** Runtime reference to an item; behavior remains owned by content. */
export interface EquippedItem {
  itemId: ItemId
  /** Runtime rarity can differ from the catalog rarity after a rolled drop. */
  rarity?: Rarity
  /** Rolled modifiers are persisted here so snapshots never reroll them. */
  modifiers?: GearModifier[]
  /** Set assignment is rolled per generated item and persisted with it. */
  setId?: GearSetId
}

export type EquipmentLoadout = Partial<Record<EquipmentSlot, EquippedItem>>
