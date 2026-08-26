/** Shared rarity values used by all content types. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const satisfies readonly Rarity[]

/** Placeholder weights; these are centralized so balance can change safely. */
export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
} as const satisfies Record<Rarity, number>

export const RARITY_ORDER = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
} as const satisfies Record<Rarity, number>

export function nextRarity(rarity: Rarity): Rarity | undefined {
  return RARITIES[RARITY_ORDER[rarity] + 1]
}

export interface RarityVisualMetadata {
  label: string
  color: string
  icon: string
}

export const RARITY_VISUALS = {
  common: { label: 'Common', color: '#d1d5db', icon: '◆' },
  uncommon: { label: 'Uncommon', color: '#4ade80', icon: '◆' },
  rare: { label: 'Rare', color: '#60a5fa', icon: '◆' },
  epic: { label: 'Epic', color: '#c084fc', icon: '◆' },
  legendary: { label: 'Legendary', color: '#fbbf24', icon: '◆' },
} as const satisfies Record<Rarity, RarityVisualMetadata>

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && RARITIES.some((rarity) => rarity === value)
}

export function validateRarityWeights(
  weights: Readonly<Record<string, number>>,
): string[] {
  const errors: string[] = []
  let total = 0
  for (const rarity of RARITIES) {
    const weight = weights[rarity]
    if (!Number.isFinite(weight) || weight < 0) {
      errors.push(`rarityWeights.${rarity} must be a finite non-negative number.`)
    } else {
      total += weight
    }
  }
  if (total <= 0) {
    errors.push('rarityWeights must contain a positive total weight.')
  }
  return errors
}
