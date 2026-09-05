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

  it('resolves every run-meal family and keeps each family within its cap', () => {
    const result = resolveFishMeal([
      fish('speed', 0.5, 'river-minnow'),
      fish('attack-speed', 0.5, 'reed-darter'),
      fish('healing', 0.5, 'glassfin-trout'),
      fish('health', 0.5, 'silver-perch', 'uncommon'),
      fish('damage', 0.5, 'lantern-pike', 'uncommon'),
    ])
    const remainingFamilies = resolveFishMeal([
      fish('cooldown', 0.5, 'moon-carp', 'rare'),
      fish('resistance', 0.5, 'tideback-catfish', 'rare'),
      fish('elite', 0.5, 'comet-eel', 'epic'),
      fish('revive', 0.5, 'star-koi', 'legendary'),
    ])

    expect(result.effects.movementSpeedPercent).toBeGreaterThan(0)
    expect(result.effects.attackSpeedPercent).toBeGreaterThan(0)
    expect(result.effects.increasedHealingPercent).toBeGreaterThan(0)
    expect(result.effects.maxHpPercent).toBeGreaterThan(0)
    expect(result.effects.attackDamagePercent).toBeGreaterThan(0)
    expect(remainingFamilies.effects.cooldownReductionPercent).toBeGreaterThan(0)
    expect(remainingFamilies.effects.physicalResistancePercent).toBeGreaterThan(0)
    expect(remainingFamilies.effects.eliteDamagePercent).toBeGreaterThan(0)
    expect(remainingFamilies.effects.emergencyRevivePercent).toBe(1)
  })

  it('applies the cap cumulatively before adding a repeated family contribution', () => {
    const result = resolveFishMeal([
      fish('eel-1', 1, 'comet-eel', 'legendary'),
      fish('eel-2', 1, 'comet-eel', 'legendary'),
      fish('eel-3', 1, 'comet-eel', 'legendary'),
      fish('eel-4', 1, 'comet-eel', 'legendary'),
      fish('eel-5', 1, 'comet-eel', 'legendary'),
    ])

    expect(result.effects.eliteDamagePercent).toBe(16)
    expect(result.preparation.items.map((item) =>
      (item.resolvedEffect?.eliteDamagePercent as number),
    )).toEqual([16, 0, 0, 0, 0])
  })

  it('uses the fish definition rarity instead of client-provided rarity metadata', () => {
    const common = resolveFishMeal([fish('common', 0.5, 'river-minnow', 'common')])
    const forged = resolveFishMeal([fish('forged', 0.5, 'river-minnow', 'legendary')])

    expect(forged.movementSpeedPercent).toBe(common.movementSpeedPercent)
  })

  it('amplifies an enchanted fish meal without changing its family', () => {
    const plain = resolveFishMeal([fish('plain', 0.5)])
    const enchanted = resolveFishMeal([{
      ...fish('enchanted', 0.5),
      metadata: {
        ...fish('enchanted', 0.5).metadata,
        enchantmentId: 'bright-scales',
        enchantmentValue: 15,
      },
    }])

    expect(enchanted.movementSpeedPercent).toBeGreaterThan(plain.movementSpeedPercent)
    expect(enchanted.preparation.items[0].resolvedEffect).toMatchObject({
      type: 'fish-meal',
      family: 'movement-speed',
      enchantmentId: 'bright-scales',
      enchantmentValue: 15,
    })
  })

  it('ignores unknown enchantments and client-forged enchantment values', () => {
    const plain = resolveFishMeal([fish('plain', 0.5)])
    const forged = resolveFishMeal([{
      ...fish('forged', 0.5),
      metadata: {
        ...fish('forged', 0.5).metadata,
        enchantmentId: 'bright-scales',
        enchantmentValue: 999,
      },
    }])

    expect(forged.movementSpeedPercent).toBeGreaterThan(plain.movementSpeedPercent)
    expect(forged.movementSpeedPercent).toBeLessThan(
      plain.movementSpeedPercent * 2,
    )
  })
})
