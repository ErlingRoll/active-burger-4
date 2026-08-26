import { describe, expect, it } from 'vitest'
import {
  BOSS_FLOOR_EVENT_DURATION_SECONDS,
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_MAX_FLOOR,
  createDungeonEncounterTimeline,
  getFloorStatMultiplier,
  isDungeonMaxFloorUnlocked,
  resolveDungeonMaxFloor,
  scaleOrdinaryEnemyStats,
} from './Dungeons'

describe('default dungeon timeline foundation', () => {
  it('authors a ten-floor default and unlock-gated deeper contracts', () => {
    expect(DEFAULT_DUNGEON_CONFIG.defaultMaxFloor).toBe(
      DEFAULT_DUNGEON_MAX_FLOOR,
    )
    expect(DEFAULT_DUNGEON_CONFIG.floorDurationSeconds).toBe(120)
    expect(DEFAULT_DUNGEON_CONFIG.bossFloorDurationSeconds).toBe(
      BOSS_FLOOR_EVENT_DURATION_SECONDS,
    )
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline).toHaveLength(10)
    expect(
      DEFAULT_DUNGEON_CONFIG.encounterTimeline.map((event) => event.floorNumber),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bossDefinitionId: 'stone-golem',
          durationSeconds: 120,
          floorNumber: 1,
        }),
      ]),
    )
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline.at(-1)).toMatchObject({
      floorNumber: DEFAULT_DUNGEON_MAX_FLOOR,
      bossDefinitionId: 'inferno-warden',
      isFinal: true,
      durationSeconds: 120,
    })

    expect(
      DEFAULT_DUNGEON_CONFIG.maximumFloorContracts.map(
        (contract) => contract.maxFloor,
      ),
    ).toEqual([20, 50, 100])
    const contract = DEFAULT_DUNGEON_CONFIG.maximumFloorContracts[0]!
    expect(isDungeonMaxFloorUnlocked(contract)).toBe(false)
    expect(
      isDungeonMaxFloorUnlocked(contract, new Set([contract.requiredUnlockId])),
    ).toBe(true)
    expect(resolveDungeonMaxFloor(DEFAULT_DUNGEON_CONFIG)).toBe(10)
    expect(() =>
      resolveDungeonMaxFloor(DEFAULT_DUNGEON_CONFIG, contract.id),
    ).toThrow(/requires unlock/)
    expect(
      resolveDungeonMaxFloor(
        DEFAULT_DUNGEON_CONFIG,
        contract.id,
        new Set([contract.requiredUnlockId]),
      ),
    ).toBe(contract.maxFloor)
    expect(createDungeonEncounterTimeline(contract.maxFloor)).toHaveLength(20)
    expect(createDungeonEncounterTimeline(contract.maxFloor).at(-1)).toMatchObject({
      floorNumber: contract.maxFloor,
      bossDefinitionId: 'inferno-warden',
      isFinal: true,
    })
  })

  it('uses one-based floors and authored-base, linear stat scaling', () => {
    expect(getFloorStatMultiplier(1)).toBe(1)
    expect(getFloorStatMultiplier(3)).toBe(1.02)

    expect(scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 3)).toEqual({
      maxHp: 102,
      contactDamage: 10.2,
    })
  })
})
