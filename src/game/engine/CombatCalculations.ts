import {
  createDamageValues,
  type PartialDamageValues,
} from '../../content/stats/Damage'

export interface HealingCalculationInput {
  requestedAmount: number
  increasedHealingPercent: number
  missingHp: number
  criticalMultiplierPercent: number
  isCritical: boolean
}

export interface ShieldAbsorption {
  absorbedDamage: number
  remainingDamage: number
  remainingShield: number
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function calculatePoisonDamagePerSecond(
  preMitigationDamage: Readonly<PartialDamageValues>,
  physicalChaosRatio: number,
): number {
  const damage = createDamageValues(preMitigationDamage)
  return Math.max(
    0,
    (damage.physical + damage.chaos) * nonNegativeFinite(physicalChaosRatio),
  )
}

export function calculateDamageAfterReduction(
  incomingDamage: number,
  damageReductionPercent: number,
): number {
  return nonNegativeFinite(incomingDamage) * (
    1 - Math.min(75, nonNegativeFinite(damageReductionPercent)) / 100
  )
}

export function calculateHealingAmount({
  requestedAmount,
  increasedHealingPercent,
  missingHp,
  criticalMultiplierPercent,
  isCritical,
}: Readonly<HealingCalculationInput>): number {
  const baseAmount = nonNegativeFinite(requestedAmount) * (
    1 + nonNegativeFinite(increasedHealingPercent) / 100
  )
  const criticalMultiplier = isCritical
    ? nonNegativeFinite(criticalMultiplierPercent) / 100
    : 1
  return Math.min(
    nonNegativeFinite(missingHp),
    baseAmount * criticalMultiplier,
  )
}

export function calculateLeechAmount(
  actualDamage: number,
  leechRatio: number,
  missingHp?: number,
): number {
  const leechAmount = nonNegativeFinite(actualDamage) * nonNegativeFinite(leechRatio)
  return missingHp === undefined
    ? leechAmount
    : Math.min(nonNegativeFinite(missingHp), leechAmount)
}

export function calculateShieldAbsorption(
  incomingDamage: number,
  shieldAmount: number,
): ShieldAbsorption {
  const damage = nonNegativeFinite(incomingDamage)
  const shield = nonNegativeFinite(shieldAmount)
  const absorbedDamage = Math.min(damage, shield)
  return {
    absorbedDamage,
    remainingDamage: damage - absorbedDamage,
    remainingShield: shield - absorbedDamage,
  }
}

export function calculateEffectiveSkillCooldown(
  baseCooldown: number,
  cooldownReductionPercent: number,
): number {
  return Math.max(
    0.1,
    nonNegativeFinite(baseCooldown) * (
      1 - nonNegativeFinite(cooldownReductionPercent) / 100
    ),
  )
}

export function calculateLevelScaledAmount(
  baseAmount: number,
  amountPerLevel: number,
  level: number,
): number {
  return Math.max(
    0,
    finiteOrZero(baseAmount) +
      finiteOrZero(amountPerLevel) * Math.max(0, finiteOrZero(level) - 1),
  )
}

export function calculateAreaValue(
  baseValue: number,
  areaOfEffectPercent: number,
): number {
  return nonNegativeFinite(baseValue) * (
    1 + nonNegativeFinite(areaOfEffectPercent) / 100
  )
}

export function extendDurationUpToMaximum(
  remainingDuration: number,
  extensionSeconds: number,
  maximumDuration: number,
): number {
  const current = Math.min(
    nonNegativeFinite(remainingDuration),
    nonNegativeFinite(maximumDuration),
  )
  return Math.min(
    nonNegativeFinite(maximumDuration),
    current + nonNegativeFinite(extensionSeconds),
  )
}
