import { describe, expect, it } from 'vitest'
import { createEntityIdAllocator } from '../../ids'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import { applyDamageEvents } from '../combat/CombatSystem'
import {
  cancelBossTelegraphs,
  resolveBossTelegraphs,
  updateBosses,
} from './BossSystem'
import type { GameState } from '../../state/GameState'

function state(): GameState {
  return {
    run: {
      phase: 'playing',
      seed: 42,
      killCount: 0,
      selectedUpgradeIds: [],
    },
    player: createInitialPlayerState(1),
    enemies: [],
    bosses: [{
      id: 2,
      definitionId: 'stone-golem',
      bossDefinitionId: 'stone-golem',
      x: 120,
      y: 0,
      radius: 42,
      hp: 900,
      maxHp: 900,
      speed: 26,
      contactDamage: 18,
      xpReward: 100,
      targetId: 1,
      skills: [
        { skillId: 'ground-slam', cooldownRemaining: 0 },
        { skillId: 'charge', cooldownRemaining: 100 },
      ],
      nextSkillIndex: 0,
    }],
    projectiles: [],
    pickups: [],
    summons: [],
    effects: [],
    telegraphs: [],
    time: 0,
    tick: 0,
    paused: false,
  }
}

describe('boss skills', () => {
  it('creates a deterministic Ground Slam telegraph and resolves its damage', () => {
    const gameState = state()
    const allocator = createEntityIdAllocator()

    updateBosses(gameState, allocator, 0)
    expect(gameState.telegraphs).toHaveLength(1)
    expect(gameState.telegraphs?.[0]).toMatchObject({
      kind: 'ground-slam',
      x: 0,
      y: 0,
      radius: 100,
    })

    gameState.telegraphs![0]!.remainingDuration = 0
    const damage = resolveBossTelegraphs(gameState)
    applyDamageEvents(gameState, damage)
    expect(gameState.player.hp).toBe(76)
    expect(gameState.telegraphs).toEqual([])
  })

  it('resolves Charge along its telegraphed path with stable damage', () => {
    const gameState = state()
    gameState.bosses![0]!.skills[0]!.cooldownRemaining = 100
    gameState.bosses![0]!.skills[1]!.cooldownRemaining = 0
    gameState.bosses![0]!.nextSkillIndex = 1
    updateBosses(gameState, createEntityIdAllocator(), 0)
    expect(gameState.telegraphs?.[0]?.kind).toBe('charge')

    gameState.telegraphs![0]!.remainingDuration = 0
    applyDamageEvents(gameState, resolveBossTelegraphs(gameState))
    expect(gameState.player.hp).toBe(70)
  })

  it('cancels a defeated boss telegraph before it can affect Dodge', () => {
    const gameState = state()
    updateBosses(gameState, createEntityIdAllocator(), 0)

    cancelBossTelegraphs(gameState, new Set([2]))

    expect(gameState.telegraphs).toEqual([])
  })
})
