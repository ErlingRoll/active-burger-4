import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
} from '../../../content/skills/Skills'
import { createGearModifier } from '../../../content/gear/ModifierPools'
import { PLAYER_PROJECTILE_CHAIN_RANGE } from '../../../content/projectiles/Projectiles'
import {
  applyDamageEvents,
  collectEnemyContactDamage,
  collectProjectileDamage,
  performBasicAttackIfReady,
  updateProjectiles,
} from './CombatSystem'
import type {
  BossState,
  EnemyState,
  GameState,
  ProjectileState,
} from '../../state/GameState'
import {
  equipItem,
  equipRolledItem,
} from '../../equipment/EquipmentState'

const neverCrit = { next: () => 1 }
const alwaysCrit = { next: () => 0 }
const allocator = {
  createEntityId: (() => {
    let nextId = 10_000
    return () => nextId++
  })(),
}

function enemy(id: number, x: number, y = 0): EnemyState {
  return {
    id,
    definitionId: 'slime',
    x,
    y,
    radius: 18,
    hp: 20,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 5,
    targetId: 1,
  }
}

function boss(id: number, x: number, y = 0): BossState {
  return {
    ...enemy(id, x, y),
    definitionId: 'stone-golem',
    bossDefinitionId: 'stone-golem',
    skills: [],
    nextSkillIndex: 0,
  }
}

function projectile(): ProjectileState {
  return {
    id: 10,
    ownerId: 1,
    definitionId: 'basic-attack-orb',
    skillId: BASIC_ATTACK_SKILL_ID,
    targetId: 2,
    sourceTags: ['physical', 'projectile'],
    basicAttackWeaponArchetype: 'wand',
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    radius: 4,
    damage: {
      physical: 5,
      lightning: 0,
      fire: 0,
      cold: 0,
      chaos: 0,
    },
    remainingLifetime: 1,
  }
}

function state(
  enemies: EnemyState[],
  options: {
    bosses?: BossState[]
    projectiles?: ProjectileState[]
  } = {},
): GameState {
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
      skills: [{
        skillId: BASIC_ATTACK_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }],
      equipment: {},
      statModifiers: [],
      baseStats: {
        maxHp: 100,
        movementSpeed: 200,
        attackDamage: 10,
        attackSpeed: 1,
        attackRange: 50,
      },
    },
    enemies,
    bosses: options.bosses,
    projectiles: options.projectiles ?? [projectile()],
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
        damage: expect.objectContaining({
          physical: 5,
        }),
      }),
    ])
  })

  it('relaunches player projectiles across distinct nearby enemies and allows A -> B -> A', () => {
    const gameState = state(
      [enemy(2, 20), enemy(3, 60)],
      {
        projectiles: [{
          ...projectile(),
          x: 20,
          targetId: 2,
          remainingChains: 2,
          chainRange: 50,
        }],
      },
    )

    expect(collectProjectileDamage(gameState)).toEqual([
      expect.objectContaining({ targetId: 2 }),
    ])
    expect(gameState.projectiles[0]).toMatchObject({
      x: 20,
      y: 0,
      targetId: 3,
      lastHitTargetId: 2,
      remainingChains: 1,
      remainingLifetime: 1,
    })

    gameState.projectiles[0]!.x = 60
    expect(collectProjectileDamage(gameState)).toEqual([
      expect.objectContaining({ targetId: 3 }),
    ])
    expect(gameState.projectiles[0]).toMatchObject({
      x: 60,
      y: 0,
      targetId: 2,
      lastHitTargetId: 3,
      remainingChains: 0,
      remainingLifetime: 1,
    })

    gameState.projectiles[0]!.x = 20
    expect(collectProjectileDamage(gameState)).toEqual([
      expect.objectContaining({ targetId: 2 }),
    ])
    expect(gameState.projectiles[0]?.remainingLifetime).toBe(0)
  })

  it('ends a chain instead of rehitting the same target consecutively', () => {
    const gameState = state(
      [enemy(2, 20)],
      {
        projectiles: [{
          ...projectile(),
          x: 20,
          targetId: 2,
          remainingChains: 2,
          chainRange: 50,
        }],
      },
    )

    expect(collectProjectileDamage(gameState)).toEqual([
      expect.objectContaining({ targetId: 2 }),
    ])
    expect(gameState.projectiles[0]).toMatchObject({
      targetId: 2,
      remainingLifetime: 0,
    })
  })

  it('does not let non-player projectiles inherit player chaining behavior', () => {
    const gameState = state(
      [enemy(2, 20), enemy(3, 60)],
      {
        projectiles: [{
          ...projectile(),
          ownerId: 99,
          x: 20,
          targetId: 2,
          remainingChains: 2,
          chainRange: 50,
        }],
      },
    )

    expect(collectProjectileDamage(gameState)).toEqual([
      expect.objectContaining({ sourceId: 99, targetId: 2 }),
    ])
    expect(gameState.projectiles[0]).toMatchObject({
      targetId: 2,
      remainingLifetime: 0,
    })
  })
})

describe('performBasicAttackIfReady', () => {
  it('hits every enemy and boss inside the sword arc while skipping targets outside it', () => {
    const gameState = state(
      [
        enemy(2, 35, 0),
        enemy(3, 32, 16),
        enemy(4, 0, 60),
      ],
      {
        bosses: [boss(5, 28, -12)],
        projectiles: [],
      },
    )
    equipItem(gameState.player, 'iron-cleaver')
    gameState.player.targetId = 2

    const events = performBasicAttackIfReady(gameState, allocator)

    expect(events.map((event) => event.targetId)).toEqual([2, 3, 5])
    expect(events.every((event) => event.sourceSkillId === BASIC_ATTACK_SKILL_ID)).toBe(true)
    expect(gameState.projectiles).toEqual([])
    expect(gameState.effects[0]).toMatchObject({
      skillId: BASIC_ATTACK_SKILL_ID,
      shape: 'arc',
      basicAttackWeaponArchetype: 'sword',
    })
    applyDamageEvents(gameState, events, neverCrit)
    expect(gameState.enemies.find((value) => value.id === 2)?.hp).toBeLessThan(20)
    expect(gameState.enemies.find((value) => value.id === 4)?.hp).toBe(20)
    expect(gameState.bosses?.find((value) => value.id === 5)?.hp).toBeLessThan(20)
  })

  it('fires deterministic bow spreads without steering mid-flight', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'hunters-bow',
      'rare',
      [
        createGearModifier('hunters-bow', 'basic-attack-extra-projectiles', 3, 2),
        createGearModifier('hunters-bow', 'projectile-chains', 4, 2),
      ],
    )
    gameState.player.targetId = 2

    expect(performBasicAttackIfReady(gameState, allocator)).toEqual([])
    expect(gameState.projectiles).toHaveLength(3)
    expect(gameState.projectiles.every((value) => value.definitionId === 'basic-attack-arrow')).toBe(true)
    expect(gameState.projectiles.every((value) => value.remainingChains === 2)).toBe(true)
    expect(gameState.projectiles.every((value) => value.chainRange === PLAYER_PROJECTILE_CHAIN_RANGE)).toBe(true)
    const initialVelocities = gameState.projectiles.map((value) => ({
      x: value.velocityX,
      y: value.velocityY,
    }))
    expect(initialVelocities.map((value) => Math.sign(value.y))).toEqual([-1, 0, 1])

    gameState.enemies[0]!.y = 90
    updateProjectiles(gameState, 1 / 60)

    expect(gameState.projectiles.map((value) => ({
      x: value.velocityX,
      y: value.velocityY,
    }))).toEqual(initialVelocities)
  })

  it('increases projectile chain range with area of effect', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'hunters-bow',
      'rare',
      [createGearModifier('hunters-bow', 'projectile-chains', 4, 2)],
    )
    equipRolledItem(
      gameState.player,
      'watchers-helm',
      'uncommon',
      [createGearModifier('watchers-helm', 'area-of-effect', 1, 25)],
    )
    gameState.player.targetId = 2

    performBasicAttackIfReady(gameState, allocator)

    expect(gameState.projectiles[0]?.chainRange).toBe(225)
  })

  it('steers wand projectiles toward a living target', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'starcall-wand',
      'uncommon',
      [createGearModifier('starcall-wand', 'projectile-chains', 5, 2)],
    )
    gameState.player.targetId = 2

    performBasicAttackIfReady(gameState, allocator)

    const firedProjectile = gameState.projectiles[0]
    if (!firedProjectile) {
      throw new Error('Expected a wand projectile to be created')
    }
    expect(firedProjectile.definitionId).toBe('basic-attack-orb')
    expect(firedProjectile.remainingChains).toBe(2)
    expect(firedProjectile.chainRange).toBe(PLAYER_PROJECTILE_CHAIN_RANGE)
    expect(firedProjectile.velocityY).toBe(0)

    gameState.enemies[0]!.y = 120
    updateProjectiles(gameState, 1 / 60)

    expect(gameState.projectiles[0]?.velocityY).toBeGreaterThan(0)
    expect(gameState.projectiles[0]?.targetId).toBe(2)
  })
})

describe('applyDamageEvents', () => {
  it('restores 2% of actual Whirlwind damage and never exceeds maximum HP', () => {
    const gameState = state([enemy(2, 20)])
    gameState.player.hp = 99
    gameState.player.meleeLeech = 0.02

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: 'whirlwind',
      targetId: 2,
      damage: {
        physical: 100,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit)

    expect(gameState.enemies[0]?.hp).toBe(0)
    expect(gameState.player.hp).toBe(99.4)
  })

  it('does not restore health for ranged damage', () => {
    const gameState = state([enemy(2, 20)])
    gameState.player.hp = 50
    gameState.player.meleeLeech = 0.02

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 10,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
      sourceTags: ['physical', 'projectile'],
    }], neverCrit)

    expect(gameState.player.hp).toBe(50)
  })

  it('uses target resistance for mitigation and caps elemental resistance at 75%', () => {
    const gameState = state([enemy(2, 20)])
    gameState.enemies[0]!.hp = 100
    gameState.enemies[0]!.maxHp = 100
    gameState.enemies[0]!.resistances = { elemental: 80, chaos: 10 }

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      targetId: 2,
      damage: {
        physical: 10,
        lightning: 40,
        fire: 0,
        cold: 0,
        chaos: 20,
      },
    }], neverCrit)

    expect(gameState.enemies[0]?.hp).toBe(62)
  })

  it('rolls critical strikes deterministically and converts overcrit into multiplier', () => {
    const gameState = state([enemy(2, 20)])
    gameState.enemies[0]!.hp = 500
    gameState.enemies[0]!.maxHp = 500

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      targetId: 2,
      damage: {
        physical: 100,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
      criticalStrike: {
        chance: 120,
        multiplier: 200,
      },
    }], alwaysCrit)

    expect(gameState.enemies[0]?.hp).toBe(290)
  })
})

describe('collectEnemyContactDamage', () => {
  it('applies deterministic rate-limited damage when an enemy reaches the player', () => {
    const gameState = state([enemy(2, 34)])

    expect(collectEnemyContactDamage(gameState, 1 / 60)).toEqual([
      expect.objectContaining({
        sourceId: 2,
        targetId: 1,
        damage: expect.objectContaining({
          physical: 5,
        }),
      }),
    ])
    expect(collectEnemyContactDamage(gameState, 1 / 60)).toEqual([])

    expect(collectEnemyContactDamage(gameState, 1)).toEqual([
      expect.objectContaining({
        damage: expect.objectContaining({ physical: 5 }),
      }),
    ])
  })
})
