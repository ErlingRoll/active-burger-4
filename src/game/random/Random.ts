/**
 * Deterministic seeded random number source for simulation systems.
 *
 * Simulation code must never call `Math.random()` (PLAN.md section 96);
 * every run receives a seed and all randomness flows through a
 * `RandomSource` owned by the game instance so runs are reproducible.
 */
export interface RandomSource {
  /** Returns a float in the range [0, 1). */
  next(): number
  /** Returns an integer in the inclusive range [min, max]. */
  int(min: number, max: number): number
  /** Returns true with the given probability (0-1). */
  chance(probability: number): boolean
  /** Returns a uniformly random element from a non-empty array. */
  pick<T>(items: readonly T[]): T
}

/**
 * mulberry32: a small, fast, deterministic 32-bit PRNG. It is not
 * cryptographically secure, which is fine for gameplay simulation, but it
 * does produce a stable, well-distributed sequence for a given seed.
 */
function createMulberry32(seed: number): () => number {
  let state = seed >>> 0

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Random implements RandomSource {
  private readonly nextRaw: () => number

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
}
