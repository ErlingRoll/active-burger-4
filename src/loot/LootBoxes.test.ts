import { describe, expect, it } from 'vitest'
import { RARITIES, Rarity } from '../content/rarity/Rarity'
import { getAbyssLootBoxRarityChances, resolveAbyssLootBoxRarity } from './LootBoxes'

describe('LootBoxes', () => {
  it('resolves deterministically for the same floor and danger score', () => {
    expect(resolveAbyssLootBoxRarity(42, 20, 4))
      .toBe(resolveAbyssLootBoxRarity(42, 20, 4))
  })

  it('never exceeds the floor-100 rarity curve after floor 100', () => {
    expect(resolveAbyssLootBoxRarity(42, 100, 20))
      .toBe(resolveAbyssLootBoxRarity(42, 1000, 20))
  })

  it('can resolve high rarity boxes at high floors', () => {
    const rarities = new Set(
      Array.from({ length: 10000 }, (_, seed) =>
        resolveAbyssLootBoxRarity(seed, 100, 0),
      ),
    )
    expect(rarities.has(Rarity.Epic)).toBe(true)
    expect(rarities.has(Rarity.Legendary)).toBe(true)
  })

  it('guarantees at least an epic box on every 10th floor, even early on', () => {
    for (const floor of [10, 20, 30]) {
      for (let seed = 0; seed < 200; seed++) {
        const rarity = resolveAbyssLootBoxRarity(seed, floor, 0)
        expect([Rarity.Epic, Rarity.Legendary]).toContain(rarity)
      }
    }
  })

  it('gives a milestone epic box roughly a 5% chance of being legendary', () => {
    const sampleSize = 20000
    let legendaryCount = 0
    for (let seed = 0; seed < sampleSize; seed++) {
      if (resolveAbyssLootBoxRarity(seed, 10, 0) === Rarity.Legendary) {
        legendaryCount++
      }
    }
    const rate = legendaryCount / sampleSize
    expect(rate).toBeGreaterThan(0.03)
    expect(rate).toBeLessThan(0.07)
  })

  it('does not guarantee epic on non-milestone floors', () => {
    const rarities = new Set(
      Array.from({ length: 200 }, (_, seed) => resolveAbyssLootBoxRarity(seed, 9, 0)),
    )
    expect(rarities.has(Rarity.Common)).toBe(true)
  })

  describe('getAbyssLootBoxRarityChances', () => {
    it('sums to one on every floor', () => {
      for (const floor of [1, 7, 10, 50, 99, 100, 250]) {
        const chances = getAbyssLootBoxRarityChances(floor)
        const total = RARITIES.reduce((sum, rarity) => sum + chances[rarity], 0)
        expect(total).toBeCloseTo(1, 12)
      }
    })

    it('matches what the resolver actually rolls', () => {
      /*
       * Ten thousand consecutive seeds cover every residue of the roll exactly
       * once on a floor whose mixing offset is far from the 32-bit wrap, so the
       * frequency of each rarity is the chance table to the digit. Milestone
       * floors roll differently and are covered below.
       */
      for (const floor of [1, 42, 99]) {
        const counts: Record<string, number> = {}
        for (let seed = 0; seed < 10000; seed += 1) {
          const rarity = resolveAbyssLootBoxRarity(seed, floor, 3)
          counts[rarity] = (counts[rarity] ?? 0) + 1
        }
        const chances = getAbyssLootBoxRarityChances(floor)
        for (const rarity of RARITIES) {
          expect((counts[rarity] ?? 0) / 10000).toBeCloseTo(chances[rarity], 12)
        }
      }
    })

    it('promises at least an epic box on every 10th floor', () => {
      for (const floor of [10, 20, 100, 110]) {
        const chances = getAbyssLootBoxRarityChances(floor)
        expect(chances[Rarity.Common]).toBe(0)
        expect(chances[Rarity.Uncommon]).toBe(0)
        expect(chances[Rarity.Rare]).toBe(0)
        expect(chances[Rarity.Epic]).toBeCloseTo(0.95, 12)
        expect(chances[Rarity.Legendary]).toBeCloseTo(0.05, 12)
      }
      // The milestone roll is mixed once more, so it is checked by sampling.
      const sampleSize = 20000
      let legendaryCount = 0
      for (let seed = 0; seed < sampleSize; seed += 1) {
        if (resolveAbyssLootBoxRarity(seed, 20, 0) === Rarity.Legendary) {
          legendaryCount += 1
        }
      }
      expect(legendaryCount / sampleSize).toBeCloseTo(
        getAbyssLootBoxRarityChances(20)[Rarity.Legendary],
        1,
      )
    })

    it('improves with depth and stops improving after floor 100', () => {
      const first = getAbyssLootBoxRarityChances(1)
      const deep = getAbyssLootBoxRarityChances(65)
      expect(deep[Rarity.Common]).toBeLessThan(first[Rarity.Common])
      expect(deep[Rarity.Legendary]).toBeGreaterThan(first[Rarity.Legendary])
      expect(getAbyssLootBoxRarityChances(101)).toEqual(getAbyssLootBoxRarityChances(1001))
    })

    it('treats anything below the first floor as the first floor', () => {
      expect(getAbyssLootBoxRarityChances(0)).toEqual(getAbyssLootBoxRarityChances(1))
    })
  })
})
