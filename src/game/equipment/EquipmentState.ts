import type {
  EquipmentSlot,
  ItemDefinition,
  ItemId,
} from '../../content/gear/Items'
import { getItemDefinition, INITIAL_ITEMS } from '../../content/gear/Items'
import type { Rarity } from '../../content/rarity/Rarity'
import type { StatModifier } from '../../content/stats/Stats'
import { nextRarity } from '../../content/rarity/Rarity'
import type { RandomSource } from '../random/Random'
import type { PlayerState } from '../state/GameState'
import { refreshPlayerDerivedStats } from '../stats/DerivedStats'

/** Runtime reference to an item; behavior remains owned by content. */
export interface EquippedItem {
  itemId: ItemId
  /** Runtime rarity can differ from the catalog rarity after an upgrade. */
  rarity?: Rarity
  /** Rolled modifiers are persisted here so snapshots never reroll them. */
  modifiers?: StatModifier[]
}

export type EquipmentLoadout = Partial<
  Record<EquipmentSlot, EquippedItem>
>

export function createEquippedItem(
  definition: ItemDefinition,
): EquippedItem {
  return { itemId: definition.id, rarity: definition.rarity }
}

export function equipItem(
  player: PlayerState,
  itemId: ItemId,
  itemDefinitions: readonly ItemDefinition[] = INITIAL_ITEMS,
): EquipmentSlot {
  const definition = getItemDefinition(itemId, itemDefinitions)
  player.equipment ??= {}
  player.equipment[definition.slot] = createEquippedItem(definition)
  refreshPlayerDerivedStats(player, itemDefinitions)
  return definition.slot
}

export const MIN_ITEM_UPGRADE_INCREASE = 0.1
export const MAX_ITEM_UPGRADE_INCREASE = 0.25

/**
 * Improves every modifier once and stores the rolled result on the equipped
 * item. Only the three lowest item rarities can be upgraded.
 */
export function upgradeEquippedItem(
  player: PlayerState,
  slot: EquipmentSlot,
  rng: RandomSource,
  itemDefinitions: readonly ItemDefinition[] = INITIAL_ITEMS,
): boolean {
  const equipped = player.equipment?.[slot]
  if (!equipped) {
    return false
  }
  const definition = getItemDefinition(equipped.itemId, itemDefinitions)
  const currentRarity = equipped.rarity ?? definition.rarity
  const upgradedRarity = nextRarity(currentRarity)
  if (
    !upgradedRarity ||
    upgradedRarity === 'legendary' ||
    currentRarity === 'epic' ||
    currentRarity === 'legendary'
  ) {
    return false
  }

  const modifiers = equipped.modifiers ?? definition.modifiers
  equipped.rarity = upgradedRarity
  equipped.modifiers = modifiers.map((modifier) => {
    const increase =
      MIN_ITEM_UPGRADE_INCREASE +
      rng.next() * (MAX_ITEM_UPGRADE_INCREASE - MIN_ITEM_UPGRADE_INCREASE)
    return {
      ...modifier,
      value: modifier.value * (1 + increase),
    }
  })
  refreshPlayerDerivedStats(player, itemDefinitions)
  return true
}
