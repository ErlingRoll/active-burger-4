import { describe, expect, it } from 'vitest'
import {
  DIVINE_GAMBA_MACHINE,
  DIVINE_GAMBA_MAX_BALLS,
  DIVINE_GAMBA_STAKES,
  getDivineGambaStakePrice,
} from '../src/divine-gamba/DivineGambaRegistry'
import { createDivineGambaRandom, simulatePlay } from '../src/divine-gamba/sim'

/**
 * The house rules of the Divine Gamba.
 *
 * Two things are promised about the machine, and both are properties of the
 * physics and the pocket table together, so neither can be read off a
 * formula. They are measured here by running the simulation:
 *
 * 1. The law of large numbers favours the house. The return to player is
 *    below one, so over enough balls the machine keeps Essence.
 * 2. A drop profits a little under half the time. For a drop of three balls
 *    or more the chance that it pays back more than it cost is between forty
 *    and fifty percent, and it is under fifty percent at every ball count.
 *    A lucky drop can still win big; the median drop loses, by a little.
 *
 * The two pull against each other: the profit chance is carried by the
 * pockets just inside the winners paying nearly the ball back, and the
 * jackpot is kept small so that paying them does not push the return over
 * one. A pocket table that breaks either rule fails here.
 */

const BALLS = 8000
const PLAYS_PER_COUNT = 4000
const DEFAULT_BALL_COUNT = 5

interface Measurement {
  returnToPlayer: number
  boxChancePerBall: number
  epicChancePerBall: number
  legendaryChancePerBall: number
  /** Essence returned per ball, one entry per ball, for resampling plays. */
  returns: number[]
  pricePerBall: number
}

function measure(stake: number): Measurement {
  const pricePerBall = getDivineGambaStakePrice(stake)
  const returns: number[] = []
  let boxes = 0
  let epics = 0
  let legendaries = 0
  for (let seed = 1; returns.length < BALLS; seed += 1) {
    const outcome = simulatePlay({ seed: (seed * 2654435761) >>> 0, machine: DIVINE_GAMBA_MACHINE, ballCount: 20, stakePrice: pricePerBall })
    for (const ball of outcome.balls) {
      returns.push(ball.essenceWon)
      if (ball.boxRarity !== null) {
        boxes += 1
        if (ball.boxRarity === 'epic') {
          epics += 1
        } else if (ball.boxRarity === 'legendary') {
          legendaries += 1
        }
      }
    }
  }
  const total = returns.reduce((sum, value) => sum + value, 0)
  return {
    returnToPlayer: total / (returns.length * pricePerBall),
    boxChancePerBall: boxes / returns.length,
    epicChancePerBall: epics / returns.length,
    legendaryChancePerBall: legendaries / returns.length,
    returns,
    pricePerBall,
  }
}

/** The chance a drop of `ballCount` balls returns more than it cost, by resampling measured balls. */
function profitChance(measurement: Measurement, ballCount: number): number {
  const random = createDivineGambaRandom(ballCount * 977 + 1)
  let profitable = 0
  for (let play = 0; play < PLAYS_PER_COUNT; play += 1) {
    let returned = 0
    for (let ball = 0; ball < ballCount; ball += 1) {
      returned += measurement.returns[random.nextUint() % measurement.returns.length] ?? 0
    }
    if (returned > ballCount * measurement.pricePerBall) {
      profitable += 1
    }
  }
  return profitable / PLAYS_PER_COUNT
}

describe('the house rules', () => {
  const base = measure(1)

  it('returns between 95 and 100 percent over many balls', () => {
    expect(base.returnToPlayer).toBeGreaterThan(0.95)
    expect(base.returnToPlayer).toBeLessThan(1)
  })

  it('profits less than half the time at every ball count', () => {
    for (let ballCount = 1; ballCount <= DIVINE_GAMBA_MAX_BALLS; ballCount += 1) {
      expect(profitChance(base, ballCount), `${ballCount} balls`).toBeLessThan(0.5)
    }
  })

  it('profits a little under half the time for a drop of three balls or more', () => {
    for (let ballCount = 3; ballCount <= DIVINE_GAMBA_MAX_BALLS; ballCount += 1) {
      expect(profitChance(base, ballCount), `${ballCount} balls`).toBeGreaterThan(0.38)
    }
    expect(profitChance(base, DEFAULT_BALL_COUNT)).toBeGreaterThan(0.4)
  })

  it('rewards a single ball often enough to be worth dropping', () => {
    expect(profitChance(base, 1)).toBeGreaterThan(0.2)
  })

  it('keeps boxes to about one ball in a hundred, and the rare ones rarer', () => {
    // A jackpot always carries a box, so boxes are as rare as jackpots.
    expect(base.boxChancePerBall).toBeLessThan(0.015)
    expect(base.epicChancePerBall).toBeLessThan(0.003)
    expect(base.legendaryChancePerBall).toBeLessThan(0.0002)
  })

  it('scales a higher stake linearly, so the rules hold at every tier', () => {
    for (const stake of DIVINE_GAMBA_STAKES) {
      const tier = measure(stake)
      expect(tier.pricePerBall).toBe(base.pricePerBall * stake)
      expect(Math.abs(tier.returnToPlayer - base.returnToPlayer)).toBeLessThan(0.005)
    }
  })
})
