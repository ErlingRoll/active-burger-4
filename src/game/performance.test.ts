import { describe, expect, it } from 'vitest'
import {
  createGame,
  FIXED_STEP_SECONDS,
} from './Game'

interface PerformanceSample {
  enemyCount: number
  meanMs: number
  p95Ms: number
  maxMs: number
}

const MEASURED_TICKS = 60
const WARMUP_TICKS = 10

function spawnEnemies(game: ReturnType<typeof createGame>, enemyCount: number): void {
  for (let spawned = 0; spawned < enemyCount; spawned += 100) {
    game.spawnDebugEnemies(100)
  }
}

function measureSimulation(enemyCount: number): PerformanceSample {
  const game = createGame({
    seed: 20_260_905 + enemyCount,
    freeMovementEnabled: false,
  })
  spawnEnemies(game, enemyCount)
  // Disable player attacks so enemy density, not combat outcome, determines the sample.
  game.state.player.skills = []

  for (let tick = 0; tick < WARMUP_TICKS; tick += 1) {
    game.update(FIXED_STEP_SECONDS)
  }

  const samples: number[] = []
  for (let tick = 0; tick < MEASURED_TICKS; tick += 1) {
    const start = performance.now()
    game.update(FIXED_STEP_SECONDS)
    samples.push(performance.now() - start)
  }

  const sortedSamples = [...samples].sort((left, right) => left - right)
  const meanMs = samples.reduce((total, sample) => total + sample, 0) / samples.length
  const p95Ms = sortedSamples[Math.floor(sortedSamples.length * 0.95)] ?? 0
  const maxMs = sortedSamples.at(-1) ?? 0
  return {
    enemyCount,
    meanMs,
    p95Ms,
    maxMs,
  }
}

describe('enemy-density performance', () => {
  it('reports fixed-step simulation cost at 100, 200, and 500 enemies', () => {
    const samples = [100, 200, 500].map(measureSimulation)
    console.info(`enemy-density-performance ${JSON.stringify(samples)}`)

    expect(samples).toHaveLength(3)
    expect(samples.every((sample) =>
      Number.isFinite(sample.meanMs) &&
      Number.isFinite(sample.p95Ms) &&
      Number.isFinite(sample.maxMs),
    )).toBe(true)
    expect(samples.every((sample) => sample.meanMs >= 0)).toBe(true)
    expect(samples.find((sample) => sample.enemyCount === 200)?.p95Ms ?? Infinity)
      .toBeLessThan(64)
    expect(samples.find((sample) => sample.enemyCount === 500)?.meanMs ?? Infinity)
      .toBeLessThan(64)
  })
})
