import {
  EquipmentSlot,
  getLegacyItemSetId,
  type ItemDefinition,
  type ItemId,
  type WeaponArchetype,
} from '../../content/gear/Items'
import {
  ALL_ITEM_DEFINITIONS,
  getItemDefinition,
} from '../../content/gear/Items'
import {
  cloneGearModifiers,
  rerollGearModifierAtTier,
  type GearModifier,
  type GearModifierTier,
} from '../../content/gear/ModifierPools'
import type { Rarity } from '../../content/rarity/Rarity'
import type { GearSetId } from '../../game-config/gear-sets'
import type { RandomSource } from '../random/Random'
import type { PlayerState } from '../state/GameState'
import {
  refreshMeleeLeech,
  refreshPlayerDerivedStats,
} from '../stats/DerivedStats'

export { refreshMeleeLeech }

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

export type EquipmentLoadout = Partial<
  Record<EquipmentSlot, EquippedItem>
>

export function createEquippedItem(
  definition: ItemDefinition,
  rarity: Rarity = definition.rarity,
  modifiers: readonly GearModifier[] = definition.modifiers,
  setId: GearSetId | undefined = definition.setId,
): EquippedItem {
  return {
    itemId: definition.id,
    rarity,
    modifiers: cloneGearModifiers(modifiers),
    ...(setId ? { setId } : {}),
  }
}

export function equipItem(
  player: PlayerState,
  itemId: ItemId,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): EquipmentSlot {
  const definition = getItemDefinition(itemId, itemDefinitions)
  player.equipment ??= {}
  player.equipment[definition.slot] = createEquippedItem(
    definition,
    undefined,
    undefined,
    getLegacyItemSetId(itemId),
  )
  refreshPlayerDerivedStats(player, itemDefinitions)
  return definition.slot
}

export function equipRolledItem(
  player: PlayerState,
  itemId: ItemId,
  rarity: Rarity,
  modifiers: readonly GearModifier[],
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
  setId?: GearSetId,
): EquipmentSlot {
  const definition = getItemDefinition(itemId, itemDefinitions)
  player.equipment ??= {}
  player.equipment[definition.slot] = createEquippedItem(
    definition,
    rarity,
    modifiers,
    setId ?? getLegacyItemSetId(itemId),
  )
  refreshPlayerDerivedStats(player, itemDefinitions)
  return definition.slot
}

export function getEquippedWeaponArchetype(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): WeaponArchetype | undefined {
  const equipped = player.equipment?.weapon
  if (!equipped) {
    return undefined
  }
  const definition = getItemDefinition(equipped.itemId, itemDefinitions)
  return definition.slot === EquipmentSlot.Weapon
    ? definition.weaponArchetype
    : undefined
}

export interface RolledItemUpgrade {
  upgradedModifiers: GearModifier[]
  upgradedModifierId: GearModifier['id']
  fromTier: GearModifierTier
  toTier: GearModifierTier
}

export function rollItemUpgradeModifiers(
  modifiers: readonly GearModifier[],
  rng: RandomSource,
): RolledItemUpgrade | undefined {
  const eligible = modifiers.filter((modifier) => modifier.tier > 1)
  if (eligible.length === 0) {
    return undefined
  }
  const upgradedModifier = rng.pick(eligible)
  const upgradedModifiers = modifiers.map((modifier) =>
    modifier.id === upgradedModifier.id
      ? rerollGearModifierAtTier(
          modifier,
          (modifier.tier - 1) as GearModifierTier,
          rng,
        )
      : { ...modifier }
  )
  return {
    upgradedModifiers,
    upgradedModifierId: upgradedModifier.id,
    fromTier: upgradedModifier.tier,
    toTier: (upgradedModifier.tier - 1) as GearModifierTier,
  }
}

/**
 * Stores an offer's previously rolled modifier values on the equipped item.
 */
export function upgradeEquippedItem(
  player: PlayerState,
  slot: EquipmentSlot,
  upgradedModifiers: readonly GearModifier[],
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): boolean {
  const equipped = player.equipment?.[slot]
  if (!equipped) {
    return false
  }

  equipped.modifiers = cloneGearModifiers(upgradedModifiers)
  refreshPlayerDerivedStats(player, itemDefinitions)
  refreshMeleeLeech(player, itemDefinitions)
  return true
}
