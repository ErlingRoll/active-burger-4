/**
 * Deterministic seeded implementation of the shared `RandomSource` contract.
 *
 * Simulation code must never call `Math.random()`; every run receives a seed
 * and all randomness flows through a `RandomSource` owned by the game instance
 * so runs are reproducible.
 */
import type { RandomSource } from '../../shared/RandomSource'
export type { RandomSource } from '../../shared/RandomSource'

/**
 * mulberry32: a small, fast, deterministic 32-bit PRNG. It is not
 * cryptographically secure, which is fine for gameplay simulation, but it
 * does produce a stable, well-distributed sequence for a given seed.
 */
interface Mulberry32 {
  (): number
  getState(): number
  setState(value: number): void
}

function createMulberry32(seed: number): Mulberry32 {
  let state = seed >>> 0

  const next = function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  } as Mulberry32

  next.getState = () => state
  next.setState = (value: number) => { state = value >>> 0 }

  return next
}

export class Random implements RandomSource {
  private readonly nextRaw: Mulberry32

  constructor(seed: number) {
    this.nextRaw = createMulberry32(seed)
  }

  next(): number {
    return this.nextRaw()
  }

  int(min: number, max: number): number {
    if (max < min) {
      throw new Error(`Random.int: max (${max}) must be >= min (${min}).`)
    }

    const range = max - min + 1
    return min + Math.floor(this.next() * range)
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Random.pick: items must not be empty.')
    }

    return items[this.int(0, items.length - 1)] as T
  }

  /** Returns the internal PRNG state for checkpoint serialization. */
  getInternalState(): number {
    return this.nextRaw.getState()
  }

  /** Restores the internal PRNG state from a checkpoint. */
  setInternalState(value: number): void {
    this.nextRaw.setState(value)
  }
}
