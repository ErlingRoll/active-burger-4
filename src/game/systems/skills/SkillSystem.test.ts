import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
} from '../../../content/skills/Skills'
import { createGearModifier } from '../../../content/gear/ModifierPools'
import {
  RALLYING_BANNER_BASE_DURATION_SECONDS,
  RALLYING_BANNER_EFFECT_RADIUS,
  RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS,
  CINDER_MINE_FUSE_SECONDS,
  STORM_RELAY_BASE_DURATION_SECONDS,
  STORM_RELAY_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS,
  SOUL_TETHER_DURATION_SECONDS,
  SOUL_TETHER_RETARGET_DAMAGE_MULTIPLIER,
} from '../../../game-config/skills'
import { createGame, FIXED_STEP_SECONDS } from '../../Game'
import { equipItem, equipRolledItem } from '../../equipment/EquipmentState'
import { Rarity } from '../../../content/rarity/Rarity'
import {
  collectSkillDamage,
  updateSkillCooldowns,
  updateSkillEffects,
  updateCinderMineTraps,
  updateStormRelay,
  updateSoulTether,
} from './SkillSystem'
import {
  applyDamageEvents,
  collectProjectileDamage,
  performBasicAttackIfReady,
  updateBurning,
  updateProjectiles,
} from '../combat/CombatSystem'
import {
  removeDeadSummons,
  updateSummons,
} from '../summons/SummonSystem'
import { isPlayerInRallyingBanner } from './RallyingBanner'
import { isSkillResonant } from '../../combat/Resonance'

const allocator = {
  createEntityId: () => 10_000,
}

describe('skill system', () => {
  it('adds Attunement to skill damage without changing Basic Attack damage', () => {
    const game = createGame({ seed: 49 })
    game.state.player.skills = [{
      skillId: WHIRLWIND_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    const targetId = game.spawnSlime({ x: 40, y: 0 })

    const [event] = collectSkillDamage(game.state, allocator)

    expect(event?.targetId).toBe(targetId)
    expect(event?.damage.physical).toBeCloseTo(16)
  })

  it('scales Attunement from the upgraded Basic Attack profile', () => {
    const game = createGame({ seed: 47 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 2, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    game.spawnSlime({ x: 40, y: 0 })

    const [event] = collectSkillDamage(game.state, allocator)

    expect(event?.damage.physical).toBeCloseTo(17)
  })

  it('consumes Resonance and applies the skill-specific effect on the next skill cast', () => {
    const game = createGame({ seed: 48 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    game.state.player.targetId = targetId

    for (let attack = 0; attack < (game.state.player.resonance ?? 5); attack += 1) {
      game.state.player.attackCooldownRemaining = 0
      performBasicAttackIfReady(game.state, allocator)
    }

    collectSkillDamage(game.state, allocator)

    expect(game.state.player.skills.find(
      (skill) => skill.skillId === WHIRLWIND_SKILL_ID,
    )?.resonanceAttackCount).toBe(0)
    expect(game.state.player.attackCooldownRemaining).toBe(0)
  })

  it('charges and consumes resonance independently for each skill', () => {
    const game = createGame({ seed: 51 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    game.state.player.targetId = targetId
    const resonanceRequirement = game.state.player.resonance ?? 5

    for (let attack = 0; attack < resonanceRequirement; attack += 1) {
      game.state.player.attackCooldownRemaining = 0
      performBasicAttackIfReady(game.state, allocator)
    }

    expect(isSkillResonant(game.state, WHIRLWIND_SKILL_ID)).toBe(true)
    expect(isSkillResonant(game.state, CHAIN_LIGHTNING_SKILL_ID)).toBe(true)

    const events = collectSkillDamage(game.state, allocator)

    expect(events.some((event) => event.sourceSkillId === WHIRLWIND_SKILL_ID)).toBe(true)
    expect(events.some((event) => event.sourceSkillId === CHAIN_LIGHTNING_SKILL_ID)).toBe(true)
    expect(isSkillResonant(game.state, WHIRLWIND_SKILL_ID)).toBe(false)
    expect(isSkillResonant(game.state, CHAIN_LIGHTNING_SKILL_ID)).toBe(false)
  })

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
    expect(events.every((event) =>
      Math.abs(event.damage.physical - 16) < 0.001
    )).toBe(true)
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
    expect(events.every((event) => event.damage.lightning === 8)).toBe(true)
    expect(game.state.effects[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 220, y: 0 },
    ])
    expect(game.state.player.skills.at(-1)?.cooldownRemaining).toBe(3)

    expect(collectSkillDamage(game.state, allocator)).toEqual([])
  })

  it('continues through a dense group instead of stopping after three targets', () => {
    const game = createGame({ seed: 52 })
    game.state.player.skills = [{
      skillId: CHAIN_LIGHTNING_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    const targetIds = [80, 120, 160, 200, 240, 280].map((x) =>
      game.spawnSlime({ x, y: 0 }),
    )

    const events = collectSkillDamage(game.state, allocator)

    expect(events.map((event) => event.targetId)).toEqual(targetIds.slice(0, 5))
    expect(game.state.effects[0]?.points).toHaveLength(6)
  })

  it('applies the selected Frost and Overload Chain Lightning branch effects', () => {
    const game = createGame({ seed: 53 })
    game.state.player.skills = [{
      skillId: CHAIN_LIGHTNING_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    game.state.run.selectedUpgradeIds.push(
      'chain-lightning-frost',
      'chain-lightning-overload',
    )
    game.spawnSlime({ x: 100, y: 0 })

    const [event] = collectSkillDamage(game.state, allocator)

    expect(event?.frostApplication).toMatchObject({ stacks: 1 })
    expect(event?.shockApplication).toMatchObject({ threshold: 3 })
  })

  it('gives Vitality distinct steady and emergency healing identities', () => {
    const renewalGame = createGame({ seed: 54 })
    renewalGame.state.player.skills = [{
      skillId: VITALITY_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    renewalGame.state.player.hp = 50
    renewalGame.state.run.selectedUpgradeIds.push('vitality-renewal')
    renewalGame.state.player.vitalityMaxHpHealingPercent = 3
    collectSkillDamage(renewalGame.state, allocator)
    expect(renewalGame.state.player.hp).toBeGreaterThan(55)

    const lastStandGame = createGame({ seed: 55 })
    lastStandGame.state.player.skills = [{
      skillId: VITALITY_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    lastStandGame.state.player.hp = 20
    lastStandGame.state.player.vitalityLowHpHealingMultiplier = 2
    collectSkillDamage(lastStandGame.state, allocator)
    expect(lastStandGame.state.player.hp).toBe(32)
  })

  it('applies synergy bonuses to healing and shields', () => {
    const game = createGame({ seed: 56 })
    game.state.player.skills = [
      { skillId: VITALITY_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: AEGIS_PULSE_SKILL_ID, level: 1, cooldownRemaining: 1 },
    ]
    game.state.player.hp = 50
    game.state.player.aegisPulseShieldAmount = 10
    game.state.player.aegisPulseShieldMaxAmount = 14
    game.state.player.aegisPulseShieldRemaining = 4
    game.state.run.selectedUpgradeIds.push('synergy-vitality-aegis-pulse')

    collectSkillDamage(game.state, allocator)

    expect(game.state.player.hp).toBeCloseTo(56)
    expect(game.state.player.aegisPulseShieldAmount).toBeCloseTo(13)
  })

  it('applies skill-specific percentage damage growth without compounding rank bonuses', () => {
    const game = createGame({ seed: 55 })
    game.state.player.skills = [
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 2, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 2, cooldownRemaining: 0 },
    ]
    game.spawnSlime({ x: 80, y: 0 })

    const events = collectSkillDamage(game.state, allocator)

    expect(events.find((event) => event.sourceSkillId === WHIRLWIND_SKILL_ID)?.damage.physical)
      .toBeCloseTo(16.64)
    expect(events.find((event) => event.sourceSkillId === CHAIN_LIGHTNING_SKILL_ID)?.damage.lightning)
      .toBeCloseTo(8.72)
  })

  it('lets Close Quarters prime a ready Basic Attack after a Whirlwind hit', () => {
    const game = createGame({ seed: 57 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    game.state.player.attackCooldownRemaining = 1
    game.spawnSlime({ x: 40, y: 0 })
    game.state.run.selectedUpgradeIds.push('synergy-basic-attack-whirlwind')

    collectSkillDamage(game.state, allocator)

    expect(game.state.player.attackCooldownRemaining).toBe(0.5)
  })

  it('lets Basic Attack prime Shock or Chill for its paired skill', () => {
    const shockGame = createGame({ seed: 58 })
    shockGame.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const shockTargetId = shockGame.spawnSlime({ x: 40, y: 0 })
    shockGame.state.player.targetId = shockTargetId
    shockGame.state.run.selectedUpgradeIds.push(
      'synergy-basic-attack-chain-lightning',
    )

    const shockEvents = performBasicAttackIfReady(shockGame.state, allocator)

    expect(shockEvents[0]?.shockApplication).toMatchObject({ stacks: 1 })

    const frostGame = createGame({ seed: 59 })
    frostGame.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: GLACIAL_ORB_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const frostTargetId = frostGame.spawnSlime({ x: 40, y: 0 })
    frostGame.state.player.targetId = frostTargetId
    frostGame.state.run.selectedUpgradeIds.push(
      'synergy-basic-attack-glacial-orb',
    )

    const frostEvents = performBasicAttackIfReady(frostGame.state, allocator)

    expect(frostEvents[0]?.frostApplication).toMatchObject({ stacks: 1 })
  })

  it('lets Gravity Well prime an extra Chain Lightning target', () => {
    const game = createGame({ seed: 60 })
    game.state.player.skills = [{
      skillId: GRAVITY_WELL_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    game.state.run.selectedUpgradeIds.push(
      'synergy-chain-lightning-gravity-well',
    )
    for (const x of [80, 120, 160, 200]) {
      game.spawnSlime({ x, y: 0 })
    }

    collectSkillDamage(game.state, allocator)
    game.state.player.skills = [
      { skillId: GRAVITY_WELL_SKILL_ID, level: 1, cooldownRemaining: 1 },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]

    const events = collectSkillDamage(game.state, allocator)

    expect(events.filter(
      (event) => event.sourceSkillId === CHAIN_LIGHTNING_SKILL_ID,
    )).toHaveLength(4)
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
      Rarity.Rare,
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
          lightning: 4,
        }),
      }),
    ])
    expect(events.find((event) => event.sourceSkillId === WHIRLWIND_SKILL_ID)
      ?.damage.physical).toBeCloseTo(16)
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
    expect(chainEvent?.damage.lightning).toBeCloseTo(13.6)
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
      Rarity.Common,
      [createGearModifier('iron-cleaver', 'cooldown-reduction', 3, 12)],
    )
    game.spawnSlime({ x: 80, y: 0 })

    collectSkillDamage(game.state, allocator)

    expect(game.state.player.skills[0]?.cooldownRemaining).toBeCloseTo(2.2)
  })

  it('automatically heals from Vitality, scales by level, and respects cooldown reduction', () => {
    const game = createGame({ seed: 56 })
    game.state.player.skills = [{
      skillId: VITALITY_SKILL_ID,
      level: 2,
      cooldownRemaining: 0,
    }]
    game.state.player.hp = game.state.player.maxHp - 20
    equipRolledItem(
      game.state.player,
      'iron-cleaver',
      Rarity.Common,
      [createGearModifier('iron-cleaver', 'cooldown-reduction', 3, 14)],
    )

    expect(collectSkillDamage(game.state, allocator)).toEqual([])

    expect(game.state.player.hp).toBe(game.state.player.maxHp - 12)
    expect(game.state.player.skills[0]?.cooldownRemaining).toBeCloseTo(4.3)
    expect(game.state.effects[0]?.skillId).toBe(VITALITY_SKILL_ID)
    expect(collectSkillDamage(game.state, allocator)).toEqual([])
  })

  it('allows Vitality healing to critically strike and caps it at missing HP', () => {
    const game = createGame({ seed: 57 })
    game.state.player.skills = [{
      skillId: VITALITY_SKILL_ID,
      level: 2,
      cooldownRemaining: 0,
    }]
    game.state.player.hp = game.state.player.maxHp - 6
    game.state.player.critChance = 100
    game.state.player.critMultiplier = 200

    collectSkillDamage(game.state, allocator, { next: () => 0 })

    expect(game.state.player.hp).toBe(game.state.player.maxHp)
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
      Rarity.Common,
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

  describe('Glacial Orb', () => {
    it('hits the nearest target and splashes to nearby enemies, applying Chill', () => {
      const game = createGame({ seed: 60 })
      game.state.player.skills = [{
        skillId: GLACIAL_ORB_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const nearestId = game.spawnSlime({ x: 200, y: 0 })
      const splashId = game.spawnSlime({ x: 200, y: 50 })
      const outOfRangeId = game.spawnSlime({ x: 500, y: 0 })

      const castEvents = collectSkillDamage(game.state, allocator)

      expect(castEvents).toEqual([])
      expect(game.state.effects).toEqual([])
      expect(game.state.player.skills[0]?.cooldownRemaining).toBeCloseTo(3.2)
      expect(game.state.projectiles).toEqual([
        expect.objectContaining({
          skillId: GLACIAL_ORB_SKILL_ID,
          targetId: nearestId,
        }),
      ])
      expect(game.state.projectiles[0]?.visualOnly).toBeUndefined()

      let impactEvents: ReturnType<typeof collectProjectileDamage> = []
      for (let tick = 0; tick < 60 && impactEvents.length === 0; tick += 1) {
        updateProjectiles(game.state, 1 / 60)
        impactEvents = collectProjectileDamage(game.state, undefined, allocator)
      }

      expect(impactEvents.map((event) => event.targetId)).toEqual([nearestId, splashId])
      expect(impactEvents.every((event) => event.damage.cold === 9)).toBe(true)
      expect(impactEvents.every((event) => event.frostApplication?.stacks === 1)).toBe(true)
      expect(impactEvents.some((event) => event.targetId === outOfRangeId)).toBe(false)
      expect(game.state.effects).toEqual([
        expect.objectContaining({
          skillId: GLACIAL_ORB_SKILL_ID,
          x: 200,
          y: 0,
          radius: 55,
        }),
      ])
    })

    it('extends splash radius and adds an extra Chill stack with Permafrost', () => {
      const game = createGame({ seed: 61 })
      game.state.player.skills = [{
        skillId: GLACIAL_ORB_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('glacial-orb-permafrost')
      const nearestId = game.spawnSlime({ x: 200, y: 0 })
      const edgeId = game.spawnSlime({ x: 200, y: 90 })

      expect(collectSkillDamage(game.state, allocator)).toEqual([])
      game.state.projectiles[0]!.x = 200
      const events = collectProjectileDamage(game.state, undefined, allocator)

      expect(events.map((event) => event.targetId)).toEqual([nearestId, edgeId])
      expect(events.every((event) => event.frostApplication?.stacks === 2)).toBe(true)
    })

    it('restricts Ice Lance to a single target but rewards Chilled or Frozen enemies', () => {
      const game = createGame({ seed: 62 })
      game.state.player.skills = [{
        skillId: GLACIAL_ORB_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('glacial-orb-ice-lance')
      const targetId = game.spawnSlime({ x: 200, y: 0 })
      game.spawnSlime({ x: 200, y: 50 })
      game.state.enemies.find((enemy) => enemy.id === targetId)!.chillStacks = 1

      expect(collectSkillDamage(game.state, allocator)).toEqual([])
      game.state.projectiles[0]!.x = 200
      const events = collectProjectileDamage(game.state, undefined, allocator)

      expect(events).toEqual([
        expect.objectContaining({ targetId, damage: expect.objectContaining({ cold: 12.6 }) }),
      ])
    })

    it('uses global projectile bonuses but ignores Basic Attack-only projectile bonuses', () => {
      const localModifierGame = createGame({ seed: 64 })
      localModifierGame.state.player.skills = [{
        skillId: GLACIAL_ORB_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      equipItem(localModifierGame.state.player, 'hunters-bow')
      localModifierGame.spawnSlime({ x: 120, y: 0 })

      collectSkillDamage(localModifierGame.state, allocator)

      expect(localModifierGame.state.projectiles).toHaveLength(1)

      const globalModifierGame = createGame({ seed: 65 })
      globalModifierGame.state.player.skills = [{
        skillId: GLACIAL_ORB_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      equipItem(globalModifierGame.state.player, 'splintering-helm')
      equipItem(globalModifierGame.state.player, 'splintering-armor')
      globalModifierGame.spawnSlime({ x: 120, y: 0 })

      collectSkillDamage(globalModifierGame.state, allocator)

      expect(globalModifierGame.state.projectiles).toHaveLength(2)
      const first = globalModifierGame.state.projectiles[0]!
      const second = globalModifierGame.state.projectiles[1]!
      expect(
        Math.atan2(second.velocityY, second.velocityX) -
          Math.atan2(first.velocityY, first.velocityX),
      ).toBeCloseTo((15 * Math.PI) / 180)
    })
  })

  describe("Lancer's Charge", () => {
    it('strikes every enemy in the charge corridor toward the nearest target', () => {
      const game = createGame({ seed: 63 })
      game.state.player.skills = [{
        skillId: LANCERS_CHARGE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const targetId = game.spawnSlime({ x: 150, y: 0 })
      const inCorridorId = game.spawnSlime({ x: 100, y: 20 })
      const outsideId = game.spawnSlime({ x: 100, y: 80 })

      const events = collectSkillDamage(game.state, allocator)

      expect(events.map((event) => event.targetId).sort((a, b) => a - b))
        .toEqual([targetId, inCorridorId].sort((a, b) => a - b))
      expect(events.every((event) =>
        Math.abs(event.damage.physical - 19) < 0.001
      )).toBe(true)
      expect(events.some((event) => event.targetId === outsideId)).toBe(false)
      expect(game.state.player.x).toBeGreaterThan(0)
      expect(game.state.player.lancerMomentumStacks).toBe(1)
      expect(game.state.player.lancerMomentumDecayRemaining).toBe(4)
    })

    it('builds capped Momentum stacks across casts and decays them after inactivity', () => {
      const game = createGame({ seed: 64 })
      game.state.player.skills = [{
        skillId: LANCERS_CHARGE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.spawnSlime({ x: 150, y: 0 })

      collectSkillDamage(game.state, allocator)
      expect(game.state.player.lancerMomentumStacks).toBe(1)

      game.state.player.skills[0]!.cooldownRemaining = 0
      const [secondEvent] = collectSkillDamage(game.state, allocator)
      expect(secondEvent?.damage.physical).toBeCloseTo(19.66)
      expect(game.state.player.lancerMomentumStacks).toBe(2)

      updateSkillCooldowns(game.state, 4)
      expect(game.state.player.lancerMomentumStacks).toBe(0)
    })

    it('gives Vanguard a bigger Momentum bonus plus a single-target bonus', () => {
      const game = createGame({ seed: 65 })
      game.state.player.skills = [{
        skillId: LANCERS_CHARGE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('lancers-charge-vanguard')
      game.state.player.lancerMomentumStacks = 1
      game.spawnSlime({ x: 150, y: 0 })

      const [event] = collectSkillDamage(game.state, allocator)

      expect(event?.damage.physical).toBeCloseTo(21.75)
    })

    it('gives Impaler more range at the cost of reduced damage', () => {
      const withoutImpaler = createGame({ seed: 66 })
      withoutImpaler.state.player.skills = [{
        skillId: LANCERS_CHARGE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      withoutImpaler.spawnSlime({ x: 190, y: 0 })
      expect(collectSkillDamage(withoutImpaler.state, allocator)).toEqual([])

      const withImpaler = createGame({ seed: 66 })
      withImpaler.state.player.skills = [{
        skillId: LANCERS_CHARGE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      withImpaler.state.run.selectedUpgradeIds.push('lancers-charge-impaler')
      withImpaler.spawnSlime({ x: 190, y: 0 })

      const [event] = collectSkillDamage(withImpaler.state, allocator)
      expect(event?.damage.physical).toBeCloseTo(17.35)
    })
  })

  describe('Rallying Banner', () => {
    it('heals the player and activates its base banner bonuses', () => {
      const game = createGame({ seed: 67 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.player.hp = game.state.player.maxHp - 20

      expect(collectSkillDamage(game.state, allocator)).toEqual([])

      expect(game.state.player.hp).toBe(game.state.player.maxHp - 16)
      expect(game.state.player.rallyingBannerRemaining).toBe(6)
      expect(game.state.player.rallyingBannerDamageReductionPercent).toBe(10)
      expect(game.state.player.rallyingBannerCooldownReductionPercent).toBe(0)
      expect(game.state.effects[0]).toMatchObject({
        radius: RALLYING_BANNER_EFFECT_RADIUS,
        lifetime: RALLYING_BANNER_BASE_DURATION_SECONDS,
        remainingLifetime: RALLYING_BANNER_BASE_DURATION_SECONDS,
      })
    })

    it('heals living allies inside the banner area on each healing pulse', () => {
      const game = createGame({ seed: 70 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.player.hp = game.state.player.maxHp - 20
      game.state.summons.push(
        {
          id: 101,
          ownerId: game.state.player.id,
          x: 40,
          y: 0,
          hp: 2,
          maxHp: 10,
          contactCooldownRemaining: 0,
          attackCooldownRemaining: 0,
        },
        {
          id: 102,
          ownerId: game.state.player.id,
          x: RALLYING_BANNER_EFFECT_RADIUS + 20,
          y: 0,
          hp: 2,
          maxHp: 10,
          contactCooldownRemaining: 0,
          attackCooldownRemaining: 0,
        },
      )

      collectSkillDamage(game.state, allocator)
      updateSkillEffects(game.state, 1)

      expect(game.state.player.hp).toBe(game.state.player.maxHp - 12)
      expect(game.state.summons[0]?.hp).toBe(6)
      expect(game.state.summons[1]?.hp).toBe(2)
    })

    it('gives Bulwark a bigger reduction and longer duration', () => {
      const game = createGame({ seed: 68 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('rallying-banner-bulwark')

      collectSkillDamage(game.state, allocator)

      expect(game.state.player.rallyingBannerRemaining).toBe(10)
      expect(game.state.player.rallyingBannerDamageReductionPercent).toBe(25)
      expect(game.state.effects[0]?.lifetime).toBe(
        RALLYING_BANNER_BASE_DURATION_SECONDS +
          RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS,
      )
    })

    it('allows overlapping placements with independent durations', () => {
      const game = createGame({ seed: 69 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]

      collectSkillDamage(game.state, allocator)
      const firstBanner = game.state.effects[0]!
      game.state.player.skills[0]!.cooldownRemaining = 0
      game.state.player.x = RALLYING_BANNER_EFFECT_RADIUS + 20
      collectSkillDamage(game.state, allocator)

      expect(game.state.player.skills[0]?.castCount).toBe(2)
      expect(game.state.effects).toHaveLength(2)
      expect(game.state.effects.map((effect) => effect.x)).toEqual([0, 116])

      firstBanner.remainingLifetime = 1
      updateSkillEffects(game.state, 1)

      expect(game.state.effects).toHaveLength(1)
      expect(game.state.effects[0]?.x).toBe(116)
    })

    it('removes the banner effect when its active duration expires', () => {
      const game = createGame({ seed: 70 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]

      collectSkillDamage(game.state, allocator)
      updateSkillEffects(game.state, RALLYING_BANNER_BASE_DURATION_SECONDS)

      expect(game.state.effects).toEqual([])
    })

    it('keeps overlapping banners independent during high-cooldown-reduction casts', () => {
      const game = createGame({ seed: 72 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('rallying-banner-commander')
      equipRolledItem(
        game.state.player,
        'starcall-wand',
        Rarity.Rare,
        [],
        undefined,
        'astral',
      )
      for (const itemId of ['helmet', 'armor', 'boots', 'ring', 'amulet']) {
        equipRolledItem(
          game.state.player,
          itemId,
          Rarity.Rare,
          [],
          undefined,
          'astral',
        )
      }

      let casts = 0
      let previousCastCount = 0
      let maximumBannerCount = 0
      for (let tick = 0; tick < 60 * 30; tick += 1) {
        game.update(FIXED_STEP_SECONDS)
        const bannerCount = game.state.effects.filter(
          (effect) => effect.skillId === RALLYING_BANNER_SKILL_ID,
        ).length
        maximumBannerCount = Math.max(maximumBannerCount, bannerCount)
        const castCount = game.state.player.skills[0]?.castCount ?? 0
        if (castCount > previousCastCount) {
          casts += castCount - previousCastCount
          previousCastCount = castCount
        }
      }

      expect(casts).toBeGreaterThan(3)
      expect(maximumBannerCount).toBeGreaterThan(1)
    })

    it('does not stack defensive bonuses from overlapping banners', () => {
      const game = createGame({ seed: 73 })
      game.state.player.skills = [{
        skillId: RALLYING_BANNER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('rallying-banner-bulwark')

      collectSkillDamage(game.state, allocator)
      game.state.player.skills[0]!.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)

      expect(game.state.player.rallyingBannerRemaining).toBe(10)
      expect(game.state.player.rallyingBannerDamageReductionPercent).toBe(25)
      expect(isPlayerInRallyingBanner(game.state)).toBe(true)
      applyDamageEvents(game.state, [{
        sourceId: 2,
        targetId: game.state.player.id,
        damage: { physical: 100, lightning: 0, fire: 0, cold: 0, chaos: 0 },
      }])

      expect(game.state.player.hp).toBe(game.state.player.maxHp - 55)
    })

    it("lets Commander's active cooldown reduction apply to every equipped skill", () => {
      const game = createGame({ seed: 71 })
      game.state.player.skills = [
        { skillId: RALLYING_BANNER_SKILL_ID, level: 1, cooldownRemaining: 0 },
        { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
      ]
      game.state.run.selectedUpgradeIds.push('rallying-banner-commander')
      game.spawnSlime({ x: 50, y: 0 })

      collectSkillDamage(game.state, allocator)

      const rallyingBanner = game.state.player.skills.find(
        (skill) => skill.skillId === RALLYING_BANNER_SKILL_ID,
      )
      const whirlwind = game.state.player.skills.find(
        (skill) => skill.skillId === WHIRLWIND_SKILL_ID,
      )
      expect(rallyingBanner?.cooldownRemaining).toBeCloseTo(14.08)
      expect(whirlwind?.cooldownRemaining).toBeCloseTo(2.2)
    })
  })

  describe('Gravity Well', () => {
    it('pulls enemies toward the player, capped short of overlap, and deals chaos damage', () => {
      const game = createGame({ seed: 70 })
      game.state.player.skills = [{
        skillId: GRAVITY_WELL_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const targetId = game.spawnSlime({ x: 100, y: 0 })

      const [event] = collectSkillDamage(game.state, allocator)

      expect(event).toEqual(expect.objectContaining({
        targetId,
        damage: expect.objectContaining({ chaos: 7 }),
      }))
      expect(game.state.enemies.find((enemy) => enemy.id === targetId)?.x).toBeCloseTo(42)
    })

    it('gives Singularity a bigger radius, more pull, and applies Chill', () => {
      const game = createGame({ seed: 71 })
      game.state.player.skills = [{
        skillId: GRAVITY_WELL_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('gravity-well-singularity')
      const targetId = game.spawnSlime({ x: 150, y: 0 })

      const [event] = collectSkillDamage(game.state, allocator)

      expect(event?.frostApplication).toMatchObject({ stacks: 1 })
      expect(game.state.enemies.find((enemy) => enemy.id === targetId)?.x).toBeCloseTo(50)
    })

    it('lets Event Horizon trade pulling for a large damage increase', () => {
      const game = createGame({ seed: 72 })
      game.state.player.skills = [{
        skillId: GRAVITY_WELL_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('gravity-well-event-horizon')
      const targetId = game.spawnSlime({ x: 100, y: 0 })

      const [event] = collectSkillDamage(game.state, allocator)

      expect(event?.damage.chaos).toBeCloseTo(10.5)
      expect(game.state.enemies.find((enemy) => enemy.id === targetId)?.x).toBe(100)
    })
  })

  describe('Aegis Pulse', () => {
    it('damages nearby enemies and grants a temporary absorb shield', () => {
      const game = createGame({ seed: 73 })
      game.state.player.skills = [{
        skillId: AEGIS_PULSE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const targetId = game.spawnSlime({ x: 50, y: 0 })

      const [event] = collectSkillDamage(game.state, allocator)

      expect(event).toEqual(expect.objectContaining({
        targetId,
        damage: expect.objectContaining({ physical: 14 }),
      }))
      expect(game.state.player.aegisPulseShieldAmount).toBe(14)
      expect(game.state.player.aegisPulseShieldRemaining).toBe(4)
    })

    it('gives Bulwark a bigger shield that lasts longer', () => {
      const game = createGame({ seed: 74 })
      game.state.player.skills = [{
        skillId: AEGIS_PULSE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('aegis-pulse-bulwark')

      collectSkillDamage(game.state, allocator)

      expect(game.state.player.aegisPulseShieldAmount).toBe(26)
      expect(game.state.player.aegisPulseShieldRemaining).toBe(6)
    })
  })

  describe('Rift Javelin', () => {
    it('pierces every enemy outbound, then returns to hit each enemy again inbound', () => {
      const game = createGame({ seed: 80 })
      game.state.player.skills = [{
        skillId: RIFT_JAVELIN_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const nearId = game.spawnSlime({ x: 80, y: 0 })
      const farId = game.spawnSlime({ x: 160, y: 0 })

      expect(collectSkillDamage(game.state, allocator)).toEqual([])
      expect(game.state.projectiles).toHaveLength(1)
      const projectile = game.state.projectiles[0]!
      expect(projectile.piercing).toBe(true)

      let outboundEvents: ReturnType<typeof collectProjectileDamage> = []
      for (let tick = 0; tick < 240; tick += 1) {
        updateProjectiles(game.state, 1 / 60)
        outboundEvents = outboundEvents.concat(
          collectProjectileDamage(game.state, undefined, allocator),
        )
        if (game.state.projectiles[0]?.returning) {
          break
        }
      }
      expect(outboundEvents.map((event) => event.targetId)).toEqual([nearId, farId])
      expect(game.state.projectiles[0]?.returning).toBe(true)

      let inboundEvents: ReturnType<typeof collectProjectileDamage> = []
      for (let tick = 0; tick < 240 && game.state.projectiles.length > 0; tick += 1) {
        updateProjectiles(game.state, 1 / 60)
        inboundEvents = inboundEvents.concat(
          collectProjectileDamage(game.state, undefined, allocator),
        )
      }
      expect(inboundEvents.map((event) => event.targetId)).toEqual([farId, nearId])
    })

    it('fires a spread volley for global extra projectiles', () => {
      const game = createGame({ seed: 84 })
      game.state.player.skills = [{
        skillId: RIFT_JAVELIN_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      equipItem(game.state.player, 'splintering-helm')
      equipItem(game.state.player, 'splintering-armor')
      game.spawnSlime({ x: 160, y: 0 })

      collectSkillDamage(game.state, allocator)

      expect(game.state.projectiles).toHaveLength(2)
      const first = game.state.projectiles[0]!
      const second = game.state.projectiles[1]!
      expect(
        Math.atan2(second.velocityY, second.velocityX) -
          Math.atan2(first.velocityY, first.velocityX),
      ).toBeCloseTo((15 * Math.PI) / 180)
    })

    it('lets Homeward Edge increase damage only on the return leg', () => {
      const game = createGame({ seed: 81 })
      game.state.player.skills = [{
        skillId: RIFT_JAVELIN_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('rift-javelin-homeward')
      game.spawnSlime({ x: 80, y: 0 })

      collectSkillDamage(game.state, allocator)
      const projectile = game.state.projectiles[0]!
      expect(projectile.returnDamageMultiplier).toBeCloseTo(1.4)

      let outboundEvents: ReturnType<typeof collectProjectileDamage> = []
      for (let tick = 0; tick < 60 && outboundEvents.length === 0; tick += 1) {
        updateProjectiles(game.state, 1 / 60)
        outboundEvents = collectProjectileDamage(game.state, undefined, allocator)
      }
      expect(outboundEvents[0]?.damage.physical).toBeCloseTo(24)

      projectile.returning = true
      projectile.pierceHitTargetIds = []
      const inboundEvents = collectProjectileDamage(game.state, undefined, allocator)
      expect(inboundEvents[0]?.damage.physical).toBeCloseTo(24 * 1.4)
    })

    it('applies a Poison stack from Barbed Javelin hits', () => {
      const game = createGame({ seed: 82 })
      game.state.player.skills = [{
        skillId: RIFT_JAVELIN_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('rift-javelin-barbed')
      game.spawnSlime({ x: 80, y: 0 })

      collectSkillDamage(game.state, allocator)
      let events: ReturnType<typeof collectProjectileDamage> = []
      for (let tick = 0; tick < 60 && events.length === 0; tick += 1) {
        updateProjectiles(game.state, 1 / 60)
        events = collectProjectileDamage(game.state, undefined, allocator)
      }
      expect(events[0]?.poisonApplication).toMatchObject({ physicalChaosRatio: 0.35 })
    })
  })

  describe('Cinder Mine', () => {
    it('arms before an enemy enters its radius, then explodes and applies Burning', () => {
      const game = createGame({ seed: 83 })
      game.state.player.skills = [{
        skillId: CINDER_MINE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      equipItem(game.state.player, 'ritual-staff')
      const targetId = game.spawnSlime({ x: 200, y: 0 })

      expect(collectSkillDamage(game.state, allocator)).toEqual([])
      expect(game.state.traps).toHaveLength(1)
      expect(updateCinderMineTraps(game.state, CINDER_MINE_FUSE_SECONDS, allocator))
        .toEqual([])
      expect(game.state.traps).toHaveLength(1)

      game.state.enemies.find((enemy) => enemy.id === targetId)!.x = 20
      const events = updateCinderMineTraps(game.state, 0.05, allocator)
      expect(events).toEqual([
        expect.objectContaining({
          targetId,
          damage: expect.objectContaining({ fire: 15 }),
          burningApplication: expect.objectContaining({ fireDamageRatio: 0.4 }),
        }),
      ])
      expect(game.state.traps).toEqual([])

      applyDamageEvents(game.state, events)
      const target = game.state.enemies.find((enemy) => enemy.id === targetId)!
      expect(target.burningStacks).toHaveLength(1)
      const burningEvents = updateBurning(game.state, 1)
      expect(burningEvents).toEqual([
        expect.objectContaining({ targetId, sourceLabel: 'Burning', damageOverTime: true }),
      ])
      expect(burningEvents[0]?.damage.fire).toBeCloseTo(6)
    })

    it('does not detonate while its fuse is still running', () => {
      const game = createGame({ seed: 86 })
      game.state.player.skills = [{
        skillId: CINDER_MINE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.spawnSlime({ x: 20, y: 0 })

      collectSkillDamage(game.state, allocator)
      expect(updateCinderMineTraps(game.state, 0.05, allocator)).toEqual([])
      expect(game.state.traps).toHaveLength(1)
      expect(game.state.traps?.[0]?.fuseRemaining).toBeGreaterThan(0)
    })

    it('keeps an armed mine until an enemy enters its radius', () => {
      const game = createGame({ seed: 86 })
      game.state.player.skills = [{
        skillId: CINDER_MINE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]

      collectSkillDamage(game.state, allocator)
      expect(updateCinderMineTraps(game.state, CINDER_MINE_FUSE_SECONDS, allocator))
        .toEqual([])
      expect(game.state.traps).toHaveLength(1)
      expect(game.state.traps?.[0]?.fuseRemaining).toBe(0)
    })

    it('deploys a second, weaker mine with Cluster Charges', () => {
      const game = createGame({ seed: 84 })
      game.state.player.skills = [{
        skillId: CINDER_MINE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('cinder-mine-cluster')

      collectSkillDamage(game.state, allocator)

      expect(game.state.traps).toHaveLength(2)
      expect(game.state.traps?.[0]?.damage.fire).toBeCloseTo(15 * 0.65)
      expect(game.state.traps?.[1]?.x).not.toBe(game.state.traps?.[0]?.x)
    })

    it('gives Inferno Charge a bigger radius and stronger Burning', () => {
      const game = createGame({ seed: 85 })
      game.state.player.skills = [{
        skillId: CINDER_MINE_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('cinder-mine-inferno')

      collectSkillDamage(game.state, allocator)

      expect(game.state.traps?.[0]?.radius).toBeCloseTo(95)
      expect(game.state.traps?.[0]?.burningApplication?.fireDamageRatio).toBeCloseTo(0.6)
    })

    it('lets Wildfire consume Burning when Fiery Touch triggers', () => {
      const game = createGame({ seed: 85 })
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
        sourceSkillId: BASIC_ATTACK_SKILL_ID,
        targetId,
        damage: { physical: 1, lightning: 0, fire: 0, cold: 0, chaos: 0 },
      }])

      expect(target.burningStacks).toEqual([])
      expect(target.hp).toBeCloseTo(69)
      expect(game.state.player.skills.find(
        (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
      )?.cooldownRemaining).toBeGreaterThan(0)
    })
  })

  describe('Storm Relay', () => {
    it('strikes immediately on cast, chains to nearby enemies, and applies Shock', () => {
      const game = createGame({ seed: 86 })
      game.state.player.skills = [{
        skillId: STORM_RELAY_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const firstId = game.spawnSlime({ x: 100, y: 0 })
      const secondId = game.spawnSlime({ x: 200, y: 0 })

      const events = collectSkillDamage(game.state, allocator)

      expect(events.map((event) => event.targetId)).toEqual([firstId, secondId])
      expect(events.every((event) => event.shockApplication?.threshold === 3)).toBe(true)
      expect(game.state.relays).toHaveLength(1)
      expect(game.state.relays?.[0]?.strikeIntervalSeconds).toBe(STORM_RELAY_STRIKE_INTERVAL_SECONDS)
    })

    it('strikes again once its interval elapses, then expires after its duration', () => {
      const game = createGame({ seed: 87 })
      game.state.player.skills = [{
        skillId: STORM_RELAY_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.spawnSlime({ x: 100, y: 0 })
      collectSkillDamage(game.state, allocator)

      expect(updateStormRelay(game.state, STORM_RELAY_STRIKE_INTERVAL_SECONDS - 0.1, allocator))
        .toEqual([])
      const secondStrike = updateStormRelay(game.state, 0.2, allocator)
      expect(secondStrike.length).toBeGreaterThan(0)

      const finalTick = updateStormRelay(game.state, 30, allocator)
      expect(finalTick).toEqual([])
      expect(game.state.relays).toEqual([])
    })

    it('keeps overlapping relays independent when recast before expiration', () => {
      const game = createGame({ seed: 90 })
      game.state.player.skills = [{
        skillId: STORM_RELAY_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.spawnSlime({ x: 100, y: 0 })

      collectSkillDamage(game.state, allocator)
      updateStormRelay(game.state, 0.5, allocator)
      game.state.player.skills[0]!.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)

      expect(game.state.relays).toHaveLength(2)
      expect(game.state.relays?.map((relay) => relay.remainingDuration))
        .toEqual([
          STORM_RELAY_BASE_DURATION_SECONDS - 0.5,
          STORM_RELAY_BASE_DURATION_SECONDS,
        ])

      updateStormRelay(game.state, STORM_RELAY_BASE_DURATION_SECONDS - 0.5, allocator)
      expect(game.state.relays).toHaveLength(1)
      expect(game.state.relays?.[0]?.remainingDuration).toBeCloseTo(0.5)
    })

    it('gives Overcharge a faster strike interval and extra Shock stacks', () => {
      const game = createGame({ seed: 88 })
      game.state.player.skills = [{
        skillId: STORM_RELAY_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('storm-relay-overcharge')
      game.spawnSlime({ x: 100, y: 0 })

      const events = collectSkillDamage(game.state, allocator)

      expect(events[0]?.shockApplication?.stacks).toBe(2)
      expect(game.state.relays?.[0]?.strikeIntervalSeconds)
        .toBe(STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS)
    })

    it('keeps one permanent Conduit relay when recast and adds a burst pulse around it', () => {
      const game = createGame({ seed: 89 })
      game.state.player.skills = [{
        skillId: STORM_RELAY_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('storm-relay-conduit')
      game.spawnSlime({ x: 100, y: 0 })

      collectSkillDamage(game.state, allocator)
      expect(game.state.relays?.[0]?.permanent).toBe(true)

      updateStormRelay(game.state, 1000, allocator)
      expect(game.state.relays).toHaveLength(1)

      game.state.player.x = 50
      game.state.player.y = 75
      game.state.player.skills[0]!.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)

      expect(game.state.relays).toHaveLength(1)
      expect(game.state.relays?.[0]).toMatchObject({
        permanent: true,
        x: 50,
        y: 75,
      })
    })
  })

  describe('Soul Tether', () => {
    it('tethers the nearest enemy, deals chaos damage over time, and heals the player', () => {
      const game = createGame({ seed: 90 })
      game.state.player.skills = [{
        skillId: SOUL_TETHER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.player.hp = 50
      const targetId = game.spawnSlime({ x: 60, y: 0 })

      expect(collectSkillDamage(game.state, allocator)).toEqual([])
      expect(game.state.player.soulTethers).toEqual([
        expect.objectContaining({ targetId }),
      ])

      const events = updateSoulTether(game.state, 1, allocator)
      expect(events).toEqual([
        expect.objectContaining({
          targetId,
          sourceSkillId: SOUL_TETHER_SKILL_ID,
          damageOverTime: true,
        }),
      ])
      applyDamageEvents(game.state, events)
      expect(game.state.player.hp).toBeGreaterThan(50)
    })

    it('applies DoT multiplier to Soul Tether ticks', () => {
      const game = createGame({ seed: 20260901 })
      game.state.player.skills = [{
        skillId: SOUL_TETHER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const targetId = game.spawnSlime({ x: 60, y: 0 })
      const target = game.state.enemies.find((enemy) => enemy.id === targetId)!
      target.hp = 1_000
      target.maxHp = 1_000
      equipRolledItem(
        game.state.player,
        'swiftstride-boots',
        Rarity.Common,
        [createGearModifier('swiftstride-boots', 'dot-multiplier', 1, 20)],
      )

      collectSkillDamage(game.state, allocator)
      const [tick] = updateSoulTether(game.state, 1, allocator)

      expect(tick?.damage.chaos).toBeCloseTo(7)
      applyDamageEvents(game.state, [tick!])
      expect(target.hp).toBeCloseTo(991.6)
    })

    it('keeps cooldown-overlapping tethers independent, including their visuals', () => {
      const game = createGame({ seed: 94 })
      game.state.player.skills = [{
        skillId: SOUL_TETHER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const targetId = game.spawnSlime({ x: 60, y: 0 })

      collectSkillDamage(game.state, allocator)
      game.state.player.skills[0]!.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)

      expect(game.state.player.soulTethers).toHaveLength(2)
      expect(game.state.player.soulTethers?.[0])
        .not.toBe(game.state.player.soulTethers?.[1])
      expect(game.state.effects[0]?.points).not.toEqual(
        game.state.effects[1]?.points,
      )

      const events = updateSoulTether(game.state, 1, allocator)
      expect(events).toHaveLength(2)
      expect(events.map((event) => event.targetId)).toEqual([targetId, targetId])
    })

    it('tracks each tether duration independently and scales its final tick', () => {
      const game = createGame({ seed: 96 })
      game.state.player.skills = [{
        skillId: SOUL_TETHER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.spawnSlime({ x: 60, y: 0 })

      collectSkillDamage(game.state, allocator)
      const tethersAfterFirstCast = game.state.player.soulTethers ?? []
      expect(tethersAfterFirstCast).toHaveLength(1)
      const firstTether = tethersAfterFirstCast[0]!
      updateSoulTether(game.state, 2, allocator)
      expect(firstTether.remainingDuration).toBeCloseTo(
        SOUL_TETHER_DURATION_SECONDS - 2,
      )

      game.state.player.skills[0]!.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)
      const tethersAfterSecondCast = game.state.player.soulTethers ?? []
      expect(tethersAfterSecondCast).toHaveLength(2)
      const secondTether = tethersAfterSecondCast[1]!
      expect(secondTether.duration).toBe(SOUL_TETHER_DURATION_SECONDS)

      const overlappingEvents = updateSoulTether(game.state, 5, allocator)
      expect(overlappingEvents).toHaveLength(2)
      expect(overlappingEvents[0]?.damage.chaos).toBeCloseTo(
        firstTether.damagePerSecond * 5,
      )
      expect(game.state.player.soulTethers?.[0]).toBe(secondTether)
      expect(secondTether.remainingDuration).toBeCloseTo(2)

      const finalEvents = updateSoulTether(game.state, 2, allocator)
      expect(finalEvents).toHaveLength(1)
      expect(finalEvents[0]?.damage.chaos).toBeCloseTo(
        secondTether.damagePerSecond * 2,
      )
      expect(game.state.player.soulTethers).toEqual([])
    })

    it('extends every matching tether with Voltaic Bond', () => {
      const game = createGame({ seed: 97 })
      game.state.player.skills = [
        {
          skillId: SOUL_TETHER_SKILL_ID,
          level: 1,
          cooldownRemaining: 0,
        },
        {
          skillId: STORM_RELAY_SKILL_ID,
          level: 1,
          cooldownRemaining: 0,
        },
      ]
      game.state.run.selectedUpgradeIds.push('synergy-storm-relay-soul-tether')
      game.spawnSlime({ x: 60, y: 0 })

      collectSkillDamage(game.state, allocator)
      game.state.player.skills.forEach((skill) => {
        skill.cooldownRemaining = 0
      })
      collectSkillDamage(game.state, allocator)

      const tethers = game.state.player.soulTethers ?? []
      expect(tethers).toHaveLength(2)
      expect(tethers.map((tether) => tether.duration)).toEqual([8, 7.5])
      expect(tethers.map((tether) => tether.remainingDuration)).toEqual([8, 7.5])
    })

    it('applies Lifebound Pact healing to Soul Tether damage', () => {
      const game = createGame({ seed: 93 })
      game.state.player.skills = [
        { skillId: SOUL_TETHER_SKILL_ID, level: 1, cooldownRemaining: 0 },
        { skillId: VITALITY_SKILL_ID, level: 1, cooldownRemaining: 0 },
      ]
      const targetId = game.spawnSlime({ x: 60, y: 0 })
      collectSkillDamage(game.state, allocator)
      game.state.player.hp = 0
      game.state.run.selectedUpgradeIds.push('synergy-soul-tether-vitality')

      applyDamageEvents(game.state, [{
        sourceId: game.state.player.id,
        sourceSkillId: SOUL_TETHER_SKILL_ID,
        targetId,
        damage: { physical: 0, lightning: 0, fire: 0, cold: 0, chaos: 10 },
      }])

      expect(game.state.player.hp).toBeCloseTo(0.5)
      expect(game.state.player.soulTetherVitalityCharge).toBeCloseTo(0.25)
    })

    it('snaps to one weaker nearby enemy when the tethered enemy dies, then ends', () => {
      const game = createGame({ seed: 91 })
      game.state.player.skills = [{
        skillId: SOUL_TETHER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const primaryId = game.spawnSlime({ x: 60, y: 0 })
      const secondaryId = game.spawnSlime({ x: 90, y: 0 })
      collectSkillDamage(game.state, allocator)
      const initialDps = game.state.player.soulTethers?.[0]?.damagePerSecond ?? 0

      const primary = game.state.enemies.find((enemy) => enemy.id === primaryId)!
      primary.hp = 1
      applyDamageEvents(game.state, [{
        sourceId: game.state.player.id,
        sourceSkillId: SOUL_TETHER_SKILL_ID,
        targetId: primaryId,
        damage: { physical: 5, lightning: 0, fire: 0, cold: 0, chaos: 0 },
      }])

      expect(game.state.player.soulTethers?.[0]?.targetId).toBe(secondaryId)
      expect(game.state.player.soulTethers?.[0]?.damagePerSecond)
        .toBeCloseTo(initialDps * SOUL_TETHER_RETARGET_DAMAGE_MULTIPLIER)
      expect(game.state.player.soulTethers?.[0]?.hasRetargeted).toBe(true)

      const secondary = game.state.enemies.find((enemy) => enemy.id === secondaryId)!
      secondary.hp = 1
      applyDamageEvents(game.state, [{
        sourceId: game.state.player.id,
        sourceSkillId: SOUL_TETHER_SKILL_ID,
        targetId: secondaryId,
        damage: { physical: 5, lightning: 0, fire: 0, cold: 0, chaos: 0 },
      }])
      expect(game.state.player.soulTethers).toEqual([])
    })

    it('retargets every overlapping tether independently when a shared target dies', () => {
      const game = createGame({ seed: 95 })
      game.state.player.skills = [{
        skillId: SOUL_TETHER_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const primaryId = game.spawnSlime({ x: 60, y: 0 })
      const secondaryId = game.spawnSlime({ x: 90, y: 0 })
      game.spawnSlime({ x: 120, y: 0 })
      const primary = game.state.enemies.find((enemy) => enemy.id === primaryId)!
      const secondary = game.state.enemies.find((enemy) => enemy.id === secondaryId)!
      primary.hp = 1
      secondary.hp = 100
      secondary.maxHp = 100

      collectSkillDamage(game.state, allocator)
      game.state.player.skills[0]!.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)

      applyDamageEvents(game.state, [{
        sourceId: game.state.player.id,
        sourceSkillId: SOUL_TETHER_SKILL_ID,
        targetId: primaryId,
        damage: { physical: 5, lightning: 0, fire: 0, cold: 0, chaos: 0 },
      }])

      expect(game.state.player.soulTethers).toHaveLength(2)
      expect(game.state.player.soulTethers?.every(
        (tether) => tether.targetId === secondaryId && tether.hasRetargeted,
      )).toBe(true)
    })
  })

  describe('Phantom Arsenal', () => {
    it('summons a temporary archer that fires physical bolts, respecting its cap', () => {
      const game = createGame({ seed: 92 })
      game.state.player.skills = [{
        skillId: PHANTOM_ARSENAL_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      const targetId = game.spawnSlime({ x: 60, y: 0 })

      collectSkillDamage(game.state, allocator)
      expect(game.state.summons).toHaveLength(1)
      expect(game.state.summons[0]?.skillId).toBe(PHANTOM_ARSENAL_SKILL_ID)
      expect(game.state.summons[0]?.expiryRemaining).toBeGreaterThan(0)

      const summonSkill = game.state.player.skills.find(
        (skill) => skill.skillId === PHANTOM_ARSENAL_SKILL_ID,
      )!
      summonSkill.cooldownRemaining = 0
      collectSkillDamage(game.state, allocator)
      expect(game.state.summons).toHaveLength(1)

      let firedProjectile = false
      for (let tick = 0; tick < 180 && !firedProjectile; tick += 1) {
        updateSummons(game.state, 1 / 60, allocator)
        firedProjectile = game.state.projectiles.some(
          (projectile) => projectile.skillId === PHANTOM_ARSENAL_SKILL_ID,
        )
      }
      expect(firedProjectile).toBe(true)
      expect(game.state.projectiles[0]?.targetId).toBe(targetId)
      expect(game.state.projectiles[0]?.damage.physical).toBeGreaterThan(0)
    })

    it('fires a spread volley for global extra projectiles', () => {
      const game = createGame({ seed: 94 })
      game.state.player.skills = [{
        skillId: PHANTOM_ARSENAL_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      equipItem(game.state.player, 'splintering-helm')
      equipItem(game.state.player, 'splintering-armor')
      game.spawnSlime({ x: 60, y: 0 })

      collectSkillDamage(game.state, allocator)
      updateSummons(game.state, 1 / 60, allocator)

      expect(game.state.projectiles).toHaveLength(2)
      const first = game.state.projectiles[0]!
      const second = game.state.projectiles[1]!
      expect(
        Math.atan2(second.velocityY, second.velocityX) -
          Math.atan2(first.velocityY, first.velocityX),
      ).toBeCloseTo((15 * Math.PI) / 180)
    })

    it('despawns automatically once its temporary duration elapses', () => {
      const game = createGame({ seed: 93 })
      game.state.player.skills = [{
        skillId: PHANTOM_ARSENAL_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      collectSkillDamage(game.state, allocator)
      expect(game.state.summons).toHaveLength(1)

      updateSummons(game.state, 999, allocator)
      removeDeadSummons(game.state)
      expect(game.state.summons).toEqual([])
    })
  })
})
