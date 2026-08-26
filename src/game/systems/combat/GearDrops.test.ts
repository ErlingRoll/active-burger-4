import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'
import { removeDeadEntities } from './CombatSystem'

const neverDrops = {
  chance: () => false,
  next: () => 0.5,
  int: () => 1,
  pick: <T>(items: readonly T[]) => items[0] as T,
}

describe('enemy gear drops', () => {
  it('keeps seeded drop outcomes deterministic', () => {
    const run = () => {
      const game = createGame({ seed: 47 })
      game.spawnSlime({ x: 500, y: 0 })
      const enemy = game.state.enemies[0]
      if (!enemy) {
        throw new Error('Expected a spawned enemy')
      }
      enemy.hp = 0
      game.update(1 / 60)
      return game.state.pickups.map((pickup) => pickup.kind)
    }

    expect(run()).toEqual(run())
    expect(run()).toContain('gear')
  })

  it('forces exactly kill 50 when no gear orb has been generated', () => {
    const game = createGame({ seed: 1 })
    const gearPickups: string[] = []

    for (let index = 0; index < 49; index += 1) {
      game.spawnSlime({ x: 1_000 + index, y: 0 })
    }
    for (const enemy of game.state.enemies) {
      enemy.hp = 0
    }

    removeDeadEntities(
      game.state,
      () => {},
      undefined,
      (position, sourceEnemyDefinitionId) => {
        gearPickups.push(`${position.x}:${sourceEnemyDefinitionId}`)
      },
      neverDrops,
    )
    expect(game.state.run.killCount).toBe(49)
    expect(game.state.run.gearDropGenerated).toBe(false)
    expect(gearPickups).toHaveLength(0)

    game.spawnSlime({ x: 1_100, y: 0 })
    const lastEnemy = game.state.enemies.at(-1)
    if (!lastEnemy) {
      throw new Error('Expected the fiftieth enemy')
    }
    lastEnemy.hp = 0
    removeDeadEntities(
      game.state,
      () => {},
      undefined,
      (position, sourceEnemyDefinitionId) => {
        gearPickups.push(`${position.x}:${sourceEnemyDefinitionId}`)
      },
      neverDrops,
    )

    expect(game.state.run.killCount).toBe(50)
    expect(game.state.run.gearDropGenerated).toBe(false)
    expect(gearPickups).toHaveLength(0)
  })

  it('does not create gear at kill 50 when normal drop rolls fail', () => {
    const game = createGame({ seed: 2 })
    const gearPickups: number[] = []
    const random = {
      chance: () => false,
      next: () => 1,
      int: () => 1,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    for (let index = 0; index < 50; index += 1) {
      game.spawnSlime({ x: 1_000 + index, y: 0 })
    }
    for (const enemy of game.state.enemies) {
      enemy.hp = 0
    }
    removeDeadEntities(
      game.state,
      () => {},
      undefined,
      () => gearPickups.push(1),
      random,
    )
    expect(gearPickups).toHaveLength(0)

    game.spawnSlime({ x: 1_100, y: 0 })
    const enemy = game.state.enemies.at(-1)
    if (!enemy) {
      throw new Error('Expected another enemy')
    }
    enemy.hp = 0
    removeDeadEntities(game.state, () => {}, undefined, () => gearPickups.push(1), random)
    expect(game.state.run.killCount).toBe(51)
    expect(gearPickups).toHaveLength(0)
  })

  it('collects gear orbs through the pending gear bridge, not XP', () => {
    const game = createGame({ seed: 3 })
    game.spawnGearPickup({ x: 0, y: 0 }, 'brute')

    game.update(1 / 60)

    expect(game.state.player.xp).toBe(0)
    expect(game.state.pickups).toEqual([])
    expect(game.getPendingGearPickups()).toEqual([
      expect.objectContaining({
        kind: 'gear',
        sourceEnemyDefinitionId: 'brute',
      }),
    ])
    expect(game.consumePendingGearPickups()).toHaveLength(1)
    expect(game.getPendingGearPickups()).toEqual([])
  })
})
