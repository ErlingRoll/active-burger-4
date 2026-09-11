import { describe, expect, it } from 'vitest'
import { Rarity } from '../content/rarity/Rarity'
import { resolveAbyssLootBoxRarity } from './LootBoxes'

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
})
