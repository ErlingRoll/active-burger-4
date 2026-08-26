import { describe, expect, it } from 'vitest'
import {
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../../content/skills/Skills'
import { createGame } from '../../Game'
import { applyUpgrade } from './UpgradeSystem'

describe('skill upgrades', () => {
  it('unlocks skills and increases their rank without changing stat upgrades', () => {
    const game = createGame({ seed: 61 })
    const damageBefore = game.state.player.attackDamage

    applyUpgrade(game.state, 'whirlwind-unlock')
    applyUpgrade(game.state, 'whirlwind-level')
    applyUpgrade(game.state, 'chain-lightning-unlock')
    applyUpgrade(game.state, 'basic-bolt-level')

    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: 'basic-bolt', level: 2 }),
      expect.objectContaining({ skillId: WHIRLWIND_SKILL_ID, level: 2 }),
      expect.objectContaining({ skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1 }),
    ])
    applyUpgrade(game.state, 'damage-boost')
    expect(game.state.player.attackDamage).toBe(damageBefore + 2)
  })

  it('applies the deterministic Dodge reaction-time upgrade', () => {
    const game = createGame({ seed: 62 })
    expect(game.state.player.dodge).toMatchObject({
      mode: 'autonomous',
      level: 1,
      reactionTime: 0.1,
    })

    applyUpgrade(game.state, 'dodge-reaction')

    expect(game.state.player.dodge).toMatchObject({
      mode: 'autonomous',
      level: 2,
      reactionTime: 0.05,
    })
    expect(game.state.player.movementSpeed).toBe(100)
  })

  it('adds leech without unlocking or ranking the already-owned Whirlwind skill', () => {
    const game = createGame({ seed: 63 })
    applyUpgrade(game.state, 'whirlwind-unlock')

    applyUpgrade(game.state, 'whirlwind-leech')

    expect(game.state.player.meleeLeech).toBe(0.02)
    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: 'basic-bolt', level: 1 }),
      expect.objectContaining({ skillId: WHIRLWIND_SKILL_ID, level: 1 }),
    ])
  })
})
