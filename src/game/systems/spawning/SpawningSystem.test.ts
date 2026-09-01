import { describe, expect, it } from 'vitest'
import { getLevelMaxHpBonus } from '../../../content/progression/LevelScaling'
import { createGame } from '../../Game'
import { refreshPlayerDerivedStats } from '../../stats/DerivedStats'

describe('ordinary enemy floor scaling', () => {
  it('scales HP and contact damage from authored stats per floor', () => {
    const game = createGame({ seed: 20260826 })
    const firstId = game.spawnEnemy('slime', { x: 0, y: 0 })
    game.state.run.floor = 2
    const secondId = game.spawnEnemy('slime', { x: 0, y: 0 })

    const first = game.state.enemies.find((enemy) => enemy.id === firstId)
    const second = game.state.enemies.find((enemy) => enemy.id === secondId)
    expect(first).toMatchObject({
      maxHp: 50,
      hp: 50,
      contactDamage: expect.closeTo(4.8, 10),
    })
    expect(second).toMatchObject({
      maxHp: expect.closeTo(62.531, 3),
      hp: expect.closeTo(62.531, 3),
      contactDamage: expect.closeTo(6.003, 3),
    })
  })

  it('varies movement speed deterministically between instances', () => {
    const game = createGame({ seed: 20260827 })
    const firstId = game.spawnEnemy('slime', { x: 0, y: 0 })
    const secondId = game.spawnEnemy('slime', { x: 0, y: 0 })
    const first = game.state.enemies.find((enemy) => enemy.id === firstId)
    const second = game.state.enemies.find((enemy) => enemy.id === secondId)

    expect(first?.speed).toBeCloseTo(84.6)
    expect(second?.speed).toBeCloseTo(85.5)
    expect(first?.speed).not.toBe(second?.speed)
  })

  it('adds capped high-floor pressure without changing the early baseline', () => {
    const game = createGame({ seed: 20260828 })
    const earlyId = game.spawnEnemy('slime', { x: 0, y: 0 })
    game.state.run.floor = 100
    const lateId = game.spawnEnemy('slime', { x: 0, y: 0 })
    const early = game.state.enemies.find((enemy) => enemy.id === earlyId)
    const late = game.state.enemies.find((enemy) => enemy.id === lateId)

    expect(early).toMatchObject({
      maxHp: 50,
      speed: expect.closeTo(84.6, 5),
      contactDamage: expect.closeTo(4.8, 10),
    })
    expect(late?.maxHp).toBeGreaterThan(early?.maxHp ?? 0)
    expect(late?.speed).toBeGreaterThan(early?.speed ?? 0)
    expect(late?.contactDamage).toBeGreaterThan(early?.contactDamage ?? 0)
  })

  it('uses tougher authored baselines for every ordinary mob role', () => {
    const game = createGame({ seed: 20260829 })
    const definitions = [
      ['slime', 50, 4.8],
      ['runner', 26, 4],
      ['brute', 210, 9.6],
      ['archer', 60, 7.2],
      ['splitter', 104, 6.4],
      ['flanker', 46, 4.8],
    ] as const

    for (const [definitionId, maxHp, contactDamage] of definitions) {
      const id = game.spawnEnemy(definitionId, { x: 1_000, y: 0 })
      const enemy = game.state.enemies.find((candidate) => candidate.id === id)
      expect(enemy).toMatchObject({
        maxHp,
        hp: maxHp,
      })
      expect(enemy?.contactDamage).toBeCloseTo(contactDamage)
    }
  })

  it('applies Glass World multipliers to the complete derived player stats', () => {
    const game = createGame({
      seed: 20260830,
      worldModifierIds: ['glass-world'],
    })

    expect(game.state.player.baseStats).toMatchObject({
      maxHp: 150,
      attackDamage: 14,
      attackSpeed: 1,
      movementSpeed: 160,
    })
    expect(game.state.player.maxHp).toBeCloseTo(112.5)
    expect(game.state.player.attackDamage).toBeCloseTo(15.4)
    expect(game.state.player.attackSpeed).toBeCloseTo(1.1)
    expect(game.state.player.movementSpeed).toBeCloseTo(168)

    game.state.player.level = 100
    refreshPlayerDerivedStats(game.state.player)

    expect(game.state.player.maxHp).toBeCloseTo(
      (150 + getLevelMaxHpBonus(100)) * 0.75,
    )
  })
})
