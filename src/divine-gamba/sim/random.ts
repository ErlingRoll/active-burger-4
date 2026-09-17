/**
 * xorshift32, the simulation's only source of randomness.
 *
 * Copied rather than imported from `src/game/random` because this module is
 * shared with the Edge Function bundle, which cannot reach the game. Every
 * decision the simulation makes compares an integer from this stream, so the
 * browser and the server draw the same numbers in the same order.
 */
export interface DivineGambaRandom {
  /** The next unsigned 32-bit integer. */
  nextUint(): number
  /** A float in [0, 1) with 32 bits of precision, from one draw. */
  nextUnit(): number
  /** An integer in [0, 10000), from one draw. */
  nextBasisPoints(): number
}

const ZERO_SEED_REPLACEMENT = 2654435769

export function createDivineGambaRandom(seed: number): DivineGambaRandom {
  let state = (seed >>> 0) === 0 ? ZERO_SEED_REPLACEMENT : seed >>> 0
  const nextUint = (): number => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state
  }
  return {
    nextUint,
    nextUnit: () => nextUint() / 4294967296,
    nextBasisPoints: () => nextUint() % 10000,
  }
}

/** The stream one ball draws from, derived from the play seed and the ball's index. */
export function ballSeed(playSeed: number, ballIndex: number): number {
  return (Math.imul(playSeed ^ Math.imul(ballIndex + 1, 0x9e3779b9), 0x85ebca6b) ^ (playSeed >>> 16)) >>> 0
}
