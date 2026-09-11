import { getFishingEnchantmentDefinition, type FishingEnchantmentId } from '../fishing/FishingContent'
import type { Rarity } from '../content/rarity/Rarity'

/**
 * What the Smokehouse does to a fish, mirrored from the server so the picker
 * can say what a choice is worth before it is made. `gut_fish_at_smokehouse`
 * and `cure_fish_at_smokehouse` re-read the fish and decide for themselves.
 */

/** Roe for a gutted fish: its rarity, scaled by size the way its meal effect is. */
export function roeForFish(rarity: Rarity | undefined, sizePercentile: unknown): number {
  const base = { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8 }[rarity ?? 'common']
  const size = typeof sizePercentile === 'number' && Number.isFinite(sizePercentile)
    ? Math.min(1, Math.max(0, sizePercentile))
    : 0.5
  return Math.ceil(base * (0.75 + size * 0.5))
}

export interface CureStep {
  enchantmentId: FishingEnchantmentId
  roeCost: number
}

const CURE_LADDER: readonly { from: FishingEnchantmentId | null, to: CureStep }[] = [
  { from: null, to: { enchantmentId: 'bright-scales', roeCost: 3 } },
  { from: 'bright-scales', to: { enchantmentId: 'deep-current', roeCost: 8 } },
  { from: 'deep-current', to: { enchantmentId: 'astral-mark', roeCost: 16 } },
]

/** The tier curing would raise a fish to, or null at the top. */
export function nextCureStep(metadata: Record<string, unknown>): CureStep | null {
  const current = getFishingEnchantmentDefinition(metadata.enchantmentId)?.id ?? null
  return CURE_LADDER.find((step) => step.from === current)?.to ?? null
}
