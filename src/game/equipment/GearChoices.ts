import {
  getItemDefinition,
  INITIAL_ITEMS,
  type EquipmentSlot,
  type ItemDefinition,
  type ItemId,
} from '../../content/gear/Items'
import {
  GEAR_RARITY_WEIGHTS,
  cloneGearModifiers,
  getGearModifierCountForRarity,
  rollGearModifiersForItem,
  serializeGearModifiers,
  type GearModifier,
  type GearModifierTier,
} from '../../content/gear/ModifierPools'
import type { Rarity } from '../../content/rarity/Rarity'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'
import { rollItemUpgradeModifiers } from './EquipmentState'

export const GEAR_CHOICES_PER_PICKUP = 3

export interface GearItemChoice {
  type: 'gear'
  itemId: ItemId
  slot: EquipmentSlot
  rarity: Rarity
  modifiers: readonly GearModifier[]
}

export interface UpgradeEquippedItemChoice {
  type: 'upgrade-equipped-item'
  itemId: ItemId
  slot: EquipmentSlot
  rarity: Rarity
  upgradedModifierId: GearModifier['id']
  fromTier: GearModifierTier
  toTier: GearModifierTier
  upgradedModifiers: readonly GearModifier[]
}

export type GearChoice = GearItemChoice | UpgradeEquippedItemChoice

function rollRarity(rng: RandomSource): Rarity {
  const totalWeight = Object.values(GEAR_RARITY_WEIGHTS).reduce(
    (total, weight) => total + weight,
    0,
  )
  let roll = rng.next() * totalWeight
  const rarities = Object.keys(GEAR_RARITY_WEIGHTS) as Rarity[]
  for (const rarity of rarities) {
    roll -= GEAR_RARITY_WEIGHTS[rarity]
    if (roll < 0) {
      return rarity
    }
  }
  return rarities[rarities.length - 1] as Rarity
}

function rollChoiceFromTemplate(
  definition: ItemDefinition,
  rng: RandomSource,
): GearItemChoice {
  const rarity = rollRarity(rng)
  const modifiers = rollGearModifiersForItem(
    definition,
    rarity,
    rng,
  )
  if (modifiers.length !== getGearModifierCountForRarity(rarity)) {
    throw new Error(`Rolled unexpected modifier count for ${definition.id}.`)
  }
  return {
    type: 'gear',
    itemId: definition.id,
    slot: definition.slot,
    rarity,
    modifiers,
  }
}

function isRangerPreferredWeapon(
  definition: Readonly<ItemDefinition>,
): boolean {
  return definition.slot === 'weapon' &&
    (
      definition.weaponArchetype === 'bow' ||
      definition.weaponArchetype === 'wand'
    )
}

function ensureRangerPreferredWeaponChoice(
  state: Readonly<GameState>,
  choices: GearChoice[],
  rng: RandomSource,
  itemDefinitions: readonly ItemDefinition[],
): void {
  if (state.player.playstyleId !== 'ranger') {
    return
  }
  if (choices.some((choice) =>
    choice.type === 'gear' &&
    isRangerPreferredWeapon(getItemDefinition(choice.itemId, itemDefinitions))
  )) {
    return
  }

  const replacementIndices = choices.flatMap((choice, index) =>
    choice.type === 'gear' ? [index] : []
  )
  if (replacementIndices.length === 0) {
    return
  }
  const existingItemIds = new Set(choices.map((choice) => choice.itemId))
  const preferredTemplates = itemDefinitions.filter((definition) =>
    isRangerPreferredWeapon(definition) && !existingItemIds.has(definition.id)
  )
  if (preferredTemplates.length === 0) {
    return
  }

  const replacementIndex = replacementIndices[
    rng.int(0, replacementIndices.length - 1)
  ]
  const replacementDefinition = preferredTemplates[
    rng.int(0, preferredTemplates.length - 1)
  ]
  if (replacementIndex === undefined || !replacementDefinition) {
    return
  }
  choices[replacementIndex] = rollChoiceFromTemplate(replacementDefinition, rng)
}

interface EligibleUpgradeTarget {
  itemId: ItemId
  slot: EquipmentSlot
  rarity: Rarity
  modifiers: readonly GearModifier[]
}

function eligibleUpgradeTargets(
  state: Readonly<GameState>,
  itemDefinitions: readonly ItemDefinition[],
): EligibleUpgradeTarget[] {
  const choices: EligibleUpgradeTarget[] = []
  for (const [slot, equipped] of Object.entries(state.player.equipment ?? {})) {
    if (!equipped) {
      continue
    }
    const definition = getItemDefinition(equipped.itemId, itemDefinitions)
    const modifiers = cloneGearModifiers(equipped.modifiers ?? definition.modifiers)
    if (!modifiers.some((modifier) => modifier.tier > 1)) {
      continue
    }
    choices.push({
      itemId: equipped.itemId,
      slot: slot as EquipmentSlot,
      rarity: equipped.rarity ?? definition.rarity,
      modifiers,
    })
  }
  return choices
}

export function gearChoiceSignature(choice: Readonly<GearChoice>): string {
  return choice.type === 'gear'
    ? `gear:${choice.itemId}:${choice.slot}:${choice.rarity}:${serializeGearModifiers(choice.modifiers)}`
    : `upgrade:${choice.itemId}:${choice.slot}:${choice.rarity}:${choice.upgradedModifierId}:${choice.fromTier}:${choice.toTier}:${serializeGearModifiers(choice.upgradedModifiers)}`
}

/**
 * Generates a deterministic, rarity-weighted set of distinct gear templates.
 * When an eligible equipped item exists, one normal offer is replaced by the
 * special upgrade offer for a single lower-tier modifier on that item.
 */
export function generateGearChoices(
  state: Readonly<GameState>,
  count: number,
  rng: RandomSource,
  itemDefinitions: readonly ItemDefinition[] = INITIAL_ITEMS,
): GearChoice[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Gear choice count must be a non-negative integer: ${count}`)
  }
  const normalCount = count
  if (itemDefinitions.length < normalCount) {
    throw new Error(
      `Cannot generate ${normalCount} unique gear choices from ${itemDefinitions.length} items.`,
    )
  }

  const remaining = [...itemDefinitions]
  const choices: GearChoice[] = []
  while (choices.length < normalCount) {
    const definition = remaining.splice(rng.int(0, remaining.length - 1), 1)[0]
    if (!definition) {
      break
    }
    choices.push(rollChoiceFromTemplate(definition, rng))
  }

  const upgradeTargets = eligibleUpgradeTargets(state, itemDefinitions)
  if (upgradeTargets.length > 0 && choices.length > 0) {
    const target = rng.pick(upgradeTargets)
    const upgrade = rollItemUpgradeModifiers(target.modifiers, rng)
    if (upgrade) {
      const existingTargetIndex = choices.findIndex(
        (choice) => choice.type === 'gear' && choice.itemId === target.itemId,
      )
      const replacementIndex =
        existingTargetIndex >= 0
          ? existingTargetIndex
          : rng.int(0, choices.length - 1)
      choices[replacementIndex] = {
        type: 'upgrade-equipped-item',
        itemId: target.itemId,
        slot: target.slot,
        rarity: target.rarity,
        upgradedModifierId: upgrade.upgradedModifierId,
        fromTier: upgrade.fromTier,
        toTier: upgrade.toTier,
        upgradedModifiers: upgrade.upgradedModifiers,
      }
    }
  }
  ensureRangerPreferredWeaponChoice(state, choices, rng, itemDefinitions)
  return choices
}

export const generateGearPickupChoices = generateGearChoices
export const generateGearOfferChoices = generateGearChoices
