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

export const DAMAGE_CONVERSION_SOURCE_TYPES = [
  'physical',
  'lightning',
  'cold',
  'fire',
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
  | 'area'

export const DAMAGE_INCREASE_TYPES = [
  'global',
  'physical',
  'elemental',
  'chaos',
  'projectile',
  'area',
] as const satisfies readonly DamageIncreaseType[]

export type DamageIncreaseValues = { [K in DamageIncreaseType]: number }

export interface DamageIncreaseContext {
  isProjectile?: boolean
  isArea?: boolean
}

export interface DamageConversion {
  sourceDamageType: DamageType
  targetDamageType: DamageType
  percent: number
  source: 'skill' | 'other'
}

export interface DamageGainAsExtra {
  sourceDamageTypes?: readonly DamageType[]
  targetDamageType: DamageType
  percent: number
}

export interface DamageMoreModifier {
  damageTypes?: readonly DamageType[]
  percent: number
}

export interface DamageCalculationOptions {
  flatDamage?: Readonly<PartialDamageValues>
  conversions?: readonly DamageConversion[]
  gainAsExtra?: readonly DamageGainAsExtra[]
  increased?: Readonly<Partial<Record<DamageIncreaseType, number>>>
  moreModifiers?: readonly DamageMoreModifier[]
  increaseContext?: DamageIncreaseContext
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
  area: 0,
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
    area: values.area ?? 0,
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

/**
 * Applies the player's percentage increase to a periodic damage payload.
 * Ownership is resolved by the combat system; this helper only performs the
 * damage calculation so estimates and resolved events use the same formula.
 */
export function applyDotMultiplier(
  values: Readonly<PartialDamageValues>,
  dotMultiplier: number,
): DamageValues {
  return scaleDamageValues(
    values,
    1 + Math.max(0, Number.isFinite(dotMultiplier) ? dotMultiplier : 0) / 100,
  )
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
  const areaDamage = context.isArea ? normalized.area : 0
  if (ELEMENTAL_DAMAGE_TYPES.includes(damageType as (typeof ELEMENTAL_DAMAGE_TYPES)[number])) {
    return normalized.global + normalized.elemental + projectileDamage + areaDamage
  }
  if (damageType === 'physical') {
    return normalized.global + normalized.physical + projectileDamage + areaDamage
  }
  if (damageType === 'chaos') {
    return normalized.global + normalized.chaos + projectileDamage + areaDamage
  }
  return normalized.global + projectileDamage + areaDamage
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

/**
 * Applies a global or per-type "more" damage multiplier after all increases.
 */
export function applyMoreDamage(
  base: Readonly<PartialDamageValues>,
  more: number | Readonly<PartialDamageValues>,
): DamageValues {
  const normalized = createDamageValues(base)
  const globalMorePercent = typeof more === 'number' ? more : 0
  const moreByDamageType = typeof more === 'number'
    ? undefined
    : createDamageValues(more)
  const scaled = createDamageValues()
  for (const damageType of DAMAGE_TYPES) {
    scaled[damageType] = normalized[damageType] *
      (1 + (moreByDamageType?.[damageType] ?? globalMorePercent) / 100)
  }
  return scaled
}

interface DamageComponent {
  amount: number
  damageType: DamageType
  history: readonly DamageType[]
}

function addDamageTypeToHistory(
  history: readonly DamageType[],
  damageType: DamageType,
): readonly DamageType[] {
  return history.includes(damageType) ? history : [...history, damageType]
}

function validateDamageConversion(conversion: Readonly<DamageConversion>): void {
  const sourceIndex = DAMAGE_CONVERSION_SOURCE_TYPES.indexOf(conversion.sourceDamageType)
  const targetIndex = DAMAGE_CONVERSION_SOURCE_TYPES.indexOf(conversion.targetDamageType)
  if (sourceIndex < 0 || targetIndex <= sourceIndex) {
    throw new Error(
      `Damage conversion must follow physical -> lightning -> cold -> fire -> chaos: ${conversion.sourceDamageType} -> ${conversion.targetDamageType}.`,
    )
  }
  if (!Number.isFinite(conversion.percent) || conversion.percent < 0) {
    throw new Error(`Damage conversion percent must be a non-negative finite number: ${conversion.percent}.`)
  }
}

function validateDamageGainAsExtra(gain: Readonly<DamageGainAsExtra>): void {
  if (!Number.isFinite(gain.percent) || gain.percent < 0) {
    throw new Error(`Gain-as-extra percent must be a non-negative finite number: ${gain.percent}.`)
  }
  if (
    !isDamageType(gain.targetDamageType) ||
    gain.sourceDamageTypes?.some((damageType) => !isDamageType(damageType))
  ) {
    throw new Error('Gain-as-extra damage types must be supported damage types.')
  }
}

function effectiveConversionsForSource(
  sourceDamageType: DamageType,
  conversions: readonly DamageConversion[],
): readonly DamageConversion[] {
  const matching = conversions.filter((conversion) =>
    conversion.sourceDamageType === sourceDamageType
  )
  const skillConversions = matching.filter((conversion) => conversion.source === 'skill')
  const otherConversions = matching.filter((conversion) => conversion.source === 'other')
  const skillTotal = skillConversions.reduce(
    (total, conversion) => total + conversion.percent,
    0,
  )
  const skillScale = skillTotal > 100 ? 100 / skillTotal : 1
  const remainingPercent = 100 - skillTotal * skillScale
  const otherTotal = otherConversions.reduce(
    (total, conversion) => total + conversion.percent,
    0,
  )
  const otherScale = otherTotal > remainingPercent && otherTotal > 0
    ? remainingPercent / otherTotal
    : 1
  return matching.map((conversion) => ({
    ...conversion,
    percent: conversion.percent * (
      conversion.source === 'skill' ? skillScale : otherScale
    ),
  }))
}

function createDamageComponents(
  base: Readonly<PartialDamageValues>,
): DamageComponent[] {
  const normalized = createDamageValues(base)
  return DAMAGE_TYPES
    .filter((damageType) => normalized[damageType] !== 0)
    .map((damageType) => ({
      amount: normalized[damageType],
      damageType,
      history: [damageType],
    }))
}

function applyConversionsAndGainAsExtra(
  base: Readonly<PartialDamageValues>,
  conversions: readonly DamageConversion[],
  gainAsExtra: readonly DamageGainAsExtra[],
): DamageComponent[] {
  for (const conversion of conversions) {
    validateDamageConversion(conversion)
  }
  for (const gain of gainAsExtra) {
    validateDamageGainAsExtra(gain)
  }

  let components = createDamageComponents(base)
  for (const sourceDamageType of DAMAGE_CONVERSION_SOURCE_TYPES) {
    const sourceConversions = effectiveConversionsForSource(
      sourceDamageType,
      conversions,
    )
    const convertedPercent = sourceConversions.reduce(
      (total, conversion) => total + conversion.percent,
      0,
    )
    const nextComponents: DamageComponent[] = []
    for (const component of components) {
      if (component.damageType !== sourceDamageType) {
        nextComponents.push(component)
        continue
      }

      for (const gain of gainAsExtra) {
        if (
          gain.sourceDamageTypes !== undefined &&
          !gain.sourceDamageTypes.includes(sourceDamageType)
        ) {
          continue
        }
        nextComponents.push({
          amount: component.amount * gain.percent / 100,
          damageType: gain.targetDamageType,
          history: addDamageTypeToHistory(component.history, gain.targetDamageType),
        })
      }

      const retainedPercent = 100 - convertedPercent
      if (retainedPercent > 0) {
        nextComponents.push({
          ...component,
          amount: component.amount * retainedPercent / 100,
        })
      }
      for (const conversion of sourceConversions) {
        nextComponents.push({
          amount: component.amount * conversion.percent / 100,
          damageType: conversion.targetDamageType,
          history: addDamageTypeToHistory(
            component.history,
            conversion.targetDamageType,
          ),
        })
      }
    }
    components = nextComponents
  }
  return components
}

function increasedDamageForHistory(
  increased: Readonly<Partial<Record<DamageIncreaseType, number>>>,
  history: readonly DamageType[],
  context: DamageIncreaseContext,
): number {
  const normalized = createDamageIncreaseValues(increased)
  const projectileDamage = context.isProjectile ? normalized.projectile : 0
  const areaDamage = context.isArea ? normalized.area : 0
  return normalized.global +
    projectileDamage +
    areaDamage +
    (history.includes('physical') ? normalized.physical : 0) +
    (history.some((damageType) =>
      ELEMENTAL_DAMAGE_TYPES.includes(
        damageType as (typeof ELEMENTAL_DAMAGE_TYPES)[number],
      )
    ) ? normalized.elemental : 0) +
    (history.includes('chaos') ? normalized.chaos : 0)
}

function moreDamageFactorForHistory(
  history: readonly DamageType[],
  moreModifiers: readonly DamageMoreModifier[],
): number {
  return moreModifiers.reduce((factor, modifier) => {
    if (!Number.isFinite(modifier.percent)) {
      throw new Error(`More damage percent must be a finite number: ${modifier.percent}.`)
    }
    if (modifier.damageTypes?.some((damageType) => !isDamageType(damageType))) {
      throw new Error('More damage modifier types must be supported damage types.')
    }
    if (
      modifier.damageTypes !== undefined &&
      !modifier.damageTypes.some((damageType) => history.includes(damageType))
    ) {
      return factor
    }
    return factor * (1 + modifier.percent / 100)
  }, 1)
}

/**
 * Calculates flat damage, source-ordered gain-as-extra and conversion, then
 * applies each eligible increased and more modifier once per component.
 */
export function calculateDamageValues(
  base: Readonly<PartialDamageValues>,
  options: Readonly<DamageCalculationOptions> = {},
): DamageValues {
  const components = applyConversionsAndGainAsExtra(
    applyFlatDamage(base, options.flatDamage ?? {}),
    options.conversions ?? [],
    options.gainAsExtra ?? [],
  )
  const calculated = createDamageValues()
  for (const component of components) {
    const increasedPercent = increasedDamageForHistory(
      options.increased ?? {},
      component.history,
      options.increaseContext ?? {},
    )
    calculated[component.damageType] += component.amount *
      (1 + increasedPercent / 100) *
      moreDamageFactorForHistory(component.history, options.moreModifiers ?? [])
  }
  return calculated
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
