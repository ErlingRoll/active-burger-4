import { describe, expect, it } from 'vitest'
import { createGame, FIXED_STEP_SECONDS } from '../../Game'

describe('boss encounter timeline', () => {
  it('starts once at the deterministic 3:00 boundary and suspends normal spawns', () => {
    const game = createGame({ seed: 123 })
    for (let index = 0; index < 180 * 60; index += 1) {
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
      encounterId: 'stone-golem-encounter',
      normalSpawnsSuspended: true,
    })
    expect(game.state.bosses).toHaveLength(1)
    const enemyCount = game.state.enemies.length
    game.update(FIXED_STEP_SECONDS)
    expect(game.state.enemies.length).toBe(enemyCount)
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

    game.spawnXpPickup({ x: 0, y: 0 }, 10)
    game.update(FIXED_STEP_SECONDS)
    expect(game.phase).toBe('level-up')
    expect(game.startBossEncounter()).toBe(false)
    const choice = game.getPendingUpgradeChoices()[0]
    expect(choice).toBeDefined()
    game.selectUpgrade(choice!)
    expect(game.startBossEncounter()).toBe(true)
  })
})
