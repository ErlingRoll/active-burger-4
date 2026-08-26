import { describe, expect, it } from 'vitest'
import { createGame, FIXED_STEP_SECONDS } from './Game'
import { SLIME_DEFINITION_ID } from '../content/enemies/Enemies'

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

    for (let i = 0; i < 60 * 60; i += 1) {
      game.update(1 / 60)
    }

    expect(game.state.tick).toBe(60 * 60)
    expect(game.state.time).toBeCloseTo(60)
  })

  it('advances by exactly one fixed step per FIXED_STEP_SECONDS of input', () => {
    const game = createGame({ seed: 2 })

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.tick).toBe(1)
    expect(game.state.time).toBeCloseTo(FIXED_STEP_SECONDS)
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
      x: 6,
      y: 0,
      velocityX: 360,
      velocityY: 0,
      damage: game.state.player.attackDamage,
    })
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
})
