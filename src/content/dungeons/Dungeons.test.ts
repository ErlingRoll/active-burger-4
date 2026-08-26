import { describe, expect, it } from 'vitest'
import {
  BOSS_FLOOR_EVENT_DURATION_SECONDS,
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_LENGTH_SECONDS,
  createDungeonEncounterTimeline,
  getDungeonFloor,
  getFloorStatMultiplier,
  isDungeonLengthUnlocked,
  resolveDungeonLengthSeconds,
  scaleOrdinaryEnemyStats,
} from './Dungeons'

describe('default dungeon timeline foundation', () => {
  it('authors a ten-minute default and unlock-gated longer contracts', () => {
    expect(DEFAULT_DUNGEON_CONFIG.defaultLengthSeconds).toBe(
      DEFAULT_DUNGEON_LENGTH_SECONDS,
    )
    expect(DEFAULT_DUNGEON_CONFIG.floorDurationSeconds).toBe(120)
    expect(DEFAULT_DUNGEON_CONFIG.bossFloorDurationSeconds).toBe(
      BOSS_FLOOR_EVENT_DURATION_SECONDS,
    )
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline).toHaveLength(5)
    expect(
      DEFAULT_DUNGEON_CONFIG.encounterTimeline.map((event) => event.timeSeconds),
    ).toEqual([120, 240, 360, 480, 600])
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bossDefinitionId: 'stone-golem',
          durationSeconds: 120,
          floorNumber: 2,
        }),
      ]),
    )
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline.at(-1)).toMatchObject({
      timeSeconds: DEFAULT_DUNGEON_LENGTH_SECONDS,
      bossDefinitionId: 'inferno-warden',
      isFinal: true,
      durationSeconds: 120,
    })

    const contract = DEFAULT_DUNGEON_CONFIG.longerLengthContracts[0]!
    expect(contract.lengthSeconds).toBeGreaterThan(
      DEFAULT_DUNGEON_CONFIG.defaultLengthSeconds,
    )
    expect(isDungeonLengthUnlocked(contract)).toBe(false)
    expect(isDungeonLengthUnlocked(contract, new Set([contract.requiredUnlockId]))).toBe(true)
    expect(resolveDungeonLengthSeconds(DEFAULT_DUNGEON_CONFIG)).toBe(600)
    expect(() =>
      resolveDungeonLengthSeconds(DEFAULT_DUNGEON_CONFIG, contract.id),
    ).toThrow(/requires unlock/)
    expect(
      resolveDungeonLengthSeconds(
        DEFAULT_DUNGEON_CONFIG,
        contract.id,
        new Set([contract.requiredUnlockId]),
      ),
    ).toBe(contract.lengthSeconds)
    expect(createDungeonEncounterTimeline(contract.lengthSeconds)).toHaveLength(8)
    expect(
      createDungeonEncounterTimeline(contract.lengthSeconds).at(-1)?.timeSeconds,
    ).toBe(contract.lengthSeconds)
    expect(createDungeonEncounterTimeline(contract.lengthSeconds).at(-1)).toMatchObject({
      bossDefinitionId: 'inferno-warden',
      isFinal: true,
    })
  })

  it('uses one-based floors and authored-base, linear stat scaling', () => {
    expect(getDungeonFloor(0)).toBe(1)
    expect(getDungeonFloor(119.999)).toBe(1)
    expect(getDungeonFloor(120)).toBe(2)
    expect(getFloorStatMultiplier(1)).toBe(1)
    expect(getFloorStatMultiplier(3)).toBe(1.02)

    expect(scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 3)).toEqual({
      maxHp: 102,
      contactDamage: 10.2,
    })
  })
})
