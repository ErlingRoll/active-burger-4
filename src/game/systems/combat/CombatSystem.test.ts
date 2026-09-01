import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
} from '../../../content/skills/Skills'
import { createGearModifier } from '../../../content/gear/ModifierPools'
import { PLAYER_PROJECTILE_CHAIN_RANGE } from '../../../content/projectiles/Projectiles'
import {
  applyDamageEvents,
  collectEnemyContactDamage,
  collectProjectileDamage,
  performBasicAttackIfReady,
  resolvePlayerTarget,
  updateProjectiles,
  updatePoison,
  updateFrost,
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
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import {
  createPlayerDamageProfileFromStats,
  getBasicAttackDamageBeforeCritFromStats,
  getAttunementDamageFromStats,
} from '../../combat/DamageSources'
import { createGame } from '../../Game'
import { createDamageValues } from '../../../content/stats/Damage'
import { Rarity } from '../../../content/rarity/Rarity'

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

  describe('Necromancer staff poison', () => {
    it('hits every enemy in the target-centered area and scales its radius with area of effect', () => {
      const game = createGame({ seed: 90, playstyleId: 'necromancer' })
      const targetId = game.spawnSlime({ x: 120, y: 0 })
      const outerId = game.spawnSlime({ x: 185, y: 0 })

      resolvePlayerTarget(game.state)
      const baseEvents = performBasicAttackIfReady(game.state, allocator)
      expect(baseEvents.map((event) => event.targetId)).toEqual([targetId])

      game.state.player.attackCooldownRemaining = 0
      game.state.player.skills.find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)!.cooldownRemaining = 0
      equipRolledItem(
        game.state.player,
        'swiftstride-boots',
        Rarity.Common,
        [createGearModifier('swiftstride-boots', 'area-of-effect', 1, 25)],
      )
      const scaledEvents = performBasicAttackIfReady(game.state, allocator)
      expect(scaledEvents.map((event) => event.targetId)).toEqual([targetId, outerId])
      expect(game.state.effects.at(-1)?.radius).toBe(50)
    })

    it('applies independent poison stacks with critical scaling and chaos resistance', () => {
      const game = createGame({ seed: 91, playstyleId: 'necromancer' })
      const targetId = game.spawnSlime({ x: 80, y: 0 })
      const target = game.state.enemies.find((enemy) => enemy.id === targetId)!
      target.hp = 1_000
      target.maxHp = 1_000
      target.resistances = { chaos: 50 }

      resolvePlayerTarget(game.state)
      const firstHit = performBasicAttackIfReady(game.state, allocator)
      applyDamageEvents(game.state, firstHit, neverCrit)
      expect(target.poisonStacks).toHaveLength(1)
      expect(target.poisonStacks?.[0]?.damagePerSecond).toBeCloseTo(4.5)

      game.state.player.attackCooldownRemaining = 0
      game.state.player.skills.find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)!.cooldownRemaining = 0
      const criticalHit = performBasicAttackIfReady(game.state, allocator)
      applyDamageEvents(game.state, criticalHit, alwaysCrit)
      expect(target.poisonStacks).toHaveLength(2)
      expect(target.poisonStacks?.[1]?.damagePerSecond).toBeCloseTo(9)

      const poisonEvents = updatePoison(game.state, 1)
      expect(poisonEvents).toHaveLength(2)
      applyDamageEvents(game.state, poisonEvents, neverCrit)
      expect(target.hp).toBeCloseTo(1_000 - 9 - 18 - 4.5 * 0.5 - 9 * 0.5)
      expect(game.state.run.skillDamageDealt?.[BASIC_ATTACK_SKILL_ID]).toBeCloseTo(33.75)
      expect(poisonEvents.every((event) => event.sourceSkillId === BASIC_ATTACK_SKILL_ID)).toBe(true)

      updatePoison(game.state, 3)
      expect(target.poisonStacks).toHaveLength(0)
    })
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
      impactPoint: { x: 35, y: 0 },
    })
    expect(gameState.effects[0]?.impactPoints).toEqual([
      { x: 35, y: 0 },
      { x: 32, y: 16 },
      { x: 28, y: -12 },
    ])
    applyDamageEvents(gameState, events, neverCrit)
    expect(gameState.enemies.find((value) => value.id === 2)?.hp).toBeLessThan(20)
    expect(gameState.enemies.find((value) => value.id === 4)?.hp).toBe(20)
    expect(gameState.bosses?.find((value) => value.id === 5)?.hp).toBeLessThan(20)
  })

  it('falls back to a nearby attackable enemy when the retained target is out of melee range', () => {
    const gameState = state(
      [enemy(2, 160), enemy(3, 20)],
      { projectiles: [] },
    )
    equipItem(gameState.player, 'iron-cleaver')
    gameState.player.targetId = 2

    const events = performBasicAttackIfReady(gameState, allocator)

    expect(events.map((event) => event.targetId)).toContain(3)
    expect(gameState.player.attackCooldownRemaining).toBeGreaterThan(0)
  })

  it('falls back to a nearby attackable enemy when the retained target is out of projectile range', () => {
    const gameState = state(
      [enemy(2, 700), enemy(3, 20)],
      { projectiles: [] },
    )
    equipItem(gameState.player, 'starcall-wand')
    gameState.player.targetId = 2

    expect(performBasicAttackIfReady(gameState, allocator)).toEqual([])

    expect(gameState.projectiles.length).toBeGreaterThan(0)
    expect(gameState.projectiles.every((projectile) => projectile.targetId === 3)).toBe(true)
    expect(gameState.player.attackCooldownRemaining).toBeGreaterThan(0)
  })

  it('fires deterministic bow spreads without steering mid-flight', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'hunters-bow',
      Rarity.Rare,
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
    expect(
      Math.atan2(initialVelocities[2]!.y, initialVelocities[2]!.x) -
        Math.atan2(initialVelocities[0]!.y, initialVelocities[0]!.x),
    ).toBeCloseTo((15 * 2 * Math.PI) / 180)

    gameState.enemies[0]!.y = 90
    updateProjectiles(gameState, 1 / 60)

    expect(gameState.projectiles.map((value) => ({
      x: value.velocityX,
      y: value.velocityY,
    }))).toEqual(initialVelocities)
  })

  it('applies bow Precision to the primary target but not chained targets', () => {
    const gameState = state(
      [enemy(2, 120), enemy(3, 180)],
      { projectiles: [] },
    )
    equipRolledItem(
      gameState.player,
      'hunters-bow',
      Rarity.Rare,
      [createGearModifier('hunters-bow', 'projectile-chains', 5, 2)],
    )
    gameState.player.targetId = 2

    performBasicAttackIfReady(gameState, allocator)
    const projectile = gameState.projectiles[0]
    if (!projectile) {
      throw new Error('Expected a bow projectile to be created')
    }
    expect(projectile.primaryTargetId).toBe(2)
    expect(projectile.primaryTargetDamageIncreasePercent).toBe(100)

    projectile.x = 120
    projectile.y = 0
    const primaryHit = collectProjectileDamage(gameState)
    expect(primaryHit).toHaveLength(1)
    expect(primaryHit[0]?.targetId).toBe(2)
    expect(primaryHit[0]?.damage.physical).toBe(20)
    expect(projectile.targetId).toBe(3)

    projectile.x = 180
    projectile.y = 0
    const chainedHit = collectProjectileDamage(gameState)
    expect(chainedHit).toHaveLength(1)
    expect(chainedHit[0]?.targetId).toBe(3)
    expect(chainedHit[0]?.damage.physical).toBe(10)

    projectile.x = 120
    projectile.y = 0
    const returnedHit = collectProjectileDamage(gameState)
    expect(returnedHit).toHaveLength(1)
    expect(returnedHit[0]?.targetId).toBe(2)
    expect(returnedHit[0]?.damage.physical).toBe(10)
  })

  it('gives the bow a single-target DPS edge over the default Starcall Wand', () => {
    const bowState = state([enemy(2, 120)], { projectiles: [] })
    equipItem(bowState.player, 'hunters-bow')
    bowState.player.targetId = 2
    performBasicAttackIfReady(bowState, allocator)
    for (const projectile of bowState.projectiles) {
      projectile.x = 120
      projectile.y = 0
    }
    const bowVolleyDamage = collectProjectileDamage(bowState)
      .reduce((total, event) => total + event.damage.physical, 0)
    const bowDps = bowVolleyDamage * getDerivedPlayerStats(bowState.player).attackSpeed

    const wandState = state([enemy(2, 120)], { projectiles: [] })
    equipItem(wandState.player, 'starcall-wand')
    wandState.player.targetId = 2
    performBasicAttackIfReady(wandState, allocator)
    for (const projectile of wandState.projectiles) {
      projectile.x = 120
      projectile.y = 0
    }
    const wandVolleyDamage = collectProjectileDamage(wandState)
      .reduce((total, event) => total + event.damage.physical, 0)
    const wandDps = wandVolleyDamage * getDerivedPlayerStats(wandState.player).attackSpeed

    expect(bowDps).toBeGreaterThan(wandDps)
  })

  it('fires extra wand projectiles from the equipped modifier', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'starcall-wand',
      Rarity.Rare,
      [createGearModifier('starcall-wand', 'basic-attack-extra-projectiles', 3, 2)],
    )
    gameState.player.targetId = 2

    expect(performBasicAttackIfReady(gameState, allocator)).toEqual([])
    expect(gameState.projectiles).toHaveLength(3)
    expect(gameState.projectiles.every((value) => value.definitionId === 'basic-attack-orb')).toBe(true)
    expect(gameState.projectiles.every((value) => value.primaryTargetId === undefined)).toBe(true)
  })

  it('uses the default Starcall Wand extra-projectile modifier', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipItem(gameState.player, 'starcall-wand')
    gameState.player.targetId = 2

    expect(performBasicAttackIfReady(gameState, allocator)).toEqual([])
    expect(gameState.projectiles).toHaveLength(2)
    expect(gameState.projectiles.every((value) => value.definitionId === 'basic-attack-orb')).toBe(true)
    expect(gameState.projectiles.every((value) => value.primaryTargetId === undefined)).toBe(true)
  })

  it('keeps multiple wand projectiles visibly separated while homing', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'starcall-wand',
      Rarity.Rare,
      [createGearModifier('starcall-wand', 'basic-attack-extra-projectiles', 3, 2)],
    )
    gameState.player.targetId = 2

    performBasicAttackIfReady(gameState, allocator)
    updateProjectiles(gameState, 1 / 60)

    const first = gameState.projectiles[0]
    const last = gameState.projectiles[2]
    if (!first || !last) {
      throw new Error('Expected multiple wand projectiles to be created')
    }
    const firstAngle = Math.atan2(first.velocityY, first.velocityX)
    const lastAngle = Math.atan2(last.velocityY, last.velocityX)
    expect(lastAngle - firstAngle).toBeGreaterThan((40 * Math.PI) / 180)
  })

  it('increases projectile chain range with area of effect', () => {
    const gameState = state([enemy(2, 120, 0)], { projectiles: [] })
    equipRolledItem(
      gameState.player,
      'hunters-bow',
      Rarity.Rare,
      [createGearModifier('hunters-bow', 'projectile-chains', 4, 2)],
    )
    equipRolledItem(
      gameState.player,
      'watchers-helm',
      Rarity.Uncommon,
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
      Rarity.Uncommon,
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

  it('increases total Basic Attack damage by its percentage skill level bonus', () => {
    const gameState = state([enemy(2, 120)], { projectiles: [] })
    gameState.player.skills[0]!.level = 2
    gameState.player.targetId = 2

    performBasicAttackIfReady(gameState, allocator)

    expect(gameState.projectiles[0]?.damage.physical).toBe(11)
  })

  it('adds Basic Attack and global increases before applying them to flat damage', () => {
    const profile = createPlayerDamageProfileFromStats(
      {
        flatDamage: {
          physical: 10,
          lightning: 0,
          fire: 0,
          cold: 0,
          chaos: 0,
        },
        increasedDamage: {
          global: 20,
          physical: 0,
          elemental: 0,
          chaos: 0,
          projectile: 0,
        },
        critChance: 0,
        critMultiplier: 200,
      },
      { physical: 100 },
      { isBasicAttack: true, additionalIncreasedDamage: { global: 10 } },
    )

    expect(profile.damage.physical).toBe(143)
  })

  it('adds finalized Attunement after skill increases without reapplying them', () => {
    const profile = createPlayerDamageProfileFromStats(
      {
        attackDamage: 15,
        attunement: 50,
        flatDamage: {
          physical: 0,
          lightning: 0,
          fire: 0,
          cold: 0,
          chaos: 0,
        },
        increasedDamage: {
          global: 0,
          physical: 20,
          elemental: 0,
          chaos: 0,
          projectile: 0,
        },
        critChance: 0,
        critMultiplier: 200,
      },
      { physical: 10 },
      { additionalIncreasedDamage: { physical: 0 } },
    )

    expect(profile.damage.physical).toBeCloseTo(21)
    expect(profile.attunementDamage?.physical).toBe(9)
  })

  it('uses dynamic Attunement adjustments from the player state', () => {
    const game = createGame({ seed: 20260901 })
    game.state.player.attunementBonusPercent = 25

    expect(getDerivedPlayerStats(game.state.player).attunement).toBe(80)
  })

  it('masters each final Basic Attack damage type independently and rounds up', () => {
    const stats = {
      attackDamage: 15,
      attunement: 50,
      basicAttackIsProjectile: false,
      flatDamage: {
        physical: 0,
        lightning: 2,
        fire: 5,
        cold: 0,
        chaos: 0,
      },
      increasedDamage: {
        global: 0,
        physical: 0,
        elemental: 0,
        chaos: 0,
        projectile: 0,
      },
    }

    expect(getBasicAttackDamageBeforeCritFromStats(stats)).toMatchObject({
      physical: 15,
      lightning: 2,
      fire: 5,
    })
    expect(getAttunementDamageFromStats(stats)).toMatchObject({
      physical: 8,
      lightning: 1,
      fire: 3,
    })
  })
})

describe('applyDamageEvents', () => {
  it('applies DoT multiplier to player-owned periodic damage exactly once', () => {
    const game = createGame({ seed: 20260901 })
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const target = game.state.enemies.find((enemy) => enemy.id === targetId)!
    target.hp = 1_000
    target.maxHp = 1_000
    equipRolledItem(
      game.state.player,
      'swiftstride-boots',
      Rarity.Common,
      [createGearModifier('swiftstride-boots', 'dot-multiplier', 1, 20)],
    )

    applyDamageEvents(game.state, [{
      sourceId: game.state.player.id,
      sourceSkillId: SOUL_TETHER_SKILL_ID,
      targetId,
      damage: createDamageValues({ chaos: 10 }),
      damageOverTime: true,
    }], neverCrit)

    expect(target.hp).toBeCloseTo(988)
  })

  it('triggers Fiery Touch once per direct player hit and scales its area', () => {
    const gameState = state([enemy(2, 20), enemy(3, 90)])
    gameState.player.skills.push({
      skillId: FIERY_TOUCH_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    })

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit, allocator)

    expect(gameState.enemies.map((candidate) => candidate.hp)).toEqual([9, 10])
    expect(gameState.player.skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )?.cooldownRemaining).toBe(2)
    expect(gameState.effects).toEqual([
      expect.objectContaining({
        skillId: FIERY_TOUCH_SKILL_ID,
        radius: 80,
        x: 20,
        y: 0,
      }),
    ])
  })

  it('applies percentage level scaling to Fiery Touch trigger damage', () => {
    const gameState = state([enemy(2, 20)])
    gameState.player.skills.push({
      skillId: FIERY_TOUCH_SKILL_ID,
      level: 2,
      cooldownRemaining: 0,
    })

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit, allocator)

    expect(gameState.enemies[0]?.hp).toBeCloseTo(8.2)
  })

  it('allows summon hits but excludes DoT and Fiery Touch self-triggering', () => {
    const gameState = state([enemy(2, 20)])
    gameState.enemies[0]!.hp = 200
    gameState.enemies[0]!.maxHp = 200
    gameState.player.skills.push({
      skillId: FIERY_TOUCH_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    })
    gameState.summons.push({
      id: 50,
      ownerId: gameState.player.id,
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      contactCooldownRemaining: 0,
      attackCooldownRemaining: 0,
    })

    applyDamageEvents(gameState, [{
      sourceId: 50,
      sourceSkillId: 'raise-skeleton',
      targetId: 2,
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit, allocator)
    expect(gameState.effects).toHaveLength(1)

    gameState.player.skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )!.cooldownRemaining = 0
    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
      damageOverTime: true,
    }, {
      sourceId: gameState.player.id,
      sourceSkillId: FIERY_TOUCH_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 0,
        lightning: 0,
        fire: 1,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit, allocator)

    expect(gameState.effects).toHaveLength(1)
    expect(gameState.player.skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )?.cooldownRemaining).toBe(0)
  })

  it('combines global and Fiery Touch cooldown reduction with a 0.1-second floor', () => {
    const gameState = state([enemy(2, 20)])
    gameState.enemies[0]!.hp = 200
    gameState.enemies[0]!.maxHp = 200
    gameState.player.skills.push({
      skillId: FIERY_TOUCH_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    })
    equipRolledItem(
      gameState.player,
      'iron-cleaver',
      Rarity.Common,
      [createGearModifier('iron-cleaver', 'cooldown-reduction', 3, 12)],
    )
    gameState.run.selectedUpgradeIds = [
      'fiery-touch-cooldown-reduction',
      'fiery-touch-cooldown-reduction',
    ]

    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit)
    expect(gameState.player.skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )?.cooldownRemaining).toBeCloseTo(1.56)

    gameState.player.skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )!.cooldownRemaining = 0
    gameState.run.selectedUpgradeIds = Array.from(
      { length: 20 },
      () => 'fiery-touch-cooldown-reduction' as const,
    )
    applyDamageEvents(gameState, [{
      sourceId: gameState.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId: 2,
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }], neverCrit)
    expect(gameState.player.skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )?.cooldownRemaining).toBe(0.1)
  })

  it('restores 2% of actual Whirlwind damage and never exceeds maximum HP', () => {
    const gameState = state([enemy(2, 20)])
    gameState.player.hp = 99
    gameState.player.whirlwindLeech = 0.02

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

  it('does not apply Whirlwind leech to sword Basic Attack damage', () => {
    const gameState = state([enemy(2, 20)])
    gameState.player.hp = 50
    gameState.player.whirlwindLeech = 0.02

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
      sourceTags: ['physical', 'melee'],
    }], neverCrit)

    expect(gameState.player.hp).toBe(50)
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
    expect(gameState.enemies[0]?.lastMeleeAttackTime).toBe(0)
    expect(collectEnemyContactDamage(gameState, 1 / 60)).toEqual([])

    expect(collectEnemyContactDamage(gameState, 1)).toEqual([
      expect.objectContaining({
        damage: expect.objectContaining({ physical: 5 }),
      }),
    ])
  })

  it('ramps contact damage with the enemy age multiplier', () => {
    const gameState = state([enemy(2, 34)])
    gameState.enemies[0]!.spawnTime = -55

    const [event] = collectEnemyContactDamage(gameState, 1 / 60)

    expect(event?.damage.physical).toBeCloseTo(8.75)
  })

  describe('Frost and Shock statuses', () => {
    it('freezes after capped Chill progress and shatters on physical damage', () => {
      const gameState = state([enemy(2, 100)])
      const frostEvent = {
        targetId: 2,
        damage: createDamageValues(),
        frostApplication: {
          stacks: 1,
          durationSeconds: 4,
          freezeThreshold: 3,
          freezeDurationSeconds: 1,
        },
      }

      applyDamageEvents(gameState, [frostEvent, frostEvent, frostEvent], neverCrit)

      expect(gameState.enemies[0]?.frozenRemainingDuration).toBe(1)
      applyDamageEvents(gameState, [{
        targetId: 2,
        damage: createDamageValues({ physical: 10 }),
      }], neverCrit)
      expect(gameState.enemies[0]?.hp).toBe(5)

      updateFrost(gameState, 1)
      expect(gameState.enemies[0]?.frozenRemainingDuration).toBe(0)
    })

    it('freezes immediately when a Tier 1 gear Chill hit applies three stacks', () => {
      const gameState = state([enemy(2, 100)])
      equipRolledItem(
        gameState.player,
        'ring',
        Rarity.Common,
        [createGearModifier('ring', 'frost-application', 1, 3)],
      )

      applyDamageEvents(gameState, [{
        sourceId: gameState.player.id,
        sourceSkillId: BASIC_ATTACK_SKILL_ID,
        targetId: 2,
        damage: createDamageValues(),
      }], neverCrit)

      expect(gameState.enemies[0]?.frozenRemainingDuration).toBe(1)
      expect(gameState.enemies[0]?.chillStacks).toBe(0)
    })

    it('detonates Chain Lightning Shock at three stacks', () => {
      const gameState = state([enemy(2, 100)])
      const shockEvent = {
        sourceId: 1,
        sourceSkillId: 'chain-lightning' as const,
        targetId: 2,
        damage: createDamageValues({ lightning: 2 }),
        shockApplication: {
          stacks: 1,
          durationSeconds: 4,
          threshold: 3,
          burstMultiplier: 1.5,
        },
      }

      applyDamageEvents(gameState, [shockEvent, shockEvent, shockEvent], neverCrit)

      expect(gameState.enemies[0]?.shockStacks).toBe(0)
      expect(gameState.enemies[0]?.hp).toBe(11)
    })
  })

  it.each([
    ['fiery', 'fire'],
    ['electrocuting', 'lightning'],
    ['frigid', 'cold'],
  ] as const)('adds 50%% physical damage as %s damage for %s elites', (
    eliteModifier,
    elementalDamageType,
  ) => {
    const gameState = state([{
      ...enemy(2, 34),
      eliteModifier,
    }])

    const [event] = collectEnemyContactDamage(gameState, 1 / 60)

    expect(event?.damage).toMatchObject({
      physical: 5,
      [elementalDamageType]: 2.5,
    })
  })

  it('makes Poisoner contact hits apply independent poison stacks to the player', () => {
    const gameState = state([{
      ...enemy(2, 34),
      eliteModifier: 'poisoner',
    }])
    gameState.player.resistances = { chaos: 50 }

    const [hit] = collectEnemyContactDamage(gameState, 1 / 60)
    expect(hit?.poisonApplication).toEqual({
      durationSeconds: 4,
      physicalChaosRatio: 0.5,
    })

    applyDamageEvents(gameState, [hit!], neverCrit)
    expect(gameState.player.poisonStacks).toEqual([{
      remainingDuration: 4,
      damagePerSecond: 2.5,
    }])

    const [poisonTick] = updatePoison(gameState, 1)
    expect(poisonTick?.damage).toMatchObject({ chaos: 2.5 })
    applyDamageEvents(gameState, [poisonTick!], neverCrit)
    expect(gameState.player.hp).toBeCloseTo(93.75)
  })

  describe('Rallying Banner and Aegis Pulse player defenses', () => {
    it('reduces incoming player damage while the Rallying Banner is active', () => {
      const gameState = state([enemy(2, 34)])
      gameState.player.rallyingBannerRemaining = 6
      gameState.player.rallyingBannerDamageReductionPercent = 10

      applyDamageEvents(gameState, [{
        sourceId: 2,
        targetId: gameState.player.id,
        damage: createDamageValues({ physical: 10 }),
      }], neverCrit)

      expect(gameState.player.hp).toBe(91)
    })

    it('gives Knight Vanguard Guard through floor 2 only', () => {
      const knight = createGame({ seed: 20260829 })
      const damage = [{
        sourceId: 2,
        targetId: knight.state.player.id,
        damage: createDamageValues({ physical: 40 }),
      }]

      applyDamageEvents(knight.state, damage, neverCrit)
      expect(knight.state.player.hp).toBe(118)

      knight.state.player.hp = knight.state.player.maxHp
      knight.state.run.floor = 2
      applyDamageEvents(knight.state, damage, neverCrit)
      expect(knight.state.player.hp).toBe(118)

      knight.state.player.hp = knight.state.player.maxHp
      knight.state.run.floor = 3
      applyDamageEvents(knight.state, damage, neverCrit)
      expect(knight.state.player.hp).toBe(110)

      const ranger = createGame({ seed: 20260830, playstyleId: 'ranger' })
      applyDamageEvents(ranger.state, damage, neverCrit)
      expect(ranger.state.player.hp).toBe(45)
    })

    it('drains the Aegis Pulse shield before player HP is reduced', () => {
      const gameState = state([enemy(2, 34)])
      gameState.player.aegisPulseShieldAmount = 6
      gameState.player.aegisPulseShieldRemaining = 4

      applyDamageEvents(gameState, [{
        sourceId: 2,
        targetId: gameState.player.id,
        damage: createDamageValues({ physical: 10 }),
      }], neverCrit)

      expect(gameState.player.aegisPulseShieldAmount).toBe(0)
      expect(gameState.player.hp).toBe(96)
    })

    it('reflects half of the shield-absorbed damage back at the attacker when Reprisal is selected', () => {
      const gameState = state([enemy(2, 34)])
      gameState.run.selectedUpgradeIds = ['aegis-pulse-reprisal']
      gameState.player.aegisPulseShieldAmount = 6
      gameState.player.aegisPulseShieldRemaining = 4
      equipRolledItem(
        gameState.player,
        'iron-cleaver',
        Rarity.Legendary,
        [createGearModifier('iron-cleaver', 'increased-global-damage', 5, 8)],
      )

      applyDamageEvents(gameState, [{
        sourceId: 2,
        targetId: gameState.player.id,
        damage: createDamageValues({ physical: 10 }),
      }], neverCrit)

      expect(gameState.player.hp).toBe(96)
      expect(gameState.enemies[0]?.hp).toBe(17)
    })

    it('does not trigger Reprisal for damage-over-time ticks', () => {
      const gameState = state([enemy(2, 34)])
      gameState.run.selectedUpgradeIds = ['aegis-pulse-reprisal']
      gameState.player.aegisPulseShieldAmount = 6
      gameState.player.aegisPulseShieldRemaining = 4

      applyDamageEvents(gameState, [{
        sourceId: 2,
        targetId: gameState.player.id,
        damage: createDamageValues({ physical: 10 }),
        damageOverTime: true,
      }], neverCrit)

      expect(gameState.enemies[0]?.hp).toBe(20)
    })

    it('decays Rallying Banner and Aegis Pulse timers and clears their bonuses on expiry', () => {
      const gameState = state([])
      gameState.player.rallyingBannerRemaining = 0.5
      gameState.player.rallyingBannerDamageReductionPercent = 10
      gameState.player.rallyingBannerCooldownReductionPercent = 12
      gameState.player.aegisPulseShieldRemaining = 0.5
      gameState.player.aegisPulseShieldAmount = 8

      updateFrost(gameState, 1)

      expect(gameState.player.rallyingBannerRemaining).toBe(0)
      expect(gameState.player.rallyingBannerDamageReductionPercent).toBe(0)
      expect(gameState.player.rallyingBannerCooldownReductionPercent).toBe(0)
      expect(gameState.player.aegisPulseShieldRemaining).toBe(0)
      expect(gameState.player.aegisPulseShieldAmount).toBe(0)
    })
  })
})
