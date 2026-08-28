import type { EnemyDefinitionId } from '../content/enemies/Enemies'

/** Per-enemy probability of generating a gear orb on death. */
export const GEAR_DROP_CHANCES = {
  slime: 0.1,
  runner: 0.1,
  archer: 0.1,
  splitter: 0.1,
  brute: 0.1,
} as const satisfies Record<EnemyDefinitionId, number>

/**
 * Keeps the baseline per-enemy drop rate stable while the normal spawn threat
 * grows over time. Values above one allow future progression to intentionally
 * make gear drops more frequent.
 */
export const GEAR_DROP_CHANCE_BALANCE = {
  threatNormalizationExponent: 1,
} as const

export const GEAR_PICKUP_BALANCE = {
  radius: 12,
  attractionRadius: 180,
  attractionSpeed: 360,
} as const
