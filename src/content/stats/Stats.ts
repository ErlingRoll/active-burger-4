/**
 * Stats shared by player upgrades and gear. Multiplicative modifier values are
 * factors (for example, 1.15 means +15%).
 */
export type StatKey =
  | 'maxHp'
  | 'movementSpeed'
  | 'attackDamage'
  | 'attackSpeed'
  | 'attackRange'

export const STAT_KEYS = [
  'maxHp',
  'movementSpeed',
  'attackDamage',
  'attackSpeed',
  'attackRange',
] as const satisfies readonly StatKey[]

export const ATTUNEMENT_DESCRIPTION =
  'Attunement adds this percentage of your final pre-crit Basic Attack damage to skills and summons, preserving each damage type and rounding each component up.'
export const RESONANCE_DESCRIPTION =
  'Resonance is the number of successful Basic Attacks needed to empower the next skill cast.'

export type StatValues = { [K in StatKey]: number }
/** Character-authored stats; attack range is supplied by the equipped weapon. */
/** Character-authored combat stats that are not derived from equipment. */
export type CharacterStatValues = Omit<StatValues, 'attackRange'> & {
  /** Successful Basic Attacks required to empower the next skill cast. */
  resonance?: number
  /** Percentage of final Basic Attack damage converted into skill damage. */
  attunement?: number
}

export interface StatModifier {
  stat: StatKey
  operation: 'add' | 'multiply'
  value: number
  sourceId: string
}

export function isStatKey(value: unknown): value is StatKey {
  return typeof value === 'string' && STAT_KEYS.some((stat) => stat === value)
}

/**
 * Deterministically evaluates modifiers as `(base + additive) *
 * multiplicative`. Additive modifiers are summed before multiplicative
 * modifiers are composed by multiplication, so acquisition order cannot
 * change the result.
 */
export function evaluateDerivedStats(
  base: Readonly<StatValues>,
  modifiers: readonly StatModifier[] = [],
): StatValues {
  const derived = { ...base }
  const orderedModifiers = [...modifiers].sort((left, right) => {
    const leftKey = `${left.stat}\u0000${left.operation}\u0000${left.sourceId}\u0000${String(left.value)}`
    const rightKey = `${right.stat}\u0000${right.operation}\u0000${right.sourceId}\u0000${String(right.value)}`
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
  for (const stat of STAT_KEYS) {
    let additive = 0
    let multiplicative = 1
    for (const modifier of orderedModifiers) {
      if (!isStatKey(modifier.stat) || modifier.stat !== stat) {
        continue
      }
      if (!Number.isFinite(modifier.value)) {
        continue
      }
      if (modifier.operation === 'add') {
        additive += modifier.value
      } else if (modifier.operation === 'multiply') {
        multiplicative *= modifier.value
      }
    }
    derived[stat] = (base[stat] + additive) * multiplicative
  }
  return derived
}
