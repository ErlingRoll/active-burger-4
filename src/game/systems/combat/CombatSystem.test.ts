import { describe, expect, it } from 'vitest'
import {
  applyDamageEvents,
  collectEnemyContactDamage,
  collectProjectileDamage,
} from './CombatSystem'
import type {
  EnemyState,
  GameState,
  ProjectileState,
} from '../../state/GameState'

function enemy(id: number, x: number): EnemyState {
  return {
    id,
    definitionId: 'slime',
    x,
    y: 0,
    radius: 18,
    hp: 20,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 5,
    targetId: 1,
  }
}

function projectile(): ProjectileState {
  return {
    id: 10,
    ownerId: 1,
    definitionId: 'basic-bolt',
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    radius: 4,
    damage: 5,
    remainingLifetime: 1,
  }
}

function state(enemies: EnemyState[]): GameState {
  return {
    run: {
      phase: 'playing',
      seed: 1,
      killCount: 0,
      selectedUpgradeIds: [],
    },
    player: {
      id: 1,
      x: 0,
      y: 0,
      radius: 16,
      hp: 100,
      maxHp: 100,
      level: 1,
      xp: 0,
      movementSpeed: 200,
      attackDamage: 10,
      attackSpeed: 1,
      attackRange: 50,
      attackCooldownRemaining: 0,
      skills: [],
    },
    enemies,
    projectiles: [projectile()],
    pickups: [],
    summons: [],
    effects: [],
    time: 0,
    tick: 0,
    paused: false,
  }
}

describe('collectProjectileDamage', () => {
  it('keeps the stable EntityId consumer tie-break across reversed storage order', () => {
    const damageEvents = collectProjectileDamage(
      state([enemy(9, 20), enemy(4, -20)]),
    )

    expect(damageEvents).toEqual([
      expect.objectContaining({
        targetId: 4,
        amount: 5,
      }),
    ])
  })

  describe('melee leech', () => {
    it('restores 2% of actual Whirlwind damage and never exceeds maximum HP', () => {
      const gameState = state([enemy(2, 20)])
      gameState.player.hp = 99
      gameState.player.meleeLeech = 0.02

      applyDamageEvents(gameState, [{
        sourceId: gameState.player.id,
        sourceSkillId: 'whirlwind',
        targetId: 2,
        amount: 100,
        damageType: 'physical',
      }])

      expect(gameState.enemies[0]?.hp).toBe(0)
      expect(gameState.player.hp).toBe(99.4)
    })

    it('does not restore health for ranged damage', () => {
      const gameState = state([enemy(2, 20)])
      gameState.player.hp = 50
      gameState.player.meleeLeech = 0.02

      applyDamageEvents(gameState, [{
        sourceId: gameState.player.id,
        sourceSkillId: 'basic-bolt',
        targetId: 2,
        amount: 10,
        damageType: 'physical',
      }])

      expect(gameState.player.hp).toBe(50)
    })
  })

  describe('collectEnemyContactDamage', () => {
    it('applies deterministic rate-limited damage when an enemy reaches the player', () => {
      const gameState = state([enemy(2, 34)])

      expect(collectEnemyContactDamage(gameState, 1 / 60)).toEqual([
        expect.objectContaining({
          sourceId: 2,
          targetId: 1,
          amount: 5,
        }),
      ])
      expect(collectEnemyContactDamage(gameState, 1 / 60)).toEqual([])

      expect(collectEnemyContactDamage(gameState, 1)).toEqual([
        expect.objectContaining({ amount: 5 }),
      ])
    })
  })
})
