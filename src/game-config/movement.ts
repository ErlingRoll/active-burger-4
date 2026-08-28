/**
 * Tunable player movement response. Values are in world units per second².
 * Acceleration is intentionally high so autonomous movement remains responsive
 * while direction changes no longer snap instantly.
 */
export const PLAYER_MOVEMENT = {
  acceleration: 900,
  deceleration: 1350,
} as const
