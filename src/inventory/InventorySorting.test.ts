import { describe, expect, it } from 'vitest'
import { sortInventoryItems } from './InventorySorting'
import type { InventoryItemInstance } from './InventoryTypes'

function item(
  itemInstanceId: string,
  definitionId: string,
  metadata: Record<string, unknown> = {},
): InventoryItemInstance {
  return {
    itemInstanceId,
    definitionId,
    quantity: 1,
    bound: false,
    metadata,
    source: { type: 'system', id: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('sortInventoryItems', () => {
  it('sorts by type, then descending rarity, then descending Essence', () => {
    const items = [
      item('common-fish', 'river-minnow', { rarity: 'common' }),
      item('rare-fish', 'silver-perch', { rarity: 'rare' }),
      item('bait', 'river-worm'),
      item('epic-fish', 'revival-koi', { rarity: 'epic' }),
    ]

    expect(sortInventoryItems(items, {
      getEssence: (inventoryItem) => ({
        'common-fish': 2,
        'rare-fish': 5,
        bait: 0,
        'epic-fish': 20,
      }[inventoryItem.itemInstanceId] ?? null),
    }).map((inventoryItem) => inventoryItem.itemInstanceId)).toEqual([
      'bait',
      'epic-fish',
      'rare-fish',
      'common-fish',
    ])
  })

  it('runs preceding comparators before the default fallback', () => {
    const items = [
      item('first', 'river-minnow', { rarity: 'common' }),
      item('second', 'river-minnow', { rarity: 'common' }),
    ]

    expect(sortInventoryItems(items, {
      precedingComparators: [
        (left, right) => right.itemInstanceId.localeCompare(left.itemInstanceId),
      ],
    }).map((inventoryItem) => inventoryItem.itemInstanceId)).toEqual([
      'second',
      'first',
    ])
  })
})
