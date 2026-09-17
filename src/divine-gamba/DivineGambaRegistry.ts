import type { DivineGambaMachineConfig, DivineGambaPocket } from './sim/types.ts'

/**
 * The Divine Gamba as content: one machine, the same for every player.
 *
 * Every value here is mirrored in the migrations, and
 * tests/divineGambaRegistry.test.ts holds the two together: the seed rows
 * are parsed out of the migrations and compared with these tables.
 *
 * The numbers were tuned against the simulation, not against a formula. The
 * two house rules that hold them, that the return to player is below one and
 * that a drop profits a little under half the time, are asserted by
 * tests/divineGambaOdds.test.ts.
 */

export const DIVINE_GAMBA_BASE_BALL_PRICE = 20

/** The stakes a ball can be bought at: the base price times one of these. */
export const DIVINE_GAMBA_STAKES: readonly number[] = [1, 2, 5]

/**
 * Relative weights by rarity, in tenths of a percent: a legendary box is one
 * in a thousand, and the rest share the other 999.
 */
export const DIVINE_GAMBA_BOX_RARITY_WEIGHTS: Readonly<Record<string, number>> = {
  common: 550,
  uncommon: 300,
  rare: 120,
  epic: 29,
  legendary: 1,
}

export const DIVINE_GAMBA_ROWS = 8

/**
 * The pocket table, one entry per gap under the last row of pegs.
 *
 * The three outer pockets on each side pay above the ball and the two
 * inner ones pay a fraction, with the middle paying least. A single ball
 * profits under three times in ten; a drop of several balls, because the
 * pocket just inside the winners pays nearly the ball back, a little under
 * half the time. The outermost two always carry a box as well as their
 * payout; a ball that reaches one is the rarest thing the machine does.
 */
export const DIVINE_GAMBA_POCKETS: readonly DivineGambaPocket[] = [
  { multiplierPercent: 600, boxChanceBasisPoints: 10000 },
  { multiplierPercent: 200, boxChanceBasisPoints: 0 },
  { multiplierPercent: 160, boxChanceBasisPoints: 0 },
  { multiplierPercent: 90, boxChanceBasisPoints: 0 },
  { multiplierPercent: 25, boxChanceBasisPoints: 0 },
  { multiplierPercent: 90, boxChanceBasisPoints: 0 },
  { multiplierPercent: 160, boxChanceBasisPoints: 0 },
  { multiplierPercent: 200, boxChanceBasisPoints: 0 },
  { multiplierPercent: 600, boxChanceBasisPoints: 10000 },
]

/** The machine the simulation runs. The server builds the same one from its settings. */
export const DIVINE_GAMBA_MACHINE: DivineGambaMachineConfig = {
  rows: DIVINE_GAMBA_ROWS,
  pockets: DIVINE_GAMBA_POCKETS.map((pocket) => ({ ...pocket })),
  boxRarityWeights: { ...DIVINE_GAMBA_BOX_RARITY_WEIGHTS },
}

/** Whether a pocket is one of the two at the edges, which pay most and always drop a box. */
export function isDivineGambaJackpot(machine: DivineGambaMachineConfig, pocketIndex: number): boolean {
  return pocketIndex === 0 || pocketIndex === machine.pockets.length - 1
}

/** What a ball costs, and the Essence the pockets pay against: the base price times the stake. */
export function getDivineGambaStakePrice(stake: number): number {
  return DIVINE_GAMBA_BASE_BALL_PRICE * stake
}

export const DIVINE_GAMBA_MAX_BALLS = 20
