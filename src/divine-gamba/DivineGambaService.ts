import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type {
  DivineGambaBeginResult,
  DivineGambaPendingPlay,
  DivineGambaService,
  DivineGambaSettledBall,
  DivineGambaSettleResult,
} from './DivineGambaTypes'
import type { DivineGambaMachineConfig } from './sim/types.ts'

/** The Edge Function that runs the simulation for the house. */
export const DIVINE_GAMBA_SETTLE_FUNCTION = 'divine-gamba-settle'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isMachine(value: unknown): value is DivineGambaMachineConfig {
  return isRecord(value) &&
    isCount(value.rows) &&
    Array.isArray(value.pockets) &&
    value.pockets.every((pocket) =>
      isRecord(pocket) && isCount(pocket.multiplierPercent) && isCount(pocket.boxChanceBasisPoints)) &&
    isRecord(value.boxRarityWeights)
}

function invalidResponse(message: string): Error {
  return new Error(`The Divine Gamba returned an invalid response: ${message}`)
}

function assertOperationId(operationId: string): void {
  if (!isNonEmptyString(operationId)) {
    throw new Error('A non-empty Divine Gamba operation ID is required.')
  }
}

/** The machine as the simulation reads it, and nothing the server might have stored beside it. */
function readMachine(machine: DivineGambaMachineConfig): DivineGambaMachineConfig {
  return {
    rows: machine.rows,
    pockets: machine.pockets.map((pocket) => ({
      multiplierPercent: pocket.multiplierPercent,
      boxChanceBasisPoints: pocket.boxChanceBasisPoints,
    })),
    boxRarityWeights: { ...machine.boxRarityWeights },
  }
}

function readPlay(row: unknown): Omit<DivineGambaPendingPlay, 'createdAt'> | null {
  if (!isRecord(row) ||
    !isCount(row.play_id) || !isCount(row.seed) || !isCount(row.sim_version) ||
    !isCount(row.stake) || !isCount(row.ball_count) || !isCount(row.stake_price) ||
    !isCount(row.price_per_ball) ||
    !isMachine(row.machine) || !isCount(row.essence_spent)) {
    return null
  }
  return {
    playId: row.play_id,
    seed: row.seed,
    simVersion: row.sim_version,
    stake: row.stake,
    ballCount: row.ball_count,
    stakePrice: row.stake_price,
    pricePerBall: row.price_per_ball,
    machine: readMachine(row.machine),
    essenceSpent: row.essence_spent,
  }
}

function readBall(row: unknown): DivineGambaSettledBall | null {
  if (!isRecord(row) || !isCount(row.ball_index) || !isCount(row.pocket_index) ||
    !isCount(row.essence_won) ||
    !(row.box_rarity === null || isNonEmptyString(row.box_rarity))) {
    return null
  }
  return {
    ballIndex: row.ball_index,
    pocketIndex: row.pocket_index,
    landedTick: isCount(row.landed_tick) ? row.landed_tick : 0,
    essenceWon: row.essence_won,
    boxRarity: row.box_rarity === null ? null : row.box_rarity,
    boxDefinitionId: isNonEmptyString(row.box_definition_id) ? row.box_definition_id : null,
    boxInstanceId: isNonEmptyString(row.box_instance_id) ? row.box_instance_id : null,
  }
}

function readSettlement(data: unknown): DivineGambaSettleResult {
  if (!isRecord(data) || !isCount(data.play_id) || !isCount(data.essence_spent) ||
    !isCount(data.essence_won) || !isCount(data.box_count) || !isCount(data.essence_balance) ||
    !Array.isArray(data.balls) || typeof data.was_processed !== 'boolean') {
    throw invalidResponse('expected a settlement')
  }
  const balls = data.balls.map(readBall)
  if (balls.some((ball) => ball === null)) {
    throw invalidResponse('expected settled balls')
  }
  return {
    playId: data.play_id,
    essenceSpent: data.essence_spent,
    essenceWon: data.essence_won,
    boxCount: data.box_count,
    essenceBalance: data.essence_balance,
    balls: balls.filter((ball): ball is DivineGambaSettledBall => ball !== null),
    wasProcessed: data.was_processed,
  }
}

/** The message inside a failed Edge Function call, when it sent one. */
async function functionErrorMessage(error: unknown): Promise<string> {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json()
      if (isRecord(body) && isNonEmptyString(body.error)) {
        return body.error
      }
    } catch {
      // Fall through to the generic message.
    }
  }
  return error instanceof Error ? error.message : 'The house could not settle the play.'
}

/**
 * The Divine Gamba, as the browser reaches it.
 *
 * Prices, the machine, the seed and the outcome are all read back from the
 * server rather than sent to it. The client names a ball count and a stake,
 * and asks the house to settle by play id; nothing about where a ball landed
 * ever travels upward.
 */
export function createDivineGambaService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): DivineGambaService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async loadPendingPlays(): Promise<DivineGambaPendingPlay[]> {
      const response = await getClient().rpc('list_divine_gamba_pending_plays')
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data)) {
        throw invalidResponse('expected a pending play array')
      }
      return response.data.map((row) => {
        const play = readPlay(row)
        if (play === null || !isRecord(row) || !isNonEmptyString(row.created_at)) {
          throw invalidResponse('expected a pending play')
        }
        return { ...play, createdAt: row.created_at }
      })
    },

    async beginPlay(operationId, ballCount, stake): Promise<DivineGambaBeginResult> {
      assertOperationId(operationId)
      if (!Number.isInteger(ballCount) || ballCount < 1 || ballCount > 20) {
        throw new Error('A play holds 1 to 20 balls.')
      }
      if (!Number.isInteger(stake) || stake < 1) {
        throw new Error('Invalid stake.')
      }
      const response = await getClient().rpc('begin_divine_gamba_play', {
        p_operation_id: operationId,
        p_ball_count: ballCount,
        p_stake: stake,
      })
      if (response.error) {
        throw response.error
      }
      const play = readPlay(response.data)
      if (play === null || !isRecord(response.data) ||
        !isCount(response.data.essence_balance) || typeof response.data.was_processed !== 'boolean') {
        throw invalidResponse('expected a begun play')
      }
      return {
        ...play,
        essenceBalance: response.data.essence_balance,
        wasProcessed: response.data.was_processed,
      }
    },

    async settlePlay(playId): Promise<DivineGambaSettleResult> {
      if (!isCount(playId) || playId < 1) {
        throw new Error('A play ID is required.')
      }
      const response = await getClient().functions.invoke(DIVINE_GAMBA_SETTLE_FUNCTION, {
        body: { playId },
      })
      if (response.error) {
        throw new Error(await functionErrorMessage(response.error))
      }
      return readSettlement(response.data)
    },
  }
}
