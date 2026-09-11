import { describe, expect, it } from 'vitest'
import type { InventoryItemInstance } from './InventoryTypes'
import { isSalvageableItem, selectSalvageSweep } from './InventoryFilters'

function item(
  definitionId: string,
  metadata: Record<string, unknown> = {},
): InventoryItemInstance {
  return {
    itemInstanceId: `instance-${definitionId}`,
    definitionId,
    quantity: 1,
    bound: false,
    favorite: false,
    metadata,
    source: { type: 'fishing', id: null },
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  }
}

describe('InventoryFilters', () => {
  it('treats fish and rods as individually salvageable, and nothing else', () => {
    expect(isSalvageableItem(item('river-minnow'))).toBe(true)
    expect(isSalvageableItem(item('starter-fishing-rod'))).toBe(true)
    expect(isSalvageableItem(item('basic-bait'))).toBe(false)
    expect(isSalvageableItem(item('scrap'))).toBe(false)
    expect(isSalvageableItem(item('loot-box-common'))).toBe(false)
  })

  it('sweeps fish and rods up to the chosen rarity, leaving rarer gear untouched', () => {
    const commonFish = item('river-minnow', { rarity: 'common' })
    const uncommonFish = item('reed-darter', { rarity: 'uncommon' })
    const commonRod = item('starter-fishing-rod', { rarity: 'common' })
    const rareRod = item('tideback-fishing-rod', { rarity: 'rare' })
    const epicRod = item('moonwater-fishing-rod', { rarity: 'epic' })
    const commonBait = item('basic-bait')
    const shelf = [commonFish, uncommonFish, commonRod, rareRod, epicRod, commonBait]

    expect(selectSalvageSweep(shelf, 'common', new Set())).toEqual({
      targets: [commonFish, commonRod],
      favoritesKept: 0,
    })
    expect(selectSalvageSweep(shelf, 'uncommon', new Set()).targets)
      .toEqual([commonFish, uncommonFish, commonRod])
    expect(selectSalvageSweep(shelf, 'rare', new Set()).targets)
      .toEqual([commonFish, uncommonFish, commonRod, rareRod])
  })

  it('keeps favorites out of the sweep and counts them', () => {
    const keptRod = { ...item('starter-fishing-rod', { rarity: 'common' }), favorite: true }
    const sweptRod = { ...item('tideback-fishing-rod', { rarity: 'rare' }), itemInstanceId: 'rod-2' }
    const keptByDefinition = item('river-minnow', { rarity: 'common' })

    const swept = selectSalvageSweep(
      [keptRod, sweptRod, keptByDefinition],
      'rare',
      new Set(['river-minnow']),
    )

    expect(swept).toEqual({ targets: [sweptRod], favoritesKept: 2 })
  })

  it('never sweeps an item whose rarity it cannot read', () => {
    // A fish carries its rarity on the instance; one without it is not priced.
    const unknown = item('river-minnow')

    expect(selectSalvageSweep([unknown], 'rare', new Set()).targets).toEqual([])
  })
})
