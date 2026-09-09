import { describe, expect, it } from 'vitest'
import type { InventoryItemInstance } from './InventoryTypes'
import { isSalvageableItem, selectCommonSalvage } from './InventoryFilters'

function item(
  definitionId: string,
  metadata: Record<string, unknown> = {},
): InventoryItemInstance {
  return {
    itemInstanceId: `instance-${definitionId}`,
    definitionId,
    quantity: 1,
    bound: false,
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

  it('sweeps common fish and common rods together, leaving rarer gear untouched', () => {
    const commonFish = item('river-minnow', { rarity: 'common' })
    const commonRod = item('starter-fishing-rod', { rarity: 'common' })
    const rareRod = item('tideback-fishing-rod', { rarity: 'rare' })
    const commonBait = item('basic-bait')

    const swept = selectCommonSalvage([commonFish, commonRod, rareRod, commonBait])

    expect(swept).toEqual([commonFish, commonRod])
  })
})
