import { describe, expect, it } from 'vitest'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import { Random } from '../random/Random'
import {
  calculateThreatPerSecond,
  SpawnDirector,
  type SpawnDirectorState,
} from './SpawnDirector'

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

  it('increases threat pressure as run time grows', () => {
    expect(calculateThreatPerSecond(600)).toBeGreaterThan(
      calculateThreatPerSecond(0),
    )

    const balance = { ...SPAWN_BALANCE, maxActiveEnemies: 100 }
    const early = new SpawnDirector(new Random(1), balance).update(
      createState(0),
      10,
    )
    const late = new SpawnDirector(new Random(1), balance).update(
      createState(600),
      10,
    )
    expect(late.length).toBeGreaterThan(early.length)
  })

  it('does not issue requests once the active enemy cap is full', () => {
    const director = new SpawnDirector(new Random(2))

    expect(
      director.update(createState(0, SPAWN_BALANCE.maxActiveEnemies), 10),
    ).toHaveLength(0)
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
