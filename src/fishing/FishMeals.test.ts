import { describe, expect, it } from 'vitest'
import { resolveFishMeal } from './FishMeals'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'

function fish(id: string, sizePercentile = 0.5): InventoryItemInstance {
  return {
    itemInstanceId: id,
    definitionId: 'river-minnow',
    quantity: 1,
    bound: false,
    metadata: {
      speciesId: 'river-minnow',
      rarity: 'common',
      sizePercentile,
    },
    source: { type: 'fishing', id: `attempt-${id}` },
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  }
}

describe('FishMeals', () => {
  it('resolves deterministic capped diminishing returns', () => {
    const result = resolveFishMeal([
      fish('fish-1', 0.5),
      fish('fish-2', 0.5),
      fish('fish-3', 0.5),
      fish('fish-4', 0.5),
      fish('fish-5', 0.5),
    ])

    expect(result.movementSpeedPercent).toBeLessThanOrEqual(6)
    expect(result.preparation.items).toHaveLength(5)
    expect(result.preparation.items[0].resolvedEffect).toMatchObject({
      type: 'fish-meal',
      family: 'movement-speed',
    })
  })

  it('rejects duplicate fish and more than five fish', () => {
    expect(() => resolveFishMeal([fish('fish-1'), fish('fish-1')])).toThrow(/once/)
    expect(() => resolveFishMeal([
      fish('fish-1'),
      fish('fish-2'),
      fish('fish-3'),
      fish('fish-4'),
      fish('fish-5'),
      fish('fish-6'),
    ])).toThrow(/at most 5/)
  })
})
