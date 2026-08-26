import { describe, expect, it } from 'vitest'
import { SPAWN_BALANCE } from '../spawning/SpawnBalance'
import {
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

  it('combines authored difficulty, rewards, and deterministic run effects', () => {
    const effects = resolveWorldModifierEffects(
      ['swarming', 'juggernauts', 'glass-world', 'elite-invasion', 'fast-start'],
      SPAWN_BALANCE,
    )

    expect(effects.difficulty).toBe(16)
    expect(effects.essenceRewardMultiplier).toBeCloseTo(2.08725)
    expect(effects.playerStatMultipliers).toEqual({
      maxHp: 0.65,
      attackDamage: 1.1,
      movementSpeed: 1.05,
    })
    expect(effects.spawnBalance).toMatchObject({
      baseThreatPerSecond: 1.35,
      threatGrowthPerMinute: 0.6,
      maxActiveEnemies: 38,
      eliteStartTimeSeconds: 20,
      eliteChance: 0.25,
    })
    expect(effects.fastStartThreatMultiplier).toBe(1.4)
    expect(effects.fastStartDurationSeconds).toBe(120)
  })
})
