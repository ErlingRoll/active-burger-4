import { describe, expect, it } from 'vitest'
import { createDamageValues } from '../../content/stats/Damage'
import { createGame } from '../Game'
import type { GameState } from '../state/GameState'
import { applyDamageEvents } from '../systems/combat/CombatSystem'
import { healPlayer } from './PlayerCombatLog'

function mutableState(game: ReturnType<typeof createGame>): GameState {
  return {
    ...game.state,
    run: { ...game.state.run, playerCombatLog: [] },
    player: { ...game.state.player },
  }
}

describe('player combat log', () => {
  it('records each mitigated damage type and healing with resulting player HP', () => {
    const game = createGame({ seed: 91 })
    const slimeId = game.spawnSlime({ x: 40, y: 0 })
    const state = mutableState(game)
    state.time = 5
    state.player.hp = 30

    applyDamageEvents(state, [{
      sourceId: slimeId,
      targetId: state.player.id,
      damage: createDamageValues({ physical: 12, fire: 20 }),
    }])

    expect(state.run.playerCombatLog).toEqual([
      {
        time: 5,
        kind: 'damage',
        amount: 12,
        damageType: 'physical',
        source: 'Slime',
        resultingHp: 18,
      },
      {
        time: 5,
        kind: 'damage',
        amount: 18,
        damageType: 'fire',
        source: 'Slime',
        resultingHp: 0,
      },
    ])

    healPlayer(state, 15, 'Healing potion')

    expect(state.run.playerCombatLog?.[2]).toEqual({
      time: 5,
      kind: 'healing',
      amount: 15,
      source: 'Healing potion',
      resultingHp: 15,
    })
  })

  it('retains only the final ten seconds of player combat events', () => {
    const game = createGame({ seed: 92 })
    const state = mutableState(game)
    state.player.hp = 100
    healPlayer(state, 1, 'Healing potion')
    state.time = 11
    state.player.hp = 100

    healPlayer(state, 1, 'Healing potion')

    expect(state.run.playerCombatLog).toEqual([
      expect.objectContaining({ time: 11, kind: 'healing' }),
    ])
  })
})
