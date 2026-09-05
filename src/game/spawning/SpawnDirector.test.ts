import { describe, expect, it } from 'vitest'
import {
  SPAWN_BALANCE,
  SPAWN_RING_DISTANCE_MULTIPLIER,
} from '../../content/spawning/SpawnBalance'
import { Random } from '../random/Random'
import {
  ACTIVE_ENEMY_CAP,
  calculateThreatPerSecond,
  REINFORCEMENT_INTERVAL_SECONDS,
  SpawnDirector,
  type SpawnDirectorState,
} from './SpawnDirector'
import { ARENA_BOUNDS } from '../../game-config/arena'

function createState(
  time = 0,
  enemyCount = 0,
): SpawnDirectorState {
  return {
    time,
    player: { x: 100, y: -50 },
    enemies: Array.from({ length: enemyCount }, (_, id) => ({
      id,
      hp: 1,
    })),
  }
}

describe('SpawnDirector', () => {
  it('produces the same spawn sequence for the same seed', () => {
    const run = (seed: number) => {
      const director = new SpawnDirector(new Random(seed))
      return director.update(createState(), 1)
    }

    expect(run(123)).toEqual(run(123))
    expect(run(123)).not.toEqual(run(124))
  })

  it('places each request within the configured spawn ring', () => {
    const director = new SpawnDirector(new Random(456))
    const state = createState()
    const requests = director.update(state, 5)

    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      const distance = Math.hypot(
        request.x - state.player.x,
        request.y - state.player.y,
      )
      expect(distance).toBeGreaterThanOrEqual(
        SPAWN_BALANCE.spawnRingInnerRadius,
      )
      expect(distance).toBeLessThanOrEqual(
        SPAWN_BALANCE.spawnRingOuterRadius,
      )
    }
  })

  it('spawns the updated ring thirty percent farther from the player', () => {
    expect(SPAWN_RING_DISTANCE_MULTIPLIER).toBe(1.3)
    expect(SPAWN_BALANCE.spawnRingInnerRadius).toBe(650)
    expect(SPAWN_BALANCE.spawnRingOuterRadius).toBe(845)
  })

  it('increases threat pressure as run time grows', () => {
    expect(calculateThreatPerSecond(600)).toBeGreaterThan(
      calculateThreatPerSecond(0),
    )

    const early = new SpawnDirector(new Random(1)).update(
      createState(0),
      10,
    )
    const late = new SpawnDirector(new Random(1)).update(
      createState(600),
      10,
    )
    expect(late.length).toBeGreaterThan(early.length)
  })

  it('adds smooth floor pressure to threat without requiring a hard breakpoint', () => {
    const director = new SpawnDirector(new Random(3))
    const early = director.update(
      { ...createState(0), run: { floor: 19 } },
      10,
    )
    const laterDirector = new SpawnDirector(new Random(3))
    const later = laterDirector.update(
      { ...createState(0), run: { floor: 21 } },
      10,
    )

    expect(later.length).toBeGreaterThanOrEqual(early.length)
    expect(later.length - early.length).toBeLessThan(5)
  })

  it('raises elite pressure gradually with the floor', () => {
    const probabilities: number[] = []
    const random = {
      next: () => 0,
      int: (min: number) => min,
      chance: (probability: number) => {
        probabilities.push(probability)
        return false
      },
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    const balance = {
      ...SPAWN_BALANCE,
      eliteStartTimeSeconds: 0,
    }

    new SpawnDirector(random, balance).update(
      { ...createState(0), run: { floor: 1 } },
      3,
    )
    const earlyProbability = probabilities[0]
    probabilities.length = 0
    new SpawnDirector(random, balance).update(
      { ...createState(0), run: { floor: 100 } },
      3,
    )

    expect(earlyProbability).toBeCloseTo(0.08)
    expect(probabilities[0]).toBeGreaterThan(earlyProbability ?? 0)
    expect(probabilities[0]).toBeLessThanOrEqual(1)
  })

  it('continues issuing requests when many enemies are already active', () => {
    const director = new SpawnDirector(new Random(2))

    expect(director.update(createState(0, 30), 10).length).toBeGreaterThan(0)
  })

  it('caps active enemies while keeping delayed reinforcements alive', () => {
    const director = new SpawnDirector(new Random(7))

    expect(director.update(createState(0, ACTIVE_ENEMY_CAP), 10)).toEqual([])

    const firstReinforcement = director.update(
      createState(10, ACTIVE_ENEMY_CAP - 1),
      1 / 60,
    )
    expect(firstReinforcement).toHaveLength(1)

    expect(
      director.update(createState(10, ACTIVE_ENEMY_CAP - 1), 1 / 60),
    ).toEqual([])

    expect(
      director.update(
        createState(10, ACTIVE_ENEMY_CAP - 1),
        REINFORCEMENT_INTERVAL_SECONDS,
      ),
    ).toHaveLength(1)
  })

  it('preserves the selected enemy type when entering reinforcement mode', () => {
    const cappedDirector = new SpawnDirector(new Random(8))
    const uncappedDirector = new SpawnDirector(new Random(8))

    cappedDirector.update(createState(0, ACTIVE_ENEMY_CAP), 10)
    const cappedRequest = cappedDirector.update(
      createState(0, ACTIVE_ENEMY_CAP - 1),
      1 / 60,
    )[0]
    const uncappedRequest = uncappedDirector.update(createState(0), 10)[0]

    expect(cappedRequest?.definitionId).toBe(uncappedRequest?.definitionId)
  })

  it('leaves enemy spawning unconstrained by the player arena wall', () => {
    const state = createState()
    state.player = { x: ARENA_BOUNDS.maxX - 16, y: 0 }
    const alwaysZeroRandom = {
      next: () => 0,
      int: (min: number) => min,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const requests = new SpawnDirector(alwaysZeroRandom).update(state, 1)

    expect(requests.some((request) => request.x > ARENA_BOUNDS.maxX)).toBe(true)
  })

  it('introduces every composition entry during a fixed-timestep run', () => {
    const director = new SpawnDirector(new Random(20260826))
    const state = createState()
    const firstSpawnTimes = new Map<string, number>()

    for (let step = 1; step <= 120 * 60; step += 1) {
      state.time = step / 60
      for (const request of director.update(state, 1 / 60)) {
        firstSpawnTimes.set(
          request.definitionId,
          firstSpawnTimes.get(request.definitionId) ?? state.time,
        )
      }
    }

    for (const entry of SPAWN_BALANCE.spawnEntries) {
      const firstSpawnTime = firstSpawnTimes.get(entry.definitionId)
      expect(firstSpawnTime).toBeDefined()
      const startTimeSeconds =
        'startTimeSeconds' in entry ? entry.startTimeSeconds : 0
      expect(firstSpawnTime).toBeGreaterThanOrEqual(startTimeSeconds)
    }
  })
})
