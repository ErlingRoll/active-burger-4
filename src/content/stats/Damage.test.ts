import { describe, expect, it } from 'vitest'
import {
  applyFlatDamage,
  applyIncreasedDamage,
  getAverageCriticalStrikeFactor,
  getResistanceForDamageType,
  mitigateDamageValues,
  normalizeCriticalStrikeStats,
} from './Damage'

describe('damage model', () => {
  it('adds flat damage before increased damage per type', () => {
    const result = applyIncreasedDamage(
      applyFlatDamage(
        { physical: 10 },
        { lightning: 5 },
      ),
      { elemental: 20 },
    )

    expect(result).toMatchObject({
      physical: 10,
      lightning: 6,
    })
  })

  it('adds projectile damage increases only to projectile-tagged damage sources', () => {
    expect(applyIncreasedDamage(
      { physical: 10, lightning: 10 },
      { projectile: 25, elemental: 20 },
      { isProjectile: true },
    )).toMatchObject({
      physical: 12.5,
      lightning: 14.5,
    })
    expect(applyIncreasedDamage(
      { physical: 10, lightning: 10 },
      { projectile: 25, elemental: 20 },
    )).toMatchObject({
      physical: 10,
      lightning: 12,
    })
  })

  it('caps resistance at 75% while elemental resistance applies to all elemental types', () => {
    expect(getResistanceForDamageType({ elemental: 80 }, 'lightning')).toBe(75)
    expect(getResistanceForDamageType({ elemental: 25, fire: 10 }, 'fire')).toBe(35)
    expect(mitigateDamageValues(
      { physical: 100, lightning: 100, chaos: 100 },
      { physical: 50, elemental: 80, chaos: 10 },
    )).toMatchObject({
      physical: 50,
      lightning: 25,
      chaos: 90,
    })
  })

  it('normalizes overcrit into critical multiplier while capping effective chance at 100%', () => {
    expect(normalizeCriticalStrikeStats({
      chance: 125,
      multiplier: 200,
    })).toEqual({
      chance: 100,
      multiplier: 212.5,
    })
    expect(getAverageCriticalStrikeFactor({
      chance: 100,
      multiplier: 200,
    })).toBe(2)
  })
})
