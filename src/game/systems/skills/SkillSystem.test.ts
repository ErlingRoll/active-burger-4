import { describe, expect, it } from 'vitest'
import {
  CHAIN_LIGHTNING_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_STANDARD_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
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
    expect(lastStandGame.state.player.hp).toBe(24)
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
      .toBeCloseTo(8.64)
    expect(events.find((event) => event.sourceSkillId === CHAIN_LIGHTNING_SKILL_ID)?.damage.lightning)
      .toBeCloseTo(7.63)
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
      'common',
      [createGearModifier('iron-cleaver', 'cooldown-reduction', 3, 14)],
    )

    expect(collectSkillDamage(game.state, allocator)).toEqual([])

    expect(game.state.player.hp).toBe(game.state.player.maxHp - 16)
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

      const events = collectSkillDamage(game.state, allocator)

      expect(events.map((event) => event.targetId)).toEqual([nearestId, splashId])
      expect(events.every((event) => event.damage.cold === 9)).toBe(true)
      expect(events.every((event) => event.frostApplication?.stacks === 1)).toBe(true)
      expect(events.some((event) => event.targetId === outOfRangeId)).toBe(false)
      expect(game.state.player.skills[0]?.cooldownRemaining).toBeCloseTo(3.2)
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

      const events = collectSkillDamage(game.state, allocator)

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

      const events = collectSkillDamage(game.state, allocator)

      expect(events).toEqual([
        expect.objectContaining({ targetId, damage: expect.objectContaining({ cold: 12.6 }) }),
      ])
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
      expect(events.every((event) => event.damage.physical === 11)).toBe(true)
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
      expect(secondEvent?.damage.physical).toBeCloseTo(11.66)
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

      expect(event?.damage.physical).toBeCloseTo(13.75)
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
      expect(event?.damage.physical).toBeCloseTo(9.35)
    })
  })

  describe('Rallying Standard', () => {
    it('heals the player and activates its base banner bonuses', () => {
      const game = createGame({ seed: 67 })
      game.state.player.skills = [{
        skillId: RALLYING_STANDARD_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.player.hp = game.state.player.maxHp - 20

      expect(collectSkillDamage(game.state, allocator)).toEqual([])

      expect(game.state.player.hp).toBe(game.state.player.maxHp - 16)
      expect(game.state.player.rallyingStandardRemaining).toBe(6)
      expect(game.state.player.rallyingStandardDamageReductionPercent).toBe(10)
      expect(game.state.player.rallyingStandardCooldownReductionPercent).toBe(0)
    })

    it('gives Bulwark a bigger reduction and longer duration', () => {
      const game = createGame({ seed: 68 })
      game.state.player.skills = [{
        skillId: RALLYING_STANDARD_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      }]
      game.state.run.selectedUpgradeIds.push('rallying-standard-bulwark')

      collectSkillDamage(game.state, allocator)

      expect(game.state.player.rallyingStandardRemaining).toBe(10)
      expect(game.state.player.rallyingStandardDamageReductionPercent).toBe(25)
    })

    it("lets Commander's active cooldown reduction apply to every equipped skill", () => {
      const game = createGame({ seed: 69 })
      game.state.player.skills = [
        { skillId: RALLYING_STANDARD_SKILL_ID, level: 1, cooldownRemaining: 0 },
        { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
      ]
      game.state.run.selectedUpgradeIds.push('rallying-standard-commander')
      game.spawnSlime({ x: 50, y: 0 })

      collectSkillDamage(game.state, allocator)

      const rallyingStandard = game.state.player.skills.find(
        (skill) => skill.skillId === RALLYING_STANDARD_SKILL_ID,
      )
      const whirlwind = game.state.player.skills.find(
        (skill) => skill.skillId === WHIRLWIND_SKILL_ID,
      )
      expect(rallyingStandard?.cooldownRemaining).toBeCloseTo(14.08)
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
        damage: expect.objectContaining({ physical: 6 }),
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
})
