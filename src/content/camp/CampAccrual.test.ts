import { describe, expect, it } from 'vitest'
import {
  accrueCampProduction,
  campRatePerHour,
  previewCampProduction,
  type CampAccrualInput,
} from './CampAccrual'

/**
 * The three properties that make claiming safe, plus the edges of the clock.
 * The exact figures for a set of clocks are pinned by
 * tests/campRegistry.test.ts, which holds this twin and the SQL one to the
 * same fixtures.
 */

const HOUR_MS = 3_600_000
const START = Date.parse('2026-09-11T00:00:00Z')

function at(hours: number, overrides: Partial<CampAccrualInput> = {}): CampAccrualInput {
  return {
    ratePerHour: 4,
    capHours: 8,
    accruedFromMs: START,
    nowMs: START + hours * HOUR_MS,
    ...overrides,
  }
}

describe('accrueCampProduction', () => {
  it('pays whole units for the elapsed hours', () => {
    expect(accrueCampProduction(at(2.75))).toMatchObject({ units: 11, accruedFromMs: START + 2.75 * HOUR_MS })
  })

  it('pays nothing the second time when claimed twice in a row', () => {
    const first = accrueCampProduction(at(3))
    const second = accrueCampProduction(at(3, { accruedFromMs: first.accruedFromMs }))
    expect(first.units).toBe(12)
    expect(second.units).toBe(0)
    expect(second.accruedFromMs).toBe(first.accruedFromMs)
  })

  it('pays the same total at two points as at the second point alone', () => {
    for (const [firstHours, secondHours] of [[1.1, 2.9], [0.3, 0.9], [2.66, 7.99], [0.125, 0.126]]) {
      const once = accrueCampProduction(at(secondHours ?? 0))
      const first = accrueCampProduction(at(firstHours ?? 0))
      const second = accrueCampProduction(at(secondHours ?? 0, { accruedFromMs: first.accruedFromMs }))
      expect(first.units + second.units, `${firstHours} then ${secondHours}`).toBe(once.units)
    }
  })

  it('carries the unpaid fraction of a unit forward on the clock', () => {
    const result = accrueCampProduction(at(2 + 40 / 60))
    expect(result.units).toBe(10)
    expect(result.accruedFromMs).toBe(START + 2.5 * HOUR_MS)
  })

  it('pays no more past the cap, and loses nothing', () => {
    const atCap = accrueCampProduction(at(8))
    const wellPast = accrueCampProduction(at(20))
    expect(wellPast.units).toBe(atCap.units)
    expect(wellPast.units).toBe(32)
    expect(wellPast.countedSeconds).toBe(8 * 3600)
    // The clock moves to now, so the next interval starts fresh rather than
    // still owing the hours the cap refused to count.
    expect(wellPast.accruedFromMs).toBe(START + 20 * HOUR_MS)
  })

  it('does not pay for time that has not passed', () => {
    const result = accrueCampProduction(at(-1))
    expect(result).toEqual({ units: 0, countedSeconds: 0, accruedFromMs: START - HOUR_MS })
  })

  it('pays nothing at a rate of zero and moves the clock on', () => {
    expect(accrueCampProduction(at(5, { ratePerHour: 0 }))).toEqual({
      units: 0, countedSeconds: 5 * 3600, accruedFromMs: START + 5 * HOUR_MS,
    })
  })

  it('lands on the integer a product is equal to rather than a double below it', () => {
    expect(accrueCampProduction(at(0.75, { ratePerHour: 4 })).units).toBe(3)
    expect(accrueCampProduction(at(1, { ratePerHour: 6.6 })).units).toBe(6)
  })
})

describe('previewCampProduction', () => {
  it('reports what a claim would pay without moving anything', () => {
    expect(previewCampProduction(at(2.75))).toBe(11)
  })
})

describe('campRatePerHour', () => {
  it('multiplies the job, the building and the sheet', () => {
    expect(campRatePerHour(4, 1.5, 1.1)).toBeCloseTo(6.6)
  })
})
