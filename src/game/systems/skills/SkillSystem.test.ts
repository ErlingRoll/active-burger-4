import { describe, expect, it } from 'vitest'
import {
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../../content/skills/Skills'
import { createGame } from '../../Game'
import { collectSkillDamage, updateSkillCooldowns } from './SkillSystem'

const allocator = {
  createEntityId: () => 10_000,
}

describe('skill system', () => {
  it('resolves Whirlwind hits by stable EntityId order and respects cooldown', () => {
    const game = createGame({ seed: 50 })
    const firstId = game.spawnSlime({ x: 80, y: 0 })
    const secondId = game.spawnSlime({ x: -80, y: 0 })
    game.state.player.skills.push({
      skillId: WHIRLWIND_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    })

    const events = collectSkillDamage(game.state, allocator)
    expect(events.map((event) => event.targetId)).toEqual([firstId, secondId])
    expect(events.every((event) => event.amount === 8)).toBe(true)
    expect(game.state.effects[0]?.points).toEqual([{ x: 0, y: 0 }])
    expect(game.state.player.skills.at(-1)?.cooldownRemaining).toBe(2.5)
    expect(collectSkillDamage(game.state, allocator)).toEqual([])

    updateSkillCooldowns(game.state, 2.5)
    expect(collectSkillDamage(game.state, allocator).length).toBe(2)
  })

  it('chains to distinct valid enemies by distance, then EntityId', () => {
    const game = createGame({ seed: 51 })
    const firstId = game.spawnSlime({ x: 100, y: 0 })
    const secondId = game.spawnSlime({ x: 200, y: 0 })
    const thirdId = game.spawnSlime({ x: 220, y: 0 })
    const outOfRangeId = game.spawnSlime({ x: 500, y: 0 })
    game.state.player.skills.push({
      skillId: CHAIN_LIGHTNING_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    })

    const events = collectSkillDamage(game.state, allocator)
    expect(events.map((event) => event.targetId)).toEqual([
      firstId,
      secondId,
      thirdId,
    ])
    expect(new Set(events.map((event) => event.targetId)).size).toBe(3)
    expect(events.every((event) => event.targetId !== outOfRangeId)).toBe(true)
    expect(game.state.effects[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 220, y: 0 },
    ])
    expect(game.state.player.skills.at(-1)?.cooldownRemaining).toBe(3.5)

    expect(collectSkillDamage(game.state, allocator)).toEqual([])
  })
})
