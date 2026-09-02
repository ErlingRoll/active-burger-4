import { describe, expect, it } from 'vitest'
import {
  getBasicAttackMorePhysicalDamagePercent,
} from '../../content/upgrades/Upgrades'
import {
  createDamageIncreaseValues,
  createDamageValues,
  sumDamageValues,
} from '../../content/stats/Damage'
import {
  createPlayerDamageProfileFromStats,
  getAttunementDamageFromStats,
  getBasicAttackDamageBeforeCritFromStats,
} from './DamageSources'

describe('Basic Attack more damage', () => {
  it('applies Brutal Attack after increases and includes it in Attunement', () => {
    const basicAttackMorePhysicalDamagePercent =
      getBasicAttackMorePhysicalDamagePercent(['basic-attack-brutality'])
    const stats = {
      attackDamage: 100,
      attunement: 20,
      basicAttackIsProjectile: false,
      critChance: 0,
      critMultiplier: 200,
      flatDamage: createDamageValues(),
      increasedDamage: createDamageIncreaseValues({ physical: 50 }),
    }
    const context = { basicAttackMorePhysicalDamagePercent }

    expect(getBasicAttackDamageBeforeCritFromStats(stats, context))
      .toMatchObject({ physical: 165 })
    expect(getAttunementDamageFromStats(stats, context))
      .toMatchObject({ physical: 33 })
  })

  it.each([
    ['lightning', 'lightning'],
    ['fire', 'fire'],
    ['cold', 'cold'],
    ['chaos', 'chaos'],
  ] as const)('converts seventy percent of post-increase and post-more physical damage to %s', (
    _evolutionName,
    conversionType,
  ) => {
    const damage = getBasicAttackDamageBeforeCritFromStats(
      {
        attackDamage: 100,
        basicAttackIsProjectile: false,
        flatDamage: createDamageValues(),
        increasedDamage: createDamageIncreaseValues({ physical: 50 }),
      },
      { basicAttackMorePhysicalDamagePercent: 10 },
      conversionType,
    )

    expect(damage.physical).toBeCloseTo(49.5)
    expect(damage[conversionType]).toBeCloseTo(115.5)
    expect(sumDamageValues(damage)).toBeCloseTo(165)
    expect(Object.values(damage).filter((value) => value > 0)).toHaveLength(2)
  })

  it('applies Brutal Attack before converting the live Basic Attack profile', () => {
    const profile = createPlayerDamageProfileFromStats(
      {
        attackDamage: 100,
        basicAttackIsProjectile: false,
        critChance: 0,
        critMultiplier: 200,
        flatDamage: createDamageValues(),
        increasedDamage: createDamageIncreaseValues({ physical: 50 }),
      },
      { physical: 200 },
      {
        isBasicAttack: true,
        attunementSourceAdditionalIncreasedDamage: {
          basicAttackDamageConversionType: 'lightning',
          basicAttackMorePhysicalDamagePercent: 10,
        },
      },
    )

    expect(profile.damage.physical).toBeCloseTo(99)
    expect(profile.damage.lightning).toBeCloseTo(231)
  })

  it('applies a skill more multiplier after its increases', () => {
    const profile = createPlayerDamageProfileFromStats(
      {
        attackDamage: 0,
        basicAttackIsProjectile: false,
        critChance: 0,
        critMultiplier: 200,
        flatDamage: createDamageValues(),
        increasedDamage: createDamageIncreaseValues(),
      },
      { fire: 100 },
      {
        isBasicAttack: true,
        additionalIncreasedDamage: { global: 50 },
        moreDamagePercent: 10,
      },
    )

    expect(profile.damage).toMatchObject({ fire: 165 })
  })
})
