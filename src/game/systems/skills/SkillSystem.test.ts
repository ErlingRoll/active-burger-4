import { describe, expect, it } from 'vitest'
import {
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../../content/skills/Skills'
import { createGearModifier } from '../../../content/gear/ModifierPools'
import { createGame } from '../../Game'
import { equipRolledItem } from '../../equipment/EquipmentState'
import { collectSkillDamage, updateSkillCooldowns } from './SkillSystem'

const allocator = {
  createEntityId: () => 10_000,
}

describe('skill system', () => {
  it('resolves Whirlwind hits by stable EntityId order and respects cooldown', () => {
    const game = createGame({ seed: 50 })
    game.state.player.skills = [{
      skillId: WHIRLWIND_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    const firstId = game.spawnSlime({ x: 80, y: 0 })
    const secondId = game.spawnSlime({ x: -80, y: 0 })

    const events = collectSkillDamage(game.state, allocator)
    expect(events.map((event) => event.targetId)).toEqual([firstId, secondId])
    expect(events.every((event) => event.damage.physical === 8)).toBe(true)
    expect(game.state.effects[0]?.points).toEqual([{ x: 0, y: 0 }])
    expect(game.state.player.skills.at(-1)?.cooldownRemaining).toBe(2.5)
    expect(collectSkillDamage(game.state, allocator)).toEqual([])

    updateSkillCooldowns(game.state, 2.5)
    expect(collectSkillDamage(game.state, allocator).length).toBe(2)
  })

  it('chains to distinct valid enemies by distance, then EntityId', () => {
    const game = createGame({ seed: 51 })
    game.state.player.skills = [{
      skillId: CHAIN_LIGHTNING_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    const firstId = game.spawnSlime({ x: 100, y: 0 })
    const secondId = game.spawnSlime({ x: 200, y: 0 })
    const thirdId = game.spawnSlime({ x: 220, y: 0 })
    const outOfRangeId = game.spawnSlime({ x: 500, y: 0 })

    const events = collectSkillDamage(game.state, allocator)
    expect(events.map((event) => event.targetId)).toEqual([
      firstId,
      secondId,
      thirdId,
    ])
    expect(new Set(events.map((event) => event.targetId)).size).toBe(3)
    expect(events.every((event) => event.targetId !== outOfRangeId)).toBe(true)
    expect(events.every((event) => event.damage.lightning === 7)).toBe(true)
    expect(game.state.effects[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 220, y: 0 },
    ])
    expect(game.state.player.skills.at(-1)?.cooldownRemaining).toBe(3.5)

    expect(collectSkillDamage(game.state, allocator)).toEqual([])
  })

  it('applies flat and increased player damage modifiers to every player skill', () => {
    const game = createGame({ seed: 52 })
    game.state.player.skills = [
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    equipRolledItem(
      game.state.player,
      'duelists-band',
      'rare',
      [
        createGearModifier('duelists-band', 'flat-lightning-damage', 3, 5),
        createGearModifier('duelists-band', 'increased-elemental-damage', 3, 20),
        createGearModifier('duelists-band', 'crit-chance', 5, 2),
      ],
    )
    const targetId = game.spawnSlime({ x: 80, y: 0 })

    const events = collectSkillDamage(game.state, allocator)
    expect(events.filter((event) => event.sourceSkillId === WHIRLWIND_SKILL_ID)).toEqual([
      expect.objectContaining({
        targetId,
        damage: expect.objectContaining({
          physical: 8,
          lightning: 6,
        }),
      }),
    ])
    expect(events.filter((event) => event.sourceSkillId === CHAIN_LIGHTNING_SKILL_ID)).toEqual([
      expect.objectContaining({
        targetId,
        damage: expect.objectContaining({
          lightning: expect.any(Number),
        }),
      }),
    ])
    const chainEvent = events.find(
      (event) => event.sourceSkillId === CHAIN_LIGHTNING_SKILL_ID,
    )
    expect(chainEvent?.damage.lightning).toBeCloseTo(14.4)
  })

  it('applies weapon cooldown reduction to non-projectile skills', () => {
    const game = createGame({ seed: 53 })
    game.state.player.skills = [{
      skillId: WHIRLWIND_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    equipRolledItem(
      game.state.player,
      'iron-cleaver',
      'common',
      [createGearModifier('iron-cleaver', 'cooldown-reduction', 3, 12)],
    )
    game.spawnSlime({ x: 80, y: 0 })

    collectSkillDamage(game.state, allocator)

    expect(game.state.player.skills[0]?.cooldownRemaining).toBeCloseTo(2.2)
  })

  it('extends Whirlwind reach with area-of-effect gear', () => {
    const game = createGame({ seed: 54 })
    game.state.player.skills = [{
      skillId: WHIRLWIND_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    equipRolledItem(
      game.state.player,
      'duelists-band',
      'common',
      [createGearModifier('duelists-band', 'area-of-effect', 1, 21)],
    )
    const targetId = game.spawnSlime({ x: 100, y: 0 })

    const events = collectSkillDamage(game.state, allocator)

    expect(events).toEqual([
      expect.objectContaining({
        targetId,
        sourceSkillId: WHIRLWIND_SKILL_ID,
      }),
    ])
    expect(game.state.effects[0]?.radius).toBeCloseTo(108.9)
  })
})
