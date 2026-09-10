import { describe, expect, it } from 'vitest'
import { createGame, FIXED_STEP_SECONDS } from '../../Game'
import { getBossDefinition } from '../../../content/bosses/Bosses'

describe('boss encounter timeline', () => {
  it('starts on the current floor after its normal progress completes', () => {
    const game = createGame({ seed: 123 })
    const updatesThroughFirstFloor = Math.ceil(
      game.dungeon.floorDurationSeconds / FIXED_STEP_SECONDS,
    ) + 1
    for (let index = 0; index < updatesThroughFirstFloor; index += 1) {
      game.update(FIXED_STEP_SECONDS)
      if (game.phase === 'level-up') {
        const choice = game.getPendingChoices()[0]
        if (choice) {
          game.selectChoice(choice)
        }
      }
    }

    expect(game.state.encounter).toMatchObject({
      status: 'active',
      encounterId: 'floor-boss-1',
      normalSpawnsSuspended: true,
    })
    expect(game.state.bosses).toHaveLength(1)
    expect(game.state.run.floor).toBe(1)
    const enemyCount = game.state.enemies.length
    game.update(FIXED_STEP_SECONDS)
    expect(game.state.enemies.length).toBeLessThanOrEqual(enemyCount)
  })

  it('schedules Inferno Warden on the configured maximum floor', () => {
    const game = createGame({ seed: 124 })
    expect(game.dungeon.encounterTimeline.map((event) => event.floorNumber)).toEqual([
      ...Array.from({ length: 30 }, (_, index) => index + 1),
    ])
    expect(game.dungeon.encounterTimeline.at(-1)).toMatchObject({
      floorNumber: 30,
      bossDefinitionId: 'inferno-warden',
      isFinal: true,
    })
  })

  it('triggers the final boss after the final normal floor completes', () => {
    const game = createGame({ seed: 125 })
    game.state.run.floor = game.dungeon.defaultMaxFloor
    game.state.run.floorStartedAt =
      game.state.time - game.dungeon.floorDurationSeconds

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.run.floor).toBe(30)
    expect(game.getUiSnapshot().floorProgress).toBe(1)
    expect(game.state.encounter).toMatchObject({
      status: 'active',
      bossDefinitionId: 'inferno-warden',
      floorNumber: 30,
      isFinal: true,
    })
  })

  it('starts a boss after 45 seconds with Shorter Minute enabled', () => {
    const game = createGame({
      seed: 126,
      worldModifierIds: ['shorter-minute'],
    })

    expect(game.dungeon.floorDurationSeconds).toBe(45)
    expect(game.dungeon.bossFloorDurationSeconds).toBe(120)
    game.state.run.floorStartedAt =
      game.state.time - game.dungeon.floorDurationSeconds

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.encounter).toMatchObject({
      status: 'active',
      bossDefinitionId: game.dungeon.encounterTimeline[0]?.bossDefinitionId,
      floorNumber: 1,
    })
  })

  it('draws each floor boss from the run seed', () => {
    const one = createGame({ seed: 901 }).dungeon.encounterTimeline
    const another = createGame({ seed: 902 }).dungeon.encounterTimeline

    // The same seed has to give the same descent, or a resumed run would meet a
    // different boss than the one it left.
    expect(createGame({ seed: 901 }).dungeon.encounterTimeline).toEqual(one)
    expect(another).not.toEqual(one)
    // The Warden ends a dungeon and is never drawn for an ordinary floor.
    expect(
      one.slice(0, -1).some((event) => event.bossDefinitionId === 'inferno-warden'),
    ).toBe(false)
  })

  it('never sends a boss to a floor below its earliest', () => {
    const timeline = createGame({ seed: 903 }).dungeon.encounterTimeline

    for (const event of timeline.slice(0, -1)) {
      expect(getBossDefinition(event.bossDefinitionId).minFloor)
        .toBeLessThanOrEqual(event.floorNumber)
    }
  })

  it('supports a manual encounter and resumes normal spawns after victory', () => {
    const game = createGame({ seed: 456 })
    expect(game.startBossEncounter()).toBe(true)
    const boss = game.state.bosses?.[0]
    expect(boss).toBeDefined()
    boss!.hp = 0

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.encounter?.status).toBe('complete')
    expect(game.state.encounter?.normalSpawnsSuspended).toBe(false)
  })

  it('does not start a manual encounter while paused or awaiting a choice', () => {
    const game = createGame({ seed: 457 })
    game.pause()
    expect(game.startBossEncounter()).toBe(false)
    game.resume()

    game.spawnXpPickup({ x: 0, y: 0 }, 16)
    game.update(FIXED_STEP_SECONDS)
    expect(game.phase).toBe('level-up')
    expect(game.startBossEncounter()).toBe(false)
    const choice = game.getPendingUpgradeChoices()[0]
    expect(choice).toBeDefined()
    game.selectUpgrade(choice!)
    expect(game.startBossEncounter()).toBe(true)
  })
})
