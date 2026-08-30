import { describe, expect, it } from 'vitest'
import {
  CINDER_MINE_BURNING_DURATION_SECONDS,
  CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO,
  CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER,
  PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT,
  RIFT_JAVELIN_BARBED_DURATION_SECONDS,
  RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO,
  STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_STRIKE_INTERVAL_SECONDS,
} from '../../../game-config/skills'
import {
  CINDER_MINE_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  VITALITY_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  getSkillDefinition,
} from '../../../content/skills/Skills'
import { SYNERGY_UPGRADES } from '../../../game-config/synergies'
import { createGame } from '../../Game'
import { applyDamageEvents } from '../combat/CombatSystem'
import { collectSkillDamage } from './SkillSystem'

const allocator = {
  createEntityId: () => 10_000,
}

describe('new skill balance budgets', () => {
  it('keeps each new skill inside its intended baseline DPS band', () => {
    const riftDefinition = getSkillDefinition(RIFT_JAVELIN_SKILL_ID)
    const cinderDefinition = getSkillDefinition(CINDER_MINE_SKILL_ID)
    const stormDefinition = getSkillDefinition(STORM_RELAY_SKILL_ID)
    const soulDefinition = getSkillDefinition(SOUL_TETHER_SKILL_ID)
    const phantomDefinition = getSkillDefinition(PHANTOM_ARSENAL_SKILL_ID)

    const riftDps =
      (riftDefinition.baseDamage.physical ?? 0) * 2 / riftDefinition.cooldown
    const cinderDps =
      (
        (cinderDefinition.baseDamage.fire ?? 0) +
        (cinderDefinition.baseDamage.fire ?? 0) *
          CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO *
          CINDER_MINE_BURNING_DURATION_SECONDS
      ) / cinderDefinition.cooldown
    const stormDps =
      (stormDefinition.baseDamage.lightning ?? 0) *
        (stormDefinition.maxTargets ?? 1) /
        STORM_RELAY_STRIKE_INTERVAL_SECONDS
    const stormOverchargeDps =
      (stormDefinition.baseDamage.lightning ?? 0) *
        (stormDefinition.maxTargets ?? 1) /
        STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS
    const soulDps = soulDefinition.baseDamage.chaos ?? 0
    const phantomDps =
      (phantomDefinition.summonBaseDamage ?? 0) /
      (phantomDefinition.summonAttackCooldown ?? 1)

    expect(riftDps).toBeCloseTo(9.41, 2)
    expect(riftDps).toBeGreaterThan(8)
    expect(riftDps).toBeLessThan(12)
    expect(cinderDps).toBeCloseTo(8.68, 2)
    expect(cinderDps).toBeGreaterThan(7)
    expect(cinderDps).toBeLessThan(11)
    expect(stormDps).toBeCloseTo(11.67, 2)
    expect(stormDps).toBeGreaterThan(9)
    expect(stormDps).toBeLessThan(14)
    expect(stormOverchargeDps).toBeCloseTo(19.09, 2)
    expect(stormOverchargeDps).toBeLessThan(21)
    expect(soulDps).toBe(7)
    expect(soulDps).toBeGreaterThan(3)
    expect(soulDps).toBeLessThan(8)
    expect(phantomDps).toBeCloseTo(3.85, 2)
    expect(phantomDps).toBeGreaterThan(2.5)
    expect(phantomDps).toBeLessThan(5)
  })

  it('keeps branch upgrades inside bounded output budgets', () => {
    const riftDamage = getSkillDefinition(RIFT_JAVELIN_SKILL_ID).baseDamage.physical ?? 0
    const riftBarbedDps = (
      riftDamage * 2 +
      riftDamage *
        RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO *
        RIFT_JAVELIN_BARBED_DURATION_SECONDS *
        2
    ) / getSkillDefinition(RIFT_JAVELIN_SKILL_ID).cooldown
    const cinderDamage = getSkillDefinition(CINDER_MINE_SKILL_ID).baseDamage.fire ?? 0
    const cinderClusterDps = (
      cinderDamage * CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER * 2 +
      cinderDamage *
        CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER *
        CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO *
        CINDER_MINE_BURNING_DURATION_SECONDS *
        2
    ) / getSkillDefinition(CINDER_MINE_SKILL_ID).cooldown
    const phantomDamage = getSkillDefinition(PHANTOM_ARSENAL_SKILL_ID).summonBaseDamage ?? 0
    const phantomVolleyDps =
      phantomDamage * 2 *
        (1 - PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT / 100) /
      (getSkillDefinition(PHANTOM_ARSENAL_SKILL_ID).summonAttackCooldown ?? 1)

    expect(riftBarbedDps).toBeCloseTo(19.29, 2)
    expect(riftBarbedDps).toBeLessThan(21)
    expect(cinderClusterDps).toBeCloseTo(11.29, 2)
    expect(cinderClusterDps).toBeLessThan(13)
    expect(phantomVolleyDps).toBeCloseTo(6.15, 2)
    expect(phantomVolleyDps).toBeLessThan(7)
  })
})

describe('new skill combination balance', () => {
  it('cash-outs Wildfire without duplicating consumed Burning damage', () => {
    const game = createGame({ seed: 94 })
    game.state.player.skills = [
      { skillId: FIERY_TOUCH_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CINDER_MINE_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const target = game.state.enemies.find((enemy) => enemy.id === targetId)!
    target.maxHp = 100
    target.hp = 100
    target.burningStacks = [{
      remainingDuration: 3,
      damagePerSecond: 4,
      sourceSkillId: CINDER_MINE_SKILL_ID,
    }]
    game.state.run.selectedUpgradeIds.push('synergy-cinder-mine-fiery-touch')

    applyDamageEvents(game.state, [{
      sourceId: game.state.player.id,
      sourceSkillId: RIFT_JAVELIN_SKILL_ID,
      targetId,
      damage: { physical: 1, lightning: 0, fire: 0, cold: 0, chaos: 0 },
    }])

    expect(target.hp).toBeCloseTo(77)
    expect(target.burningStacks).toEqual([])
  })

  it('does not let Ashen Circuit and Overcharge trigger Overload every pulse', () => {
    const game = createGame({ seed: 95 })
    game.state.player.skills = [{
      skillId: STORM_RELAY_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    const targetId = game.spawnSlime({ x: 100, y: 0 })
    const target = game.state.enemies.find((enemy) => enemy.id === targetId)!
    target.burningStacks = [{
      remainingDuration: 3,
      damagePerSecond: 2,
      sourceSkillId: CINDER_MINE_SKILL_ID,
    }]
    game.state.run.selectedUpgradeIds.push(
      'storm-relay-overcharge',
      'synergy-cinder-mine-storm-relay',
    )

    const firstPulse = collectSkillDamage(game.state, allocator)
    applyDamageEvents(game.state, firstPulse)

    expect(firstPulse[0]?.shockApplication?.stacks).toBe(2)
    expect(target.shockStacks).toBe(2)
    expect(target.hp).toBeGreaterThan(0)
  })

  it('caps Renewing Banner extension instead of creating permanent duration growth', () => {
    const game = createGame({ seed: 96 })
    game.state.player.skills = [
      { skillId: RALLYING_BANNER_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: VITALITY_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    game.state.run.selectedUpgradeIds.push(
      'synergy-vitality-rallying-banner',
    )

    collectSkillDamage(game.state, allocator)
    for (let cast = 0; cast < 10; cast += 1) {
      const vitality = game.state.player.skills.find(
        (skill) => skill.skillId === VITALITY_SKILL_ID,
      )!
      vitality.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)
    }

    expect(game.state.player.rallyingBannerRemaining).toBe(12)
  })

  it('keeps all redesigned synergies free of generic damage effects', () => {
    expect(SYNERGY_UPGRADES.every((synergy) =>
      synergy.synergyEffects.every((effect) =>
        effect.damageIncreasePercent === undefined &&
        effect.healingIncreasePercent === undefined &&
        effect.shieldIncreasePercent === undefined
      )
    )).toBe(true)
  })
})
