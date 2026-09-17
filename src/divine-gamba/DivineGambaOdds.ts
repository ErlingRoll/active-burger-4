import { createDivineGambaRandom, simulatePlay, type DivineGambaMachineConfig } from './sim'

/**
 * The odds the legend shows, measured the way the house-rules test measures
 * them: by running the simulation.
 *
 * There is no formula for where a physics ball lands, so the legend drops a
 * few thousand balls through the current machine and counts. That is cheap
 * enough to do once per loadout, and the counts are cached by machine, so
 * toggling a modifier back and forth costs nothing the second time.
 */
export interface DivineGambaOdds {
  /** Share of balls landing in each pocket, 0 to 1. */
  landing: number[]
  /** Essence returned per Essence staked, over many balls. */
  returnToPlayer: number
  /** Chance a single ball brings a box, 0 to 1. */
  boxChancePerBall: number
  /** Essence returned per paid ball, one entry per sampled ball. */
  returns: number[]
}

const SAMPLE_BALLS = 3000
const SAMPLE_PLAYS = 2000
const cache = new Map<string, DivineGambaOdds>()

export function measureDivineGambaOdds(machine: DivineGambaMachineConfig, stakePrice: number): DivineGambaOdds {
  const key = `${stakePrice}:${JSON.stringify(machine)}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }
  const landing = new Array<number>(machine.rows + 1).fill(0)
  const returns: number[] = []
  let boxes = 0
  let landed = 0
  let paid = 0
  for (let seed = 1; paid < SAMPLE_BALLS; seed += 1) {
    const outcome = simulatePlay({ seed: (seed * 2654435761) >>> 0, machine, ballCount: 20, stakePrice })
    const perPaidBall = new Array<number>(20).fill(0)
    for (const ball of outcome.balls) {
      landing[ball.pocketIndex] = (landing[ball.pocketIndex] ?? 0) + 1
      landed += 1
      const owner = ball.parentIndex ?? ball.ballIndex
      perPaidBall[owner] = (perPaidBall[owner] ?? 0) + ball.essenceWon
      if (ball.boxRarity !== null) {
        boxes += 1
      }
    }
    returns.push(...perPaidBall)
    paid += 20
  }
  const odds: DivineGambaOdds = {
    landing: landing.map((count) => count / landed),
    returnToPlayer: returns.reduce((sum, value) => sum + value, 0) / (paid * stakePrice),
    boxChancePerBall: boxes / paid,
    returns,
  }
  cache.set(key, odds)
  return odds
}

/** The chance a play of `ballCount` balls at `pricePerBall` returns more than it cost. */
export function measureProfitChance(odds: DivineGambaOdds, ballCount: number, pricePerBall: number): number {
  const random = createDivineGambaRandom(ballCount * 977 + 1)
  let profitable = 0
  for (let play = 0; play < SAMPLE_PLAYS; play += 1) {
    let returned = 0
    for (let ball = 0; ball < ballCount; ball += 1) {
      returned += odds.returns[random.nextUint() % odds.returns.length] ?? 0
    }
    if (returned > ballCount * pricePerBall) {
      profitable += 1
    }
  }
  return profitable / SAMPLE_PLAYS
}
