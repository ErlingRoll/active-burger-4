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
    expect(first).toMatchObject({ maxHp: 20, hp: 20, contactDamage: 5 })
    expect(second).toMatchObject({
      maxHp: 20.2,
      hp: 20.2,
      contactDamage: 5.05,
    })
  })
})
