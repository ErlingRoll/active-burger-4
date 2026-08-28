import { describe, expect, it } from 'vitest'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'
import { createGame } from '../Game'
import {
  equipItem,
  refreshMeleeLeech,
} from './EquipmentState'
import { getDerivedPlayerStats } from '../stats/DerivedStats'

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

describe('equipment gear sets', () => {
  it('applies cumulative Giant set max HP bonuses at each threshold', () => {
    const game = createGame({ seed: 72 })
    const baseMaxHp = getDerivedPlayerStats(game.state.player).maxHp

    equipItem(game.state.player, 'iron-cleaver')
    equipItem(game.state.player, 'watchers-helm')
    expect(getDerivedPlayerStats(game.state.player).maxHp).toBeCloseTo((baseMaxHp + 24) * 1.1)

    equipItem(game.state.player, 'bastion-plate')
    equipItem(game.state.player, 'swiftstride-boots')
    expect(getDerivedPlayerStats(game.state.player).maxHp).toBeCloseTo((baseMaxHp + 62) * 1.35)

    equipItem(game.state.player, 'duelists-band')
    equipItem(game.state.player, 'giants-amulet')
    expect(getDerivedPlayerStats(game.state.player).maxHp).toBeCloseTo((baseMaxHp + 132) * 1.8)
  })

  it('applies Astral cooldown and Splintering projectile set bonuses', () => {
    const astralGame = createGame({ seed: 73 })
    equipItem(astralGame.state.player, 'starcall-wand')
    equipItem(astralGame.state.player, 'astral-helm')
    equipItem(astralGame.state.player, 'astral-raiment')
    equipItem(astralGame.state.player, 'astral-sabatons')
    expect(getDerivedPlayerStats(astralGame.state.player).cooldownReduction).toBe(17)

    const splinteringGame = createGame({ seed: 74 })
    equipItem(splinteringGame.state.player, 'hunters-bow')
    equipItem(splinteringGame.state.player, 'splintering-helm')
    equipItem(splinteringGame.state.player, 'splintering-armor')
    equipItem(splinteringGame.state.player, 'splintering-boots')
    equipItem(splinteringGame.state.player, 'splintering-ring')
    equipItem(splinteringGame.state.player, 'splintering-amulet')
    expect(getDerivedPlayerStats(splinteringGame.state.player).basicAttackExtraProjectiles).toBe(6)
  })
})
