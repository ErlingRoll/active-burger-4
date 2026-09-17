import { describe, expect, it } from 'vitest'
import {
  ALL_DIVINE_GAMBA_PART_DEFINITIONS,
  DIVINE_GAMBA_MAX_BALLS,
  getDivineGambaBallPrice,
  getDivineGambaStakePrice,
  resolveDivineGambaMachine,
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
 *    below one for every loadout, so over enough balls the machine keeps
 *    Essence.
 * 2. A single play profits less than half the time. For every loadout, stake
 *    and ball count, the chance that a play pays back more than it cost is
 *    under fifty percent. A lucky play can still win big; the median play
 *    loses.
 *
 * Adding a part or a modifier adds it to every loadout below, so a new store
 * entry that breaks either rule fails this suite.
 */

const BALLS_PER_LOADOUT = 8000
const PLAYS_PER_COUNT = 4000

const PARTS = ALL_DIVINE_GAMBA_PART_DEFINITIONS.filter((definition) => definition.kind === 'part').map(({ id }) => id)
const MODIFIERS = ALL_DIVINE_GAMBA_PART_DEFINITIONS.filter((definition) => definition.kind === 'modifier').map(({ id }) => id)

interface Loadout {
  name: string
  owned: string[]
  enabled: string[]
}

const LOADOUTS: Loadout[] = [
  { name: 'bare', owned: [], enabled: [] },
  ...PARTS.map((id) => ({ name: `part ${id}`, owned: withPrerequisites([id]), enabled: [] })),
  ...MODIFIERS.map((id) => ({ name: `modifier ${id}`, owned: withPrerequisites([id]), enabled: [id] })),
  { name: 'every part', owned: PARTS, enabled: [] },
  ...MODIFIERS.map((id) => ({ name: `every part and ${id}`, owned: [...PARTS, id], enabled: [id] })),
  { name: 'everything on', owned: [...PARTS, ...MODIFIERS], enabled: MODIFIERS },
  { name: 'every part, magnet and splitter', owned: [...PARTS, 'rift-magnet', 'splitter'], enabled: ['rift-magnet', 'splitter'] },
]

function withPrerequisites(ids: string[]): string[] {
  const owned = new Set<string>()
  const add = (id: string): void => {
    const definition = ALL_DIVINE_GAMBA_PART_DEFINITIONS.find((entry) => entry.id === id)
    if (definition === undefined || owned.has(id)) {
      return
    }
    owned.add(id)
    if (definition.requiresPartId !== null) {
      add(definition.requiresPartId)
    }
  }
  ids.forEach(add)
  return [...owned]
}

interface Measurement {
  returnToPlayer: number
  boxChancePerBall: number
  epicChancePerBall: number
  /** Essence returned per paid ball, one entry per ball, for resampling plays. */
  returns: number[]
  pricePerBall: number
}

function measure(loadout: Loadout, stake: number): Measurement {
  const resolved = resolveDivineGambaMachine(loadout.owned, loadout.enabled)
  const { allowedStakes: _stakes, ...machine } = resolved
  const pricePerBall = getDivineGambaBallPrice(resolved, stake)
  const stakePrice = getDivineGambaStakePrice(stake)
  const returns: number[] = []
  let boxes = 0
  let epics = 0
  let paid = 0
  for (let seed = 1; paid < BALLS_PER_LOADOUT; seed += 1) {
    const outcome = simulatePlay({ seed: (seed * 2654435761) >>> 0, machine, ballCount: 20, stakePrice })
    // A split child's winnings belong to the paid ball it came from.
    const perPaidBall = new Array<number>(20).fill(0)
    for (const ball of outcome.balls) {
      const owner = ball.parentIndex ?? ball.ballIndex
      perPaidBall[owner] = (perPaidBall[owner] ?? 0) + ball.essenceWon
      if (ball.boxRarity !== null) {
        boxes += 1
        if (ball.boxRarity === 'epic') {
          epics += 1
        }
      }
    }
    returns.push(...perPaidBall)
    paid += 20
  }
  const total = returns.reduce((sum, value) => sum + value, 0)
  return {
    returnToPlayer: total / (paid * pricePerBall),
    boxChancePerBall: boxes / paid,
    epicChancePerBall: epics / paid,
    returns,
    pricePerBall,
  }
}

/** The chance a play of `ballCount` balls returns more than it cost, by resampling measured balls. */
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
  const measured = LOADOUTS.map((loadout) => ({ loadout, measurement: measure(loadout, 1) }))

  it('returns between 85 and 92 percent on a bare machine', () => {
    const bare = measured.find(({ loadout }) => loadout.name === 'bare')
    expect(bare?.measurement.returnToPlayer).toBeGreaterThan(0.85)
    expect(bare?.measurement.returnToPlayer).toBeLessThan(0.92)
  })

  it.each(measured.map(({ loadout, measurement }) => [loadout.name, measurement] as const))(
    'keeps the return to player below one and above seventy percent with %s',
    (_name, measurement) => {
      expect(measurement.returnToPlayer).toBeLessThan(0.94)
      expect(measurement.returnToPlayer).toBeGreaterThan(0.70)
    },
  )

  it.each(measured.map(({ loadout, measurement }) => [loadout.name, measurement] as const))(
    'profits less than half the time at every ball count with %s',
    (_name, measurement) => {
      for (let ballCount = 1; ballCount <= DIVINE_GAMBA_MAX_BALLS; ballCount += 1) {
        expect(profitChance(measurement, ballCount), `${ballCount} balls`).toBeLessThan(0.5)
      }
    },
  )

  it('keeps a bare machine rewarding a profit often enough to be worth playing', () => {
    const bare = measured.find(({ loadout }) => loadout.name === 'bare')
    expect(bare === undefined ? 0 : profitChance(bare.measurement, 1)).toBeGreaterThan(0.2)
  })

  it.each(measured.map(({ loadout, measurement }) => [loadout.name, measurement] as const))(
    'keeps boxes rare with %s',
    (_name, measurement) => {
      expect(measurement.boxChancePerBall).toBeLessThan(0.015)
      expect(measurement.epicChancePerBall).toBeLessThan(0.001)
    },
  )

  it('keeps a bare machine\'s boxes under half a percent per ball', () => {
    const bare = measured.find(({ loadout }) => loadout.name === 'bare')
    expect(bare?.measurement.boxChancePerBall).toBeLessThan(0.005)
  })

  it('scales a higher stake linearly, so the rules hold at every tier', () => {
    const loadout = { name: 'stakes', owned: ['high-stakes-2', 'high-stakes-5'], enabled: [] }
    const one = measure(loadout, 1)
    const five = measure(loadout, 5)
    expect(five.pricePerBall).toBe(one.pricePerBall * 5)
    expect(Math.abs(five.returnToPlayer - one.returnToPlayer)).toBeLessThan(0.005)
  })
})
