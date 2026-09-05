import { Rarity, type Rarity as RarityValue } from '../content/rarity/Rarity'
import type { InventoryItemDefinitionId } from '../inventory/InventoryTypes'
import type { FishIconId } from './FishIcon'

export type FishingMode = 'auto' | 'manual'

export const FISHING_MODES = {
  auto: {
    id: 'auto',
    name: 'Auto fish',
    description: 'Let the pond resolve the catch automatically.',
  },
  manual: {
    id: 'manual',
    name: 'Manual reel',
    description: 'Reel in the moment for improved catch quality.',
  },
} as const satisfies Record<FishingMode, {
  id: FishingMode
  name: string
  description: string
}>

export function isFishingMode(value: unknown): value is FishingMode {
  return typeof value === 'string' && value in FISHING_MODES
}

export interface FishingBaitDefinition {
  id: InventoryItemDefinitionId
  name: string
  description: string
  unlimited: boolean
  rarityBonusPercent: number
  sizeBonusPercent: number
  lootBoxChancePercent: number
}

export const FISHING_BAITS = {
  'basic-bait': {
    id: 'basic-bait',
    name: 'Basic Bait',
    description: 'Unlimited bait for common river fish.',
    unlimited: true,
    rarityBonusPercent: 0,
    sizeBonusPercent: 0,
    lootBoxChancePercent: 0,
  },
  'river-worm': {
    id: 'river-worm',
    name: 'River Worm',
    description: 'Improves the chance of uncommon and rare fish.',
    unlimited: false,
    rarityBonusPercent: 10,
    sizeBonusPercent: 0,
    lootBoxChancePercent: 0,
  },
  'glow-grub': {
    id: 'glow-grub',
    name: 'Glow Grub',
    description: 'Draws larger fish and slightly improves loot-box finds.',
    unlimited: false,
    rarityBonusPercent: 18,
    sizeBonusPercent: 5,
    lootBoxChancePercent: 1,
  },
  'moonwater-lure': {
    id: 'moonwater-lure',
    name: 'Moonwater Lure',
    description: 'A premium lure for high-rarity, high-quality catches.',
    unlimited: false,
    rarityBonusPercent: 26,
    sizeBonusPercent: 10,
    lootBoxChancePercent: 2,
  },
} as const satisfies Record<string, FishingBaitDefinition>

export type FishingRodModifierId =
  | 'rarity'
  | 'speed'
  | 'bait-retention'
  | 'loot-box'
  | 'enchantment'

export interface FishingRodModifierDefinition {
  id: FishingRodModifierId
  label: string
  description: string
}

export const FISHING_ROD_MODIFIERS = {
  rarity: {
    id: 'rarity',
    label: 'Fortune',
    description: 'Improves the chance of higher-rarity fish.',
  },
  speed: {
    id: 'speed',
    label: 'Quick Line',
    description: 'Reduces the time before the float can be resolved.',
  },
  'bait-retention': {
    id: 'bait-retention',
    label: 'Bait Keeper',
    description: 'Can preserve non-unlimited bait after a catch.',
  },
  'loot-box': {
    id: 'loot-box',
    label: 'Treasure Sense',
    description: 'Improves the chance of finding a fishing loot box.',
  },
  enchantment: {
    id: 'enchantment',
    label: 'Enchanter',
    description: 'Improves the chance of an enchanted catch.',
  },
} as const satisfies Record<FishingRodModifierId, FishingRodModifierDefinition>

export const FISHING_ROD_MODIFIER_COUNT_BY_RARITY = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
} as const satisfies Record<RarityValue, number>

function isFishingRodModifierId(value: unknown): value is FishingRodModifierId {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(FISHING_ROD_MODIFIERS, value)
}

export function formatFishingRodModifiers(metadata: Record<string, unknown>): string {
  if (!Array.isArray(metadata.modifierIds)) {
    return 'No modifiers'
  }
  const labels = metadata.modifierIds
    .filter(isFishingRodModifierId)
    .map((modifierId) => FISHING_ROD_MODIFIERS[modifierId].label)
  return labels.length > 0 ? labels.join(', ') : 'No modifiers'
}

export interface FishingCatch {
  definitionId: InventoryItemDefinitionId
  metadata: {
    speciesId: string
    rarity: RarityValue
    sizePercentile: number
    enchantmentId?: string
    enchantmentValue?: number
  }
}

export type FishEffectFamily =
  | 'movement-speed'
  | 'attack-speed'
  | 'increased-healing'
  | 'max-hp'
  | 'attack-damage'
  | 'cooldown-reduction'
  | 'physical-resistance'
  | 'elite-damage'
  | 'emergency-revive'
  | 'abyss-exhaustion'

export interface FishDefinition {
  id: InventoryItemDefinitionId
  name: string
  rarity: RarityValue
  weightRangeKg: {
    min: number
    max: number
  }
  effect: {
    family: FishEffectFamily
    label: string
    description: string
    baseValue: number
    runMealEligible: boolean
  }
  visual: {
    icon: FishIconId
    accent: string
    glow: string
  }
}

export const FISH_DEFINITIONS = {
  'river-minnow': {
    id: 'river-minnow',
    name: 'River Minnow',
    rarity: Rarity.Common,
    weightRangeKg: { min: 0.02, max: 0.18 },
    effect: {
      family: 'movement-speed',
      label: 'Swift Current',
      description: '+2% movement speed',
      baseValue: 2,
      runMealEligible: true,
    },
    visual: { icon: 'river-minnow', accent: '#67e8f9', glow: '#0891b2' },
  },
  'reed-darter': {
    id: 'reed-darter',
    name: 'Reed Darter',
    rarity: Rarity.Common,
    weightRangeKg: { min: 0.08, max: 0.45 },
    effect: {
      family: 'attack-speed',
      label: 'Quick Fins',
      description: '+3% attack speed',
      baseValue: 3,
      runMealEligible: true,
    },
    visual: { icon: 'reed-darter', accent: '#86efac', glow: '#15803d' },
  },
  'glassfin-trout': {
    id: 'glassfin-trout',
    name: 'Glassfin Trout',
    rarity: Rarity.Common,
    weightRangeKg: { min: 0.25, max: 2.5 },
    effect: {
      family: 'increased-healing',
      label: 'Clearwater',
      description: '+5% healing received',
      baseValue: 5,
      runMealEligible: true,
    },
    visual: { icon: 'glassfin-trout', accent: '#bae6fd', glow: '#0284c7' },
  },
  'silver-perch': {
    id: 'silver-perch',
    name: 'Silver Perch',
    rarity: Rarity.Uncommon,
    weightRangeKg: { min: 0.4, max: 3.2 },
    effect: {
      family: 'max-hp',
      label: 'Steady Scales',
      description: '+4% maximum health',
      baseValue: 4,
      runMealEligible: true,
    },
    visual: { icon: 'silver-perch', accent: '#d1d5db', glow: '#64748b' },
  },
  'lantern-pike': {
    id: 'lantern-pike',
    name: 'Lantern Pike',
    rarity: Rarity.Uncommon,
    weightRangeKg: { min: 1.5, max: 8 },
    effect: {
      family: 'attack-damage',
      label: 'Ambush Predator',
      description: '+3% attack damage',
      baseValue: 3,
      runMealEligible: true,
    },
    visual: { icon: 'lantern-pike', accent: '#fde68a', glow: '#d97706' },
  },
  'moon-carp': {
    id: 'moon-carp',
    name: 'Moon Carp',
    rarity: Rarity.Rare,
    weightRangeKg: { min: 2, max: 14 },
    effect: {
      family: 'cooldown-reduction',
      label: 'Moonlit Focus',
      description: '+5% skill cooldown recovery',
      baseValue: 5,
      runMealEligible: true,
    },
    visual: { icon: 'moon-carp', accent: '#c4b5fd', glow: '#7c3aed' },
  },
  'tideback-catfish': {
    id: 'tideback-catfish',
    name: 'Tideback Catfish',
    rarity: Rarity.Rare,
    weightRangeKg: { min: 3, max: 18 },
    effect: {
      family: 'physical-resistance',
      label: 'Heavy Scales',
      description: '+4% physical resistance',
      baseValue: 4,
      runMealEligible: true,
    },
    visual: { icon: 'tideback-catfish', accent: '#f0abfc', glow: '#a21caf' },
  },
  'revival-koi': {
    id: 'revival-koi',
    name: 'Revival Koi',
    rarity: Rarity.Epic,
    weightRangeKg: { min: 1, max: 7 },
    effect: {
      family: 'abyss-exhaustion',
      label: 'Second Breath',
      description: 'Reduces Champion Abyss exhaustion by up to 4 hours',
      baseValue: 4,
      runMealEligible: false,
    },
    visual: { icon: 'revival-koi', accent: '#fb7185', glow: '#be123c' },
  },
  'comet-eel': {
    id: 'comet-eel',
    name: 'Comet Eel',
    rarity: Rarity.Epic,
    weightRangeKg: { min: 0.8, max: 9 },
    effect: {
      family: 'elite-damage',
      label: 'Abyss Current',
      description: '+8% damage against elite and boss enemies',
      baseValue: 8,
      runMealEligible: true,
    },
    visual: { icon: 'comet-eel', accent: '#f0abfc', glow: '#c026d3' },
  },
  'star-koi': {
    id: 'star-koi',
    name: 'Star Koi',
    rarity: Rarity.Legendary,
    weightRangeKg: { min: 4, max: 24 },
    effect: {
      family: 'emergency-revive',
      label: 'Astral Grace',
      description: 'Prevents the first lethal hit and leaves you at 20% health',
      baseValue: 20,
      runMealEligible: true,
    },
    visual: { icon: 'star-koi', accent: '#fef08a', glow: '#ca8a04' },
  },
} as const satisfies Record<string, FishDefinition>

export const FISH_DROP_TABLE = [
  { definitionId: 'river-minnow', baseDropChance: 29 },
  { definitionId: 'reed-darter', baseDropChance: 15 },
  { definitionId: 'glassfin-trout', baseDropChance: 12 },
  { definitionId: 'silver-perch', baseDropChance: 10 },
  { definitionId: 'lantern-pike', baseDropChance: 9 },
  { definitionId: 'moon-carp', baseDropChance: 8 },
  { definitionId: 'tideback-catfish', baseDropChance: 6 },
  { definitionId: 'revival-koi', baseDropChance: 5 },
  { definitionId: 'comet-eel', baseDropChance: 4 },
  { definitionId: 'star-koi', baseDropChance: 2 },
] as const satisfies readonly {
  definitionId: InventoryItemDefinitionId
  baseDropChance: number
}[]

export const DEFAULT_FISHING_BAIT_ID = 'basic-bait'

export function getFishingBaitDefinition(
  baitDefinitionId: string,
): FishingBaitDefinition | undefined {
  return FISHING_BAITS[baitDefinitionId as keyof typeof FISHING_BAITS]
}

export function formatFishingBaitEffect(
  baitDefinitionId: string,
): string {
  const bait = getFishingBaitDefinition(baitDefinitionId)
  if (!bait || bait.id === DEFAULT_FISHING_BAIT_ID) {
    return 'Unlimited · common fish'
  }

  return [
    `rarity +${bait.rarityBonusPercent}%`,
    `size +${bait.sizeBonusPercent}%`,
    bait.lootBoxChancePercent > 0 ? `loot boxes +${bait.lootBoxChancePercent}%` : null,
  ].filter((value): value is string => value !== null).join(' · ')
}

export type FishingEnchantmentId = 'bright-scales' | 'deep-current' | 'astral-mark'

export interface FishingEnchantmentDefinition {
  id: FishingEnchantmentId
  name: string
  description: string
  effectBonusPercent: number
}

export const FISHING_ENCHANTMENTS = {
  'bright-scales': {
    id: 'bright-scales',
    name: 'Bright Scales',
    description: 'Increases this fish meal effect by 15%.',
    effectBonusPercent: 15,
  },
  'deep-current': {
    id: 'deep-current',
    name: 'Deep Current',
    description: 'Increases this fish meal effect by 25%.',
    effectBonusPercent: 25,
  },
  'astral-mark': {
    id: 'astral-mark',
    name: 'Astral Mark',
    description: 'Increases this fish meal effect by 40%.',
    effectBonusPercent: 40,
  },
} as const satisfies Record<FishingEnchantmentId, FishingEnchantmentDefinition>

export function getFishingEnchantmentDefinition(
  enchantmentId: unknown,
): FishingEnchantmentDefinition | undefined {
  return typeof enchantmentId === 'string' &&
    Object.prototype.hasOwnProperty.call(FISHING_ENCHANTMENTS, enchantmentId)
    ? FISHING_ENCHANTMENTS[enchantmentId as FishingEnchantmentId]
    : undefined
}

export function formatFishingEnchantment(
  metadata: Record<string, unknown>,
): string | null {
  const enchantment = getFishingEnchantmentDefinition(metadata.enchantmentId)
  return enchantment
    ? `${enchantment.name} · +${enchantment.effectBonusPercent}% meal effect`
    : null
}

export function formatFishingSalvageValue(
  definitionId: string,
  metadata: Record<string, unknown>,
): string {
  const fish = getFishDefinition(definitionId)
  const size = metadata.sizePercentile
  if (!fish || typeof size !== 'number' || !Number.isFinite(size) || size < 0 || size > 1) {
    return 'Salvage value unavailable'
  }
  const baseValue = {
    common: 2,
    uncommon: 5,
    rare: 10,
    epic: 20,
    legendary: 40,
  }[fish.rarity]
  const enchantment = getFishingEnchantmentDefinition(metadata.enchantmentId)
  const enchantmentFactor = enchantment
    ? 1 + enchantment.effectBonusPercent / 100
    : 1
  const essence = Math.floor(baseValue * (0.5 + size) * enchantmentFactor)
  return `Salvage value: ${essence} Essence`
}

export function formatFishingFishDetail(
  definitionId: string,
  metadata: Record<string, unknown>,
): string {
  const fish = getFishDefinition(definitionId)
  return `Weight: ${formatFishSizeKg(metadata.sizePercentile, fish?.weightRangeKg)} · ${formatFishingSalvageValue(
    definitionId,
    metadata,
  )}`
}

export function getFishDefinition(definitionId: string): FishDefinition | undefined {
  return FISH_DEFINITIONS[definitionId as keyof typeof FISH_DEFINITIONS]
}

export function formatFishSizeKg(
  value: unknown,
  weightRange?: FishDefinition['weightRangeKg'],
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unknown'
  }
  const normalizedSize = Math.min(1, Math.max(0, value))
  const weight = weightRange
    ? weightRange.min + (weightRange.max - weightRange.min) * normalizedSize
    : normalizedSize
  return `${weight.toFixed(2)} kg`
}

export interface FishingCatchOptions {
  mode?: FishingMode
  manualSuccess?: boolean
  baitDefinitionId?: string
}

function normalizeSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) {
    throw new Error('Fishing seed must be a safe integer.')
  }
  return seed >>> 0
}

export function resolveFishingCatch(
  seed: number,
  options: FishingCatchOptions = {},
): FishingCatch {
  const normalizedSeed = normalizeSeed(seed)
  const manualBonus = options.mode === 'manual' && options.manualSuccess ? 15 : 0
  const baitBonus = getFishingBaitDefinition(options.baitDefinitionId ?? DEFAULT_FISHING_BAIT_ID)
  const roll = Math.min(
    99.99,
    (normalizedSeed % 10000) / 100 +
      manualBonus +
      (baitBonus?.rarityBonusPercent ?? 0),
  )
  let cumulativeChance = 0
  let selectedFishId = FISH_DROP_TABLE[FISH_DROP_TABLE.length - 1].definitionId
  for (const entry of FISH_DROP_TABLE) {
    cumulativeChance += entry.baseDropChance
    if (roll < cumulativeChance) {
      selectedFishId = entry.definitionId
      break
    }
  }
  const selectedFish = getFishDefinition(selectedFishId)
  if (!selectedFish) {
    throw new Error(`Unknown fishing table entry: ${selectedFishId}.`)
  }
  const sizeBonus =
    (options.mode === 'manual' && options.manualSuccess ? 0.05 : 0) +
    (baitBonus?.sizeBonusPercent ?? 0) / 100
  return {
    definitionId: selectedFish.id,
    metadata: {
      speciesId: selectedFish.id,
      rarity: selectedFish.rarity,
      sizePercentile: Math.min(0.99, 0.1 + (normalizedSeed % 8000) / 10000 + sizeBonus),
    },
  }
}
