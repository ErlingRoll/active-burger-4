import type { DivineGambaMachineConfig } from './sim/types.ts'

/**
 * The Divine Gamba, as the browser sees it.
 *
 * A play is paid for by one call and paid out by another, and the two are
 * separate because the drop is simulated on both sides in between: the
 * server's run settles, the browser's run animates, and they agree because
 * the simulation is deterministic. See docs/features/divine_gamba.md.
 */

export interface DivineGambaOwnedPart {
  partId: string
  acquiredAt: string
}

/** The machine a play was begun with, plus the stakes its parts allow. */
export interface DivineGambaPlayMachine extends DivineGambaMachineConfig {
  allowedStakes: number[]
}

export interface DivineGambaBeginResult {
  playId: number
  seed: number
  simVersion: number
  stake: number
  ballCount: number
  /** What the pockets pay against: the base price times the stake. */
  stakePrice: number
  /** What each ball cost, surcharge included. */
  pricePerBall: number
  modifierIds: string[]
  machine: DivineGambaPlayMachine
  essenceSpent: number
  essenceBalance: number
  /** True for the day's free drop: nothing was charged. */
  free: boolean
  wasProcessed: boolean
}

/** Whether today's free drop is still to be had, and when the next one comes. */
export interface DivineGambaFreeDropState {
  available: boolean
  /** When the next free drop unlocks: midnight UTC. */
  resetsAt: string
  serverTime: string
}

export interface DivineGambaPendingPlay {
  playId: number
  seed: number
  simVersion: number
  stake: number
  ballCount: number
  stakePrice: number
  pricePerBall: number
  modifierIds: string[]
  machine: DivineGambaPlayMachine
  essenceSpent: number
  createdAt: string
}

export interface DivineGambaSettledBall {
  ballIndex: number
  parentIndex: number | null
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

export interface DivineGambaPurchaseResult {
  partId: string
  essenceSpent: number
  shardsSpent: number
  essenceBalance: number
  wasProcessed: boolean
}

export interface DivineGambaService {
  /** The parts this player has bought. */
  loadOwnedParts(): Promise<DivineGambaOwnedPart[]>
  /** Plays that were paid for and never settled, oldest first. */
  loadPendingPlays(): Promise<DivineGambaPendingPlay[]>
  loadFreeDropState(): Promise<DivineGambaFreeDropState>
  /**
   * Pays for a play and returns what the simulation needs to run it.
   *
   * The operation id makes a retry a replay: the same id returns the same
   * play and charges nothing twice.
   */
  beginPlay(
    operationId: string,
    ballCount: number,
    stake: number,
    modifierIds: readonly string[],
    /** Ask for the day's free drop: one ball, base stake, no modifiers, nothing charged. */
    free?: boolean,
  ): Promise<DivineGambaBeginResult>
  /**
   * Asks the house to run the play and pay it.
   *
   * Idempotent: a play already settled returns what it paid the first time.
   */
  settlePlay(playId: number): Promise<DivineGambaSettleResult>
  buyPart(operationId: string, partId: string): Promise<DivineGambaPurchaseResult>
}
