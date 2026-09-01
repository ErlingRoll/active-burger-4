import { describe, expect, it } from 'vitest'
import { createDamageValues } from '../../content/stats/Damage'
import { VITALITY_SKILL_ID } from '../../content/skills/Skills'
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
    state.player.characterClassId = 'ranger'
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

  it('applies increased healing to every healing source before capping at max HP', () => {
    const game = createGame({ seed: 93 })
    const state = mutableState(game)
    state.player.hp = 50
    state.player.increasedHealing = 25

    expect(healPlayer(state, 20, 'Vitality')).toBe(25)
    expect(state.player.hp).toBe(75)
    expect(healPlayer(state, 100, 'Healing potion')).toBe(state.player.maxHp - 75)
    expect(state.player.hp).toBe(state.player.maxHp)
  })

  it('records effective healing for the skill that provided it', () => {
    const game = createGame({ seed: 95 })
    const state = mutableState(game)
    state.player.hp = 50

    expect(healPlayer(
      state,
      20,
      'Vitality',
      undefined,
      VITALITY_SKILL_ID,
    )).toBe(20)
    expect(state.run.skillHealingDone).toEqual({
      [VITALITY_SKILL_ID]: 20,
    })

    healPlayer(state, 20, 'Healing potion')
    expect(state.run.skillHealingDone).toEqual({
      [VITALITY_SKILL_ID]: 20,
    })
  })

  it('allows critical Vitality healing and applies the max HP cap afterward', () => {
    const game = createGame({ seed: 94 })
    const state = mutableState(game)
    state.player.hp = 100
    state.player.critChance = 100
    state.player.critMultiplier = 200

    expect(healPlayer(state, 20, 'Vitality', { next: () => 0 })).toBe(40)
    expect(state.player.hp).toBe(140)
    expect(healPlayer(state, 20, 'Vitality', { next: () => 0 })).toBe(10)
    expect(state.player.hp).toBe(state.player.maxHp)
  })
})
