import { describe, expect, it } from 'vitest'
import { resolveFishMeal } from './FishMeals'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'

function fish(
  id: string,
  sizePercentile = 0.5,
  definitionId = 'river-minnow',
  rarity = 'common',
): InventoryItemInstance {
  return {
    itemInstanceId: id,
    definitionId,
    quantity: 1,
    bound: false,
    metadata: {
      speciesId: definitionId,
      rarity,
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

  it('resolves distinct fish families and rejects recovery-only fish', () => {
    const result = resolveFishMeal([
      fish('speed', 0.5, 'reed-darter'),
      fish('health', 0.5, 'silver-perch', 'uncommon'),
      fish('damage', 0.5, 'lantern-pike', 'uncommon'),
      fish('defense', 0.5, 'tideback-catfish', 'rare'),
      fish('grace', 0.5, 'star-koi', 'legendary'),
    ])

    expect(result.effects.attackSpeedPercent).toBeGreaterThan(0)
    expect(result.effects.maxHpPercent).toBeGreaterThan(0)
    expect(result.effects.attackDamagePercent).toBeGreaterThan(0)
    expect(result.effects.physicalResistancePercent).toBeGreaterThan(0)
    expect(result.effects.emergencyRevivePercent).toBe(1)
    expect(() => resolveFishMeal([fish('recovery', 0.5, 'revival-koi', 'epic')]))
      .toThrow(/Champion recovery/)
  })
})
