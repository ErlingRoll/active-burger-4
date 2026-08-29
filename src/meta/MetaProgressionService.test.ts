import { describe, expect, it } from 'vitest'
import {
  getXpMultiplierLevel,
  getStartingLevelRank,
  type MetaUnlockDefinition,
} from './MetaProgressionService'

function unlock(id: string, level: number): MetaUnlockDefinition {
  return {
    id,
    category: 'xp-multiplier',
    cost: 100,
    requiresUnlockId: level > 1 ? `xp-multiplier-${level - 1}` : null,
    isStarter: false,
    payload: {
      level,
      xpMultiplier: 1 + level * 0.05,
    },
  }
}

function startingLevelUnlock(id: string, rank: number): MetaUnlockDefinition {
  return {
    id,
    category: 'starting-level',
    cost: rank === 3 ? 5000 : rank * 1000,
    requiresUnlockId: rank > 1 ? `starting-level-${rank - 1}` : null,
    isStarter: false,
    payload: {
      rank,
      startingLevel: rank + 1,
    },
  }
}

describe('XP multiplier unlock definitions', () => {
  it('derives the highest purchased level from unlocked definitions', () => {
    const definitions = [
      unlock('xp-multiplier-1', 1),
      unlock('xp-multiplier-2', 2),
      unlock('xp-multiplier-3', 3),
    ]

    expect(getXpMultiplierLevel(definitions, [
      'xp-multiplier-1',
      'xp-multiplier-2',
      'xp-multiplier-3',
    ])).toBe(3)
  })

  it('does not exceed the configured level cap', () => {
    expect(getXpMultiplierLevel(
      [unlock('xp-multiplier-11', 11)],
      ['xp-multiplier-11'],
    )).toBe(10)
  })
})

describe('starting-level unlock definitions', () => {
  it('derives the highest purchased rank independently', () => {
    const definitions = [
      startingLevelUnlock('starting-level-1', 1),
      startingLevelUnlock('starting-level-2', 2),
      startingLevelUnlock('starting-level-3', 3),
    ]

    expect(getStartingLevelRank(definitions, [
      'starting-level-1',
      'starting-level-2',
    ])).toBe(2)
  })

  it('does not exceed the configured rank cap', () => {
    expect(getStartingLevelRank(
      [startingLevelUnlock('starting-level-4', 4)],
      ['starting-level-4'],
    )).toBe(3)
  })
})
