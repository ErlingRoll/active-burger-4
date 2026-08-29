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
  it('authors a thirty-floor default and unlock-gated deeper contracts', () => {
    expect(DEFAULT_DUNGEON_CONFIG.defaultMaxFloor).toBe(
      DEFAULT_DUNGEON_MAX_FLOOR,
    )
    expect(DEFAULT_DUNGEON_CONFIG.floorDurationSeconds).toBe(60)
    expect(DEFAULT_DUNGEON_CONFIG.bossFloorDurationSeconds).toBe(
      BOSS_FLOOR_EVENT_DURATION_SECONDS,
    )
    expect(DEFAULT_DUNGEON_CONFIG.encounterTimeline).toHaveLength(30)
    expect(
      DEFAULT_DUNGEON_CONFIG.encounterTimeline.map((event) => event.floorNumber),
    ).toEqual(Array.from({ length: 30 }, (_, index) => index + 1))
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
    ).toEqual([200, 500, 1000])
    const contract = DEFAULT_DUNGEON_CONFIG.maximumFloorContracts[0]!
    expect(isDungeonMaxFloorUnlocked(contract)).toBe(false)
    expect(
      isDungeonMaxFloorUnlocked(contract, new Set([contract.requiredUnlockId])),
    ).toBe(true)
    expect(resolveDungeonMaxFloor(DEFAULT_DUNGEON_CONFIG)).toBe(30)
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
    expect(createDungeonEncounterTimeline(contract.maxFloor)).toHaveLength(200)
    expect(createDungeonEncounterTimeline(contract.maxFloor).at(-1)).toMatchObject({
      floorNumber: contract.maxFloor,
      bossDefinitionId: 'inferno-warden',
      isFinal: true,
    })
  })

  it('uses aggressive early stat scaling with a softer late-floor curve', () => {
    expect(getFloorStatMultiplier(1)).toBe(1)
    expect(getFloorStatMultiplier(3)).toBeCloseTo(1.9)
    expect(getFloorStatMultiplier(5)).toBeCloseTo(2.8)
    expect(getFloorStatMultiplier(10)).toBeCloseTo(3.7)

    expect(scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 1)).toEqual({
      maxHp: 100,
      contactDamage: 8,
    })
    expect(scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 5)).toMatchObject({
      maxHp: 280,
    })
    expect(
      scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 5).contactDamage,
    ).toBeCloseTo(15.2)
  })
})
