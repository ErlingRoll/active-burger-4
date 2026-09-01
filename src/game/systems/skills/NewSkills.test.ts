import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  RAZORWIRE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
  SKILL_DEFINITIONS,
  type SkillId,
} from '../../../content/skills/Skills'
import {
  SIGIL_OF_RUIN_STORED_DAMAGE_CAP,
  SIGIL_OF_RUIN_DETONATION_DAMAGE_RATIO,
  SIGIL_OF_RUIN_RESONANCE_STARTING_CHARGES,
  SIGIL_OF_RUIN_EXECUTION_DAMAGE_MULTIPLIER,
  SIGIL_OF_RUIN_CONTAGIOUS_STORED_CAP_MULTIPLIER,
  MIRRORCAST_BASE_EFFECTIVENESS,
  MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS,
  MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT,
  MIRRORCAST_COPY_DELAY_SECONDS,
  MIRRORCAST_DEFERRED_COPY_DELAY_SECONDS,
  MIRRORCAST_CAPTURE_WINDOW_SECONDS,
  RAZORWIRE_TRIPWIRE_COUNT,
  RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER,
  RAZORWIRE_CROSSING_COOLDOWN_SECONDS,
  RAZORWIRE_SLOW_CHILL_STACKS,
  RAZORWIRE_BLOODWIRE_CHAOS_DAMAGE,
  BLOOD_RITE_SACRIFICE_FRACTION,
  BLOOD_RITE_RESONANCE_POTENCY_MULTIPLIER,
  BLOOD_RITE_CRIMSON_CHARGES,
  BLOOD_RITE_DEBT_DURATION_SECONDS,
  BLOOD_RITE_PRISM_DURATION_BONUS_SECONDS,
  PRISM_HALO_FIRE_INTERVAL_SECONDS,
  PRISM_HALO_REFRACTION_MAX_SPLITS,
  PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER,
  PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER,
} from '../../../game-config/skills'
import {
  SYNERGY_UPGRADES,
  getUpgradeDefinition,
  isSynergyPairEligible,
  type UpgradeId,
} from '../../../content/upgrades/Upgrades'
import { createGame } from '../../Game'
import {
  collectSkillDamage,
  updateRuinSigils,
  updateRazorwires,
  updatePrismHalo,
  updateMirrorcast,
  updateBloodDebt,
} from './SkillSystem'
import { applyDamageEvents } from '../combat/CombatSystem'
import type {
  DamageEvent,
  EnemyState,
  GameState,
  WireState,
} from '../../state/GameState'

function createAllocator(): { createEntityId: () => number } {
  let next = 100_000
  return { createEntityId: () => next++ }
}

function damage(overrides: Partial<DamageEvent['damage']>): DamageEvent['damage'] {
  return { physical: 0, fire: 0, cold: 0, lightning: 0, chaos: 0, ...overrides }
}

function findEnemy(state: GameState, id: number): EnemyState {
  const enemy = state.enemies.find((candidate) => candidate.id === id)
  if (!enemy) {
    throw new Error(`missing enemy ${id}`)
  }
  return enemy
}

function toughEnemy(game: ReturnType<typeof createGame>, id: number, hp = 100_000): EnemyState {
  const enemy = findEnemy(game.state, id)
  enemy.maxHp = hp
  enemy.hp = hp
  return enemy
}

function setSkills(game: ReturnType<typeof createGame>, skills: SkillId[]): void {
  game.state.player.skills = skills.map((skillId) => ({
    skillId,
    level: 1,
    cooldownRemaining: 0,
  }))
}

function makeResonant(game: ReturnType<typeof createGame>, skillId: SkillId): void {
  const skill = game.state.player.skills.find((candidate) => candidate.skillId === skillId)!
  skill.resonanceAttackCount = (game.state.player.resonance ?? 5) + 1
}

describe('Sigil of Ruin', () => {
  it('charges once per distinct source category and detonates at three charges', () => {
    const game = createGame({ seed: 71 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId)
    const allocator = createAllocator()

    collectSkillDamage(game.state, allocator)
    expect(game.state.player.ruinSigils).toHaveLength(1)
    expect(game.state.player.ruinSigils?.[0]?.charges).toBe(0)

    const player = game.state.player.id
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }), damageOverTime: true },
    ], undefined, allocator)

    // 60 direct + burst of 60 * 0.75 = 45.
    const expectedBurst = 60 * SIGIL_OF_RUIN_DETONATION_DAMAGE_RATIO
    expect(enemy.hp).toBeCloseTo(100_000 - 60 - expectedBurst)
    expect(game.state.player.ruinSigils).toHaveLength(0)
  })

  it('duplicate source categories do not add charges', () => {
    const game = createGame({ seed: 72 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)

    const player = game.state.player.id
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 10 }) },
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 10 }) },
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 10 }) },
    ], undefined, allocator)

    expect(game.state.player.ruinSigils?.[0]?.charges).toBe(1)
  })

  it('caps stored damage so the detonation cannot run away', () => {
    const game = createGame({ seed: 73 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)

    const player = game.state.player.id
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 5_000 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 5 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 5 }), damageOverTime: true },
    ], undefined, allocator)

    const cappedBurst = SIGIL_OF_RUIN_STORED_DAMAGE_CAP * SIGIL_OF_RUIN_DETONATION_DAMAGE_RATIO
    expect(enemy.hp).toBeCloseTo(100_000 - 5_010 - cappedBurst)
  })

  it('starts with two charges and spreads sigils on a Resonant detonation', () => {
    const game = createGame({ seed: 74 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const neighborId = game.spawnSlime({ x: 70, y: 0 })
    toughEnemy(game, targetId)
    toughEnemy(game, neighborId)
    makeResonant(game, SIGIL_OF_RUIN_SKILL_ID)
    const allocator = createAllocator()

    collectSkillDamage(game.state, allocator)
    expect(game.state.player.ruinSigils?.[0]?.charges).toBe(SIGIL_OF_RUIN_RESONANCE_STARTING_CHARGES)

    applyDamageEvents(game.state, [{
      sourceId: game.state.player.id,
      sourceSkillId: BASIC_ATTACK_SKILL_ID,
      targetId,
      damage: damage({ physical: 20 }),
    }], undefined, allocator)

    const spread = game.state.player.ruinSigils ?? []
    expect(spread.some((sigil) => sigil.targetId === neighborId && sigil.charges === 1)).toBe(true)
    expect(spread.every((sigil) => !sigil.canSpread || sigil.targetId !== targetId)).toBe(true)
  })

  it('Contagious Script spreads weaker sigils on detonation', () => {
    const game = createGame({ seed: 75 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('sigil-of-ruin-contagious-script')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const neighborId = game.spawnSlime({ x: 70, y: 0 })
    toughEnemy(game, targetId)
    toughEnemy(game, neighborId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)

    const player = game.state.player.id
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }), damageOverTime: true },
    ], undefined, allocator)

    const spread = (game.state.player.ruinSigils ?? []).find((sigil) => sigil.targetId === neighborId)
    expect(spread).toBeDefined()
    expect(spread?.storedDamageCap).toBeCloseTo(
      SIGIL_OF_RUIN_STORED_DAMAGE_CAP * SIGIL_OF_RUIN_CONTAGIOUS_STORED_CAP_MULTIPLIER,
    )
  })

  it('Execution Protocol waits for a low-HP target then hits harder', () => {
    const game = createGame({ seed: 76 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('sigil-of-ruin-execution-protocol')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId, 1_000)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)

    const player = game.state.player.id
    // Reach three charges while the target is healthy: it arms but does not detonate.
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 10 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 10 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 10 }), damageOverTime: true },
    ], undefined, allocator)
    expect(game.state.player.ruinSigils?.[0]?.armed).toBe(true)
    expect(game.state.player.ruinSigils).toHaveLength(1)

    // Drop the target below the execute threshold and hit again to detonate.
    enemy.hp = 300
    applyDamageEvents(game.state, [{
      sourceId: player,
      sourceSkillId: WHIRLWIND_SKILL_ID,
      targetId,
      damage: damage({ physical: 1 }),
    }], undefined, allocator)
    expect(game.state.player.ruinSigils).toHaveLength(0)
    // Stored damage is 31 (30 charging + 1 final); the execute multiplier boosts the burst.
    const expectedBurst = 31 * SIGIL_OF_RUIN_DETONATION_DAMAGE_RATIO * SIGIL_OF_RUIN_EXECUTION_DAMAGE_MULTIPLIER
    expect(enemy.hp).toBeCloseTo(300 - 1 - expectedBurst)
  })

  it('expires the sigil after its duration elapses', () => {
    const game = createGame({ seed: 77 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    game.spawnSlime({ x: 40, y: 0 })
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    expect(game.state.player.ruinSigils).toHaveLength(1)
    updateRuinSigils(game.state, SKILL_DEFINITIONS[SIGIL_OF_RUIN_SKILL_ID].effectLifetime + 10)
    expect(game.state.player.ruinSigils).toHaveLength(0)
  })
})

describe('Mirrorcast', () => {
  function armAndCapture(
    game: ReturnType<typeof createGame>,
    copiedSkill: SkillId,
  ): void {
    const allocator = createAllocator()
    // First tick: arm Mirrorcast while the copied skill is on cooldown.
    const skills = game.state.player.skills
    const copied = skills.find((skill) => skill.skillId === copiedSkill)!
    copied.cooldownRemaining = 99
    collectSkillDamage(game.state, allocator)
    expect(game.state.player.mirrorcast?.status).toBe('armed')
    // Second tick: let the copied skill cast so it is captured.
    copied.cooldownRemaining = 0
    const mirror = skills.find((skill) => skill.skillId === MIRRORCAST_SKILL_ID)!
    mirror.cooldownRemaining = 99
    collectSkillDamage(game.state, allocator)
  }

  it('copies the next non-Basic skill after a delay at reduced effectiveness', () => {
    const game = createGame({ seed: 80 })
    setSkills(game, [MIRRORCAST_SKILL_ID, GLACIAL_ORB_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    armAndCapture(game, GLACIAL_ORB_SKILL_ID)

    expect(game.state.player.mirrorcast?.status).toBe('pending')
    expect(game.state.player.mirrorcast?.copies).toHaveLength(1)
    expect(game.state.player.mirrorcast?.copies[0]?.effectiveness).toBeCloseTo(MIRRORCAST_BASE_EFFECTIVENESS)

    const events = updateMirrorcast(game.state, MIRRORCAST_COPY_DELAY_SECONDS, createAllocator())
    const copy = events.find((event) => event.sourceSkillId === MIRRORCAST_SKILL_ID)
    expect(copy).toBeDefined()
    // Glacial Orb base cold is 9; the copy deals half.
    expect(copy?.damage.cold).toBeCloseTo(9 * MIRRORCAST_BASE_EFFECTIVENESS)
    expect(game.state.player.mirrorcast).toBeUndefined()
  })

  it('never nests: recasting Mirrorcast does not schedule a copy of itself', () => {
    const game = createGame({ seed: 81 })
    setSkills(game, [MIRRORCAST_SKILL_ID])
    game.spawnSlime({ x: 40, y: 0 })
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    game.state.player.skills[0]!.cooldownRemaining = 0
    collectSkillDamage(game.state, allocator)
    expect(game.state.player.mirrorcast?.status).toBe('armed')
    expect(game.state.player.mirrorcast?.copies).toHaveLength(0)
  })

  it('does not reset the copied skill original cooldown', () => {
    const game = createGame({ seed: 82 })
    setSkills(game, [MIRRORCAST_SKILL_ID, GLACIAL_ORB_SKILL_ID])
    game.spawnSlime({ x: 40, y: 0 })
    armAndCapture(game, GLACIAL_ORB_SKILL_ID)
    const glacial = game.state.player.skills.find((skill) => skill.skillId === GLACIAL_ORB_SKILL_ID)!
    const cooldownAfterCast = glacial.cooldownRemaining
    updateMirrorcast(game.state, MIRRORCAST_COPY_DELAY_SECONDS, createAllocator())
    expect(glacial.cooldownRemaining).toBe(cooldownAfterCast)
    expect(cooldownAfterCast).toBeGreaterThan(0)
  })

  it('Double Exposure arms two weaker echoes', () => {
    const game = createGame({ seed: 83 })
    setSkills(game, [MIRRORCAST_SKILL_ID, GLACIAL_ORB_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('mirrorcast-double-exposure')
    game.spawnSlime({ x: 40, y: 0 })
    armAndCapture(game, GLACIAL_ORB_SKILL_ID)
    expect(game.state.player.mirrorcast?.copies).toHaveLength(MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT)
    for (const copy of game.state.player.mirrorcast?.copies ?? []) {
      expect(copy.effectiveness).toBeCloseTo(MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS)
    }
  })

  it('Deferred Echo copies later and retargets when the captured target dies', () => {
    const game = createGame({ seed: 84 })
    setSkills(game, [MIRRORCAST_SKILL_ID, GLACIAL_ORB_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('mirrorcast-deferred-echo')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const backupId = game.spawnSlime({ x: 60, y: 0 })
    toughEnemy(game, targetId)
    toughEnemy(game, backupId)
    armAndCapture(game, GLACIAL_ORB_SKILL_ID)
    expect(game.state.player.mirrorcast?.copies[0]?.delayRemaining).toBeCloseTo(MIRRORCAST_DEFERRED_COPY_DELAY_SECONDS)

    // Kill the captured target; the deferred copy should retarget onto the backup.
    findEnemy(game.state, targetId).hp = 0
    const events = updateMirrorcast(game.state, MIRRORCAST_DEFERRED_COPY_DELAY_SECONDS, createAllocator())
    const copy = events.find((event) => event.sourceSkillId === MIRRORCAST_SKILL_ID)
    expect(copy?.targetId).toBe(backupId)
  })

  it('disarms the echo when the capture window expires unused', () => {
    const game = createGame({ seed: 85 })
    setSkills(game, [MIRRORCAST_SKILL_ID])
    game.spawnSlime({ x: 40, y: 0 })
    collectSkillDamage(game.state, createAllocator())
    updateMirrorcast(game.state, MIRRORCAST_CAPTURE_WINDOW_SECONDS + 1, createAllocator())
    expect(game.state.player.mirrorcast).toBeUndefined()
  })
})

describe('Razorwire', () => {
  function crossingPoints(wire: WireState): { normalX: number; normalY: number; midX: number; midY: number } {
    const midX = (wire.ax + wire.bx) / 2
    const midY = (wire.ay + wire.by) / 2
    const dirX = wire.bx - wire.ax
    const dirY = wire.by - wire.ay
    const length = Math.hypot(dirX, dirY)
    return { normalX: -dirY / length, normalY: dirX / length, midX, midY }
  }

  it('deals damage and a slow only when an enemy crosses, with a per-enemy cooldown', () => {
    const game = createGame({ seed: 90 })
    setSkills(game, [RAZORWIRE_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    expect(game.state.wires).toHaveLength(1)
    const wire = game.state.wires![0]!
    const { normalX, normalY, midX, midY } = crossingPoints(wire)

    enemy.x = midX + normalX * 12
    enemy.y = midY + normalY * 12
    expect(updateRazorwires(game.state, 0.1, allocator)).toHaveLength(0)

    enemy.x = midX - normalX * 12
    enemy.y = midY - normalY * 12
    const crossing = updateRazorwires(game.state, 0.1, allocator)
    expect(crossing).toHaveLength(1)
    expect(crossing[0]?.damage.physical).toBeGreaterThan(0)
    expect(crossing[0]?.frostApplication?.stacks).toBe(RAZORWIRE_SLOW_CHILL_STACKS)

    // Crossing back immediately does no damage: the per-enemy cooldown gates it.
    enemy.x = midX + normalX * 12
    enemy.y = midY + normalY * 12
    expect(updateRazorwires(game.state, 0.1, allocator)).toHaveLength(0)
  })

  it('Resonance strings a second lattice wire', () => {
    const game = createGame({ seed: 91 })
    setSkills(game, [RAZORWIRE_SKILL_ID])
    game.spawnSlime({ x: 40, y: 0 })
    makeResonant(game, RAZORWIRE_SKILL_ID)
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.wires).toHaveLength(2)
  })

  it('Tripwire Network deploys several shorter wires with reduced damage', () => {
    const game = createGame({ seed: 92 })
    setSkills(game, [RAZORWIRE_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('razorwire-tripwire-network')
    game.spawnSlime({ x: 40, y: 0 })
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.wires).toHaveLength(RAZORWIRE_TRIPWIRE_COUNT)

    const baseline = createGame({ seed: 92 })
    setSkills(baseline, [RAZORWIRE_SKILL_ID])
    baseline.spawnSlime({ x: 40, y: 0 })
    collectSkillDamage(baseline.state, createAllocator())
    expect(game.state.wires![0]!.damage.physical)
      .toBeLessThan(baseline.state.wires![0]!.damage.physical)
  })

  it('Guillotine Line builds Tension and snaps at the cap', () => {
    const game = createGame({ seed: 93 })
    setSkills(game, [RAZORWIRE_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('razorwire-guillotine-line')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    const wire = game.state.wires![0]!
    expect(wire.guillotine).toBe(true)
    const { normalX, normalY, midX, midY } = crossingPoints(wire)

    const step = RAZORWIRE_CROSSING_COOLDOWN_SECONDS + 0.2
    // Record an initial side.
    enemy.x = midX + normalX * 12
    enemy.y = midY + normalY * 12
    updateRazorwires(game.state, 0.1, allocator)

    const crossingDamages: number[] = []
    for (let index = 0; index < 3; index += 1) {
      const onSideB = index % 2 === 0
      enemy.x = midX + normalX * 12 * (onSideB ? -1 : 1)
      enemy.y = midY + normalY * 12 * (onSideB ? -1 : 1)
      const events = updateRazorwires(game.state, step, allocator)
      crossingDamages.push(events[0]?.damage.physical ?? 0)
    }
    expect(crossingDamages[2]).toBeCloseTo(crossingDamages[0]! * RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER)
  })
})

describe('Blood Rite', () => {
  it('sacrifices a bounded portion of HP without killing and stores Blood Debt', () => {
    const game = createGame({ seed: 100 })
    setSkills(game, [BLOOD_RITE_SKILL_ID])
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    game.spawnSlime({ x: 40, y: 0 })
    const events = collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.hp).toBeCloseTo(100 - 100 * BLOOD_RITE_SACRIFICE_FRACTION)
    expect(game.state.player.bloodDebt?.charges).toBe(1)
    expect(events.some((event) => event.sourceSkillId === BLOOD_RITE_SKILL_ID && event.damage.chaos > 0)).toBe(true)
  })

  it('never lowers the player below one HP', () => {
    const game = createGame({ seed: 101 })
    setSkills(game, [BLOOD_RITE_SKILL_ID])
    game.state.player.hp = 1
    game.state.player.maxHp = 100
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.hp).toBe(1)
  })

  it('the next damage skill spends the debt as a flat chaos bonus with no double Attunement', () => {
    const game = createGame({ seed: 102 })
    setSkills(game, [BLOOD_RITE_SKILL_ID, WHIRLWIND_SKILL_ID])
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    const whirl = game.state.player.skills.find((skill) => skill.skillId === WHIRLWIND_SKILL_ID)!
    const blood = game.state.player.skills.find((skill) => skill.skillId === BLOOD_RITE_SKILL_ID)!

    // Cast Blood Rite alone so we can read the stored potency before it is spent.
    whirl.cooldownRemaining = 99
    collectSkillDamage(game.state, createAllocator())
    const potency = game.state.player.bloodDebt?.potency ?? 0
    expect(potency).toBeGreaterThan(0)

    // Now let Whirlwind cast: it should consume the debt as a flat chaos bonus.
    whirl.cooldownRemaining = 0
    blood.cooldownRemaining = 99
    const events = collectSkillDamage(game.state, createAllocator())
    const bonus = events.find((event) => event.sourceLabel === 'Blood Debt')
    expect(bonus).toBeDefined()
    // The bonus is a flat chaos payload equal to the stored potency (no Attunement layered on top).
    expect(bonus?.damage.physical).toBe(0)
    expect(bonus?.damage.chaos).toBeCloseTo(potency)
    // Debt was consumed.
    expect(game.state.player.bloodDebt).toBeUndefined()
  })

  it('Resonance removes the HP cost and stores a larger debt', () => {
    const baseline = createGame({ seed: 103 })
    setSkills(baseline, [BLOOD_RITE_SKILL_ID])
    baseline.state.player.hp = 100
    baseline.state.player.maxHp = 100
    collectSkillDamage(baseline.state, createAllocator())
    const basePotency = baseline.state.player.bloodDebt?.potency ?? 0

    const game = createGame({ seed: 103 })
    setSkills(game, [BLOOD_RITE_SKILL_ID])
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    makeResonant(game, BLOOD_RITE_SKILL_ID)
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.hp).toBe(100)
    expect(game.state.player.bloodDebt?.potency).toBeGreaterThan(basePotency)
    expect(game.state.player.bloodDebt?.potency).toBeCloseTo(basePotency * BLOOD_RITE_RESONANCE_POTENCY_MULTIPLIER, 1)
  })

  it('Sanguine Pact heals part of the empowered damage', () => {
    const game = createGame({ seed: 104 })
    setSkills(game, [BLOOD_RITE_SKILL_ID, WHIRLWIND_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('blood-rite-sanguine-pact')
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    const hpAfterSacrifice = 100 - 100 * BLOOD_RITE_SACRIFICE_FRACTION
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.hp).toBeGreaterThan(hpAfterSacrifice)
  })

  it('Crimson Debt stores two smaller charges', () => {
    const game = createGame({ seed: 105 })
    setSkills(game, [BLOOD_RITE_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('blood-rite-crimson-debt')
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.bloodDebt?.charges).toBe(BLOOD_RITE_CRIMSON_CHARGES)
  })

  it('lets unused Blood Debt expire', () => {
    const game = createGame({ seed: 106 })
    setSkills(game, [BLOOD_RITE_SKILL_ID])
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.bloodDebt).toBeDefined()
    updateBloodDebt(game.state, BLOOD_RITE_DEBT_DURATION_SECONDS + 1)
    expect(game.state.player.bloodDebt).toBeUndefined()
  })
})

describe('Prism Halo', () => {
  function fireOnce(game: ReturnType<typeof createGame>): DamageEvent[] {
    return updatePrismHalo(game.state, PRISM_HALO_FIRE_INTERVAL_SECONDS, createAllocator())
  }

  it('fires Fire, Cold, and Lightning in rotation with matching statuses', () => {
    const game = createGame({ seed: 110 })
    setSkills(game, [PRISM_HALO_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    collectSkillDamage(game.state, createAllocator())

    const fireEvent = fireOnce(game)[0]
    expect(fireEvent?.damage.fire).toBeGreaterThan(0)
    expect(fireEvent?.burningApplication).toBeDefined()
    expect(game.state.effects.at(-1)?.prismBeamElement).toBe('fire')

    const coldEvent = fireOnce(game)[0]
    expect(coldEvent?.damage.cold).toBeGreaterThan(0)
    expect(coldEvent?.frostApplication).toBeDefined()
    expect(game.state.effects.at(-1)?.prismBeamElement).toBe('cold')

    const lightningEvent = fireOnce(game)[0]
    expect(lightningEvent?.damage.lightning).toBeGreaterThan(0)
    expect(lightningEvent?.shockApplication).toBeDefined()
    expect(game.state.effects.at(-1)?.prismBeamElement).toBe('lightning')
  })

  it('Resonance fires all three at once and distributes Attunement a single time', () => {
    const game = createGame({ seed: 111 })
    setSkills(game, [PRISM_HALO_SKILL_ID])
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    makeResonant(game, PRISM_HALO_SKILL_ID)
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.prismHalo?.firesAllElements).toBe(true)

    const volley = fireOnce(game)
    expect(volley.filter((event) => event.targetId === targetId)).toHaveLength(3)
    expect(game.state.effects.at(-1)?.prismBeamElement).toBe('all')
    // Attunement (physical) rides on exactly one shard for the whole volley.
    const attunedShards = volley.filter((event) => event.damage.physical > 0)
    expect(attunedShards).toHaveLength(1)
  })

  it('Chromatic Convergence triggers a Prism Burst once all three elements land', () => {
    const game = createGame({ seed: 112 })
    setSkills(game, [PRISM_HALO_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('prism-halo-chromatic-convergence')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    collectSkillDamage(game.state, createAllocator())

    fireOnce(game)
    fireOnce(game)
    const lightningVolley = fireOnce(game)
    const burst = lightningVolley.find((event) => event.sourceLabel === 'Prism Burst')
    expect(burst).toBeDefined()
    expect(burst?.damage.fire).toBeGreaterThan(0)
    expect(burst?.damage.lightning).toBeGreaterThan(0)
  })

  it('Refraction splits into capped, reduced projectiles', () => {
    const game = createGame({ seed: 113 })
    setSkills(game, [PRISM_HALO_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('prism-halo-refraction')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    for (let index = 0; index < 5; index += 1) {
      toughEnemy(game, game.spawnSlime({ x: 40 + index * 8, y: 20 }))
    }
    collectSkillDamage(game.state, createAllocator())

    const events = fireOnce(game)
    const splits = events.filter((event) => event.sourceLabel === 'Refraction')
    expect(splits.length).toBeGreaterThan(0)
    expect(splits.length).toBeLessThanOrEqual(PRISM_HALO_REFRACTION_MAX_SPLITS)
    const primary = events.find((event) => event.targetId === targetId && event.sourceLabel !== 'Refraction')
    expect(splits[0]?.damage.fire).toBeCloseTo((primary?.damage.fire ?? 0) * PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER)
  })

  it('expires the halo after its duration', () => {
    const game = createGame({ seed: 114 })
    setSkills(game, [PRISM_HALO_SKILL_ID])
    game.spawnSlime({ x: 40, y: 0 })
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.prismHalo).toBeDefined()
    updatePrismHalo(game.state, SKILL_DEFINITIONS[PRISM_HALO_SKILL_ID].effectLifetime + 100, createAllocator())
    expect(game.state.player.prismHalo).toBeUndefined()
  })
})

describe('new skill synergies', () => {
  const newSkillIds: SkillId[] = [
    SIGIL_OF_RUIN_SKILL_ID,
    MIRRORCAST_SKILL_ID,
    RAZORWIRE_SKILL_ID,
    BLOOD_RITE_SKILL_ID,
    PRISM_HALO_SKILL_ID,
  ]

  it('gives every new skill a Basic Attack synergy without a maximum count', () => {
    const newSkillSet = new Set<SkillId>(newSkillIds)
    const newSynergies = SYNERGY_UPGRADES.filter((synergy) =>
      synergy.synergySkillIds.some((skillId) => newSkillSet.has(skillId)),
    )
    expect(newSynergies.length).toBeGreaterThanOrEqual(newSkillIds.length)
    for (const skillId of newSkillIds) {
      const count = SYNERGY_UPGRADES.filter((synergy) =>
        synergy.synergySkillIds.includes(skillId),
      ).length
      expect(count).toBeGreaterThanOrEqual(2)
      expect(SYNERGY_UPGRADES.some((synergy) =>
        synergy.synergySkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
        synergy.synergySkillIds.includes(skillId)
      )).toBe(true)
    }
  })

  it('gates synergy eligibility on owning both skills and having no conflicting synergy', () => {
    const eligible = isSynergyPairEligible(
      { ownedSkillIds: [SIGIL_OF_RUIN_SKILL_ID, PRISM_HALO_SKILL_ID], selectedUpgradeIds: [] },
      [SIGIL_OF_RUIN_SKILL_ID, PRISM_HALO_SKILL_ID],
    )
    expect(eligible).toBe(true)
    const missingPartner = isSynergyPairEligible(
      { ownedSkillIds: [SIGIL_OF_RUIN_SKILL_ID], selectedUpgradeIds: [] },
      [SIGIL_OF_RUIN_SKILL_ID, PRISM_HALO_SKILL_ID],
    )
    expect(missingPartner).toBe(false)
    const alreadyLinked = isSynergyPairEligible(
      {
        ownedSkillIds: [SIGIL_OF_RUIN_SKILL_ID, PRISM_HALO_SKILL_ID],
        selectedUpgradeIds: ['synergy-sigil-of-ruin-prism-halo'],
      },
      [SIGIL_OF_RUIN_SKILL_ID, PRISM_HALO_SKILL_ID],
    )
    expect(alreadyLinked).toBe(false)
  })

  it('Prismatic Ruin adds every element status to a detonation', () => {
    const game = createGame({ seed: 120 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('synergy-sigil-of-ruin-prism-halo')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    const player = game.state.player.id
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }), damageOverTime: true },
    ], undefined, allocator)
    // Detonation applied Burning, Chill, and Shock.
    expect((enemy.burningStacks?.length ?? 0)).toBeGreaterThan(0)
    expect((enemy.chillStacks ?? 0)).toBeGreaterThan(0)
    expect((enemy.shockStacks ?? 0)).toBeGreaterThan(0)
  })

  it('Bloodwire adds chaos to crossings while Blood Debt is active', () => {
    const game = createGame({ seed: 121 })
    setSkills(game, [RAZORWIRE_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('synergy-razorwire-blood-rite')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    const enemy = toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    // Set the debt after casting so the Razorwire cast does not consume it.
    game.state.player.bloodDebt = {
      charges: 1,
      potency: 20,
      sacrificedHealth: 0,
      remainingDuration: 5,
      sanguinePact: false,
    }
    const wire = game.state.wires![0]!
    const midX = (wire.ax + wire.bx) / 2
    const midY = (wire.ay + wire.by) / 2
    const dirX = wire.bx - wire.ax
    const dirY = wire.by - wire.ay
    const length = Math.hypot(dirX, dirY)
    const normalX = -dirY / length
    const normalY = dirX / length
    enemy.x = midX + normalX * 12
    enemy.y = midY + normalY * 12
    updateRazorwires(game.state, 0.1, allocator)
    enemy.x = midX - normalX * 12
    enemy.y = midY - normalY * 12
    const events = updateRazorwires(game.state, 0.1, allocator)
    expect(events[0]?.damage.chaos).toBeCloseTo(RAZORWIRE_BLOODWIRE_CHAOS_DAMAGE)
  })

  it('Prism Offering extends an active Prism Halo when Blood Rite is cast', () => {
    const game = createGame({ seed: 122 })
    setSkills(game, [BLOOD_RITE_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('synergy-blood-rite-prism-halo')
    game.state.player.hp = 100
    game.state.player.maxHp = 100
    game.state.player.prismHalo = {
      ownerId: game.state.player.id,
      remainingDuration: 4,
      fireCooldownRemaining: 0,
      nextElementIndex: 0,
      firesAllElements: false,
      rotation: 0,
    }
    game.spawnSlime({ x: 40, y: 0 })
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.player.prismHalo?.remainingDuration).toBeCloseTo(4 + BLOOD_RITE_PRISM_DURATION_BONUS_SECONDS)
  })

  it('Sanguine Ruin heals the player when a Ruin Sigil detonates', () => {
    const game = createGame({ seed: 123 })
    setSkills(game, [SIGIL_OF_RUIN_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('synergy-sigil-of-ruin-blood-rite')
    game.state.player.hp = 50
    game.state.player.maxHp = 500
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    const allocator = createAllocator()
    collectSkillDamage(game.state, allocator)
    const player = game.state.player.id
    applyDamageEvents(game.state, [
      { sourceId: player, sourceSkillId: BASIC_ATTACK_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }) },
      { sourceId: player, sourceSkillId: WHIRLWIND_SKILL_ID, targetId, damage: damage({ physical: 20 }), damageOverTime: true },
    ], undefined, allocator)
    expect(game.state.player.hp).toBeGreaterThan(50)
  })

  it('Mirror Wire extends active Razorwires each time an Echo copies', () => {
    const game = createGame({ seed: 124 })
    setSkills(game, [MIRRORCAST_SKILL_ID, GLACIAL_ORB_SKILL_ID, RAZORWIRE_SKILL_ID])
    game.state.run.selectedUpgradeIds.push('synergy-mirrorcast-razorwire')
    const targetId = game.spawnSlime({ x: 40, y: 0 })
    toughEnemy(game, targetId)
    const skills = game.state.player.skills
    const mirror = skills.find((skill) => skill.skillId === MIRRORCAST_SKILL_ID)!
    const glacial = skills.find((skill) => skill.skillId === GLACIAL_ORB_SKILL_ID)!
    const razor = skills.find((skill) => skill.skillId === RAZORWIRE_SKILL_ID)!

    // Cast Razorwire alone to place a wire.
    mirror.cooldownRemaining = 99
    glacial.cooldownRemaining = 99
    collectSkillDamage(game.state, createAllocator())
    expect(game.state.wires).toHaveLength(1)
    const durationBefore = game.state.wires![0]!.remainingDuration

    // Arm Mirrorcast, then capture Glacial Orb.
    razor.cooldownRemaining = 99
    mirror.cooldownRemaining = 0
    collectSkillDamage(game.state, createAllocator())
    mirror.cooldownRemaining = 99
    glacial.cooldownRemaining = 0
    collectSkillDamage(game.state, createAllocator())

    // The echo copy extends the wire without ticking its lifetime down.
    updateMirrorcast(game.state, MIRRORCAST_COPY_DELAY_SECONDS, createAllocator())
    expect(game.state.wires![0]!.remainingDuration).toBeGreaterThan(durationBefore)
  })
})

describe('new skill metadata and balance guardrails', () => {
  const newSkillIds: SkillId[] = [
    SIGIL_OF_RUIN_SKILL_ID,
    MIRRORCAST_SKILL_ID,
    RAZORWIRE_SKILL_ID,
    BLOOD_RITE_SKILL_ID,
    PRISM_HALO_SKILL_ID,
  ]

  it('gives every new skill a complete, unique visual contract and a Resonance effect', () => {
    const icons = new Set<string>()
    for (const skillId of newSkillIds) {
      const definition = SKILL_DEFINITIONS[skillId]
      expect(definition.visual.kind).toBe(definition.kind)
      expect(definition.visual.icon.trim().length).toBeGreaterThan(0)
      expect(definition.visual.primaryColor.trim().length).toBeGreaterThan(0)
      expect(definition.resonanceEffect?.id.length ?? 0).toBeGreaterThan(0)
      icons.add(definition.visual.icon)
    }
    expect(icons.size).toBe(newSkillIds.length)
  })

  it('references its glossary keyword in each new skill description', () => {
    expect(SKILL_DEFINITIONS[SIGIL_OF_RUIN_SKILL_ID].description).toContain('Ruin Sigil')
    expect(SKILL_DEFINITIONS[MIRRORCAST_SKILL_ID].description).toContain('Echo')
    expect(SKILL_DEFINITIONS[RAZORWIRE_SKILL_ID].description).toContain('Wire')
    expect(SKILL_DEFINITIONS[BLOOD_RITE_SKILL_ID].description).toContain('Blood Debt')
    expect(SKILL_DEFINITIONS[PRISM_HALO_SKILL_ID].description).toContain('Prism')
  })

  it('defines exactly two mutually exclusive evolution branches per new skill', () => {
    const branchesBySkill: Record<string, [UpgradeId, UpgradeId]> = {
      [SIGIL_OF_RUIN_SKILL_ID]: ['sigil-of-ruin-contagious-script', 'sigil-of-ruin-execution-protocol'],
      [MIRRORCAST_SKILL_ID]: ['mirrorcast-double-exposure', 'mirrorcast-deferred-echo'],
      [RAZORWIRE_SKILL_ID]: ['razorwire-tripwire-network', 'razorwire-guillotine-line'],
      [BLOOD_RITE_SKILL_ID]: ['blood-rite-sanguine-pact', 'blood-rite-crimson-debt'],
      [PRISM_HALO_SKILL_ID]: ['prism-halo-chromatic-convergence', 'prism-halo-refraction'],
    }
    for (const [skillId, [first, second]] of Object.entries(branchesBySkill)) {
      const firstDef = getUpgradeDefinition(first)
      const secondDef = getUpgradeDefinition(second)
      expect(firstDef.branch).toBe(first)
      expect(secondDef.branch).toBe(second)
      expect(firstDef.branch).not.toBe(secondDef.branch)
      // Choosing one branch makes the other ineligible.
      const state = {
        playerLevel: 5,
        selectedUpgradeIds: [first],
        ownedSkillIds: [skillId as SkillId],
        skillLevels: { [skillId]: 1 },
        skillSlotCount: 5,
      }
      expect(secondDef.isEligible(state)).toBe(false)
    }
  })

  it('keeps copy/split/tripwire multipliers below one so mirrored effects stay weaker', () => {
    expect(MIRRORCAST_BASE_EFFECTIVENESS).toBeLessThan(1)
    expect(MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS).toBeLessThan(MIRRORCAST_BASE_EFFECTIVENESS)
    expect(PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER).toBeLessThan(1)
    expect(SIGIL_OF_RUIN_DETONATION_DAMAGE_RATIO).toBeLessThanOrEqual(1)
    expect(BLOOD_RITE_SACRIFICE_FRACTION).toBeLessThan(1)
    expect(PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER).toBeGreaterThan(1)
  })
})
