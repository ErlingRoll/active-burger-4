import { describe, expect, it } from 'vitest'
import {
  createGame,
  DEFAULT_TIME_SCALE,
  FIXED_STEP_SECONDS,
  MAX_FRAME_SECONDS,
  MAX_TIME_SCALE,
  MIN_TIME_SCALE,
} from './Game'
import { SLIME_DEFINITION_ID } from '../content/enemies/Enemies'
import { XP_BALANCE, xpRequiredForLevel } from '../content/progression/XpBalance'

describe('Game', () => {
  it('starts a freshly created run in the playing phase, unpaused', () => {
    const game = createGame({ seed: 1 })

    expect(game.phase).toBe('playing')
    expect(game.paused).toBe(false)
    expect(game.state.tick).toBe(0)
    expect(game.state.time).toBe(0)
    expect(game.state.run.seed).toBe(1)
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
    })
    expect(Object.isFrozen(result)).toBe(true)
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
      hp: 20,
      maxHp: 20,
      speed: 60,
      contactDamage: 5,
      xpReward: 5,
      targetId: game.state.player.id,
    })

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
      expect(game.state.pickups).toEqual([])
      expect(game.getPendingChoiceFlows().length).toBeGreaterThan(1)
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
      expect(game.state.run.floor).toBe(3)
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

  it('moves a Slime deterministically toward the player each fixed tick', () => {
    const gameA = createGame({ seed: 9 })
    const gameB = createGame({ seed: 9 })
    gameA.spawnSlime({ x: 100, y: 50 })
    gameB.spawnSlime({ x: 100, y: 50 })

    gameA.update(FIXED_STEP_SECONDS)
    gameB.update(FIXED_STEP_SECONDS)

    const initialDistance = Math.hypot(100, 50)
    const movementDistance = 60 * FIXED_STEP_SECONDS
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
    game.spawnSlime({ x: 34.5, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.enemies[0].x).toBeCloseTo(
      game.state.player.radius + game.state.enemies[0].radius,
    )
    expect(game.state.enemies[0].x).toBeGreaterThanOrEqual(0)
  })

  it('automatically creates a Basic Bolt when a living enemy is in attack range', () => {
    const game = createGame({ seed: 11 })
    game.spawnSlime({ x: 50, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.projectiles).toHaveLength(1)
    expect(game.state.player.targetId).toBe(game.state.enemies[0].id)
    expect(game.state.projectiles[0]).toMatchObject({
      ownerId: game.state.player.id,
      definitionId: 'basic-bolt',
      x: 6,
      y: 0,
      velocityX: 360,
      velocityY: 0,
      damage: game.state.player.attackDamage,
    })
    expect(game.state.player.skills).toEqual([
      expect.objectContaining({ skillId: 'basic-bolt', level: 1 }),
    ])
  })

  it('keeps a lone slime inside the engagement envelope targeted and firing', () => {
    const game = createGame({ seed: 111 })
    game.spawnSlime({ x: 64, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.player.targetId).toBe(game.state.enemies[0].id)
    expect(game.state.projectiles).toHaveLength(1)
  })

  it('keeps attacking the current target when another enemy moves closer', () => {
    const game = createGame({ seed: 112 })
    const firstTargetId = game.spawnSlime({ x: 64, y: 0 })
    const closerEnemyId = game.spawnSlime({ x: 72, y: 0 })

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.player.targetId).toBe(firstTargetId)

    const closerEnemy = game.state.enemies.find((enemy) => enemy.id === closerEnemyId)
    if (!closerEnemy) {
      throw new Error('Expected the second Slime to be spawned.')
    }
    closerEnemy.x = 8

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.player.targetId).toBe(firstTargetId)
  })

  it('waits for the attack cooldown before creating another projectile', () => {
    const game = createGame({ seed: 12 })
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
    expect(game.state.pickups.map((pickup) => pickup.xpAmount)).toEqual([5, 5])
    expect(game.state.pickups.map((pickup) => pickup.x)).toEqual([95, 199])
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
    const damageBefore = game.state.player.attackDamage

    expect(game.selectUpgrade('damage-boost')).toBe(true)
    expect(game.phase).toBe('playing')
    expect(game.getPendingUpgradeChoices()).toEqual([])
    expect(game.state.player.attackDamage).toBe(damageBefore + 2)
    expect(game.selectUpgrade('damage-boost')).toBe(false)
    expect(game.state.player.attackDamage).toBe(damageBefore + 2)

    game.update(FIXED_STEP_SECONDS)
    expect(game.state.tick).toBe(tickAtLevelUp + 1)
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
