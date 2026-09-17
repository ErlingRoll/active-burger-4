/**
 * The shapes the Divine Gamba simulation reads and writes.
 *
 * This module is shared verbatim with the Edge Function that settles a play
 * (see scripts/sync-divine-gamba-sim.mjs), so it may import nothing from the
 * rest of the application and must stay plain data.
 */

/** A pocket at the foot of the board: what it pays, and whether it can hold a box. */
export interface DivineGambaPocket {
  /** Payout as a percentage of the ball price. 100 is the stake back. */
  multiplierPercent: number
  /** Chance a ball landing here also brings a loot box, in basis points. */
  boxChanceBasisPoints: number
}

/**
 * A physics effect an installed part or an enabled modifier adds to the board.
 *
 * Interpreted by `buildMachine`; the server stores the list on the play and
 * the client reads it back, so an effect is data, never code.
 */
export type DivineGambaEffect =
  | {
    kind: 'scatter'
    /** An outward nudge on every peg hit, as a share of the reference, in basis points. */
    strengthBasisPoints: number
  }
  | {
    kind: 'gravity'
    /** Scales the pull on every ball. 100 is the board as built. */
    percent: number
  }
  | {
    kind: 'jitter'
    /** Scales the random nudge a peg hit gives. 100 is the board as built. */
    percent: number
  }
  | {
    kind: 'split'
    /** Chance, in basis points, that a ball becomes two as it passes `row`. */
    chanceBasisPoints: number
    row: number
  }

/**
 * Everything the simulation needs to know about one player's machine.
 *
 * Resolved by the server from the installed parts and the enabled modifiers
 * when a play begins, stored on the play, and returned to the client so that
 * both sides simulate the same board.
 */
export interface DivineGambaMachineConfig {
  /** Peg rows. The board has `rows + 1` pockets. */
  rows: number
  pockets: DivineGambaPocket[]
  /** Scales every pocket's multiplier. 100 leaves the table as written. */
  multiplierScalePercent: number
  /** Scales every pocket's box chance. 100 leaves the table as written. */
  boxChanceScalePercent: number
  /** Relative weights by rarity name. Never names a rarity above epic. */
  boxRarityWeights: Record<string, number>
  /** The ball price as a percentage of the base price after modifier surcharges. */
  pricePercent: number
  effects: DivineGambaEffect[]
}

export interface DivineGambaPlayInput {
  /** The server's seed for this play, an unsigned 32-bit integer. */
  seed: number
  machine: DivineGambaMachineConfig
  /** Balls the player paid for, 1 to 20. A split can add more. */
  ballCount: number
  /**
   * The Essence a pocket's multiplier is taken of: the base price times the
   * stake. A modifier's surcharge raises what a ball costs, never this, which
   * is how a surcharge lowers the return.
   */
  stakePrice: number
  /** Record every tick's position for the animation. Never changes the outcome. */
  recordFrames?: boolean
}

export interface DivineGambaBallOutcome {
  ballIndex: number
  /** The ball this one split from, or null for a ball the player paid for. */
  parentIndex: number | null
  pocketIndex: number
  landedTick: number
  essenceWon: number
  boxRarity: string | null
  /** Flat `[x0, y0, x1, y1, ...]` per tick, present only when frames were asked for. */
  frames?: number[]
  /** The ticks on which the ball struck a peg, present only when frames were asked for. */
  hits?: number[]
}

export interface DivineGambaPlayOutcome {
  simVersion: number
  balls: DivineGambaBallOutcome[]
  essenceWon: number
  boxCount: number
}
