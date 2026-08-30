import {
  getItemDefinition,
  EQUIPMENT_SLOTS,
  INITIAL_ITEMS,
  EquipmentSlot,
  getLegacyItemSetId,
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
import {
  nextRarity,
  RARITY_ORDER,
  Rarity,
  type Rarity as RarityValue,
} from '../../content/rarity/Rarity'
import {
  ALL_GEAR_SET_DEFINITIONS,
  normalizeGearSetId,
  type GearSetId,
} from '../../game-config/gear-sets'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'
import { rollItemUpgradeModifiers } from './EquipmentState'

export const GEAR_CHOICES_PER_PICKUP = 3
export const GEAR_RARITY_FLOOR_CHANCE = 0.1
export const EMPTY_SLOT_GEAR_WEIGHT_MULTIPLIER = 2

export interface GearItemChoice {
  type: 'gear'
  itemId: ItemId
  slot: EquipmentSlot
  rarity: RarityValue
  modifiers: readonly GearModifier[]
  setId?: GearSetId
}

export interface UpgradeEquippedItemChoice {
  type: 'upgrade-equipped-item'
  itemId: ItemId
  slot: EquipmentSlot
  rarity: RarityValue
  upgradedModifierId: GearModifier['id']
  fromTier: GearModifierTier
  toTier: GearModifierTier
  upgradedModifiers: readonly GearModifier[]
  setId?: GearSetId
}

export interface GearRarityFloorChoice {
  type: 'gear-rarity-floor'
  minimumRarity: RarityValue
}

export type GearChoice =
  | GearItemChoice
  | UpgradeEquippedItemChoice
  | GearRarityFloorChoice

function rollRarity(
  rng: RandomSource,
  minimumRarity: RarityValue = Rarity.Common,
): RarityValue {
  const totalWeight = Object.values(GEAR_RARITY_WEIGHTS).reduce(
    (total, weight) => total + weight,
    0,
  )
  let roll = rng.next() * totalWeight
  const rarities = Object.keys(GEAR_RARITY_WEIGHTS) as RarityValue[]
  for (const rarity of rarities) {
    roll -= GEAR_RARITY_WEIGHTS[rarity]
    if (roll < 0) {
      return RARITY_ORDER[rarity] >= RARITY_ORDER[minimumRarity]
        ? rarity
        : minimumRarity
    }
  }
  const selected = rarities[rarities.length - 1] as RarityValue
  return RARITY_ORDER[selected] >= RARITY_ORDER[minimumRarity]
    ? selected
    : minimumRarity
}

function rollChoiceFromTemplate(
  definition: ItemDefinition,
  rng: RandomSource,
  minimumRarity: RarityValue,
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

function getGearTemplateWeight(
  state: Readonly<GameState>,
  definition: Readonly<ItemDefinition>,
): number {
  return state.player.equipment?.[definition.slot]
    ? 1
    : EMPTY_SLOT_GEAR_WEIGHT_MULTIPLIER
}

function chooseGearTemplateIndex(
  state: Readonly<GameState>,
  definitions: readonly ItemDefinition[],
  rng: RandomSource,
): number {
  const totalWeight = definitions.reduce(
    (total, definition) => total + getGearTemplateWeight(state, definition),
    0,
  )
  let roll = rng.int(0, totalWeight - 1)
  for (const [index, definition] of definitions.entries()) {
    roll -= getGearTemplateWeight(state, definition)
    if (roll < 0) {
      return index
    }
  }
  return definitions.length - 1
}

function isRangerPreferredWeapon(
  definition: Readonly<ItemDefinition>,
): boolean {
  return definition.slot === EquipmentSlot.Weapon &&
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
    state.player.gearRarityFloor ?? Rarity.Common,
  )
}

interface EligibleUpgradeTarget {
  itemId: ItemId
  slot: EquipmentSlot
  rarity: RarityValue
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
      setId: normalizeGearSetId(equipped.setId) ??
        definition.setId ??
        getLegacyItemSetId(equipped.itemId),
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
): RarityValue | undefined {
  const equippedItems = EQUIPMENT_SLOTS.map(
    (slot) => state.player.equipment?.[slot],
  )
  let lowestRarity: RarityValue | undefined
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
): RarityValue | undefined {
  const currentRarity = getLowestEquippedRarity(state)
  if (currentRarity !== Rarity.Common && currentRarity !== Rarity.Uncommon) {
    return undefined
  }
  const minimumRarity = state.player.gearRarityFloor ?? Rarity.Common
  const next = nextRarity(currentRarity)
  if (next === Rarity.Rare && minimumRarity === Rarity.Common) {
    return undefined
  }
  if (
    !next ||
    RARITY_ORDER[next] <= RARITY_ORDER[minimumRarity]
  ) {
    return undefined
  }
  return next
}

export function prioritizeSpecialGearChoices(
  choices: readonly GearChoice[],
): GearChoice[] {
  const blessing = choices.filter((choice) => choice.type === 'gear-rarity-floor')
  const upgrade = choices.filter((choice) => choice.type === 'upgrade-equipped-item')
  const ordinary = choices.filter((choice) =>
    choice.type !== 'gear-rarity-floor' &&
    choice.type !== 'upgrade-equipped-item'
  )
  return [...blessing, ...upgrade, ...ordinary]
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
    const definition = remaining.splice(
      chooseGearTemplateIndex(state, remaining, rng),
      1,
    )[0]
    if (!definition) {
      break
    }
    choices.push(rollChoiceFromTemplate(
      definition,
      rng,
      state.player.gearRarityFloor ?? Rarity.Common,
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
  return prioritizeSpecialGearChoices(choices)
}

export const generateGearPickupChoices = generateGearChoices
export const generateGearOfferChoices = generateGearChoices
