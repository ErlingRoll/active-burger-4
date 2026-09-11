import { describe, expect, it } from 'vitest'
import { stackInventoryItems } from './InventoryStacks'
import type { InventoryItemInstance } from './InventoryTypes'

function item(
  itemInstanceId: string,
  definitionId: string,
  quantity = 1,
): InventoryItemInstance {
  return {
    itemInstanceId,
    definitionId,
    quantity,
    bound: false,
    favorite: false,
    metadata: {},
    source: { type: 'system', id: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('stackInventoryItems', () => {
  it('counts interchangeable items into one slot', () => {
    const stacked = stackInventoryItems([
      item('first', 'scrap', 3),
      item('second', 'scrap', 5),
      item('third', 'scrap'),
    ])

    expect(stacked).toHaveLength(1)
    expect(stacked[0]?.quantity).toBe(9)
  })

  it('keeps the first instance, so the oldest row is the one spent', () => {
    const [stack] = stackInventoryItems([item('older', 'scrap'), item('newer', 'scrap')])

    expect(stack?.itemInstanceId).toBe('older')
  })

  it('leaves a fish alone, because two of one species are two things', () => {
    const stacked = stackInventoryItems([
      item('one', 'river-minnow'),
      item('two', 'river-minnow'),
    ])

    expect(stacked.map((fish) => fish.itemInstanceId)).toEqual(['one', 'two'])
  })

  it('keeps the order items arrived in, so the sort downstream decides it', () => {
    const stacked = stackInventoryItems([
      item('scrap-a', 'scrap'),
      item('fish', 'river-minnow'),
      item('scrap-b', 'scrap'),
    ])

    expect(stacked.map((entry) => entry.definitionId)).toEqual(['scrap', 'river-minnow'])
  })
})
