import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  getSkillDamage,
  getSkillDefinition,
} from '../../../content/skills/Skills'
import { getSkillDamageIncreasePercent } from '../../../content/upgrades/Upgrades'
import { createGame } from '../../Game'
import { applyUpgrade } from './UpgradeSystem'

describe('skill upgrades', () => {
  it('unlocks skills and increases their rank without changing stat upgrades', () => {
    const game = createGame({ seed: 61 })
    const damageBefore = game.state.player.attackDamage

    applyUpgrade(game.state, 'whirlwind-unlock')
    applyUpgrade(game.state, 'whirlwind-level')
    applyUpgrade(game.state, 'chain-lightning-unlock')
    applyUpgrade(game.state, 'basic-attack-level')

    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: BASIC_ATTACK_SKILL_ID, level: 2 }),
      expect.objectContaining({ skillId: WHIRLWIND_SKILL_ID, level: 2 }),
      expect.objectContaining({ skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1 }),
    ])
    expect(game.state.player.attackDamage).toBe(damageBefore)
    const basicAttack = getSkillDefinition(BASIC_ATTACK_SKILL_ID)
    expect(getSkillDamage(basicAttack, 2).physical).toBe(0)
    expect(getSkillDamageIncreasePercent(BASIC_ATTACK_SKILL_ID, 2)).toBe(10)
  })

  it('adds leech without unlocking or ranking the already-owned Whirlwind skill', () => {
    const game = createGame({ seed: 63 })
    applyUpgrade(game.state, 'whirlwind-unlock')

    applyUpgrade(game.state, 'whirlwind-leech')

    expect(game.state.player.meleeLeech).toBe(0)
    expect(game.state.player.whirlwindLeech).toBe(0.02)
    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: BASIC_ATTACK_SKILL_ID, level: 1 }),
      expect.objectContaining({ skillId: WHIRLWIND_SKILL_ID, level: 1 }),
    ])
  })

  it('adds Magnet collection range ranks without compounding them', () => {
    const game = createGame({ seed: 64 })

    applyUpgrade(game.state, 'magnet')
    applyUpgrade(game.state, 'magnet')

    expect(game.state.player.pickupCollectionRangeMultiplier).toBeCloseTo(1.2)
  })

  it('removes a skill and clears all upgrades acquired for that skill', () => {
    const game = createGame({ seed: 65 })
    applyUpgrade(game.state, 'whirlwind-level')
    applyUpgrade(game.state, 'whirlwind-leech')
    game.state.run.selectedUpgradeIds.push(
      'whirlwind-unlock',
      'whirlwind-level',
      'whirlwind-leech',
    )

    applyUpgrade(game.state, 'remove-skill', WHIRLWIND_SKILL_ID)

    expect(game.state.player.skills.map((skill) => skill.skillId)).toEqual([
      BASIC_ATTACK_SKILL_ID,
    ])
    expect(game.state.player.upgradeWhirlwindLeech).toBe(0)
    expect(game.state.run.selectedUpgradeIds).not.toEqual(
      expect.arrayContaining([
        'whirlwind-unlock',
        'whirlwind-level',
        'whirlwind-leech',
      ]),
    )
    expect(game.state.player.meleeLeech).toBe(0)

    applyUpgrade(game.state, 'whirlwind-unlock')
    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: BASIC_ATTACK_SKILL_ID, level: 1 }),
      expect.objectContaining({ skillId: WHIRLWIND_SKILL_ID, level: 1 }),
    ])
  })

  it('does not allow Basic Attack to be removed', () => {
    const game = createGame({ seed: 66 })

    expect(() =>
      applyUpgrade(game.state, 'remove-skill', BASIC_ATTACK_SKILL_ID),
    ).toThrow('Skill removal requires a non-basic skill.')
  })
})
