import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getDivineGambaBallPrice,
  getDivineGambaStakePrice,
  resolveDivineGambaMachine,
} from '../src/divine-gamba/DivineGambaRegistry'
import { buildMachine, pocketCentreX } from '../src/divine-gamba/sim/machine.ts'
import { createDivineGambaRandom } from '../src/divine-gamba/sim/random.ts'
import { BOX_RARITIES, pocketPayout, rollBox } from '../src/divine-gamba/sim/rewards.ts'
import { MAX_BALLS_PER_PLAY, SIM_VERSION, simulatePlay, TICKS_PER_SECOND } from '../src/divine-gamba/sim/simulate.ts'
import type { DivineGambaMachineConfig, DivineGambaPlayOutcome } from '../src/divine-gamba/sim/types.ts'

interface PlayFixture {
  name: string
  seed: number
  ownedPartIds: string[]
  enabledModifierIds: string[]
  stake: number
  ballCount: number
  stakePrice: number
  pricePerBall: number
  expected: DivineGambaPlayOutcome
}

const fixtures = JSON.parse(readFileSync(
  path.resolve(import.meta.dirname, 'fixtures/divineGambaPlays.json'),
  'utf8',
)) as PlayFixture[]

function bareMachine(): DivineGambaMachineConfig {
  const { allowedStakes: _stakes, ...machine } = resolveDivineGambaMachine([], [])
  return machine
}

describe('the Divine Gamba simulation', () => {
  it('lands the same balls in the same pockets on the same ticks when run twice', () => {
    const machine = bareMachine()
    const first = simulatePlay({ seed: 42, machine, ballCount: 20, stakePrice: 20, recordFrames: true })
    const second = simulatePlay({ seed: 42, machine, ballCount: 20, stakePrice: 20 })
    expect(second.balls.map(({ frames: _frames, hits: _hits, ...ball }) => ball))
      .toEqual(first.balls.map(({ frames: _frames, hits: _hits, ...ball }) => ball))
    expect(first.balls.every((ball) => ball.frames !== undefined && ball.frames.length === ball.landedTick * 2)).toBe(true)
    expect(first.balls.every((ball) => ball.hits !== undefined && ball.hits.length > 0 && ball.hits.every((hit) => hit < ball.landedTick))).toBe(true)
    expect(second.balls.every((ball) => ball.frames === undefined && ball.hits === undefined)).toBe(true)
  })

  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
    'reproduces the golden fixture %s',
    (_name, fixture) => {
      const resolved = resolveDivineGambaMachine(fixture.ownedPartIds, fixture.enabledModifierIds)
      const { allowedStakes: _stakes, ...machine } = resolved
      expect(getDivineGambaBallPrice(resolved, fixture.stake)).toBe(fixture.pricePerBall)
      expect(getDivineGambaStakePrice(fixture.stake)).toBe(fixture.stakePrice)
      expect(simulatePlay({
        seed: fixture.seed,
        machine,
        ballCount: fixture.ballCount,
        stakePrice: fixture.stakePrice,
      })).toEqual(fixture.expected)
    },
  )

  it('carries the version it was generated under', () => {
    for (const fixture of fixtures) {
      expect(fixture.expected.simVersion, fixture.name).toBe(SIM_VERSION)
    }
  })

  it('drops every ball into a pocket within the tick cap for many seeds', () => {
    const machine = bareMachine()
    for (let seed = 1; seed <= 200; seed += 1) {
      const outcome = simulatePlay({ seed: seed * 7919, machine, ballCount: 20, stakePrice: 20 })
      expect(outcome.balls).toHaveLength(20)
      for (const ball of outcome.balls) {
        expect(ball.pocketIndex).toBeGreaterThanOrEqual(0)
        expect(ball.pocketIndex).toBeLessThanOrEqual(machine.rows)
        expect(ball.landedTick).toBeLessThan(TICKS_PER_SECOND * 8)
      }
    }
  })

  it('ends a recorded drop above the pocket it is credited with', () => {
    const machine = bareMachine()
    const built = buildMachine(machine)
    const outcome = simulatePlay({ seed: 99, machine, ballCount: 20, stakePrice: 20, recordFrames: true })
    for (const ball of outcome.balls) {
      const frames = ball.frames ?? []
      const lastX = frames[frames.length - 2] ?? Number.NaN
      const halfPitch = 0.5 + built.ballRadius
      expect(Math.abs(lastX - pocketCentreX(machine.rows, ball.pocketIndex))).toBeLessThanOrEqual(halfPitch + 0.15)
    }
  })

  it('sums the payouts of its balls and counts its boxes', () => {
    for (const fixture of fixtures) {
      const balls = fixture.expected.balls
      expect(balls.reduce((total, ball) => total + ball.essenceWon, 0), fixture.name).toBe(fixture.expected.essenceWon)
      expect(balls.filter((ball) => ball.boxRarity !== null).length, fixture.name).toBe(fixture.expected.boxCount)
    }
  })

  it('lets a splitter add balls after the paid ones, each naming its parent', () => {
    const split = fixtures.find((fixture) => fixture.name === 'splitter-splits')
    expect(split).toBeDefined()
    const balls = split?.expected.balls ?? []
    const children = balls.filter((ball) => ball.parentIndex !== null)
    expect(children.length).toBeGreaterThan(0)
    expect(balls.slice(0, split?.ballCount).every((ball) => ball.parentIndex === null)).toBe(true)
    for (const child of children) {
      expect(child.ballIndex).toBeGreaterThanOrEqual(split?.ballCount ?? 0)
      expect(child.parentIndex).toBeLessThan(split?.ballCount ?? 0)
    }
  })

  it('refuses a ball count outside one to twenty', () => {
    const machine = bareMachine()
    expect(() => simulatePlay({ seed: 1, machine, ballCount: 0, stakePrice: 20 })).toThrow()
    expect(() => simulatePlay({ seed: 1, machine, ballCount: MAX_BALLS_PER_PLAY + 1, stakePrice: 20 })).toThrow()
    expect(() => simulatePlay({ seed: 1, machine, ballCount: 1.5, stakePrice: 20 })).toThrow()
  })
})

describe('the rewards', () => {
  it('floors a payout to whole Essence from the pocket table and the scale', () => {
    const machine = { ...bareMachine(), multiplierScalePercent: 105 }
    // 20 × 1000 × 105 / 10000 = 210; 20 × 30 × 105 / 10000 = 6.3 → 6.
    expect(pocketPayout(machine, 0, 20)).toBe(210)
    expect(pocketPayout(machine, 4, 20)).toBe(6)
    expect(pocketPayout(machine, 99, 20)).toBe(0)
  })

  it('rolls only the rarities the weights name, and none the roll does not know', () => {
    const machine = {
      ...bareMachine(),
      boxRarityWeights: { common: 0, uncommon: 0, rare: 0, epic: 1, legendary: 1000, mythic: 100000 },
      pockets: bareMachine().pockets.map(() => ({ multiplierPercent: 100, boxChanceBasisPoints: 10000 })),
    }
    const random = createDivineGambaRandom(7)
    const drawn = new Set<string>()
    for (let draw = 0; draw < 400; draw += 1) {
      const rarity = rollBox(machine, 0, random)
      expect(rarity).not.toBeNull()
      expect(BOX_RARITIES).toContain(rarity)
      drawn.add(rarity ?? '')
    }
    expect(drawn.has('legendary')).toBe(true)
    expect(drawn.has('mythic')).toBe(false)
  })

  it('draws for a box once per ball whether or not the pocket can hold one', () => {
    const machine = bareMachine()
    const withRoll = createDivineGambaRandom(5)
    const control = createDivineGambaRandom(5)
    expect(rollBox(machine, 4, withRoll)).toBeNull()
    control.nextBasisPoints()
    expect(withRoll.nextUint()).toBe(control.nextUint())
  })
})
