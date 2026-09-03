import { Rarity, type Rarity as RarityValue } from '../content/rarity/Rarity'
import type { InventoryItemDefinitionId } from '../inventory/InventoryTypes'

export interface FishingSpotDefinition {
  id: string
  name: string
  description: string
  baitDefinitionId: InventoryItemDefinitionId
}

export interface FishingCatch {
  definitionId: InventoryItemDefinitionId
  metadata: {
    speciesId: string
    rarity: RarityValue
    sizePercentile: number
  }
}

export const FISHING_SPOTS = {
  'river-bank': {
    id: 'river-bank',
    name: 'Quiet River Bank',
    description: 'A calm stretch of water suitable for basic bait.',
    baitDefinitionId: 'basic-bait',
  },
} as const satisfies Record<string, FishingSpotDefinition>

export const FISH_DEFINITIONS = {
  'river-minnow': {
    id: 'river-minnow',
    name: 'River Minnow',
    rarity: Rarity.Common,
  },
} as const

export const DEFAULT_FISHING_SPOT_ID = 'river-bank'
export const DEFAULT_FISHING_BAIT_ID = 'basic-bait'

function normalizeSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) {
    throw new Error('Fishing seed must be a safe integer.')
  }
  return seed >>> 0
}

export function resolveFishingCatch(seed: number): FishingCatch {
  const normalizedSeed = normalizeSeed(seed)
  return {
    definitionId: 'river-minnow',
    metadata: {
      speciesId: 'river-minnow',
      rarity: Rarity.Common,
      sizePercentile: 0.1 + (normalizedSeed % 8000) / 10000,
    },
  }
}

export function isFishingSpotId(value: unknown): value is string {
  return typeof value === 'string' && value in FISHING_SPOTS
}
