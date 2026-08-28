import {
  getItemDefinition,
  EQUIPMENT_SLOTS,
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
import { nextRarity, RARITY_ORDER } from '../../content/rarity/Rarity'
import {
  ALL_GEAR_SET_DEFINITIONS,
  type GearSetId,
} from '../../game-config/gear-sets'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'
import { rollItemUpgradeModifiers } from './EquipmentState'

export const GEAR_CHOICES_PER_PICKUP = 3
export const GEAR_RARITY_FLOOR_CHANCE = 0.1

export interface GearItemChoice {
  type: 'gear'
  itemId: ItemId
  slot: EquipmentSlot
  rarity: Rarity
  modifiers: readonly GearModifier[]
  setId?: GearSetId
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
  setId?: GearSetId
}

export interface GearRarityFloorChoice {
  type: 'gear-rarity-floor'
  minimumRarity: Rarity
}

export type GearChoice =
  | GearItemChoice
  | UpgradeEquippedItemChoice
  | GearRarityFloorChoice

function rollRarity(
  rng: RandomSource,
  minimumRarity: Rarity = 'common',
): Rarity {
  const totalWeight = Object.values(GEAR_RARITY_WEIGHTS).reduce(
    (total, weight) => total + weight,
    0,
  )
  let roll = rng.next() * totalWeight
  const rarities = Object.keys(GEAR_RARITY_WEIGHTS) as Rarity[]
  for (const rarity of rarities) {
    roll -= GEAR_RARITY_WEIGHTS[rarity]
    if (roll < 0) {
      return RARITY_ORDER[rarity] >= RARITY_ORDER[minimumRarity]
        ? rarity
        : minimumRarity
    }
  }
  const selected = rarities[rarities.length - 1] as Rarity
  return RARITY_ORDER[selected] >= RARITY_ORDER[minimumRarity]
    ? selected
    : minimumRarity
}

function rollChoiceFromTemplate(
  definition: ItemDefinition,
  rng: RandomSource,
  minimumRarity: Rarity,
): GearItemChoice {
  const rarity = rollRarity(rng, minimumRarity)
  const setId = rng.pick(ALL_GEAR_SET_DEFINITIONS).id
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
    setId,
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
  const existingItemIds = new Set(
    choices
      .filter((choice): choice is GearItemChoice => choice.type === 'gear')
      .map((choice) => choice.itemId),
  )
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
  choices[replacementIndex] = rollChoiceFromTemplate(
    replacementDefinition,
    rng,
    state.player.gearRarityFloor ?? 'common',
  )
}

interface EligibleUpgradeTarget {
  itemId: ItemId
  slot: EquipmentSlot
  rarity: Rarity
  modifiers: readonly GearModifier[]
  setId?: GearSetId
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
    const definition = itemDefinitions.find(
      (candidate) => candidate.id === equipped.itemId,
    ) ?? getItemDefinition(equipped.itemId)
    const modifiers = cloneGearModifiers(equipped.modifiers ?? definition.modifiers)
    if (!modifiers.some((modifier) => modifier.tier > 1)) {
      continue
    }
    choices.push({
      itemId: equipped.itemId,
      slot: slot as EquipmentSlot,
      rarity: equipped.rarity ?? definition.rarity,
      modifiers,
      setId: equipped.setId ?? definition.setId,
    })
  }
  return choices
}

export function gearChoiceSignature(choice: Readonly<GearChoice>): string {
  return choice.type === 'gear'
    ? `gear:${choice.itemId}:${choice.slot}:${choice.rarity}:${choice.setId ?? ''}:${serializeGearModifiers(choice.modifiers)}`
    : choice.type === 'upgrade-equipped-item'
      ? `upgrade:${choice.itemId}:${choice.slot}:${choice.rarity}:${choice.setId ?? ''}:${choice.upgradedModifierId}:${choice.fromTier}:${choice.toTier}:${serializeGearModifiers(choice.upgradedModifiers)}`
      : `gear-rarity-floor:${choice.minimumRarity}`
}

function getLowestEquippedRarity(
  state: Readonly<GameState>,
): Rarity | undefined {
  const equippedItems = EQUIPMENT_SLOTS.map(
    (slot) => state.player.equipment?.[slot],
  )
  let lowestRarity: Rarity | undefined
  for (const item of equippedItems) {
    if (!item) {
      return undefined
    }
    if (!item.rarity) {
      return undefined
    }
    const previousLowest = lowestRarity
    if (previousLowest === undefined ||
        RARITY_ORDER[item.rarity] < RARITY_ORDER[previousLowest]) {
      lowestRarity = item.rarity
    }
  }
  return lowestRarity
}

function getEligibleGearRarityFloor(
  state: Readonly<GameState>,
): Rarity | undefined {
  const currentRarity = getLowestEquippedRarity(state)
  if (currentRarity !== 'common' && currentRarity !== 'uncommon') {
    return undefined
  }
  const minimumRarity = state.player.gearRarityFloor ?? 'common'
  const next = nextRarity(currentRarity)
  if (
    !next ||
    RARITY_ORDER[next] <= RARITY_ORDER[minimumRarity]
  ) {
    return undefined
  }
  return next
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
    choices.push(rollChoiceFromTemplate(
      definition,
      rng,
      state.player.gearRarityFloor ?? 'common',
    ))
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
        setId: target.setId,
      }
    }
  }
  ensureRangerPreferredWeaponChoice(state, choices, rng, itemDefinitions)
  const minimumRarity = getEligibleGearRarityFloor(state)
  if (
    minimumRarity &&
    count > 0 &&
    rng.chance(GEAR_RARITY_FLOOR_CHANCE)
  ) {
    const nonPreferredReplacementIndex = choices.findIndex((choice) =>
      choice.type === 'gear' &&
      !isRangerPreferredWeapon(getItemDefinition(choice.itemId, itemDefinitions))
    )
    const replacementIndex = nonPreferredReplacementIndex >= 0
      ? nonPreferredReplacementIndex
      : choices.findIndex((choice) => choice.type === 'gear')
    if (replacementIndex >= 0) {
      choices[replacementIndex] = {
        type: 'gear-rarity-floor',
        minimumRarity,
      }
    }
  }
  return choices
}

export const generateGearPickupChoices = generateGearChoices
export const generateGearOfferChoices = generateGearChoices
