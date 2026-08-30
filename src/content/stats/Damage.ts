export type DamageType =
  | 'physical'
  | 'lightning'
  | 'fire'
  | 'cold'
  | 'chaos'

export const DAMAGE_TYPES = [
  'physical',
  'lightning',
  'fire',
  'cold',
  'chaos',
] as const satisfies readonly DamageType[]

export const ELEMENTAL_DAMAGE_TYPES = [
  'lightning',
  'fire',
  'cold',
] as const satisfies readonly Extract<DamageType, 'lightning' | 'fire' | 'cold'>[]

export type ElementalDamageType = (typeof ELEMENTAL_DAMAGE_TYPES)[number]

export type DamageValues = { [K in DamageType]: number }
export type PartialDamageValues = Partial<Record<DamageType, number>>

export type DamageResistanceType = DamageType | 'elemental'

export const DAMAGE_RESISTANCE_TYPES = [
  'physical',
  'elemental',
  'lightning',
  'fire',
  'cold',
  'chaos',
] as const satisfies readonly DamageResistanceType[]

/** The resistance pools that directly reduce physical, elemental, and chaos damage. */
export const PRIMARY_RESISTANCE_TYPES = [
  'physical',
  'elemental',
  'chaos',
] as const satisfies readonly DamageResistanceType[]

export type DamageResistanceValues = { [K in DamageResistanceType]: number }
export type PartialDamageResistanceValues = Partial<Record<DamageResistanceType, number>>

export type DamageIncreaseType =
  | 'global'
  | 'physical'
  | 'elemental'
  | 'chaos'
  | 'projectile'

export const DAMAGE_INCREASE_TYPES = [
  'global',
  'physical',
  'elemental',
  'chaos',
  'projectile',
] as const satisfies readonly DamageIncreaseType[]

export type DamageIncreaseValues = { [K in DamageIncreaseType]: number }

export interface DamageIncreaseContext {
  isProjectile?: boolean
}

export interface CriticalStrikeStats {
  chance: number
  multiplier: number
}

export const RESISTANCE_CAP = 75

export const DEFAULT_DAMAGE_VALUES = Object.freeze({
  physical: 0,
  lightning: 0,
  fire: 0,
  cold: 0,
  chaos: 0,
} as const satisfies DamageValues)

export const DEFAULT_DAMAGE_RESISTANCE_VALUES = Object.freeze({
  physical: 0,
  elemental: 0,
  lightning: 0,
  fire: 0,
  cold: 0,
  chaos: 0,
} as const satisfies DamageResistanceValues)

export const DEFAULT_DAMAGE_INCREASE_VALUES = Object.freeze({
  global: 0,
  physical: 0,
  elemental: 0,
  chaos: 0,
  projectile: 0,
} as const satisfies DamageIncreaseValues)

export const DEFAULT_PLAYER_CRITICAL_STRIKE = Object.freeze({
  chance: 5,
  multiplier: 200,
} as const satisfies CriticalStrikeStats)

export const DEFAULT_MONSTER_CRITICAL_STRIKE = Object.freeze({
  chance: 5,
  multiplier: 150,
} as const satisfies CriticalStrikeStats)

export function isDamageType(value: unknown): value is DamageType {
  return typeof value === 'string' &&
    DAMAGE_TYPES.some((damageType) => damageType === value)
}

export function isDamageResistanceType(value: unknown): value is DamageResistanceType {
  return typeof value === 'string' &&
    DAMAGE_RESISTANCE_TYPES.some((resistanceType) => resistanceType === value)
}

export function isDamageIncreaseType(value: unknown): value is DamageIncreaseType {
  return typeof value === 'string' &&
    DAMAGE_INCREASE_TYPES.some((increaseType) => increaseType === value)
}

export function createDamageValues(
  values: Readonly<PartialDamageValues> = {},
): DamageValues {
  return {
    physical: values.physical ?? 0,
    lightning: values.lightning ?? 0,
    fire: values.fire ?? 0,
    cold: values.cold ?? 0,
    chaos: values.chaos ?? 0,
  }
}

export function createDamageResistanceValues(
  values: Readonly<PartialDamageResistanceValues> = {},
): DamageResistanceValues {
  return {
    physical: values.physical ?? 0,
    elemental: values.elemental ?? 0,
    lightning: values.lightning ?? 0,
    fire: values.fire ?? 0,
    cold: values.cold ?? 0,
    chaos: values.chaos ?? 0,
  }
}

export function createDamageIncreaseValues(
  values: Readonly<Partial<Record<DamageIncreaseType, number>>> = {},
): DamageIncreaseValues {
  return {
    global: values.global ?? 0,
    physical: values.physical ?? 0,
    elemental: values.elemental ?? 0,
    chaos: values.chaos ?? 0,
    projectile: values.projectile ?? 0,
  }
}

export function addDamageValues(
  ...valuesList: readonly Readonly<PartialDamageValues>[]
): DamageValues {
  const total = createDamageValues()
  for (const values of valuesList) {
    const normalized = createDamageValues(values)
    for (const damageType of DAMAGE_TYPES) {
      total[damageType] += normalized[damageType]
    }
  }
  return total
}

export function scaleDamageValues(
  values: Readonly<PartialDamageValues>,
  factor: number,
): DamageValues {
  const normalized = createDamageValues(values)
  const scaled = createDamageValues()
  for (const damageType of DAMAGE_TYPES) {
    scaled[damageType] = normalized[damageType] * factor
  }
  return scaled
}

export function sumDamageValues(values: Readonly<PartialDamageValues>): number {
  const normalized = createDamageValues(values)
  return DAMAGE_TYPES.reduce(
    (total, damageType) => total + normalized[damageType],
    0,
  )
}

export function applyFlatDamage(
  base: Readonly<PartialDamageValues>,
  flatDamage: Readonly<PartialDamageValues>,
): DamageValues {
  return addDamageValues(base, flatDamage)
}

function increasedDamageForType(
  increased: Readonly<Partial<Record<DamageIncreaseType, number>>>,
  damageType: DamageType,
  context: DamageIncreaseContext,
): number {
  const normalized = createDamageIncreaseValues(increased)
  const projectileDamage = context.isProjectile ? normalized.projectile : 0
  if (ELEMENTAL_DAMAGE_TYPES.includes(damageType as (typeof ELEMENTAL_DAMAGE_TYPES)[number])) {
    return normalized.global + normalized.elemental + projectileDamage
  }
  if (damageType === 'physical') {
    return normalized.global + normalized.physical + projectileDamage
  }
  if (damageType === 'chaos') {
    return normalized.global + normalized.chaos + projectileDamage
  }
  return normalized.global + projectileDamage
}

export function applyIncreasedDamage(
  base: Readonly<PartialDamageValues>,
  increased: Readonly<Partial<Record<DamageIncreaseType, number>>> = {},
  context: DamageIncreaseContext = {},
): DamageValues {
  const normalized = createDamageValues(base)
  const scaled = createDamageValues()
  for (const damageType of DAMAGE_TYPES) {
    const factor = 1 + increasedDamageForType(increased, damageType, context) / 100
    scaled[damageType] = normalized[damageType] * factor
  }
  return scaled
}

export function normalizeCriticalStrikeStats(
  criticalStrike: Readonly<CriticalStrikeStats>,
): CriticalStrikeStats {
  const chance = Math.max(0, criticalStrike.chance)
  const effectiveChance = Math.min(100, chance)
  const overcrit = Math.max(0, chance - 100)
  return {
    chance: effectiveChance,
    multiplier: Math.max(0, criticalStrike.multiplier + overcrit * 0.5),
  }
}

export function getAverageCriticalStrikeFactor(
  criticalStrike: Readonly<CriticalStrikeStats>,
): number {
  const normalized = normalizeCriticalStrikeStats(criticalStrike)
  return 1 + (normalized.chance / 100) * (normalized.multiplier / 100 - 1)
}

export function isCriticalStrike(
  criticalStrike: Readonly<CriticalStrikeStats>,
  roll: number,
): boolean {
  const normalized = normalizeCriticalStrikeStats(criticalStrike)
  return normalized.chance > 0 && roll * 100 < normalized.chance
}

export function getResistanceForDamageType(
  resistances: Readonly<PartialDamageResistanceValues> = {},
  damageType: DamageType,
): number {
  const normalized = createDamageResistanceValues(resistances)
  const total = ELEMENTAL_DAMAGE_TYPES.includes(
    damageType as (typeof ELEMENTAL_DAMAGE_TYPES)[number],
  )
    ? normalized.elemental + normalized[damageType]
    : normalized[damageType]
  return Math.min(RESISTANCE_CAP, total)
}

export function mitigateDamageValues(
  damage: Readonly<PartialDamageValues>,
  resistances: Readonly<PartialDamageResistanceValues> = {},
): DamageValues {
  const normalized = createDamageValues(damage)
  const mitigated = createDamageValues()
  for (const damageType of DAMAGE_TYPES) {
    const mitigationFactor = 1 - getResistanceForDamageType(resistances, damageType) / 100
    mitigated[damageType] = normalized[damageType] * mitigationFactor
  }
  return mitigated
}
