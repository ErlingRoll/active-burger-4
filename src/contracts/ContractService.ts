import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isContractCadence } from '../content/contracts/Contracts'
import type {
  ContractAssignment,
  ContractClaimResult,
  ContractPayment,
  ContractService,
  ContractState,
} from './ContractTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function invalidResponse(message: string): Error {
  return new Error(`The contract board returned an invalid response: ${message}`)
}

function readAssignment(value: unknown): ContractAssignment {
  if (!isRecord(value) ||
    !isCount(value.assignment_id) ||
    !isNonEmptyString(value.definition_id) ||
    !isContractCadence(value.cadence) ||
    !isNonEmptyString(value.period_key) ||
    !isTimestamp(value.window_start) ||
    !isTimestamp(value.window_end) ||
    !isCount(value.slot) ||
    !isCount(value.target) ||
    !isCount(value.progress) ||
    !isCount(value.repeat_claims) ||
    !(value.claimed_at === null || value.claimed_at === undefined || isTimestamp(value.claimed_at))) {
    throw invalidResponse('expected a contract row')
  }
  return {
    assignmentId: value.assignment_id,
    definitionId: value.definition_id,
    cadence: value.cadence,
    periodKey: value.period_key,
    windowStart: value.window_start,
    windowEnd: value.window_end,
    slot: value.slot,
    target: value.target,
    progress: value.progress,
    repeatClaims: value.repeat_claims,
    claimedAt: isTimestamp(value.claimed_at) ? value.claimed_at : null,
  }
}

function readState(value: unknown, receivedAt: number): ContractState {
  if (!isRecord(value) || !isTimestamp(value.server_time) || !isCount(value.daily_claimed) || !Array.isArray(value.contracts)) {
    throw invalidResponse('expected a contract state')
  }
  return {
    serverTime: value.server_time,
    receivedAt,
    dailyClaimed: value.daily_claimed,
    contracts: value.contracts.map(readAssignment),
  }
}

function readPayment(value: unknown): ContractPayment {
  if (!isRecord(value) || !isNonEmptyString(value.definition_id) || !isCount(value.quantity)) {
    throw invalidResponse('expected a payment row')
  }
  return { definitionId: value.definition_id, quantity: value.quantity }
}

/**
 * The contract board, as the browser sees it.
 *
 * The server deals the board, measures progress and pays the reward; the
 * client reads the whole state after every call and never guesses in
 * between. An operation id makes a claim safe to retry.
 */
export function createContractService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): ContractService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const response = await getClient().rpc(name, params)
    if (response.error) {
      throw response.error
    }
    return response.data
  }

  return {
    async loadState(): Promise<ContractState> {
      return readState(await call('get_contract_state', {}), Date.now())
    },

    async claimReward(operationId, assignmentId): Promise<ContractClaimResult> {
      if (!isNonEmptyString(operationId)) {
        throw new Error('A non-empty contract operation ID is required.')
      }
      if (!isCount(assignmentId)) {
        throw new Error('A contract assignment ID is required.')
      }
      const data = await call('claim_contract_reward', {
        p_operation_id: operationId,
        p_assignment_id: assignmentId,
      })
      if (!isRecord(data) || !Array.isArray(data.paid) || typeof data.was_processed !== 'boolean') {
        throw invalidResponse('expected a claim result')
      }
      return {
        paid: data.paid.map(readPayment),
        wasProcessed: data.was_processed,
        state: readState(data.state, Date.now()),
      }
    },
  }
}
