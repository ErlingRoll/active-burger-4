import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'

describe('ordinary enemy floor scaling', () => {
  it('scales HP and contact damage from authored stats per floor', () => {
    const game = createGame({ seed: 20260826 })
    const firstId = game.spawnEnemy('slime', { x: 0, y: 0 })
    game.state.run.floor = 2
    const secondId = game.spawnEnemy('slime', { x: 0, y: 0 })

    const first = game.state.enemies.find((enemy) => enemy.id === firstId)
    const second = game.state.enemies.find((enemy) => enemy.id === secondId)
    expect(first).toMatchObject({ maxHp: 20, hp: 20, contactDamage: 4 })
    expect(second).toMatchObject({
      maxHp: 26,
      hp: 26,
      contactDamage: 4.4,
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
      maxHp: 20,
      speed: expect.closeTo(84.6, 5),
      contactDamage: 4,
    })
    expect(late?.maxHp).toBeGreaterThan(early?.maxHp ?? 0)
    expect(late?.speed).toBeGreaterThan(early?.speed ?? 0)
    expect(late?.contactDamage).toBeGreaterThan(early?.contactDamage ?? 0)
  })
})
