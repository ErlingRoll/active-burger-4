import type { ContractCadence } from '../content/contracts/Contracts'

/**
 * The contract board as the browser sees it.
 *
 * Everything here is read back from the server: which contracts the period
 * dealt, how far each has come as of the server's clock, and whether it has
 * been claimed. The client names an assignment to claim and nothing else.
 */

export interface ContractAssignment {
  assignmentId: number
  definitionId: string
  cadence: ContractCadence
  /** The UTC date for a daily contract, the ISO week for a weekly one. */
  periodKey: string
  windowStart: string
  windowEnd: string
  slot: number
  target: number
  /** Events counted in the window as of `serverTime`. May exceed the target. */
  progress: number
  /** Times this contract was already claimed in its period. From the third, it pays half. */
  repeatClaims: number
  claimedAt: string | null
}

export interface ContractState {
  /** The server's clock when this state was read. */
  serverTime: string
  /** The client's clock when it arrived, for counting down to the window's end. */
  receivedAt: number
  /** Daily contracts claimed today. A claimed daily is replaced at once, so this is the day's tally. */
  dailyClaimed: number
  contracts: readonly ContractAssignment[]
}

export interface ContractPayment {
  definitionId: string
  quantity: number
}

export interface ContractClaimResult {
  paid: readonly ContractPayment[]
  /** False when the operation had already landed and this call only read its result. */
  wasProcessed: boolean
  state: ContractState
}

export interface ContractService {
  loadState(): Promise<ContractState>
  /** Pays a finished contract's reward. Safe to retry under the same operation id. */
  claimReward(operationId: string, assignmentId: number): Promise<ContractClaimResult>
}

/** A contract is finished when its progress has reached its target. */
export function isContractComplete(assignment: ContractAssignment): boolean {
  return assignment.progress >= assignment.target
}

/** The contracts of one cadence, in slot order. */
export function getContractsByCadence(
  state: ContractState | null,
  cadence: ContractCadence,
): ContractAssignment[] {
  return (state?.contracts ?? [])
    .filter((assignment) => assignment.cadence === cadence)
    .sort((left, right) => left.slot - right.slot)
}

/** "6h 12m left", "3d 4h left", or "Ending now". */
export function formatTimeLeft(windowEnd: string, nowMs: number): string {
  const left = Date.parse(windowEnd) - nowMs
  if (!Number.isFinite(left) || left <= 0) {
    return 'Ending now'
  }
  const minutes = Math.floor(left / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days >= 1) {
    return `${days}d ${hours % 24}h left`
  }
  if (hours >= 1) {
    return `${hours}h ${minutes % 60}m left`
  }
  return `${Math.max(1, minutes)}m left`
}
