import { describe, expect, it } from 'vitest'
import { collectProjectileDamage, applyDamageEvents, updateProjectiles } from './CombatSystem'
import { createEntityIdAllocator } from '../../ids'
import { FIXED_STEP_SECONDS, createGame } from '../../Game'
import {
  resolveEnemyTelegraphs,
  updateEnemyAbilities,
} from './EnemyAbilitySystem'

const neverCrit = { next: () => 1 }

describe('ordinary enemy abilities', () => {
  it('creates a telegraphed Brute shockwave and resolves it in range', () => {
    const game = createGame({ seed: 302 })
    game.spawnEnemy('brute', { x: 100, y: 0 })
    const allocator = createEntityIdAllocator()

    updateEnemyAbilities(game.state, allocator, 0)

    expect(game.state.telegraphs).toMatchObject([{
      sourceKind: 'enemy',
      skillId: 'brute-shockwave',
      kind: 'enemy-shockwave',
    }])
    const telegraph = game.state.telegraphs?.[0]
    if (!telegraph) {
      throw new Error('Expected Brute telegraph')
    }
    telegraph.remainingDuration = 0

    const events = resolveEnemyTelegraphs(game.state, allocator)
    expect(events).toMatchObject([{
      targetId: game.state.player.id,
      damage: { physical: 8.4 },
      sourceLabel: 'Shockwave',
    }])
    const hpBefore = game.state.player.hp
    applyDamageEvents(game.state, events, neverCrit)
    expect(game.state.player.hp).toBeLessThan(hpBefore)
  })

  it('warns before launching an Archer projectile that can hit the player', () => {
    const game = createGame({ seed: 303 })
    game.spawnEnemy('archer', { x: 300, y: 0 })
    const allocator = createEntityIdAllocator()

    updateEnemyAbilities(game.state, allocator, 0)

    expect(game.state.telegraphs).toMatchObject([{
      sourceKind: 'enemy',
      skillId: 'archer-shot',
      kind: 'enemy-projectile',
      points: [
        { x: 300, y: 0 },
        { x: 0, y: 0 },
      ],
    }])
    const telegraph = game.state.telegraphs?.[0]
    if (!telegraph) {
      throw new Error('Expected Archer telegraph')
    }
    telegraph.remainingDuration = 0
    resolveEnemyTelegraphs(game.state, allocator)

    expect(game.state.projectiles).toHaveLength(1)
    const projectile = game.state.projectiles[0]
    if (!projectile) {
      throw new Error('Expected Archer projectile')
    }
    expect(Math.hypot(projectile.velocityX, projectile.velocityY)).toBe(480)
    projectile.x = game.state.player.x
    projectile.y = game.state.player.y
    const events = collectProjectileDamage(game.state)
    expect(events).toMatchObject([{
      sourceId: game.state.enemies[0]?.id,
      targetId: game.state.player.id,
      sourceLabel: 'Aimed Shot',
    }])
    expect(events[0]?.damage.physical).toBeCloseTo(5.4)

    const hpBefore = game.state.player.hp
    applyDamageEvents(game.state, events, neverCrit)
    expect(game.state.player.hp).toBeLessThan(hpBefore)
    updateProjectiles(game.state, FIXED_STEP_SECONDS)
    expect(game.state.projectiles[0]?.remainingLifetime).toBeLessThan(3)
  })
})
