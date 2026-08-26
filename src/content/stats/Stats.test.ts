import { describe, expect, it } from 'vitest'
import { evaluateDerivedStats, type StatValues } from './Stats'

const base: StatValues = {
  maxHp: 100,
  movementSpeed: 200,
  attackDamage: 10,
  attackSpeed: 1,
  attackRange: 50,
}

describe('derived stat evaluation', () => {
  it('applies additive modifiers before multiplicative modifiers', () => {
    const result = evaluateDerivedStats(base, [
      { stat: 'attackDamage', operation: 'multiply', value: 1.5, sourceId: 'gear' },
      { stat: 'attackDamage', operation: 'add', value: 2, sourceId: 'upgrade' },
    ])

    expect(result.attackDamage).toBe(18)
  })

  it('composes multiplicative modifiers by multiplication', () => {
    const result = evaluateDerivedStats(base, [
      { stat: 'movementSpeed', operation: 'multiply', value: 1.1, sourceId: 'a' },
      { stat: 'movementSpeed', operation: 'multiply', value: 1.2, sourceId: 'b' },
    ])

    expect(result.movementSpeed).toBeCloseTo(264)
  })

  it('does not depend on modifier acquisition order', () => {
    const modifiers = [
      { stat: 'attackDamage' as const, operation: 'add' as const, value: 0.1, sourceId: 'b' },
      { stat: 'attackDamage' as const, operation: 'add' as const, value: 0.2, sourceId: 'a' },
      { stat: 'attackDamage' as const, operation: 'multiply' as const, value: 1.1, sourceId: 'b' },
      { stat: 'attackDamage' as const, operation: 'multiply' as const, value: 1.2, sourceId: 'a' },
    ]

    expect(evaluateDerivedStats(base, modifiers)).toEqual(
      evaluateDerivedStats(base, [...modifiers].reverse()),
    )
  })

  it('preserves base values when no modifiers are equipped', () => {
    expect(evaluateDerivedStats(base, [])).toEqual(base)
  })
})
