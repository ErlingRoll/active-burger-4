/**
 * Offline accrual, as a pure function of the clock.
 *
 * Production is computed on claim from the elapsed interval rather than by a
 * ticking job, so there is no server-side timer per player, and the arithmetic
 * is the same whether the client is previewing what is pending or the server
 * is paying it out. `camp_accrue` in the migrations is the SQL twin; the
 * migration asserts a fixture set against it and this module's tests pin the
 * three properties that make claiming safe:
 *
 * - Claiming twice in a row pays nothing the second time.
 * - Claiming at two points pays the same total as claiming once at the second
 *   point, because the unpaid fraction of a unit carries forward.
 * - Past the cap, waiting longer pays nothing more, and nothing is lost.
 *
 * The clock is always the server's. `accruedFrom` is the moment from which
 * unclaimed production is measured, and it advances only by the time a claim
 * actually paid for. Both instants are milliseconds since the epoch, the way
 * `Date.parse` and `Date.now` hand them over.
 */

export interface CampAccrualInput {
  /** Units per hour: the job's base rate, the building's multiplier and the sheet's output. */
  ratePerHour: number
  /** Hours of production that can be pending at once: the lesser of the sheet's stamina and the Storehouse cap. */
  capHours: number
  /** When the unclaimed interval starts, in milliseconds since the epoch. */
  accruedFromMs: number
  /** The server's now, in milliseconds since the epoch. */
  nowMs: number
}

export interface CampAccrualResult {
  /** Whole units this claim pays. */
  units: number
  /** The elapsed time that counted, after the cap, in seconds. */
  countedSeconds: number
  /** Where the clock moves to: now, less the fraction of a unit not yet paid. */
  accruedFromMs: number
}

/**
 * A hair above zero, added before flooring so that a product such as
 * 4 × 2700 ÷ 3600 lands on the integer it is mathematically equal to rather
 * than a double one bit below it. The SQL twin works in exact numerics and
 * needs no such thing.
 */
const FLOOR_EPSILON = 1e-9

export function accrueCampProduction(input: CampAccrualInput): CampAccrualResult {
  const ratePerHour = Number.isFinite(input.ratePerHour) ? Math.max(0, input.ratePerHour) : 0
  const capSeconds = Math.max(0, input.capHours) * 3600
  const elapsedSeconds = Math.max(0, (input.nowMs - input.accruedFromMs) / 1000)
  const countedSeconds = Math.min(elapsedSeconds, capSeconds)

  if (ratePerHour === 0) {
    return { units: 0, countedSeconds, accruedFromMs: input.nowMs }
  }

  const units = Math.floor((ratePerHour * countedSeconds) / 3600 + FLOOR_EPSILON)
  const paidSeconds = (units * 3600) / ratePerHour
  const unpaidSeconds = Math.max(0, countedSeconds - paidSeconds)

  return {
    units,
    countedSeconds,
    accruedFromMs: Math.round(input.nowMs - unpaidSeconds * 1000),
  }
}

/**
 * What is pending without moving the clock: the same arithmetic, for a panel
 * counting up from the server's time.
 */
export function previewCampProduction(input: CampAccrualInput): number {
  return accrueCampProduction(input).units
}

/** The rate a job pays one Champion at, before the clock is consulted. */
export function campRatePerHour(
  baseRatePerHour: number,
  buildingRateMultiplier: number,
  sheetOutput: number,
): number {
  return baseRatePerHour * buildingRateMultiplier * sheetOutput
}
