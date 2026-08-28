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
      maxHp: 30,
      hp: 30,
      contactDamage: 5,
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
})
