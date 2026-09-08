/**
 * The randomness contract shared by the simulation and its content.
 *
 * Content modules that roll values (gear modifier tiers, drop tables) need to
 * accept a random source, but they must not depend on `src/game/`. Declaring
 * the interface here keeps that dependency pointing at a shared leaf; the
 * seeded implementation stays in `src/game/random/Random.ts`.
 *
 * Simulation code must never call `Math.random()`: every run receives a seed
 * and all randomness flows through a `RandomSource` owned by the game instance
 * so that runs are reproducible.
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
