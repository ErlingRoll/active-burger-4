import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'
import { HEALING_POTION_ELITE_DROP_CHANCE, HEALING_POTION_ORDINARY_DROP_CHANCE } from '../../../content/progression/HealingPotions'
import { removeDeadEntities } from './CombatSystem'

const neverDrops = {
  chance: () => false,
  next: () => 0.5,
  int: () => 1,
  pick: <T>(items: readonly T[]) => items[0] as T,
}

describe('enemy gear drops', () => {
  it('spawns a potion only when an ordinary enemy passes its 5% drop roll', () => {
    const game = createGame({ seed: 4 })
    game.spawnSlime({ x: 100, y: 200 })
    const slime = game.state.enemies[0]
    if (!slime) {
      throw new Error('Expected a spawned slime')
    }
    slime.hp = 0
    const rolls: number[] = []
    const potions: { x: number; y: number }[] = []
    const random = {
      chance: (chance: number) => {
        rolls.push(chance)
        return chance === HEALING_POTION_ORDINARY_DROP_CHANCE
      },
      next: () => 0.5,
      int: () => 1,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    removeDeadEntities(game.state, () => {}, undefined, undefined, random, (position) => {
      potions.push(position)
    })

    expect(rolls).toContain(HEALING_POTION_ORDINARY_DROP_CHANCE)
    expect(potions).toEqual([{ x: 100, y: 200 }])
  })

  it('does not spawn a potion when an ordinary enemy fails its drop roll', () => {
    const game = createGame({ seed: 5 })
    game.spawnSlime({ x: 100, y: 200 })
    const slime = game.state.enemies[0]
    if (!slime) {
      throw new Error('Expected a spawned slime')
    }
    slime.hp = 0
    const potions: unknown[] = []

    removeDeadEntities(game.state, () => {}, undefined, undefined, neverDrops, (position) => {
      potions.push(position)
    })

    expect(potions).toEqual([])
  })

  it('uses the 15% potion drop chance for elite enemies', () => {
    const game = createGame({ seed: 6 })
    game.spawnEnemy('slime', { x: 100, y: 200 }, undefined, 'hasted')
    const elite = game.state.enemies[0]
    if (!elite) {
      throw new Error('Expected a spawned elite')
    }
    elite.hp = 0
    const rolls: number[] = []
    const random = {
      chance: (chance: number) => {
        rolls.push(chance)
        return chance === HEALING_POTION_ELITE_DROP_CHANCE
      },
      next: () => 0.5,
      int: () => 1,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    removeDeadEntities(game.state, () => {}, undefined, undefined, random, () => {})

    expect(rolls).toContain(HEALING_POTION_ELITE_DROP_CHANCE)
  })

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
