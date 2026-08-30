import { describe, expect, it } from 'vitest'
import {
  DUNGEON_MAX_FLOOR_BONUS_PER_RANK,
  DUNGEON_MAX_FLOOR_MAX_RANK,
  DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY,
  getDungeonMaxFloorBonus,
  getDungeonMaxFloorRank,
  getSkillSlotCount,
  getXpMultiplierLevel,
  getStartingLevelRank,
  SKILL_SLOT_UNLOCK_CATEGORY,
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

function dungeonMaxFloorUnlock(id: string, rank: number): MetaUnlockDefinition {
  return {
    id,
    category: DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY,
    cost: rank * 1000,
    requiresUnlockId: rank > 1 ? `dungeon-max-floor-${rank - 1}` : null,
    isStarter: false,
    payload: {
      rank,
      maxFloorBonus: DUNGEON_MAX_FLOOR_BONUS_PER_RANK,
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

describe('skill-slot unlock definitions', () => {
  it('increases capacity only when the one-time unlock is owned', () => {
    const definition: MetaUnlockDefinition = {
      id: 'skill-slot-1',
      category: SKILL_SLOT_UNLOCK_CATEGORY,
      cost: 1000,
      requiresUnlockId: null,
      isStarter: false,
      payload: { skillSlotCount: 6 },
    }

    expect(getSkillSlotCount([definition], [])).toBe(5)
    expect(getSkillSlotCount([definition], ['skill-slot-1'])).toBe(6)
  })
})

describe('dungeon maximum-floor unlock definitions', () => {
  it('adds five floors for each purchased rank', () => {
    const definitions = Array.from(
      { length: DUNGEON_MAX_FLOOR_MAX_RANK },
      (_, index) => dungeonMaxFloorUnlock(
        `dungeon-max-floor-${index + 1}`,
        index + 1,
      ),
    )
    const unlockedIds = definitions.map((definition) => definition.id)

    expect(getDungeonMaxFloorRank(definitions, unlockedIds)).toBe(4)
    expect(getDungeonMaxFloorBonus(definitions, unlockedIds)).toBe(20)
    expect(getDungeonMaxFloorBonus(definitions, [])).toBe(0)
  })

  it('does not exceed the four-rank cap', () => {
    const definition = dungeonMaxFloorUnlock('dungeon-max-floor-5', 5)

    expect(getDungeonMaxFloorRank([definition], [definition.id])).toBe(4)
    expect(getDungeonMaxFloorBonus([definition], [definition.id])).toBe(20)
  })
})
