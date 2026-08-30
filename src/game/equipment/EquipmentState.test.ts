import { describe, expect, it } from 'vitest'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'
import { createGame } from '../Game'
import {
  equipItem,
  equipRolledItem,
  refreshMeleeLeech,
} from './EquipmentState'
import { getDerivedPlayerStats } from '../stats/DerivedStats'
import { Rarity } from '../../content/rarity/Rarity'

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

describe('equipment attack range', () => {
  it('uses the equipped weapon range after swapping archetypes', () => {
    const game = createGame({ seed: 75, playstyleId: 'knight' })

    expect(getDerivedPlayerStats(game.state.player).attackRange).toBe(45)

    equipItem(game.state.player, 'ritual-staff')
    expect(getDerivedPlayerStats(game.state.player).attackRange).toBe(110)

    equipItem(game.state.player, 'iron-cleaver')
    expect(getDerivedPlayerStats(game.state.player).attackRange).toBe(45)
    expect('attackRange' in game.state.player).toBe(false)
  })
})

describe('equipment gear sets', () => {
  it('applies cumulative Giant all-resistance bonuses at each threshold', () => {
    const game = createGame({ seed: 72 })

    equipItem(game.state.player, 'iron-cleaver')
    equipItem(game.state.player, 'watchers-helm')
    expect(getDerivedPlayerStats(game.state.player).resistances).toMatchObject({
      physical: 15,
      elemental: 15,
      chaos: 15,
    })

    equipItem(game.state.player, 'bastion-plate')
    equipItem(game.state.player, 'swiftstride-boots')
    expect(getDerivedPlayerStats(game.state.player).resistances).toMatchObject({
      physical: 30,
      elemental: 30,
      chaos: 30,
    })

    equipItem(game.state.player, 'duelists-band')
    equipItem(game.state.player, 'giants-amulet')
    expect(getDerivedPlayerStats(game.state.player).resistances).toMatchObject({
      physical: 45,
      elemental: 45,
      chaos: 45,
    })
  })

  it("applies cumulative Scholar's XP bonuses at each threshold", () => {
    const scholarGame = createGame({ seed: 73 })
    const scholarItems = [
      'ritual-staff',
      'helmet',
      'armor',
      'boots',
      'ring',
      'amulet',
    ] as const
    for (const [index, itemId] of scholarItems.entries()) {
      equipRolledItem(
        scholarGame.state.player,
        itemId,
        Rarity.Common,
        [],
        undefined,
        'scholar',
      )
      if (index === 1) {
        expect(getDerivedPlayerStats(scholarGame.state.player).experienceGainPercent).toBe(5)
      } else if (index === 3) {
        expect(getDerivedPlayerStats(scholarGame.state.player).experienceGainPercent).toBe(15)
      } else if (index === 5) {
        expect(getDerivedPlayerStats(scholarGame.state.player).experienceGainPercent).toBe(30)
      }
    }
  })

  it('applies Astral cooldown and Splintering projectile set bonuses', () => {
    const astralGame = createGame({ seed: 73 })
    equipItem(astralGame.state.player, 'starcall-wand')
    equipItem(astralGame.state.player, 'astral-helm')
    equipItem(astralGame.state.player, 'astral-raiment')
    equipItem(astralGame.state.player, 'astral-sabatons')
    expect(getDerivedPlayerStats(astralGame.state.player).cooldownReduction).toBe(30)

    const splinteringGame = createGame({ seed: 74 })
    equipItem(splinteringGame.state.player, 'hunters-bow')
    equipItem(splinteringGame.state.player, 'splintering-helm')
    equipItem(splinteringGame.state.player, 'splintering-armor')
    equipItem(splinteringGame.state.player, 'splintering-boots')
    equipItem(splinteringGame.state.player, 'splintering-ring')
    equipItem(splinteringGame.state.player, 'splintering-amulet')
    const splinteringStats = getDerivedPlayerStats(splinteringGame.state.player)
    expect(splinteringStats.globalExtraProjectiles).toBe(6)
    expect(splinteringStats.basicAttackExtraProjectiles).toBe(0)
  })
})
