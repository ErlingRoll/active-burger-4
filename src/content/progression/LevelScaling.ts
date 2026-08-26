export const LEVEL_MAX_HP_REFERENCE_LEVEL = 100
export const LEVEL_MAX_HP_REFERENCE_BONUS = 1000
export const LEVEL_MAX_HP_GROWTH_AT_REFERENCE = 1.1

const LEVEL_MAX_HP_GROWTH_PER_LEVEL = Math.pow(
  LEVEL_MAX_HP_GROWTH_AT_REFERENCE,
  1 / (LEVEL_MAX_HP_REFERENCE_LEVEL - 1),
)

/**
 * Slowly accelerating bonus HP from character level.
 *
 * Level 100 grants exactly +1000 HP; level 200 grants approximately +2112 HP.
 */
export function getLevelMaxHpBonus(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level))
  const bonus = LEVEL_MAX_HP_REFERENCE_BONUS *
    (Math.pow(LEVEL_MAX_HP_GROWTH_PER_LEVEL, normalizedLevel - 1) - 1) /
    (LEVEL_MAX_HP_GROWTH_AT_REFERENCE - 1)
  return Math.round(bonus)
}
