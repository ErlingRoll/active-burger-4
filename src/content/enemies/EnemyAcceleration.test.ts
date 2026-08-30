import { describe, expect, it } from 'vitest'
import {
  ENEMY_POST_SPAWN_ACCELERATION,
  getPostSpawnDamageMultiplier,
  getPostSpawnSpeedMultiplier,
} from './EnemyAcceleration'

describe('enemy post-spawn acceleration', () => {
  it('holds enemies at base speed during the grace period', () => {
    expect(getPostSpawnSpeedMultiplier(0, 0)).toBe(1)
    expect(getPostSpawnSpeedMultiplier(
      ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds,
      0,
    )).toBe(1)
  })

  it('ramps linearly to four times speed', () => {
    const midpoint = ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds +
      ENEMY_POST_SPAWN_ACCELERATION.rampDurationSeconds / 2

    expect(getPostSpawnSpeedMultiplier(midpoint, 0)).toBe(2.5)
    expect(getPostSpawnSpeedMultiplier(
      ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds +
        ENEMY_POST_SPAWN_ACCELERATION.rampDurationSeconds,
      0,
    )).toBe(4)
  })

  it('keeps the multiplier capped and preserves legacy fixtures without spawn time', () => {
    expect(getPostSpawnSpeedMultiplier(1_000, 0)).toBe(4)
    expect(getPostSpawnSpeedMultiplier(1_000, undefined)).toBe(1)
  })

  it('ramps mob damage to twice its base over the same period', () => {
    const midpoint = ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds +
      ENEMY_POST_SPAWN_ACCELERATION.rampDurationSeconds / 2

    expect(getPostSpawnDamageMultiplier(0, 0)).toBe(1)
    expect(getPostSpawnDamageMultiplier(midpoint, 0)).toBe(1.5)
    expect(getPostSpawnDamageMultiplier(
      ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds +
        ENEMY_POST_SPAWN_ACCELERATION.rampDurationSeconds,
      0,
    )).toBe(2)
    expect(getPostSpawnDamageMultiplier(1_000, undefined)).toBe(1)
  })
})
