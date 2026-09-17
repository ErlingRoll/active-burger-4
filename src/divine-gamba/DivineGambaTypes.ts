import type { DivineGambaMachineConfig } from './sim/types.ts'

/**
 * The Divine Gamba, as the browser sees it.
 *
 * A play is paid for by one call and paid out by another, and the two are
 * separate because the drop is simulated on both sides in between: the
 * server's run settles, the browser's run animates, and they agree because
 * the simulation is deterministic. See docs/features/divine_gamba.md.
 */

export interface DivineGambaBeginResult {
  playId: number
  seed: number
  simVersion: number
  stake: number
  ballCount: number
  /** What each ball cost, and what the pockets pay against: the base price times the stake. */
  stakePrice: number
  pricePerBall: number
  /** The machine the play was begun on, frozen so the settlement runs the same board. */
  machine: DivineGambaMachineConfig
  essenceSpent: number
  essenceBalance: number
  wasProcessed: boolean
}

export interface DivineGambaPendingPlay {
  playId: number
  seed: number
  simVersion: number
  stake: number
  ballCount: number
  stakePrice: number
  pricePerBall: number
  machine: DivineGambaMachineConfig
  essenceSpent: number
  createdAt: string
}

export interface DivineGambaSettledBall {
  ballIndex: number
  pocketIndex: number
  landedTick: number
  essenceWon: number
  boxRarity: string | null
  boxDefinitionId: string | null
  boxInstanceId: string | null
}

export interface DivineGambaSettleResult {
  playId: number
  essenceSpent: number
  essenceWon: number
  boxCount: number
  essenceBalance: number
  balls: DivineGambaSettledBall[]
  wasProcessed: boolean
}

export interface DivineGambaService {
  /** Plays that were paid for and never settled, oldest first. */
  loadPendingPlays(): Promise<DivineGambaPendingPlay[]>
  /**
   * Pays for a play and returns what the simulation needs to run it.
   *
   * The operation id makes a retry a replay: the same id returns the same
   * play and charges nothing twice.
   */
  beginPlay(operationId: string, ballCount: number, stake: number): Promise<DivineGambaBeginResult>
  /**
   * Asks the house to run the play and pay it.
   *
   * Idempotent: a play already settled returns what it paid the first time.
   */
  settlePlay(playId: number): Promise<DivineGambaSettleResult>
}
