import { describe, expect, it } from 'vitest'
import {
  createGame,
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_TIME_SCALE,
  FIXED_STEP_SECONDS,
  MAX_FRAME_SECONDS,
  MAX_TIME_SCALE,
  MIN_TIME_SCALE,
} from './Game'
import { SLIME_DEFINITION_ID } from '../content/enemies/EnemyConfig'
import { XP_BALANCE, xpRequiredForLevel } from '../content/progression/XpBalance'
import { BASIC_ATTACK_SKILL_ID } from '../content/skills/Skills'
import { equipItem, equipRolledItem } from './equipment/EquipmentState'
import { updatePickups } from './systems/experience/ExperienceSystem'
import { applyUpgrade } from './systems/upgrades/UpgradeSystem'
import { removeDeadEntities } from './systems/combat/CombatSystem'
import { getPlayerArenaBounds } from '../game-config/arena'
import { Rarity } from '../content/rarity/Rarity'

describe('Game', () => {
  it('starts a freshly created run in the playing phase, unpaused', () => {
    const game = createGame({ seed: 1 })

    expect(game.phase).toBe('playing')
    expect(game.paused).toBe(false)
    expect(game.state.tick).toBe(0)
    expect(game.state.time).toBe(0)
    expect(game.state.run.seed).toBe(1)
  })

  it('applies the purchased XP multiplier to collected XP', () => {
    const game = createGame({ seed: 106, xpMultiplierLevel: 2 })
    game.spawnXpPickup({ x: 0, y: 0 }, 10)

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.xp).toBe(11)
  })

  it('applies the purchased skill capacity to a new run', () => {
    const game = createGame({ seed: 113, skillSlotCount: 6 })

    expect(game.state.player.skillSlotCount).toBe(6)
    for (const skillId of [
      'chain-lightning',
      'vitality',
      'fiery-touch',
      'raise-skeleton',
    ] as const) {
      expect(game.grantDebugSkill(skillId).ok).toBe(true)
    }
    expect(game.state.player.skills).toHaveLength(6)
    expect(game.grantDebugSkill('glacial-orb')).toEqual({
      ok: false,
      error: 'No skill slots are available. Remove a skill before granting another.',
    })
  })

  it('starts at the purchased level and queues skipped level-up choices', () => {
    const game = createGame({ seed: 107, startingLevel: 4 })

    expect(game.state.player.level).toBe(4)
    expect(game.state.player.xp).toBe(0)
    expect(game.state.player.maxHp).toBeGreaterThan(
      createGame({ seed: 108 }).state.player.maxHp,
    )
    expect(game.phase).toBe('level-up')
    expect(game.getPendingChoiceFlows().map((flow) =>
      flow.type === 'level-up' ? flow.level : flow.type,
    )).toEqual([2, 3, 4])
    expect(game.getPendingChoiceFlows()[0]?.choices).toHaveLength(3)
    expect(game.getPendingChoiceFlows().slice(1).every((flow) =>
      flow.type === 'level-up' && flow.choices.length === 0,
    )).toBe(true)

    while (game.phase === 'level-up') {
      const flow = game.getPendingChoiceFlow()
      expect(flow?.type).toBe('level-up')
      if (flow?.type === 'level-up') {
        expect(game.selectUpgrade(flow.choices[0]!)).toBe(true)
      }
    }
    expect(game.phase).toBe('playing')
    expect(game.state.run.selectedUpgradeIds).toHaveLength(3)
  })

  it('generates each queued level-up after the previous selection is applied', () => {
    const game = createGame({ seed: 6, startingLevel: 4 })
    const firstFlow = game.getPendingChoiceFlow()
    expect(firstFlow?.type).toBe('level-up')
    if (firstFlow?.type !== 'level-up') {
      return
    }

    const unlock = firstFlow.choices.find((choice) =>
      choice.upgradeId === 'raise-skeleton-unlock',
    )
    expect(unlock).toBeDefined()
    expect(game.selectUpgrade(unlock!)).toBe(true)

    const nextFlow = game.getPendingChoiceFlow()
    expect(nextFlow?.type).toBe('level-up')
    if (nextFlow?.type !== 'level-up') {
      return
    }
    expect(nextFlow.choices).toHaveLength(3)
    expect(nextFlow.choices.map((choice) => choice.upgradeId)).not.toContain(
      'raise-skeleton-unlock',
    )
  })

  it('equips each playstyle with its authored starter weapon', () => {
    expect(createGame({ seed: 101, playstyleId: 'knight' }).state.player.equipment?.weapon)
      .toMatchObject({ itemId: 'knight-training-sword' })
    expect(createGame({ seed: 102, playstyleId: 'ranger' }).state.player.equipment?.weapon)
      .toMatchObject({ itemId: 'ranger-training-bow' })
    expect(createGame({ seed: 103, playstyleId: 'necromancer' }).state.player.equipment?.weapon)
      .toMatchObject({ itemId: 'necromancer-bone-staff' })
    expect(createGame({ seed: 104, playstyleId: 'frost-warden' }).state.player.equipment?.weapon)
      .toMatchObject({ itemId: 'frost-warden-training-wand' })
    expect(createGame({ seed: 105, playstyleId: 'ashen-alchemist' }).state.player.equipment?.weapon)
      .toMatchObject({ itemId: 'ashen-alchemist-training-staff' })
    expect(createGame({ seed: 106, playstyleId: 'war-shepherd' }).state.player.equipment?.weapon)
      .toMatchObject({ itemId: 'war-shepherd-training-sword' })
  })

  it('grants development gear and refreshes the player projection', () => {
    const game = createGame({ seed: 109 })
    let notificationCount = 0
    game.subscribe(() => {
      notificationCount += 1
    })

    expect(game.grantDebugGear('hunters-bow')).toEqual({
      ok: true,
      changed: true,
    })
    expect(game.state.player.equipment?.weapon).toMatchObject({
      itemId: 'hunters-bow',
    })
    expect(game.state.player.attackSpeed).toBeGreaterThan(1)
    expect(notificationCount).toBe(1)

    expect(game.grantDebugGear('hunters-bow', 'splintering')).toEqual({
      ok: true,
      changed: true,
    })
    expect(game.state.player.equipment?.weapon).toMatchObject({
      itemId: 'hunters-bow',
      setId: 'splintering',
    })
    expect(notificationCount).toBe(2)
    expect(game.grantDebugGear('knight-training-sword')).toEqual({
      ok: false,
      error: 'Training weapons are not available as development grants.',
    })
  })

  it('grants development skills once and respects the configured slot limit', () => {
    const game = createGame({ seed: 110 })

    expect(game.grantDebugSkill('chain-lightning')).toEqual({
      ok: true,
      changed: true,
    })
    expect(game.grantDebugSkill('chain-lightning')).toEqual({
      ok: true,
      changed: false,
    })
    expect(game.grantDebugSkill('vitality')).toEqual({
      ok: true,
      changed: true,
    })
    expect(game.grantDebugSkill('fiery-touch')).toEqual({
      ok: true,
      changed: true,
    })
    expect(game.state.player.skills).toHaveLength(5)
    expect(game.grantDebugSkill('raise-skeleton')).toEqual({
      ok: false,
      error: 'No skill slots are available. Remove a skill before granting another.',
    })
  })

  it('grants ineligible development upgrades and blocks skill unlocks at capacity', () => {
    const game = createGame({ seed: 111 })

    expect(game.grantDebugUpgrade('vitality-last-stand')).toEqual({
      ok: true,
      changed: true,
    })
    expect(game.state.player.vitalityLowHpHealingMultiplier).toBe(2)
    expect(game.state.run.selectedUpgradeIds).toEqual(['vitality-last-stand'])

    for (const skillId of [
      'whirlwind',
      'chain-lightning',
      'vitality',
      'raise-skeleton',
    ] as const) {
      expect(game.grantDebugSkill(skillId).ok).toBe(true)
    }
    expect(game.grantDebugUpgrade('fiery-touch-unlock')).toEqual({
      ok: false,
      error: 'No skill slots are available for this skill unlock.',
    })
  })

  it('rejects development grants after the run ends', () => {
    const game = createGame({ seed: 112 })
    game.endRun()

    expect(game.grantDebugGear('helmet')).toEqual({
      ok: false,
      error: 'Development grants are only available during an active run.',
    })
  })

  it('keeps the current floor when starting a boss manually', () => {
    const game = createGame({ seed: 104 })

    expect(game.startEncounter('stone-golem')).toBe(true)
    expect(game.state.run.floor).toBe(1)
  })

  it('uses an unlocked maximum-floor contract to build the encounter timeline', () => {
    const contract = DEFAULT_DUNGEON_CONFIG.maximumFloorContracts[0]!
    const game = createGame({
      seed: 105,
      dungeonMaxFloorContractId: contract.id,
      unlockedDungeonMaxFloorIds: [contract.requiredUnlockId],
    })

    expect(game.state.run.dungeonMaxFloor).toBe(200)
    expect(game.dungeon.encounterTimeline.at(-1)).toMatchObject({
      floorNumber: 200,
      isFinal: true,
    })
  })

  it('runs headlessly: no renderer is required to advance the simulation', () => {
    // Mirrors PLAN.md section 79's deterministic simulation test: the
    // simulation can run for a full minute of ticks with nothing but the
    // `Game` instance itself, demonstrating Milestone 2's definition of done.
    const game = createGame({ seed: 12345 })

    for (let i = 0; i < 60 * 60 && game.phase === 'playing'; i += 1) {
      game.update(1 / 60)
    }

    // The first level-up intentionally suspends the otherwise headless run;
    // Milestone 7 will provide the choice that resumes it.
    expect(game.phase).toBe('level-up')
    expect(game.state.tick).toBeGreaterThan(0)
    expect(game.state.time).toBeCloseTo(game.state.tick / 60)
  })

  it('advances by exactly one fixed step per FIXED_STEP_SECONDS of input', () => {
    const game = createGame({ seed: 2 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.tick).toBe(1)
    expect(game.state.time).toBeCloseTo(FIXED_STEP_SECONDS)
  })

  it('accepts inclusive time-scale boundaries and rejects invalid values', () => {
    const game = createGame({ seed: 2 })

    expect(game.timeScale).toBe(DEFAULT_TIME_SCALE)
    expect(game.setTimeScale(MIN_TIME_SCALE)).toEqual({
      ok: true,
      value: MIN_TIME_SCALE,
    })
    expect(game.timeScale).toBe(MIN_TIME_SCALE)
    expect(game.setTimeScale(MAX_TIME_SCALE)).toEqual({
      ok: true,
      value: MAX_TIME_SCALE,
    })
    expect(game.timeScale).toBe(MAX_TIME_SCALE)

    for (const invalidValue of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      MIN_TIME_SCALE - 0.01,
      MAX_TIME_SCALE + 0.01,
    ]) {
      const result = game.setTimeScale(invalidValue)
      expect(result.ok).toBe(false)
      expect(game.timeScale).toBe(MAX_TIME_SCALE)
    }
  })

  it('applies 10x to a clamped raw frame delta before fixed-step accumulation', () => {
    const game = createGame({ seed: 2 })
    expect(game.setTimeScale(MAX_TIME_SCALE).ok).toBe(true)

    game.update(0.1)
    expect(game.state.tick).toBe(60)
    expect(game.state.time).toBeCloseTo(1)

    game.update(10)
    expect(game.state.tick).toBe(
      60 +
        Math.floor(
          (MAX_FRAME_SECONDS * MAX_TIME_SCALE) / FIXED_STEP_SECONDS,
        ),
    )
  })

  it('produces the same tick/time progression regardless of how irregular the frame deltas are', () => {
    const totalSeconds = 2

    const runWithDeltas = (deltas: number[]): { tick: number; time: number } => {
      const game = createGame({ seed: 3 })
      for (const delta of deltas) {
        game.update(delta)
      }
      return { tick: game.state.tick, time: game.state.time }
    }

    const steadySixty = Array.from({ length: Math.round(totalSeconds * 60) }, () => 1 / 60)

    // Deliberately irregular deltas (simulating frame hitches, super-fast
    // frames, etc.) that still sum to the same total elapsed time.
    const irregular: number[] = []
    let remaining = totalSeconds
    let tick = 0
    while (remaining > 0.0001) {
      const delta = Math.min(remaining, [0.0005, 0.05, 0.1, 0.0166, 0.2][tick % 5])
      irregular.push(delta)
      remaining -= delta
      tick += 1
    }

    const steadyResult = runWithDeltas(steadySixty)
    const irregularResult = runWithDeltas(irregular)

    // Both should have simulated the same number of fixed ticks (up to
    // sub-step remainder in the accumulator) because ticking is driven by
    // accumulated fixed-size steps, not by how the caller sliced the frames.
    expect(irregularResult.tick).toBe(steadyResult.tick)
    expect(irregularResult.time).toBeCloseTo(steadyResult.time, 10)
  })

  it('carries a partial-step remainder over to the next update() call', () => {
    const game = createGame({ seed: 4 })

    // Half a fixed step should not produce a tick yet...
    game.update(FIXED_STEP_SECONDS / 2)
    expect(game.state.tick).toBe(0)

    // ...but combined with the remaining half, it should.
    game.update(FIXED_STEP_SECONDS / 2)
    expect(game.state.tick).toBe(1)
  })

  it('clamps an extremely large frame delta instead of running a burst of catch-up ticks', () => {
    const game = createGame({ seed: 5 })

    game.update(10) // e.g. a backgrounded tab resuming after 10 real seconds

    // Only MAX_FRAME_SECONDS (0.25s) worth of ticks should be consumed.
    expect(game.state.tick).toBe(Math.floor(0.25 / FIXED_STEP_SECONDS))
  })

  it('stops advancing the clock while paused and resumes afterwards', () => {
    const game = createGame({ seed: 6 })

    game.update(1)
    const tickBeforePause = game.state.tick
    const timeBeforePause = game.state.time

    game.pause()
    expect(game.phase).toBe('paused')
    expect(game.paused).toBe(true)

    game.update(1)
    game.update(1)

    expect(game.state.tick).toBe(tickBeforePause)
    expect(game.state.time).toBeCloseTo(timeBeforePause)

    game.resume()
    expect(game.phase).toBe('playing')
    expect(game.paused).toBe(false)

    game.update(1)
    expect(game.state.tick).toBeGreaterThan(tickBeforePause)
  })

  it('is idempotent when pausing or resuming redundantly', () => {
    const game = createGame({ seed: 7 })

    game.pause()
    game.pause()
    expect(game.phase).toBe('paused')

    game.resume()
    game.resume()
    expect(game.phase).toBe('playing')
  })

  it('ends a run through defeat and exposes an immutable result snapshot', () => {
    const game = createGame({ seed: 7 })
    game.update(0.5)

    expect(game.endRun()).toBe(true)
    expect(game.phase).toBe('defeat')
    expect(game.state.player.hp).toBe(0)

    const result = game.getRunResultSnapshot()
    expect(result).toEqual({
      phase: 'defeat',
      elapsedTime: game.state.time,
      level: game.state.player.level,
      xp: game.state.player.xp,
      killCount: game.state.run.killCount,
      worldModifierIds: [],
      playerCombatLog: [],
      skillDamage: [],
    })
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('forfeits a paused run without retaining its combat log', () => {
    const game = createGame({ seed: 113 })
    game.state.run.playerCombatLog = [{
      time: 0,
      kind: 'damage',
      amount: 5,
      damageType: 'physical',
      source: 'Slime',
      resultingHp: game.state.player.hp - 5,
    }]
    game.pause()

    expect(game.forfeit()).toBe(true)
    expect(game.phase).toBe('defeat')
    expect(game.state.player.hp).toBe(0)
    expect(game.state.run.playerCombatLog).toEqual([])
    expect(game.getRunResultSnapshot()).toMatchObject({
      phase: 'defeat',
      forfeited: true,
      playerCombatLog: [],
    })
  })

  it('does not update any simulation state after defeat', () => {
    const game = createGame({ seed: 8 })
    game.update(1)
    game.endRun()
    const stateAfterDefeat = {
      tick: game.state.tick,
      time: game.state.time,
      kills: game.state.run.killCount,
    }

    expect(game.endRun()).toBe(false)
    game.update(10)

    expect(game.phase).toBe('defeat')
    expect(game.state.tick).toBe(stateAfterDefeat.tick)
    expect(game.state.time).toBe(stateAfterDefeat.time)
    expect(game.state.run.killCount).toBe(stateAfterDefeat.kills)
  })

  it('gives each game instance its own deterministic RNG derived from its seed', () => {
    const gameA = createGame({ seed: 999 })
    const gameB = createGame({ seed: 999 })
    const gameC = createGame({ seed: 1000 })

    const sequenceFrom = (game: ReturnType<typeof createGame>) => [
      game.random.next(),
      game.random.next(),
      game.random.next(),
    ]

    expect(sequenceFrom(gameA)).toEqual(sequenceFrom(gameB))
    expect(sequenceFrom(gameA)).not.toEqual(sequenceFrom(gameC))
  })

  it('assigns the player a stable numeric entity id', () => {
    const game = createGame({ seed: 42 })

    expect(typeof game.state.player.id).toBe('number')
    expect(game.state.player.hp).toBe(game.state.player.maxHp)
  })

  it('supports deterministic development stress spawns without consuming the run RNG', () => {
    const game = createGame({ seed: 43 })
    const firstRandomValue = game.random.next()

    expect(game.spawnDebugEnemies(100)).toBe(100)
    expect(game.spawnDebugEnemies(500)).toBe(500)
    expect(game.spawnDebugEnemies(1000)).toBe(1000)
    expect(game.state.enemies).toHaveLength(1600)
    expect(game.state.enemies[0]).toMatchObject({
      id: 2,
      definitionId: SLIME_DEFINITION_ID,
    })
    expect(game.state.enemies.every((enemy) => Number.isFinite(enemy.x))).toBe(
      true,
    )

    const comparison = createGame({ seed: 43 })
    expect(comparison.random.next()).toBe(firstRandomValue)
    expect(comparison.spawnDebugEnemies(100)).toBe(100)
    expect(comparison.state.enemies).toEqual(game.state.enemies.slice(0, 100))

    game.update(FIXED_STEP_SECONDS)
    expect(game.phase).toBe('playing')
    expect(game.state.enemies).toHaveLength(1600)

    game.endRun()
    expect(game.spawnDebugEnemies(100)).toBe(0)
  })

  it('spawns a data-driven Slime with a stable definition and chase target', () => {
    const game = createGame({ seed: 8 })

    const slimeId = game.spawnSlime({ x: 100, y: 25 })
    const slime = game.state.enemies[0]

    expect(slime).toMatchObject({
      id: slimeId,
      definitionId: SLIME_DEFINITION_ID,
      x: 100,
      y: 25,
      radius: 18,
      hp: 25,
      maxHp: 25,
      contactDamage: expect.closeTo(4.8, 10),
      xpReward: 4,
      targetId: game.state.player.id,
    })
    expect(slime.speed).toBeCloseTo(84.6)

  })

  it('spawns stairs at the final boss death and collects floor rewards before transitioning', () => {
      const game = createGame({ seed: 20260826 })
      expect(game.startBossEncounter()).toBe(true)
      const boss = game.state.bosses?.[0]
      expect(boss).toBeDefined()
      game.state.player.x = boss!.x
      game.state.player.y = boss!.y
      game.spawnXpPickup({ x: boss!.x, y: boss!.y }, 10)
      game.spawnGearPickup({ x: boss!.x, y: boss!.y })
      boss!.hp = 0

      game.update(FIXED_STEP_SECONDS)

      expect(game.state.stairs).toMatchObject({
        x: boss!.x,
        y: boss!.y,
        rewardsCollected: true,
      })
      expect(game.state.pickups).toHaveLength(1)
      expect(game.getPendingChoiceFlows()).toHaveLength(1)
      expect(game.phase).toBe('level-up')

      while (game.phase === 'level-up') {
        const flow = game.getPendingChoiceFlow()
        expect(flow).toBeDefined()
        if (flow?.type === 'level-up') {
          expect(game.selectUpgrade(flow.choices[0]!)).toBe(true)
        } else if (flow?.type === 'gear-pickup') {
          expect(game.selectGearChoice(flow.choices[0]!)).toBe(true)
        }
      }

      expect(game.phase).toBe('floor-transition')
      expect(game.state.floorTransition?.remainingSeconds).toBeCloseTo(1)
      for (let index = 0; index < 60; index += 1) {
        game.update(FIXED_STEP_SECONDS)
      }
      expect(game.phase).toBe('playing')
      expect(game.state.run.floor).toBe(2)
      expect(game.state.run.floorStartedAt).toBeCloseTo(game.state.time)
      expect(game.getUiSnapshot().boss).toBeNull()
      expect(game.getUiSnapshot().floorProgress).toBe(0)
      game.update(FIXED_STEP_SECONDS)
      expect(game.getUiSnapshot().floorProgress).toBeGreaterThan(0)
  })

  it('waits for every boss in an event before creating stairs', () => {
      const game = createGame({ seed: 20260828 })
      expect(game.startBossEncounter()).toBe(true)
      const first = game.state.bosses?.[0]
      expect(first).toBeDefined()
      if (!first) {
        throw new Error('Expected the first boss encounter to spawn a boss')
      }
      const secondId = game.spawnBoss()
      const second = game.state.bosses?.find((boss) => boss.id === secondId)
      expect(second).toBeDefined()
      if (!second) {
        throw new Error('Expected the manually spawned boss to exist')
      }
      first.xpReward = 0
      second.xpReward = 0
      first.hp = 0
      game.update(FIXED_STEP_SECONDS)

      expect(game.state.encounter?.status).toBe('active')
      expect(game.state.stairs).toBeUndefined()
      expect(game.state.bosses).toHaveLength(1)

      game.state.player.x = second.x
      game.state.player.y = second.y
      second.hp = 0
      game.update(FIXED_STEP_SECONDS)

      expect(game.state.encounter?.status).toBe('complete')
      expect(game.phase).toBe('floor-transition')
  })

  it('takes final boss stairs through victory into results after choices resolve', () => {
      const game = createGame({ seed: 20260827 })
      expect(game.startBossEncounter()).toBe(true)
      game.state.encounter!.isFinal = true
      const boss = game.state.bosses?.[0]
      expect(boss).toBeDefined()
      if (!boss) {
        throw new Error('Expected the final encounter to spawn a boss')
      }
      game.state.player.x = boss.x
      game.state.player.y = boss.y
      boss.hp = 0

      game.update(FIXED_STEP_SECONDS)

      while (game.phase === 'level-up') {
        const flow = game.getPendingChoiceFlow()
        expect(flow).toBeDefined()
        if (flow?.type === 'level-up') {
          expect(game.selectUpgrade(flow.choices[0]!)).toBe(true)
        } else if (flow?.type === 'gear-pickup') {
          expect(game.selectGearChoice(flow.choices[0]!)).toBe(true)
        }
      }
      expect(game.phase).toBe('floor-transition')
      for (let index = 0; index < 60; index += 1) {
        game.update(FIXED_STEP_SECONDS)
      }
      expect(game.phase).toBe('results')
      expect(game.getRunResultSnapshot().phase).toBe('results')
  })

  it('keeps the final floor through final-boss stairs before ending the run', () => {
      const game = createGame({ seed: 20260829 })
      game.state.run.floor = game.dungeon.defaultMaxFloor
      game.state.run.floorStartedAt =
        game.state.time - game.dungeon.floorDurationSeconds
      game.update(FIXED_STEP_SECONDS)
      const boss = game.state.bosses?.[0]
      expect(boss).toBeDefined()
      if (!boss) {
        throw new Error('Expected the final normal floor to trigger its final boss')
      }
      game.state.player.x = boss.x
      game.state.player.y = boss.y
      boss.hp = 0

      game.update(FIXED_STEP_SECONDS)

      expect(game.state.stairs).toMatchObject({ floorNumber: 30, isFinal: true })
      expect(game.state.run.floor).toBe(30)
      while (game.phase === 'level-up') {
        const flow = game.getPendingChoiceFlow()
        if (flow?.type === 'level-up') {
          expect(game.selectUpgrade(flow.choices[0]!)).toBe(true)
        } else if (flow?.type === 'gear-pickup') {
          expect(game.selectGearChoice(flow.choices[0]!)).toBe(true)
        }
      }
      expect(game.phase).toBe('floor-transition')
      for (let index = 0; index < 60; index += 1) {
        game.update(FIXED_STEP_SECONDS)
      }
      expect(game.phase).toBe('results')
      expect(game.state.run.floor).toBe(30)
  })

  it('moves a Slime deterministically toward the player each fixed tick', () => {
    const gameA = createGame({ seed: 9 })
    const gameB = createGame({ seed: 9 })
    gameA.spawnSlime({ x: 100, y: 50 })
    gameB.spawnSlime({ x: 100, y: 50 })

    gameA.update(FIXED_STEP_SECONDS)
    gameB.update(FIXED_STEP_SECONDS)

    const initialDistance = Math.hypot(100, 50)
    const movementDistance = 84.6 * FIXED_STEP_SECONDS
    expect(gameA.state.enemies[0]).toEqual(gameB.state.enemies[0])
    expect(gameA.state.enemies[0].x).toBeCloseTo(
      100 - (movementDistance * 100) / initialDistance,
    )
    expect(gameA.state.enemies[0].y).toBeCloseTo(
      50 - (movementDistance * 50) / initialDistance,
    )
  })

  it('stops at contact range without overshooting the player', () => {
    const game = createGame({ seed: 10 })
    equipRolledItem(game.state.player, 'starcall-wand', Rarity.Common, [])
    game.spawnSlime({ x: 34.5, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.enemies[0].x).toBeCloseTo(
      game.state.player.radius + game.state.enemies[0].radius,
    )
    expect(game.state.enemies[0].x).toBeGreaterThanOrEqual(0)
  })

  it('uses the equipped Knight sword Basic Attack', () => {
    const game = createGame({ seed: 11 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    game.spawnSlime({ x: 50, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.equipment?.weapon).toMatchObject({ itemId: 'knight-training-sword' })
    expect(game.state.projectiles).toHaveLength(0)
    expect(game.state.player.targetId).toBe(game.state.enemies[0].id)
    expect(game.state.enemies[0]?.hp).toBeLessThan(20)
    expect(game.state.effects[0]).toMatchObject({
      shape: 'arc',
      basicAttackWeaponArchetype: 'sword',
    })
    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: 'basic-attack', level: 1 }),
    ])
  })

  it('resolves sword Basic Attack hits without spawning projectiles', () => {
    const game = createGame({ seed: 110 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    equipItem(game.state.player, 'iron-cleaver')
    const firstTargetId = game.spawnSlime({ x: 35, y: 0 })
    const secondTargetId = game.spawnSlime({ x: 32, y: 16 })
    const outsideArcId = game.spawnSlime({ x: 0, y: 60 })

    game.update(FIXED_STEP_SECONDS)

    const firstTarget = game.state.enemies.find((enemy) => enemy.id === firstTargetId)
    const secondTarget = game.state.enemies.find((enemy) => enemy.id === secondTargetId)
    const outsideArc = game.state.enemies.find((enemy) => enemy.id === outsideArcId)
    expect(game.state.projectiles).toHaveLength(0)
    expect(firstTarget?.hp).toBeLessThan(firstTarget?.maxHp ?? Infinity)
    expect(secondTarget?.hp).toBeLessThan(secondTarget?.maxHp ?? Infinity)
    expect(outsideArc?.hp).toBe(outsideArc?.maxHp)
    expect(game.state.effects[0]).toMatchObject({
      shape: 'arc',
      basicAttackWeaponArchetype: 'sword',
    })
  })

  it('keeps a lone slime inside the engagement envelope targeted and firing', () => {
    const game = createGame({ seed: 111 })
    equipRolledItem(game.state.player, 'starcall-wand', Rarity.Common, [])
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    game.spawnSlime({ x: 60, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.targetId).toBe(game.state.enemies[0].id)
    expect(game.state.projectiles).toHaveLength(1)
  })

  it('keeps pursuing and firing at the current target when another enemy moves closer', () => {
    const game = createGame({ seed: 112 })
    equipRolledItem(game.state.player, 'starcall-wand', Rarity.Common, [])
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const firstTargetId = game.spawnSlime({ x: 60, y: 0 })
    const closerEnemyId = game.spawnSlime({ x: 68, y: 0 })

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.player.targetId).toBe(firstTargetId)

    const firstTarget = game.state.enemies.find((enemy) => enemy.id === firstTargetId)
    const closerEnemy = game.state.enemies.find((enemy) => enemy.id === closerEnemyId)
    if (!firstTarget || !closerEnemy) {
      throw new Error('Expected both Slimes to be spawned.')
    }
    firstTarget.x = 160
    closerEnemy.x = 8
    game.state.player.attackCooldownRemaining = 0
    game.state.projectiles.splice(0)

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.player.targetId).toBe(firstTargetId)
    expect(game.state.player.attackCooldownRemaining).toBeGreaterThan(0)
    expect(closerEnemy.hp).toBeLessThan(closerEnemy.maxHp)
  })

  it('waits for the attack cooldown before creating another projectile', () => {
    const game = createGame({ seed: 12 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const slimeId = game.spawnSlime({ x: 0, y: 0 })
    const slime = game.state.enemies.find((enemy) => enemy.id === slimeId)
    if (!slime) {
      throw new Error('Expected the spawned slime to exist')
    }
    slime.hp = 100
    slime.maxHp = 100

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.player.attackCooldownRemaining).toBeCloseTo(1)
    expect(game.state.projectiles).toHaveLength(0)

    for (let tick = 0; tick < 59; tick += 1) {
      game.update(FIXED_STEP_SECONDS)
    }
    expect(game.state.projectiles).toHaveLength(0)

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.player.attackCooldownRemaining).toBeCloseTo(1)
  })

  it('applies projectile damage and removes an enemy when its health reaches zero', () => {
    const game = createGame({ seed: 13 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    const slimeId = game.spawnSlime({ x: 0, y: 0 })
    const slime = game.state.enemies.find((enemy) => enemy.id === slimeId)
    if (!slime) {
      throw new Error('Expected the spawned slime to exist')
    }
    slime.hp = game.state.player.attackDamage

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.enemies).toHaveLength(0)
    expect(game.state.projectiles).toHaveLength(0)
  })

  it('increments the run kill counter once for each enemy removed', () => {
    const game = createGame({ seed: 14 })
    const firstId = game.spawnSlime({ x: 0, y: 0 })
    const secondId = game.spawnSlime({ x: 0, y: 0 })

    for (const enemy of game.state.enemies) {
      enemy.hp = 0
    }

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.run.killCount).toBe(2)
    expect(game.state.enemies).toHaveLength(0)

    // A later cleanup pass must not count entities that were already removed.
    game.update(FIXED_STEP_SECONDS)
    expect(game.state.run.killCount).toBe(2)
    expect(firstId).not.toBe(secondId)
  })

  it('creates exactly one XP pickup for each enemy death', () => {
    const game = createGame({ seed: 15 })
    const firstId = game.spawnSlime({ x: 100, y: 0 })
    const secondId = game.spawnSlime({ x: 200, y: 0 })

    for (const enemy of game.state.enemies) {
      enemy.hp = 0
    }

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.enemies).toHaveLength(0)
    expect(game.state.pickups).toHaveLength(2)
    expect(game.state.pickups.map((pickup) => pickup.xpAmount)).toEqual([4, 4])
    expect(game.state.pickups.map((pickup) => pickup.x)).toEqual([94.59, 198.575])
    expect(firstId).not.toBe(secondId)

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.pickups).toHaveLength(2)
  })

  it('attracts pickups deterministically and collects them at contact range', () => {
    const run = () => {
      const game = createGame({ seed: 16 })
      game.spawnXpPickup({ x: XP_BALANCE.pickupAttractionRadius, y: 0 }, 3)
      for (let tick = 0; tick < 60; tick += 1) {
        game.update(FIXED_STEP_SECONDS)
        if (game.state.pickups.length === 0) {
          break
        }
      }
      return {
        player: { ...game.state.player },
        pickups: [...game.state.pickups],
      }
    }

    const first = run()
    const second = run()
    expect(first).toEqual(second)
    expect(first.pickups).toHaveLength(0)
    expect(first.player.xp).toBe(3)
  })

  it('collects XP when attraction movement reaches the player contact boundary', () => {
    const game = createGame({ seed: 164 })
    game.spawnXpPickup({ x: XP_BALANCE.pickupAttractionRadius, y: 0 }, 3)

    for (let tick = 0; tick < 60; tick += 1) {
      game.update(FIXED_STEP_SECONDS)
    }

    expect(game.state.pickups).toHaveLength(0)
    expect(game.state.player.xp).toBe(3)
  })

  it('keeps all enemy death drops reachable when the enemy dies outside the arena', () => {
    const game = createGame({ seed: 163 })
    const bounds = getPlayerArenaBounds(game.state.player.radius)
    game.spawnSlime({
      x: bounds.maxX + 500,
      y: bounds.maxY + 500,
    })
    const enemy = game.state.enemies[0]
    if (!enemy) {
      throw new Error('Expected an enemy outside the arena')
    }
    enemy.hp = 0

    const alwaysDrop = {
      chance: () => true,
      next: () => 0.5,
      int: () => 1,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    removeDeadEntities(
      game.state,
      (position, xpAmount) => game.spawnXpPickup(position, xpAmount),
      undefined,
      (position) => game.spawnGearPickup(position),
      alwaysDrop,
      (position) => game.spawnHealingPotion(position),
    )

    expect(game.state.pickups).toHaveLength(3)
    expect(game.state.pickups.every((pickup) =>
      pickup.x === bounds.maxX && pickup.y === bounds.maxY
    )).toBe(true)
  })

  it('collects healing potions for 10% of maximum health without exceeding it', () => {
    const game = createGame({ seed: 161 })
    const { maxHp } = game.state.player
    game.state.player.hp = maxHp / 2
    game.spawnHealingPotion({ x: 0, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.hp).toBe(maxHp * 0.6)
    expect(game.state.pickups).toEqual([])

    game.state.player.hp = maxHp - 5
    game.spawnHealingPotion({ x: 0, y: 0 })
    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.hp).toBe(maxHp)
    expect(game.state.pickups).toEqual([])
  })

  it('extends collection range for XP, gear, and healing pickups', () => {
    const game = createGame({ seed: 162 })
    applyUpgrade(game.state, 'magnet')
    game.spawnXpPickup({ x: 145, y: 0 }, 3)
    game.spawnGearPickup({ x: 185, y: 0 })
    game.spawnHealingPotion({ x: 185, y: 0 })

    updatePickups(game.state, FIXED_STEP_SECONDS, () => {})

    expect(game.state.pickups).toHaveLength(3)
    expect(game.state.pickups.every((pickup) => pickup.x < 185)).toBe(true)
  })

  it('retains XP and safely handles multiple level thresholds', () => {
    const game = createGame({ seed: 17 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(4))

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.xp).toBe(xpRequiredForLevel(4))
    expect(game.state.player.level).toBe(4)
    expect(game.phase).toBe('level-up')
    expect(game.paused).toBe(false)
    expect(game.state.pickups).toHaveLength(0)
  })

  it('halts simulation in level-up and supports explicit user pause', () => {
    const game = createGame({ seed: 18 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))
    game.update(1)

    const snapshot = {
      tick: game.state.tick,
      time: game.state.time,
      enemies: [...game.state.enemies],
      projectiles: [...game.state.projectiles],
      pickups: [...game.state.pickups],
    }

    game.update(10)

    expect(game.phase).toBe('level-up')
    expect(game.paused).toBe(false)
    expect(game.state.tick).toBe(snapshot.tick)
    expect(game.state.time).toBe(snapshot.time)
    expect(game.state.enemies).toEqual(snapshot.enemies)
    expect(game.state.projectiles).toEqual(snapshot.projectiles)
    expect(game.state.pickups).toEqual(snapshot.pickups)

    game.pause()
    expect(game.phase).toBe('paused')
    expect(game.paused).toBe(true)

    game.resume()
    expect(game.phase).toBe('level-up')
    expect(game.paused).toBe(false)
  })

  it('offers three seeded, unique choices when a level-up begins', () => {
    const gameA = createGame({ seed: 19 })
    const gameB = createGame({ seed: 19 })
    const xp = xpRequiredForLevel(2)
    gameA.spawnXpPickup({ x: 0, y: 0 }, xp)
    gameB.spawnXpPickup({ x: 0, y: 0 }, xp)

    gameA.update(FIXED_STEP_SECONDS)
    gameB.update(FIXED_STEP_SECONDS)

    expect(gameA.phase).toBe('level-up')
    expect(gameA.getPendingUpgradeChoices()).toHaveLength(3)
    expect(gameA.getPendingUpgradeChoices()).toEqual(
      gameB.getPendingUpgradeChoices(),
    )
    expect(
      new Set(
        gameA.getPendingUpgradeChoices().map((choice) => choice.upgradeId),
      ).size,
    ).toBe(3)
  })

  it('applies an offered upgrade once and resumes without a catch-up burst', () => {
    const game = createGame({ seed: 20 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))
    game.update(FIXED_STEP_SECONDS)

    const tickAtLevelUp = game.state.tick
    const offeredUpgradeId = game.getPendingUpgradeChoices()[0]?.upgradeId
    expect(offeredUpgradeId).toBeDefined()

    expect(game.selectUpgrade(offeredUpgradeId!)).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.getPendingUpgradeChoices()).toEqual([])
    expect(game.selectUpgrade(offeredUpgradeId!)).toBe(false)

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.tick).toBe(tickAtLevelUp + 1)
  })

  it('skips upgrade and gear choice flows without changing player equipment or stats', () => {
    const game = createGame({ seed: 200 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))
    game.update(FIXED_STEP_SECONDS)

    const playerBeforeUpgrade = structuredClone(game.state.player)
    expect(game.getPendingChoiceFlow()?.type).toBe('level-up')
    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.state.player).toEqual(playerBeforeUpgrade)
    expect(game.skipChoice()).toBe(false)

    game.spawnGearPickup({ x: 0, y: 0 })
    game.update(FIXED_STEP_SECONDS)

    const playerBeforeGear = structuredClone(game.state.player)
    expect(game.getPendingChoiceFlow()?.type).toBe('gear-pickup')
    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.state.player).toEqual(playerBeforeGear)
  })

  it('skips queued level-up flows one at a time before resuming', () => {
    const game = createGame({ seed: 201, startingLevel: 3 })

    expect(game.phase).toBe('level-up')
    expect(game.getPendingChoiceFlows()).toHaveLength(2)
    expect(game.getPendingChoiceFlow()).toMatchObject({
      type: 'level-up',
      level: 2,
    })

    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('level-up')
    expect(game.getPendingChoiceFlow()).toMatchObject({
      type: 'level-up',
      level: 3,
    })

    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.getPendingChoiceFlows()).toEqual([])
  })

  it('does not skip an active choice flow while paused', () => {
    const game = createGame({ seed: 202 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))
    game.update(FIXED_STEP_SECONDS)

    const pendingBeforePause = game.getPendingChoiceFlow()
    expect(pendingBeforePause?.type).toBe('level-up')
    expect(game.pause()).toBeUndefined()
    expect(game.phase).toBe('paused')

    expect(game.skipChoice()).toBe(false)
    expect(game.getPendingChoiceFlow()).toEqual(pendingBeforePause)

    game.resume()
    expect(game.phase).toBe('level-up')
    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('playing')
  })

  it('skips queued level-up and gear flows in order', () => {
    const game = createGame({ seed: 203 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))
    game.spawnGearPickup({ x: 0, y: 0 })

    game.update(FIXED_STEP_SECONDS)
    expect(game.getPendingChoiceFlow()?.type).toBe('level-up')
    expect(game.getPendingChoiceFlows()).toHaveLength(1)

    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('playing')

    game.update(FIXED_STEP_SECONDS)
    expect(game.getPendingChoiceFlow()?.type).toBe('gear-pickup')
    expect(game.skipChoice()).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.getPendingChoiceFlows()).toEqual([])
  })

  it('offers and notifies once for every level in a multi-level XP award', () => {
    const game = createGame({ seed: 21 })
    const notifications: Array<{
      phase: string
      choices: readonly string[]
    }> = []
    game.subscribe(() => {
      notifications.push({
        phase: game.phase,
        choices: game
          .getPendingUpgradeChoices()
          .map((choice) => choice.upgradeId),
      })
    })

    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(4))
    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.level).toBe(4)
    expect(game.phase).toBe('level-up')
    expect(game.getPendingUpgradeChoices()).toHaveLength(3)
    expect(game.getPendingChoiceFlows().map((flow) => flow.type)).toEqual([
      'level-up',
      'level-up',
      'level-up',
    ])
    expect(notifications).toHaveLength(1)

    for (let offer = 0; offer < 3; offer += 1) {
      const choice = game.getPendingUpgradeChoices()[0]
      if (!choice) {
        throw new Error('Expected a pending upgrade choice')
      }

      expect(game.selectUpgrade(choice)).toBe(true)
      if (offer < 2) {
        expect(game.phase).toBe('level-up')
        expect(game.getPendingUpgradeChoices()).toHaveLength(3)
      }
    }

    expect(game.phase).toBe('playing')
    expect(game.getPendingUpgradeChoices()).toEqual([])
    expect(notifications.map((notification) => notification.phase)).toEqual([
      'level-up',
      'level-up',
      'level-up',
      'playing',
    ])
    expect(notifications.slice(0, 3).every((notification) => notification.choices.length === 3)).toBe(true)
  })

  it('queues gear pickup flows behind level-up flows and resumes after both', () => {
    const game = createGame({ seed: 22 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))
    game.spawnGearPickup({ x: 0, y: 0 })

    game.update(FIXED_STEP_SECONDS)
    expect(game.getPendingChoiceFlow()?.type).toBe('level-up')
    expect(game.getPendingChoiceFlows()).toHaveLength(1)

    const levelChoice = game.getPendingUpgradeChoices()[0]
    if (!levelChoice) {
      throw new Error('Expected a level-up choice')
    }
    expect(game.selectUpgrade(levelChoice)).toBe(true)
    expect(game.phase).toBe('playing')

    game.update(FIXED_STEP_SECONDS)
    expect(game.getPendingChoiceFlow()?.type).toBe('gear-pickup')
    const gearFlow = game.getPendingChoiceFlow()
    if (!gearFlow || gearFlow.type !== 'gear-pickup') {
      throw new Error('Expected a gear flow')
    }
    const normal = gearFlow.choices.find((choice) => choice.type === 'gear')
    if (!normal) {
      throw new Error('Expected a normal gear choice')
    }
    expect(game.selectGearChoice(normal)).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.state.player.equipment?.[normal.slot]?.itemId).toBe(normal.itemId)
  })
})
