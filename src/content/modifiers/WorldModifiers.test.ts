import { describe, expect, it } from 'vitest'
import { SPAWN_BALANCE } from '../spawning/SpawnBalance'
import {
  calculateWorldModifierRewardMultiplier,
  getWorldModifierDefinitions,
  normalizeWorldModifierIds,
  resolveWorldModifierEffects,
} from './WorldModifiers'

describe('WorldModifiers', () => {
  it('normalizes unknown and duplicate modifier IDs into stable order', () => {
    expect(normalizeWorldModifierIds([
      'swarming',
      'unknown',
      'fast-start',
      'swarming',
    ])).toEqual(['fast-start', 'swarming'])
  })

  it('orders modifier definitions by difficulty with authored tie breaking', () => {
    expect(getWorldModifierDefinitions([
      'elite-invasion',
      'glass-world',
      'juggernauts',
      'fast-start',
      'shorter-minute',
      'swarming',
      'elite-triad',
    ]).map((modifier) => modifier.id)).toEqual([
      'swarming',
      'fast-start',
      'juggernauts',
      'glass-world',
      'shorter-minute',
      'elite-invasion',
      'elite-triad',
    ])
  })

  it('adds reward bonuses when multiple modifiers are combined', () => {
    expect(calculateWorldModifierRewardMultiplier([
      'swarming',
      'elite-invasion',
    ])).toBeCloseTo(1.3)
    expect(calculateWorldModifierRewardMultiplier([
      'swarming',
      'juggernauts',
      'glass-world',
      'shorter-minute',
      'elite-invasion',
      'fast-start',
    ])).toBeCloseTo(1.88)
  })

  it('combines authored difficulty, rewards, and deterministic run effects', () => {
    const effects = resolveWorldModifierEffects(
      ['swarming', 'juggernauts', 'glass-world', 'elite-invasion', 'fast-start'],
      SPAWN_BALANCE,
    )

    expect(effects.difficulty).toBe(15)
    expect(effects.essenceRewardMultiplier).toBeCloseTo(1.73)
    expect(effects.playerStatMultipliers).toEqual({
      maxHp: 0.75,
      attackDamage: 1.1,
      attackSpeed: 1.1,
      movementSpeed: 1.05,
    })
    expect(effects.spawnBalance).toMatchObject({
      baseThreatPerSecond: 1.35,
      threatGrowthPerMinute: 0.6,
      eliteStartTimeSeconds: 20,
      eliteChance: 0.22,
    })
    expect(effects.floorDurationMultiplier).toBe(1)
    expect(effects.fastStartThreatMultiplier).toBe(1.4)
    expect(effects.fastStartDurationSeconds).toBe(120)
  })

  it('makes Juggernauts increase ordinary enemy health and all damage', () => {
    const effects = resolveWorldModifierEffects(['juggernauts'], SPAWN_BALANCE)

    expect(effects.ordinaryEnemyMaxHpMultiplier).toBe(1.3)
    expect(effects.ordinaryEnemyDamageMultiplier).toBe(1.3)
    expect(effects.ordinaryEnemySpeedMultiplier).toBe(0.9)
  })

  it('shortens normal floors without changing boss encounter duration', () => {
    const effects = resolveWorldModifierEffects(
      ['shorter-minute'],
      SPAWN_BALANCE,
    )

    expect(effects.floorDurationMultiplier).toBe(0.75)
    expect(effects.essenceRewardMultiplier).toBe(1.15)
  })

  it('makes every elite roll exactly three modifiers', () => {
    const effects = resolveWorldModifierEffects(
      ['elite-triad'],
      SPAWN_BALANCE,
    )

    expect(effects.spawnBalance.minimumEliteModifierCount).toBe(3)
  })
})
