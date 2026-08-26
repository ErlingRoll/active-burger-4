import { describe, expect, it } from 'vitest'
import { createEntityIdAllocator } from '../../ids'
import {
  createInitialPlayerState,
  spawnBoss,
} from '../spawning/SpawningSystem'
import { applyDamageEvents } from '../combat/CombatSystem'
import {
  cancelBossTelegraphs,
  getInfernoWardenEnrageMultipliers,
  resolveBossTelegraphs,
  updateBosses,
} from './BossSystem'
import {
  getBossDefinition,
  getBossSkillDefinition,
  INFERNO_WARDEN_BOSS_ID,
} from '../../../content/bosses/Bosses'
import type { GameState } from '../../state/GameState'

const neverCrit = { next: () => 1 }

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
    applyDamageEvents(gameState, damage, neverCrit)
    expect(gameState.player.hp).toBe(126)
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
    applyDamageEvents(gameState, resolveBossTelegraphs(gameState), neverCrit)
    expect(gameState.player.hp).toBe(120)
  })

  it('cancels a defeated boss telegraph before it can affect Dodge', () => {
    const gameState = state()
    updateBosses(gameState, createEntityIdAllocator(), 0)

    cancelBossTelegraphs(gameState, new Set([2]))

    expect(gameState.telegraphs).toEqual([])
  })

  it('spawns Inferno Warden skills with independent compounding enrage', () => {
    const gameState = state()
    const bossDefinition = getBossDefinition(INFERNO_WARDEN_BOSS_ID)
    gameState.time = 10
    gameState.bosses = [{
      ...gameState.bosses![0]!,
      definitionId: INFERNO_WARDEN_BOSS_ID,
      bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
      x: 0,
      y: 0,
      radius: bossDefinition.radius,
      hp: bossDefinition.maxHp,
      maxHp: bossDefinition.maxHp,
      speed: bossDefinition.speed,
      contactDamage: bossDefinition.contactDamage,
      spawnTime: 0,
      skills: bossDefinition.skills.map((skillId, index) => ({
        skillId,
        cooldownRemaining: index === 0 ? 0 : 100,
      })),
    }]

    updateBosses(gameState, createEntityIdAllocator(), 0)

    const enrage = getInfernoWardenEnrageMultipliers(10)
    const fireNova = getBossSkillDefinition(bossDefinition.skills[0]!)
    const boss = gameState.bosses[0]!
    expect(boss.speed).toBeCloseTo(bossDefinition.speed * enrage.movementSpeedMultiplier)
    expect(boss.contactDamage).toBeCloseTo(
      bossDefinition.contactDamage * enrage.damageMultiplier,
    )
    expect(boss.skills[0]!.cooldownRemaining).toBeCloseTo(
      fireNova.cooldown * enrage.cooldownMultiplier,
    )
    expect(gameState.telegraphs?.[0]).toMatchObject({
      kind: 'fire-nova',
      x: 0,
      y: 0,
      damage: { fire: fireNova.damage * enrage.damageMultiplier },
    })
  })

  it('records the authored boss spawn time for enrage', () => {
    const gameState = state()
    gameState.time = 12
    gameState.bosses = []

    spawnBoss(
      gameState,
      createEntityIdAllocator(),
      INFERNO_WARDEN_BOSS_ID,
      { x: 100, y: 25 },
    )

    expect(gameState.bosses?.[0]).toMatchObject({
      bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
      spawnTime: 12,
    })
  })

  it('resolves Inferno Warden flame lines and targeted meteor zones', () => {
    const gameState = state()
    gameState.bosses = [{
      ...gameState.bosses![0]!,
      definitionId: INFERNO_WARDEN_BOSS_ID,
      bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
      skills: [
        { skillId: 'fire-nova', cooldownRemaining: 100 },
        { skillId: 'flame-line', cooldownRemaining: 0 },
        { skillId: 'meteor-zone', cooldownRemaining: 100 },
      ],
      nextSkillIndex: 1,
    }]
    const allocator = createEntityIdAllocator()

    updateBosses(gameState, allocator, 0)
    expect(gameState.telegraphs?.[0]).toMatchObject({ kind: 'flame-line' })
    gameState.telegraphs![0]!.remainingDuration = 0
    expect(resolveBossTelegraphs(gameState)).toMatchObject([
      {
        targetId: gameState.player.id,
        damage: { fire: getBossSkillDefinition('flame-line').damage },
      },
    ])

    gameState.bosses![0]!.skills[1]!.cooldownRemaining = 100
    gameState.bosses![0]!.skills[2]!.cooldownRemaining = 0
    gameState.bosses![0]!.nextSkillIndex = 2
    updateBosses(gameState, allocator, 0)
    expect(gameState.telegraphs?.[0]).toMatchObject({
      kind: 'meteor-zone',
      x: gameState.player.x,
      y: gameState.player.y,
    })
  })
})
