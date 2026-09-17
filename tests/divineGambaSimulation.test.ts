import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DIVINE_GAMBA_MACHINE, getDivineGambaStakePrice } from '../src/divine-gamba/DivineGambaRegistry'
import { buildMachine, pocketCentreX } from '../src/divine-gamba/sim/machine.ts'
import { createDivineGambaRandom } from '../src/divine-gamba/sim/random.ts'
import { BOX_RARITIES, pocketPayout, rollBox } from '../src/divine-gamba/sim/rewards.ts'
import { MAX_BALLS_PER_PLAY, SIM_VERSION, simulatePlay, TICKS_PER_SECOND } from '../src/divine-gamba/sim/simulate.ts'
import type { DivineGambaPlayOutcome } from '../src/divine-gamba/sim/types.ts'

interface PlayFixture {
  name: string
  seed: number
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

const machine = DIVINE_GAMBA_MACHINE

describe('the Divine Gamba simulation', () => {
  it('lands the same balls in the same pockets on the same ticks when run twice', () => {
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
      expect(getDivineGambaStakePrice(fixture.stake)).toBe(fixture.stakePrice)
      expect(fixture.pricePerBall).toBe(fixture.stakePrice)
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

  it('pins a drop in which a box falls', () => {
    expect(fixtures.some((fixture) => fixture.expected.boxCount > 0)).toBe(true)
  })

  it('drops every ball into a pocket within the tick cap for many seeds', () => {
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

  it('refuses a ball count outside one to twenty', () => {
    expect(() => simulatePlay({ seed: 1, machine, ballCount: 0, stakePrice: 20 })).toThrow()
    expect(() => simulatePlay({ seed: 1, machine, ballCount: MAX_BALLS_PER_PLAY + 1, stakePrice: 20 })).toThrow()
    expect(() => simulatePlay({ seed: 1, machine, ballCount: 1.5, stakePrice: 20 })).toThrow()
  })
})

describe('the rewards', () => {
  it('floors a payout to whole Essence from the pocket table', () => {
    // 20 × 600 / 100 = 120; 20 × 25 / 100 = 5; 30 × 25 / 100 = 7.5 → 7.
    expect(pocketPayout(machine, 0, 20)).toBe(120)
    expect(pocketPayout(machine, 4, 20)).toBe(5)
    expect(pocketPayout(machine, 4, 30)).toBe(7)
    expect(pocketPayout(machine, 99, 20)).toBe(0)
  })

  it('rolls only the rarities the weights name, and none the roll does not know', () => {
    const boxes = {
      ...machine,
      boxRarityWeights: { common: 0, uncommon: 0, rare: 0, epic: 1, legendary: 1000, mythic: 100000 },
      pockets: machine.pockets.map(() => ({ multiplierPercent: 100, boxChanceBasisPoints: 10000 })),
    }
    const random = createDivineGambaRandom(7)
    const seen = new Set<string | null>()
    for (let roll = 0; roll < 500; roll += 1) {
      seen.add(rollBox(boxes, 3, random))
    }
    expect([...seen].every((rarity) => rarity !== null && (BOX_RARITIES as readonly string[]).includes(rarity))).toBe(true)
    expect(seen.has('mythic')).toBe(false)
    expect(seen.has('legendary')).toBe(true)
  })

  it('never drops a box from a pocket with no chance of one', () => {
    const random = createDivineGambaRandom(11)
    for (let roll = 0; roll < 200; roll += 1) {
      expect(rollBox(machine, 4, random)).toBeNull()
    }
  })
})
