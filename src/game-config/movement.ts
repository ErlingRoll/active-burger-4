/**
 * Tunable player movement response. Values are in world units per second².
 * Autonomous movement remains responsive while direction changes no longer snap
 * instantly. Free movement uses a separate, sharper response for direct input.
 */
export const PLAYER_MOVEMENT = {
  acceleration: 900,
  deceleration: 1350,
  freeAcceleration: 3600,
  freeDeceleration: 2700,
} as const
