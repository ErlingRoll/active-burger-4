import { Rarity, type Rarity as RarityValue } from '../content/rarity/Rarity'
import type { InventoryItemDefinitionId } from '../inventory/InventoryTypes'

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
}

export const FISHING_BAITS = {
  'basic-bait': {
    id: 'basic-bait',
    name: 'Basic Bait',
    description: 'Unlimited bait for common river fish.',
    unlimited: true,
  },
  'river-worm': {
    id: 'river-worm',
    name: 'River Worm',
    description: 'Improves the chance of uncommon and rare fish.',
    unlimited: false,
  },
} as const satisfies Record<string, FishingBaitDefinition>

export type FishingRodModifierId =
  | 'rarity'
  | 'speed'
  | 'bait-retention'
  | 'loot-box'
  | 'enchantment'

export interface FishingCatch {
  definitionId: InventoryItemDefinitionId
  metadata: {
    speciesId: string
    rarity: RarityValue
    sizePercentile: number
  }
}

export const FISH_DEFINITIONS = {
  'river-minnow': {
    id: 'river-minnow',
    name: 'River Minnow',
    rarity: Rarity.Common,
  },
  'silver-perch': {
    id: 'silver-perch',
    name: 'Silver Perch',
    rarity: Rarity.Uncommon,
  },
  'moon-carp': {
    id: 'moon-carp',
    name: 'Moon Carp',
    rarity: Rarity.Rare,
  },
  'revival-koi': {
    id: 'revival-koi',
    name: 'Revival Koi',
    rarity: Rarity.Epic,
  },
  'star-koi': {
    id: 'star-koi',
    name: 'Star Koi',
    rarity: Rarity.Legendary,
  },
} as const

const SPECIES_BY_RARITY: Record<RarityValue, InventoryItemDefinitionId> = {
  [Rarity.Common]: 'river-minnow',
  [Rarity.Uncommon]: 'silver-perch',
  [Rarity.Rare]: 'moon-carp',
  [Rarity.Epic]: 'revival-koi',
  [Rarity.Legendary]: 'star-koi',
}

export const DEFAULT_FISHING_BAIT_ID = 'basic-bait'

export interface FishingCatchOptions {
  mode?: FishingMode
  manualSuccess?: boolean
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
  const rarityRoll = Math.max(0, normalizedSeed % 100 - manualBonus)
  const rarity = rarityRoll < 60
    ? Rarity.Common
    : rarityRoll < 85
      ? Rarity.Uncommon
      : rarityRoll < 96
        ? Rarity.Rare
        : rarityRoll < 99
          ? Rarity.Epic
          : Rarity.Legendary
  const sizeBonus = options.mode === 'manual' && options.manualSuccess ? 0.05 : 0
  return {
    definitionId: SPECIES_BY_RARITY[rarity],
    metadata: {
      speciesId: SPECIES_BY_RARITY[rarity],
      rarity,
      sizePercentile: Math.min(0.99, 0.1 + (normalizedSeed % 8000) / 10000 + sizeBonus),
    },
  }
}
