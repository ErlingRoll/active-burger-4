import { describe, expect, it } from 'vitest'
import {
  applyFlatDamage,
  applyIncreasedDamage,
  applyMoreDamage,
  calculateDamageValues,
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

  it('applies more damage after increases', () => {
    expect(applyMoreDamage(
      applyIncreasedDamage({ physical: 100 }, { physical: 50 }),
      { physical: 10 },
    )).toMatchObject({
      physical: 165,
    })
  })

  it('processes gain as extra before source-ordered chained conversion', () => {
    const result = calculateDamageValues(
      { physical: 100 },
      {
        flatDamage: { physical: 20 },
        conversions: [
          {
            sourceDamageType: 'physical',
            targetDamageType: 'lightning',
            percent: 50,
            source: 'skill',
          },
          {
            sourceDamageType: 'lightning',
            targetDamageType: 'cold',
            percent: 50,
            source: 'other',
          },
        ],
        gainAsExtra: [{
          sourceDamageTypes: ['physical', 'lightning', 'cold', 'fire'],
          targetDamageType: 'chaos',
          percent: 10,
        }],
        increased: {
          global: 10,
          physical: 10,
          elemental: 10,
          chaos: 10,
        },
        moreModifiers: [{ percent: 20 }],
      },
    )

    expect(result.physical).toBeCloseTo(86.4)
    expect(result.lightning).toBeCloseTo(46.8)
    expect(result.cold).toBeCloseTo(46.8)
    expect(result.chaos).toBeCloseTo(33.84)
  })

  it('applies type modifiers once to each converted component history', () => {
    expect(calculateDamageValues(
      { physical: 100 },
      {
        conversions: [{
          sourceDamageType: 'physical',
          targetDamageType: 'lightning',
          percent: 100,
          source: 'skill',
        }],
        increased: { physical: 10, elemental: 10 },
        moreModifiers: [{ damageTypes: ['physical'], percent: 10 }],
      },
    )).toMatchObject({ lightning: 132 })
  })

  it('prioritizes skill conversion and scales other conversion to the remainder', () => {
    expect(calculateDamageValues(
      { physical: 100 },
      {
        conversions: [
          {
            sourceDamageType: 'physical',
            targetDamageType: 'lightning',
            percent: 80,
            source: 'skill',
          },
          {
            sourceDamageType: 'physical',
            targetDamageType: 'cold',
            percent: 50,
            source: 'other',
          },
          {
            sourceDamageType: 'physical',
            targetDamageType: 'fire',
            percent: 50,
            source: 'other',
          },
        ],
      },
    )).toMatchObject({
      physical: 0,
      lightning: 80,
      cold: 10,
      fire: 10,
    })
  })

  it('rejects backward damage conversion', () => {
    expect(() => calculateDamageValues(
      { chaos: 100 },
      {
        conversions: [{
          sourceDamageType: 'chaos',
          targetDamageType: 'physical',
          percent: 100,
          source: 'skill',
        }],
      },
    )).toThrow('physical -> lightning -> cold -> fire -> chaos')
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
