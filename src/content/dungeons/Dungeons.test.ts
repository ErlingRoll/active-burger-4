import { describe, expect, it } from 'vitest'
import {
  BOSS_FLOOR_EVENT_DURATION_SECONDS,
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_MAX_FLOOR,
  createDungeonEncounterTimeline,
  getFloorStatMultiplier,
  getBossDamageMultiplier,
  getFloorContactDamageMultiplier,
  getFloorDifficultyProfile,
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

  it('uses a smooth stat curve with gentle late-floor compounding', () => {
    expect(getFloorStatMultiplier(1)).toBe(1)
    expect(getFloorStatMultiplier(3)).toBeCloseTo(1.6016, 4)
    expect(getFloorStatMultiplier(5)).toBeCloseTo(2.2044, 4)
    expect(getFloorStatMultiplier(10)).toBeCloseTo(3.114, 4)
    expect(getFloorStatMultiplier(50)).toBeGreaterThan(10.3)
    expect(getFloorContactDamageMultiplier(50)).toBeCloseTo(
      getFloorStatMultiplier(50),
      10,
    )

    expect(scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 1)).toEqual({
      maxHp: 100,
      contactDamage: 8,
    })
    expect(scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 3)).toMatchObject({
      maxHp: expect.closeTo(160.16, 2),
    })
    expect(
      scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 3).contactDamage,
    ).toBeCloseTo(12.8128, 4)
    expect(
      scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 5).maxHp,
    ).toBeCloseTo(220.4403, 4)
    expect(
      scaleOrdinaryEnemyStats({ maxHp: 100, contactDamage: 10 }, 5).contactDamage,
    ).toBeCloseTo(17.6352, 4)
  })

  it('reduces damage from the first three floor bosses only', () => {
    expect(getBossDamageMultiplier(1)).toBe(0.7)
    expect(getBossDamageMultiplier(3)).toBe(0.7)
    expect(getBossDamageMultiplier(4)).toBe(1)
  })

  it('ramps supplemental difficulty smoothly across the floor-20 inflection', () => {
    const floorOne = getFloorDifficultyProfile(1)
    const floorFive = getFloorDifficultyProfile(5)
    const floorNineteen = getFloorDifficultyProfile(19)
    const floorTwenty = getFloorDifficultyProfile(20)
    const floorTwentyOne = getFloorDifficultyProfile(21)
    const floorOneHundred = getFloorDifficultyProfile(100)

    expect(floorOne.abilityIntensity).toBeGreaterThan(0)
    expect(floorFive.ordinaryEnemySpeedMultiplier).toBe(1)
    expect(floorTwenty.ordinaryEnemySpeedMultiplier).toBeGreaterThan(
      floorNineteen.ordinaryEnemySpeedMultiplier,
    )
    expect(floorTwentyOne.ordinaryEnemySpeedMultiplier).toBeGreaterThan(
      floorTwenty.ordinaryEnemySpeedMultiplier,
    )
    expect(floorTwentyOne.ordinaryEnemySpeedMultiplier -
      floorTwenty.ordinaryEnemySpeedMultiplier).toBeLessThan(0.02)
    expect(floorOneHundred.spawnThreatMultiplier).toBeGreaterThan(
      floorTwenty.spawnThreatMultiplier,
    )
    expect(getFloorDifficultyProfile(10_000).spawnThreatMultiplier).toBe(2.3)
    expect(getFloorDifficultyProfile(10_000).abilityCooldownMultiplier).toBe(0.55)
  })
})
