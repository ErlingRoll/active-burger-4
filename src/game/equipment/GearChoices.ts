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
import {
  hasAllEquippedGearAtLeastRarity,
  rollItemUpgradeModifiers,
} from './EquipmentState'
import { GEAR_XP_BLESSING_CHANCE } from '../../game-config/gear'
import {
  DEFAULT_CHARACTER_CLASS_ID,
  getCharacterClassDefinition,
  isCharacterClassId,
} from '../../content/classes/CharacterClasses'

export const GEAR_CHOICES_PER_PICKUP = 3
export const GEAR_RARITY_FLOOR_CHANCE = 0.15
export const EMPTY_SLOT_GEAR_WEIGHT_MULTIPLIER = 2
const STARTING_WEAPON_TYPE_WEIGHT = 2
const GEAR_SET_BASE_WEIGHT = 100
const GEAR_SET_MATCH_WEIGHT = 25

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
  /** Rarity of the equipped item being upgraded. */
  itemRarity: RarityValue
  /** Rarity of this special gear offer. */
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
  rarity: RarityValue
}

export interface GearXpBlessingChoice {
  type: 'gear-xp-blessing'
  rarity: RarityValue
}

export type GearChoice =
  | GearItemChoice
  | UpgradeEquippedItemChoice
  | GearRarityFloorChoice
  | GearXpBlessingChoice

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
  setChoicePool: readonly GearSetId[],
): GearItemChoice {
  const rarity = rollRarity(rng, minimumRarity)
  const setId = rng.pick(setChoicePool)
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

function getGearSetChoicePool(
  state: Readonly<GameState>,
  itemDefinitions: readonly ItemDefinition[],
): GearSetId[] {
  const equippedSetCounts = new Map<GearSetId, number>()
  let equippedSetCount = 0
  for (const equipped of Object.values(state.player.equipment ?? {})) {
    if (!equipped) {
      continue
    }
    const definition = itemDefinitions.find(
      (candidate) => candidate.id === equipped.itemId,
    ) ?? getItemDefinition(equipped.itemId)
    const setId = normalizeGearSetId(equipped.setId) ??
      definition.setId ??
      getLegacyItemSetId(equipped.itemId)
    if (!setId) {
      continue
    }
    equippedSetCounts.set(setId, (equippedSetCounts.get(setId) ?? 0) + 1)
    equippedSetCount += 1
  }

  if (equippedSetCount === 0) {
    return ALL_GEAR_SET_DEFINITIONS.map((set) => set.id)
  }

  const weightedSets = ALL_GEAR_SET_DEFINITIONS.map((set, index) => ({
    set,
    index,
    weight: GEAR_SET_BASE_WEIGHT + Math.round(
      ((equippedSetCounts.get(set.id) ?? 0) / equippedSetCount) *
        GEAR_SET_MATCH_WEIGHT,
    ),
  })).sort((left, right) =>
    right.weight - left.weight || left.index - right.index
  )

  return weightedSets.flatMap(({ set, weight }) =>
    Array.from({ length: weight }, () => set.id)
  )
}

function getStartingWeaponArchetype(
  state: Readonly<GameState>,
): ItemDefinition['weaponArchetype'] | undefined {
  const characterClassId = isCharacterClassId(state.player.characterClassId)
    ? state.player.characterClassId
    : DEFAULT_CHARACTER_CLASS_ID
  const startingWeapon = getItemDefinition(
    getCharacterClassDefinition(characterClassId).startingWeaponItemId,
  )
  return startingWeapon.slot === EquipmentSlot.Weapon
    ? startingWeapon.weaponArchetype
    : undefined
}

function getGearTemplateWeight(
  definition: Readonly<ItemDefinition>,
  startingWeaponArchetype: ItemDefinition['weaponArchetype'] | undefined,
): number {
  return definition.slot === EquipmentSlot.Weapon &&
    definition.weaponArchetype === startingWeaponArchetype
    ? STARTING_WEAPON_TYPE_WEIGHT
    : 1
}

function getGearSlotWeight(
  state: Readonly<GameState>,
  slot: EquipmentSlot,
): number {
  return state.player.equipment?.[slot]
    ? 1
    : EMPTY_SLOT_GEAR_WEIGHT_MULTIPLIER
}

function chooseGearTemplateIndex(
  state: Readonly<GameState>,
  definitions: readonly ItemDefinition[],
  rng: RandomSource,
): number {
  const availableSlots = EQUIPMENT_SLOTS.filter((slot) =>
    definitions.some((definition) => definition.slot === slot)
  )
  const totalSlotWeight = availableSlots.reduce(
    (total, slot) => total + getGearSlotWeight(state, slot),
    0,
  )
  let slotRoll = rng.int(0, totalSlotWeight - 1)
  let selectedSlot = availableSlots[availableSlots.length - 1]
  for (const slot of availableSlots) {
    slotRoll -= getGearSlotWeight(state, slot)
    if (slotRoll < 0) {
      selectedSlot = slot
      break
    }
  }
  const slotDefinitions = definitions.flatMap((definition, index) =>
    definition.slot === selectedSlot ? [{ definition, index }] : []
  )
  const startingWeaponArchetype = getStartingWeaponArchetype(state)
  const totalWeight = slotDefinitions.reduce(
    (total, candidate) =>
      total + getGearTemplateWeight(candidate.definition, startingWeaponArchetype),
    0,
  )
  let roll = rng.int(0, totalWeight - 1)
  for (const candidate of slotDefinitions) {
    roll -= getGearTemplateWeight(candidate.definition, startingWeaponArchetype)
    if (roll < 0) {
      return candidate.index
    }
  }
  return slotDefinitions[slotDefinitions.length - 1]?.index ??
    definitions.length - 1
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
      ? `upgrade:${choice.itemId}:${choice.slot}:${choice.itemRarity}:${choice.rarity}:${choice.setId ?? ''}:${choice.upgradedModifierId}:${choice.fromTier}:${choice.toTier}:${serializeGearModifiers(choice.upgradedModifiers)}`
      : choice.type === 'gear-rarity-floor'
        ? `gear-rarity-floor:${choice.minimumRarity}`
        : 'gear-xp-blessing'
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
  const xpBlessing = choices.filter((choice) => choice.type === 'gear-xp-blessing')
  const rarityBlessing = choices.filter((choice) => choice.type === 'gear-rarity-floor')
  const upgrade = choices.filter((choice) => choice.type === 'upgrade-equipped-item')
  const ordinary = choices.filter((choice) =>
    choice.type !== 'gear-xp-blessing' &&
    choice.type !== 'gear-rarity-floor' &&
    choice.type !== 'upgrade-equipped-item'
  )
  return [...xpBlessing, ...rarityBlessing, ...upgrade, ...ordinary]
}

/**
 * Generates a deterministic, rarity-weighted set of distinct gear templates.
 * When an eligible equipped item exists, one normal offer is replaced by the
 * special upgrade offer for a single lower-tier modifier on that item. Once
 * every equipment slot is rare or better, a separate chance can replace one
 * offer with the XP blessing.
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
  const setChoicePool = getGearSetChoicePool(state, itemDefinitions)
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
      setChoicePool,
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
        itemRarity: target.rarity,
        rarity: Rarity.Uncommon,
        upgradedModifierId: upgrade.upgradedModifierId,
        fromTier: upgrade.fromTier,
        toTier: upgrade.toTier,
        upgradedModifiers: upgrade.upgradedModifiers,
        setId: target.setId,
      }
    }
  }
  const minimumRarity = getEligibleGearRarityFloor(state)
  if (
    minimumRarity &&
    count > 0 &&
    rng.chance(GEAR_RARITY_FLOOR_CHANCE)
  ) {
    const replacementIndex = choices.findIndex((choice) => choice.type === 'gear')
    if (replacementIndex >= 0) {
      choices[replacementIndex] = {
        type: 'gear-rarity-floor',
        minimumRarity,
        rarity: minimumRarity,
      }
    }
  }
  if (
    !state.run.gearXpBlessingActive &&
    count > 0 &&
    hasAllEquippedGearAtLeastRarity(state.player) &&
    rng.chance(GEAR_XP_BLESSING_CHANCE)
  ) {
    const replacementIndex = choices.findIndex((choice) => choice.type === 'gear')
    if (replacementIndex >= 0) {
      choices[replacementIndex] = {
        type: 'gear-xp-blessing',
        rarity: Rarity.Epic,
      }
    }
  }
  return prioritizeSpecialGearChoices(choices)
}

export const generateGearPickupChoices = generateGearChoices
export const generateGearOfferChoices = generateGearChoices
