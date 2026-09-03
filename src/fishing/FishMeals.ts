import { RARITY_ORDER, Rarity, isRarity } from '../content/rarity/Rarity'
import type {
  InventoryItemInstance,
} from '../inventory/InventoryTypes'
import {
  getInventoryItemDefinition,
} from '../inventory/ItemDefinitions'
import {
  RUN_PREPARATION_SCHEMA_VERSION,
  type RunPreparationItemSnapshot,
  type RunPreparationSnapshot,
} from '../game/RunModes'

export const MAX_FISH_MEAL_ITEMS = 5
export const MAX_FISH_MEAL_MOVEMENT_SPEED_PERCENT = 6

export interface ResolvedFishMeal {
  preparation: RunPreparationSnapshot
  movementSpeedPercent: number
}

function getFishSize(item: InventoryItemInstance): number {
  const size = item.metadata.sizePercentile
  return typeof size === 'number' && Number.isFinite(size)
    ? Math.min(1, Math.max(0, size))
    : 0.5
}

function getFishRarityFactor(item: InventoryItemInstance): number {
  const rarity = item.metadata.rarity
  if (!isRarity(rarity)) {
    return 1
  }
  return 1 + RARITY_ORDER[rarity] * 0.25
}

function resolveFishValue(item: InventoryItemInstance): number {
  if (item.definitionId === 'river-minnow') {
    return 2 * getFishRarityFactor(item) * (0.75 + getFishSize(item) * 0.5)
  }
  return 0
}

export function resolveFishMeal(
  selectedFish: readonly InventoryItemInstance[],
): ResolvedFishMeal {
  if (selectedFish.length > MAX_FISH_MEAL_ITEMS) {
    throw new Error(`A fish meal can contain at most ${MAX_FISH_MEAL_ITEMS} fish.`)
  }
  const ids = new Set<string>()
  let movementSpeedPercent = 0
  const items: RunPreparationItemSnapshot[] = []
  selectedFish.forEach((fish, index) => {
    if (ids.has(fish.itemInstanceId)) {
      throw new Error('A fish cannot be selected more than once in a meal.')
    }
    ids.add(fish.itemInstanceId)
    if (getInventoryItemDefinition(fish.definitionId)?.category !== 'fish') {
      throw new Error('Only fish can be selected for a meal.')
    }
    const contribution = resolveFishValue(fish) / (index + 1)
    const appliedContribution = Math.max(0, contribution)
    movementSpeedPercent = Math.min(
      MAX_FISH_MEAL_MOVEMENT_SPEED_PERCENT,
      movementSpeedPercent + appliedContribution,
    )
    items.push({
      itemInstanceId: fish.itemInstanceId,
      definitionId: fish.definitionId,
      quantity: 1,
      resolvedEffect: {
        type: 'fish-meal',
        family: 'movement-speed',
        movementSpeedPercent: appliedContribution,
      },
    })
  })
  return {
    preparation: {
      version: RUN_PREPARATION_SCHEMA_VERSION,
      items,
    },
    movementSpeedPercent,
  }
}

export function getFishMealLabel(movementSpeedPercent: number): string {
  return movementSpeedPercent > 0
    ? `+${movementSpeedPercent.toFixed(1)}% movement speed`
    : 'No meal effect'
}

export const DEFAULT_EMPTY_FISH_MEAL: ResolvedFishMeal = {
  preparation: {
    version: RUN_PREPARATION_SCHEMA_VERSION,
    items: [],
  },
  movementSpeedPercent: 0,
}

export const DEFAULT_FISH_RARITY = Rarity.Common
