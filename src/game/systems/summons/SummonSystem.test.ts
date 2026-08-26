import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'
import { updateSummons } from './SummonSystem'

describe('updateSummons', () => {
  it('has the Necromancer starter skeleton attack the nearest in-range enemy deterministically', () => {
    const game = createGame({ seed: 11, playstyleId: 'necromancer' })
    const targetId = game.spawnSlime({ x: 40, y: 20 })

    const events = updateSummons(game.state, 1 / 60)

    expect(game.state.summons).toHaveLength(1)
    expect(events).toEqual([{
      sourceId: game.state.summons[0]!.id,
      targetId,
      damage: {
        physical: 6,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
      criticalStrike: {
        chance: 5,
        multiplier: 200,
      },
    }])
  })
})
