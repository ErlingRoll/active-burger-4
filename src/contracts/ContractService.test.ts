import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createContractService } from './ContractService'
import { getContractsByCadence, isContractComplete } from './ContractTypes'

const STATE = {
  server_time: '2026-09-13T12:00:00+00:00',
  daily_claimed: 2,
  contracts: [
    {
      assignment_id: 7,
      definition_id: 'daily-catch',
      cadence: 'daily',
      period_key: '2026-09-13',
      window_start: '2026-09-13T00:00:00+00:00',
      window_end: '2026-09-14T00:00:00+00:00',
      slot: 1,
      target: 5,
      progress: 2,
      repeat_claims: 0,
      claimed_at: null,
    },
    {
      assignment_id: 8,
      definition_id: 'weekly-angler',
      cadence: 'weekly',
      period_key: '2026-W37',
      window_start: '2026-09-07T00:00:00+00:00',
      window_end: '2026-09-14T00:00:00+00:00',
      slot: 1,
      target: 25,
      progress: 31,
      repeat_claims: 1,
      claimed_at: '2026-09-13T11:00:00+00:00',
    },
  ],
}

function fakeClient(rpc: (name: string, params: Record<string, unknown>) => unknown): SupabaseClient {
  return {
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => ({
      data: rpc(name, params),
      error: null,
    })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createContractService(
    { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test-key' },
    () => client,
  )
}

describe('contract service', () => {
  it('maps the board and stamps when it arrived', async () => {
    const client = fakeClient(() => STATE)
    const before = Date.now()
    const state = await createService(client).loadState()

    expect(client.rpc).toHaveBeenCalledWith('get_contract_state', {})
    expect(state.serverTime).toBe(STATE.server_time)
    expect(state.receivedAt).toBeGreaterThanOrEqual(before)
    expect(state.dailyClaimed).toBe(2)
    expect(state.contracts).toEqual([
      {
        assignmentId: 7,
        definitionId: 'daily-catch',
        cadence: 'daily',
        periodKey: '2026-09-13',
        windowStart: '2026-09-13T00:00:00+00:00',
        windowEnd: '2026-09-14T00:00:00+00:00',
        slot: 1,
        target: 5,
        progress: 2,
        repeatClaims: 0,
        claimedAt: null,
      },
      {
        assignmentId: 8,
        definitionId: 'weekly-angler',
        cadence: 'weekly',
        periodKey: '2026-W37',
        windowStart: '2026-09-07T00:00:00+00:00',
        windowEnd: '2026-09-14T00:00:00+00:00',
        slot: 1,
        target: 25,
        progress: 31,
        repeatClaims: 1,
        claimedAt: '2026-09-13T11:00:00+00:00',
      },
    ])
  })

  it('refuses a board it cannot read', async () => {
    const service = createService(fakeClient(() => ({ server_time: STATE.server_time, daily_claimed: 0, contracts: [{ assignment_id: 'seven' }] })))
    await expect(service.loadState()).rejects.toThrow(/invalid response/)
  })

  it('claims under exactly the operation and assignment it was given', async () => {
    const client = fakeClient(() => ({
      paid: [{ definition_id: 'roe', quantity: 4 }],
      was_processed: true,
      state: STATE,
    }))
    const result = await createService(client).claimReward('op-1', 7)

    expect(client.rpc).toHaveBeenCalledWith('claim_contract_reward', {
      p_operation_id: 'op-1',
      p_assignment_id: 7,
    })
    expect(result.wasProcessed).toBe(true)
    expect(result.paid).toEqual([{ definitionId: 'roe', quantity: 4 }])
    expect(result.state.contracts).toHaveLength(2)
  })

  it('reports a retried claim as already paid', async () => {
    const service = createService(fakeClient(() => ({ paid: [], was_processed: false, state: STATE })))
    const result = await service.claimReward('op-1', 7)
    expect(result.wasProcessed).toBe(false)
    expect(result.paid).toEqual([])
  })

  it('insists on an operation id and an assignment id before calling', async () => {
    const client = fakeClient(() => STATE)
    const service = createService(client)
    await expect(service.claimReward('  ', 7)).rejects.toThrow(/operation ID/)
    await expect(service.claimReward('op-1', -1)).rejects.toThrow(/assignment ID/)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('surfaces a server error as a rejection', async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: new Error('This contract is not finished yet.') })),
    } as unknown as SupabaseClient
    await expect(createService(client).claimReward('op-2', 7)).rejects.toThrow('not finished yet')
  })
})

describe('contract helpers', () => {
  it('sorts one cadence by slot and tells a finished contract from an open one', async () => {
    const state = await createService(fakeClient(() => ({
      ...STATE,
      contracts: [...STATE.contracts].reverse(),
    }))).loadState()
    const daily = getContractsByCadence(state, 'daily')
    const weekly = getContractsByCadence(state, 'weekly')
    expect(daily.map((assignment) => assignment.assignmentId)).toEqual([7])
    expect(weekly.map((assignment) => assignment.assignmentId)).toEqual([8])
    expect(isContractComplete(daily[0]!)).toBe(false)
    expect(isContractComplete(weekly[0]!)).toBe(true)
    expect(getContractsByCadence(null, 'daily')).toEqual([])
  })
})
