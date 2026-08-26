import { describe, expect, it } from 'vitest'
import {
  ARCHER_DEFINITION_ID,
  BRUTE_DEFINITION_ID,
  RUNNER_DEFINITION_ID,
  SPLITTER_DEFINITION_ID,
} from '../../../content/enemies/Enemies'
import { FIXED_STEP_SECONDS, createGame } from '../../Game'

describe('enemy variety behaviors', () => {
  it('makes Runner faster and less durable than Brute', () => {
    const game = createGame({ seed: 101 })
    game.spawnEnemy(RUNNER_DEFINITION_ID, { x: 100, y: 0 })
    game.spawnEnemy(BRUTE_DEFINITION_ID, { x: 100, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    const [runner, brute] = game.state.enemies
    expect(runner.speed).toBeGreaterThan(brute.speed)
    expect(runner.maxHp).toBeLessThan(brute.maxHp)
    expect(runner.x).toBeLessThan(brute.x)
  })

  it('keeps Archer outside contact while remaining in player targeting range', () => {
    const game = createGame({ seed: 102 })
    const archerId = game.spawnEnemy(ARCHER_DEFINITION_ID, { x: 100, y: 0 })
    const archer = game.state.enemies.find((enemy) => enemy.id === archerId)
    if (!archer) {
      throw new Error('Expected archer to exist')
    }
    archer.hp = 1_000
    archer.maxHp = 1_000

    for (let tick = 0; tick < 70; tick += 1) {
      game.update(FIXED_STEP_SECONDS)
    }

    const currentArcher = game.state.enemies.find(
      (enemy) => enemy.definitionId === ARCHER_DEFINITION_ID,
    )
    expect(currentArcher).toBeDefined()
    if (!currentArcher) {
      return
    }
    const archerDistance = Math.hypot(
      currentArcher.x - game.state.player.x,
      currentArcher.y - game.state.player.y,
    )
    expect(archerDistance).toBeGreaterThan(
      game.state.player.radius + currentArcher.radius,
    )
    expect(archerDistance).toBeLessThanOrEqual(
      game.state.player.attackRange,
    )
    expect(game.state.player.targetId).toBe(currentArcher.id)
  })

  it('splits once into stable, non-XP-awarding children', () => {
    const run = () => {
      const game = createGame({ seed: 103 })
      const parentId = game.spawnEnemy(SPLITTER_DEFINITION_ID, { x: 100, y: 50 })
      const parent = game.state.enemies.find((enemy) => enemy.id === parentId)
      if (!parent) {
        throw new Error('Expected splitter to exist')
      }
      parent.hp = 0
      game.update(FIXED_STEP_SECONDS)
      return {
        enemies: game.state.enemies.map((enemy) => ({
          id: enemy.id,
          definitionId: enemy.definitionId,
          x: enemy.x,
          y: enemy.y,
          xpReward: enemy.xpReward,
        })),
        pickups: game.state.pickups.map((pickup) => pickup.xpAmount),
        kills: game.state.run.killCount,
      }
    }

    const first = run()
    expect(first).toEqual(run())
    expect(first.kills).toBe(1)
    expect(first.pickups).toEqual([12])
    expect(first.enemies).toHaveLength(2)
    expect(first.enemies.map((enemy) => enemy.id)).toEqual([4, 5])
    expect(first.enemies.every((enemy) => enemy.definitionId === 'slime')).toBe(true)
    expect(first.enemies.every((enemy) => enemy.xpReward === 0)).toBe(true)
  })
})
