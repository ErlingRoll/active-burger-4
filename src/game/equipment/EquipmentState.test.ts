import { describe, expect, it } from 'vitest'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'
import { createGame } from '../Game'
import {
  equipItem,
  refreshMeleeLeech,
} from './EquipmentState'

describe('equipment melee leech', () => {
  it('tracks gear melee leech separately from Whirlwind upgrade leech', () => {
    const game = createGame({ seed: 71 })
    applyUpgrade(game.state, 'whirlwind-unlock')
    applyUpgrade(game.state, 'whirlwind-leech')

    equipItem(game.state.player, 'iron-cleaver')
    expect(game.state.player.meleeLeech).toBe(0.02)
    expect(game.state.player.whirlwindLeech).toBe(0.04)

    game.state.player.equipment = {}
    refreshMeleeLeech(game.state.player, [])
    expect(game.state.player.meleeLeech).toBe(0)
    expect(game.state.player.whirlwindLeech).toBe(0.02)

    equipItem(game.state.player, 'iron-cleaver')
    expect(game.state.player.meleeLeech).toBe(0.02)
    expect(game.state.player.whirlwindLeech).toBe(0.04)
  })
})
