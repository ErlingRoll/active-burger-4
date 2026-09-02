import { describe, expect, it } from 'vitest'
import {
  calculateAreaValue,
  calculateDamageAfterReduction,
  calculateEffectiveSkillCooldown,
  calculateHealingAmount,
  calculateLeechAmount,
  calculateLevelScaledAmount,
  calculatePoisonDamagePerSecond,
  calculateShieldAbsorption,
  extendDurationUpToMaximum,
} from './CombatCalculations'

describe('combat calculations', () => {
  describe('damage-over-time and mitigation', () => {
    it('calculates Poison DPS from pre-mitigation Physical and Chaos damage only', () => {
      expect(calculatePoisonDamagePerSecond(
        { physical: 100, chaos: 25, fire: 80 },
        0.12,
      )).toBe(15)
      expect(calculatePoisonDamagePerSecond({ fire: 100 }, 0.5)).toBe(0)
    })

    it('rejects invalid Poison ratios and never returns negative damage', () => {
      expect(calculatePoisonDamagePerSecond({ physical: 100 }, -0.2)).toBe(0)
      expect(calculatePoisonDamagePerSecond({ physical: -100 }, 0.2)).toBe(0)
    })

    it('reduces incoming damage without allowing negative values', () => {
      expect(calculateDamageAfterReduction(100, 25)).toBe(75)
      expect(calculateDamageAfterReduction(100, 120)).toBe(25)
      expect(calculateDamageAfterReduction(-100, 25)).toBe(0)
    })
  })

  describe('healing and shields', () => {
    it('applies increased healing, critical multiplier, and missing-health cap in order', () => {
      expect(calculateHealingAmount({
        requestedAmount: 100,
        increasedHealingPercent: 50,
        missingHp: 250,
        criticalMultiplierPercent: 200,
        isCritical: true,
      })).toBe(250)
      expect(calculateHealingAmount({
        requestedAmount: 100,
        increasedHealingPercent: 50,
        missingHp: 400,
        criticalMultiplierPercent: 200,
        isCritical: true,
      })).toBe(300)
    })

    it('does not apply a critical multiplier to non-critical healing', () => {
      expect(calculateHealingAmount({
        requestedAmount: 100,
        increasedHealingPercent: 50,
        missingHp: 500,
        criticalMultiplierPercent: 300,
        isCritical: false,
      })).toBe(150)
    })

    it('clamps invalid healing inputs before applying them', () => {
      expect(calculateHealingAmount({
        requestedAmount: -10,
        increasedHealingPercent: 50,
        missingHp: 100,
        criticalMultiplierPercent: 200,
        isCritical: true,
      })).toBe(0)
      expect(calculateHealingAmount({
        requestedAmount: 100,
        increasedHealingPercent: -50,
        missingHp: -1,
        criticalMultiplierPercent: 200,
        isCritical: false,
      })).toBe(0)
    })

    it('calculates leech from actual post-mitigation damage and caps it at missing health', () => {
      expect(calculateLeechAmount(100, 0.02, 10)).toBe(2)
      expect(calculateLeechAmount(100, 0.02, 1)).toBe(1)
      expect(calculateLeechAmount(100, 0.02)).toBe(2)
      expect(calculateLeechAmount(-100, 0.02, 10)).toBe(0)
    })

    it('absorbs a hit up to the available shield amount', () => {
      expect(calculateShieldAbsorption(50, 20)).toEqual({
        absorbedDamage: 20,
        remainingDamage: 30,
        remainingShield: 0,
      })
      expect(calculateShieldAbsorption(10, 20)).toEqual({
        absorbedDamage: 10,
        remainingDamage: 0,
        remainingShield: 10,
      })
    })

    it('supports per-component shield absorption with a shared remaining shield', () => {
      const physicalAbsorption = calculateShieldAbsorption(40, 50)
      const chaosAbsorption = calculateShieldAbsorption(
        30,
        physicalAbsorption.remainingShield,
      )

      expect(physicalAbsorption).toEqual({
        absorbedDamage: 40,
        remainingDamage: 0,
        remainingShield: 10,
      })
      expect(chaosAbsorption).toEqual({
        absorbedDamage: 10,
        remainingDamage: 20,
        remainingShield: 0,
      })
    })
  })

  describe('utility calculations', () => {
    it('scales skill healing and shields from base, per-level value, and level', () => {
      expect(calculateLevelScaledAmount(20, 5, 3)).toBe(30)
      expect(calculateLevelScaledAmount(20, 5, 0)).toBe(20)
      expect(calculateLevelScaledAmount(-20, 5, 3)).toBe(0)
    })

    it('scales cooldowns with a 0.1-second floor', () => {
      expect(calculateEffectiveSkillCooldown(5, 20)).toBe(4)
      expect(calculateEffectiveSkillCooldown(5, 200)).toBe(0.1)
      expect(calculateEffectiveSkillCooldown(5, -20)).toBe(5)
    })

    it('scales area values and ignores negative bonuses', () => {
      expect(calculateAreaValue(100, 20)).toBe(120)
      expect(calculateAreaValue(100, -20)).toBe(100)
    })

    it('extends duration only to its maximum', () => {
      expect(extendDurationUpToMaximum(3, 5, 6)).toBe(6)
      expect(extendDurationUpToMaximum(3, 1, 6)).toBe(4)
      expect(extendDurationUpToMaximum(6, 1, 6)).toBe(6)
    })
  })
})
