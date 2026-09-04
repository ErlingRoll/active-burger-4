import { RARITY_ORDER, Rarity, isRarity } from '../content/rarity/Rarity'
import type {
  InventoryItemInstance,
} from '../inventory/InventoryTypes'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { getFishDefinition } from './FishingContent'
import {
  RUN_PREPARATION_SCHEMA_VERSION,
  type RunPreparationEffects,
  type RunPreparationItemSnapshot,
  type RunPreparationSnapshot,
} from '../game/RunModes'

export const MAX_FISH_MEAL_ITEMS = 5
export const MAX_FISH_MEAL_EFFECTS: Readonly<Record<string, number>> = {
  'movement-speed': 6,
  'attack-speed': 9,
  'increased-healing': 12,
  'max-hp': 12,
  'attack-damage': 9,
  'cooldown-reduction': 12,
  'physical-resistance': 10,
  'elite-damage': 16,
  'emergency-revive': 1,
}

export interface ResolvedFishMeal {
  preparation: RunPreparationSnapshot
  effects: RunPreparationEffects
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

function getDiminishingMultiplier(previousCount: number): number {
  return 1 / (previousCount + 1)
}

function createEmptyEffects(): RunPreparationEffects {
  return {
    movementSpeedPercent: 0,
    attackSpeedPercent: 0,
    increasedHealingPercent: 0,
    maxHpPercent: 0,
    attackDamagePercent: 0,
    cooldownReductionPercent: 0,
    physicalResistancePercent: 0,
    eliteDamagePercent: 0,
    emergencyRevivePercent: 0,
  }
}

function applyFishEffect(
  effects: RunPreparationEffects,
  family: keyof typeof MAX_FISH_MEAL_EFFECTS,
  value: number,
): void {
  switch (family) {
    case 'movement-speed':
      effects.movementSpeedPercent += value
      return
    case 'attack-speed':
      effects.attackSpeedPercent += value
      return
    case 'increased-healing':
      effects.increasedHealingPercent += value
      return
    case 'max-hp':
      effects.maxHpPercent += value
      return
    case 'attack-damage':
      effects.attackDamagePercent += value
      return
    case 'cooldown-reduction':
      effects.cooldownReductionPercent += value
      return
    case 'physical-resistance':
      effects.physicalResistancePercent += value
      return
    case 'elite-damage':
      effects.eliteDamagePercent += value
      return
    case 'emergency-revive':
      effects.emergencyRevivePercent = Math.max(effects.emergencyRevivePercent, value)
      return
  }
}

function createResolvedEffect(
  family: keyof typeof MAX_FISH_MEAL_EFFECTS,
  value: number,
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    type: 'fish-meal',
    family,
  }
  const effectKey = {
    'movement-speed': 'movementSpeedPercent',
    'attack-speed': 'attackSpeedPercent',
    'increased-healing': 'increasedHealingPercent',
    'max-hp': 'maxHpPercent',
    'attack-damage': 'attackDamagePercent',
    'cooldown-reduction': 'cooldownReductionPercent',
    'physical-resistance': 'physicalResistancePercent',
    'elite-damage': 'eliteDamagePercent',
    'emergency-revive': 'emergencyRevivePercent',
  }[family]
  if (effectKey) {
    values[effectKey] = value
  }
  return values
}

export function resolveFishMeal(
  selectedFish: readonly InventoryItemInstance[],
): ResolvedFishMeal {
  if (selectedFish.length > MAX_FISH_MEAL_ITEMS) {
    throw new Error(`A fish meal can contain at most ${MAX_FISH_MEAL_ITEMS} fish.`)
  }
  const ids = new Set<string>()
  const effects = createEmptyEffects()
  const familyCounts = new Map<string, number>()
  const items: RunPreparationItemSnapshot[] = []
  selectedFish.forEach((fish) => {
    if (ids.has(fish.itemInstanceId)) {
      throw new Error('A fish cannot be selected more than once in a meal.')
    }
    ids.add(fish.itemInstanceId)
    if (getInventoryItemDefinition(fish.definitionId)?.category !== 'fish') {
      throw new Error('Only fish can be selected for a meal.')
    }
    const definition = getFishDefinition(fish.definitionId)
    if (!definition) {
      throw new Error(`Unknown fish definition: ${fish.definitionId}.`)
    }
    if (!definition.effect.runMealEligible) {
      throw new Error(`${definition.name} is reserved for Champion recovery.`)
    }
    const family = definition.effect.family
    const previousCount = familyCounts.get(family) ?? 0
    const contribution = definition.effect.baseValue *
      getFishRarityFactor(fish) *
      (0.75 + getFishSize(fish) * 0.5) *
      getDiminishingMultiplier(previousCount)
    const appliedContribution = Math.min(
      Math.max(0, MAX_FISH_MEAL_EFFECTS[family] ?? contribution),
      Math.max(0, contribution),
    )
    familyCounts.set(family, previousCount + 1)
    applyFishEffect(effects, family, appliedContribution)
    items.push({
      itemInstanceId: fish.itemInstanceId,
      definitionId: fish.definitionId,
      quantity: 1,
      resolvedEffect: createResolvedEffect(family, appliedContribution),
    })
  })
  return {
    preparation: {
      version: RUN_PREPARATION_SCHEMA_VERSION,
      items,
    },
    effects,
    movementSpeedPercent: effects.movementSpeedPercent,
  }
}

export function getFishMealLabel(movementSpeedPercent: number): string {
  return movementSpeedPercent > 0
    ? `+${movementSpeedPercent.toFixed(1)}% movement speed`
    : 'No meal effect'
}

export function getFishMealEffectSummary(effects: RunPreparationEffects): string {
  const effectSummaries: Array<readonly [string, number]> = [
    ['movement speed', effects.movementSpeedPercent],
    ['attack speed', effects.attackSpeedPercent],
    ['healing received', effects.increasedHealingPercent],
    ['maximum health', effects.maxHpPercent],
    ['attack damage', effects.attackDamagePercent],
    ['skill cooldown recovery', effects.cooldownReductionPercent],
    ['physical resistance', effects.physicalResistancePercent],
    ['elite/boss damage', effects.eliteDamagePercent],
  ]
  const result = effectSummaries
    .filter(([, value]) => value > 0)
    .map(([label, value]) => `+${value.toFixed(1)}% ${label}`)
  if (effects.emergencyRevivePercent > 0) {
    result.push('Astral Grace armed')
  }
  return result.length > 0 ? result.join(' · ') : 'No meal effect'
}

export const DEFAULT_EMPTY_FISH_MEAL: ResolvedFishMeal = {
  preparation: {
    version: RUN_PREPARATION_SCHEMA_VERSION,
    items: [],
  },
  effects: createEmptyEffects(),
  movementSpeedPercent: 0,
}

export const DEFAULT_FISH_RARITY = Rarity.Common
