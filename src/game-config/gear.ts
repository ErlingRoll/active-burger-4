import type { EnemyDefinitionId } from '../content/enemies/Enemies'

/** Per-enemy probability of generating a gear orb on death before normalization. */
export const GEAR_DROP_CHANCES = {
  slime: 0.07,
  runner: 0.07,
  archer: 0.07,
  splitter: 0.07,
  brute: 0.07,
} as const satisfies Record<EnemyDefinitionId, number>

/**
 * Keeps the baseline per-enemy drop rate stable while the normal spawn threat
 * grows over time. Values above one allow future progression to intentionally
 * make gear drops more frequent.
 */
export const GEAR_DROP_CHANCE_BALANCE = {
  threatNormalizationExponent: 1,
  floorTaper: {
    startFloor: 1,
    endFloor: 30,
    startMultiplier: 1,
    endMultiplier: 0.5,
  },
} as const

export const GEAR_PICKUP_BALANCE = {
  radius: 12,
  attractionRadius: 180,
  attractionSpeed: 360,
} as const
