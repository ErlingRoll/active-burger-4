import {
  getItemDefinition,
  INITIAL_ITEMS,
  type EquipmentSlot,
  type ItemDefinition,
  type ItemId,
} from '../../content/gear/Items'
import {
  RARITIES,
  RARITY_WEIGHTS,
  type Rarity,
} from '../../content/rarity/Rarity'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'
import { rollItemUpgradeModifiers } from './EquipmentState'
import type { StatModifier } from '../../content/stats/Stats'

export const GEAR_CHOICES_PER_PICKUP = 3

export interface GearItemChoice {
  type: 'gear'
  itemId: ItemId
  slot: EquipmentSlot
  rarity: Rarity
}

export interface UpgradeEquippedItemChoice {
  type: 'upgrade-equipped-item'
  itemId: ItemId
  slot: EquipmentSlot
  /** This special choice is intentionally always a rare offer. */
  rarity: 'rare'
  fromRarity: 'common' | 'uncommon' | 'rare'
  upgradedRarity: 'uncommon' | 'rare' | 'epic'
  upgradedModifiers: readonly StatModifier[]
}

export type GearChoice = GearItemChoice | UpgradeEquippedItemChoice

function weightedPick(
  items: readonly ItemDefinition[],
  rng: RandomSource,
): ItemDefinition {
  const availableRarities = RARITIES.filter((rarity) =>
    items.some((item) => item.rarity === rarity),
  )
  const totalWeight = availableRarities.reduce(
    (total, rarity) => total + RARITY_WEIGHTS[rarity],
    0,
  )
  let roll = rng.next() * totalWeight
  let selectedRarity = availableRarities[availableRarities.length - 1] as Rarity
  for (const rarity of availableRarities) {
    roll -= RARITY_WEIGHTS[rarity]
    if (roll < 0) {
      selectedRarity = rarity
      break
    }
  }
  const candidates = items.filter((item) => item.rarity === selectedRarity)
  return candidates[rng.int(0, candidates.length - 1)] as ItemDefinition
}

interface EligibleUpgradeTarget {
  itemId: ItemId
  slot: EquipmentSlot
  fromRarity: 'common' | 'uncommon' | 'rare'
  upgradedRarity: 'uncommon' | 'rare' | 'epic'
  modifiers: readonly StatModifier[]
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
    const fromRarity = equipped.rarity ?? definition.rarity
    const upgradedRarity =
      fromRarity === 'common'
        ? 'uncommon'
        : fromRarity === 'uncommon'
          ? 'rare'
          : fromRarity === 'rare'
            ? 'epic'
            : undefined
    if (!upgradedRarity) {
      continue
    }
    choices.push({
      itemId: equipped.itemId,
      slot: slot as EquipmentSlot,
      fromRarity: fromRarity as 'common' | 'uncommon' | 'rare',
      upgradedRarity: upgradedRarity as 'uncommon' | 'rare' | 'epic',
      modifiers: equipped.modifiers ?? definition.modifiers,
    })
  }
  return choices
}

/**
 * Generates a deterministic, rarity-weighted set of distinct catalog items.
 * When an eligible equipped item exists, one normal offer is replaced by the
 * special rare upgrade offer.
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
    const definition = weightedPick(remaining, rng)
    choices.push({
      type: 'gear',
      itemId: definition.id,
      slot: definition.slot,
      rarity: definition.rarity,
    })
    const index = remaining.indexOf(definition)
    remaining.splice(index, 1)
  }

  const upgradeTargets = eligibleUpgradeTargets(state, itemDefinitions)
  if (upgradeTargets.length > 0 && choices.length > 0) {
    const target = rng.pick(upgradeTargets)
    const existingTargetIndex = choices.findIndex(
      (choice) => choice.type === 'gear' && choice.itemId === target.itemId,
    )
    const replacementIndex =
      existingTargetIndex >= 0
        ? existingTargetIndex
        : rng.int(0, choices.length - 1)
    choices[replacementIndex] = {
      ...target,
      type: 'upgrade-equipped-item',
      rarity: 'rare',
      upgradedModifiers: rollItemUpgradeModifiers(target.modifiers, rng),
    }
  }
  return choices
}

export const generateGearPickupChoices = generateGearChoices
export const generateGearOfferChoices = generateGearChoices
