import { describe, expect, it } from 'vitest'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'
import { createGame } from '../Game'
import {
  equipItem,
  refreshMeleeLeech,
} from './EquipmentState'

describe('equipment melee leech', () => {
  it('adds Iron Cleaver leech and preserves upgrade leech across replacements', () => {
    const game = createGame({ seed: 71 })
    applyUpgrade(game.state, 'whirlwind-unlock')
    applyUpgrade(game.state, 'whirlwind-leech')

    equipItem(game.state.player, 'iron-cleaver')
    expect(game.state.player.meleeLeech).toBe(0.04)

    game.state.player.equipment = {}
    refreshMeleeLeech(game.state.player, [])
    expect(game.state.player.meleeLeech).toBe(0.02)

    equipItem(game.state.player, 'iron-cleaver')
    expect(game.state.player.meleeLeech).toBe(0.04)
  })
})
