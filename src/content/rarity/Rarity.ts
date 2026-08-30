/** Shared rarity values used by all content types. */
export const Rarity = {
  Common: 'common',
  Uncommon: 'uncommon',
  Rare: 'rare',
  Epic: 'epic',
  Legendary: 'legendary',
} as const

export type Rarity = typeof Rarity[keyof typeof Rarity]

export const RARITIES = [
  Rarity.Common,
  Rarity.Uncommon,
  Rarity.Rare,
  Rarity.Epic,
  Rarity.Legendary,
] as const satisfies readonly Rarity[]

/** Placeholder weights; these are centralized so balance can change safely. */
export const RARITY_WEIGHTS = {
  [Rarity.Common]: 60,
  [Rarity.Uncommon]: 25,
  [Rarity.Rare]: 10,
  [Rarity.Epic]: 4,
  [Rarity.Legendary]: 1,
} as const satisfies Record<Rarity, number>

export const RARITY_ORDER = {
  [Rarity.Common]: 0,
  [Rarity.Uncommon]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Epic]: 3,
  [Rarity.Legendary]: 4,
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
  [Rarity.Common]: { label: 'Common', color: '#d1d5db', icon: '◆' },
  [Rarity.Uncommon]: { label: 'Uncommon', color: '#4ade80', icon: '◆' },
  [Rarity.Rare]: { label: 'Rare', color: '#60a5fa', icon: '◆' },
  [Rarity.Epic]: { label: 'Epic', color: '#c084fc', icon: '◆' },
  [Rarity.Legendary]: { label: 'Legendary', color: '#fbbf24', icon: '◆' },
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
