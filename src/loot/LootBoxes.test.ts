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
})
