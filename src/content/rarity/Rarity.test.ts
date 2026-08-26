import { describe, expect, it } from 'vitest'
import {
  RARITY_VISUALS,
  RARITY_WEIGHTS,
  validateRarityWeights,
} from './Rarity'

describe('rarity content data', () => {
  it('provides complete centralized weights and visual metadata', () => {
    expect(validateRarityWeights(RARITY_WEIGHTS)).toEqual([])
    expect(Object.keys(RARITY_VISUALS)).toHaveLength(5)
  })

  it('rejects negative, non-finite, and all-zero weights', () => {
    expect(validateRarityWeights({
      common: 0,
      uncommon: -1,
      rare: Number.NaN,
      epic: 0,
      legendary: 0,
    })).toEqual(expect.arrayContaining([
      'rarityWeights.uncommon must be a finite non-negative number.',
      'rarityWeights.rare must be a finite non-negative number.',
      'rarityWeights must contain a positive total weight.',
    ]))
  })
})
