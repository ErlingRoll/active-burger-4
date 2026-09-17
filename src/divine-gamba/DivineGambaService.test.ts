import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createDivineGambaService, DIVINE_GAMBA_SETTLE_FUNCTION } from './DivineGambaService'
import { resolveDivineGambaMachine } from './DivineGambaRegistry'

function query(response: unknown) {
  const builder = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: response, error: null }).then(resolve),
  }
  return builder
}

function fakeClient(options: {
  rows?: unknown
  rpc?: (name: string, params: Record<string, unknown>) => unknown
  invoke?: (name: string, options: { body: unknown }) => { data?: unknown, error?: unknown }
} = {}): SupabaseClient {
  return {
    from: vi.fn(() => query(options.rows ?? [])),
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => ({
      data: options.rpc?.(name, params) ?? null,
      error: null,
    })),
    functions: {
      invoke: vi.fn(async (name: string, invokeOptions: { body: unknown }) =>
        options.invoke?.(name, invokeOptions) ?? { data: null, error: null }),
    },
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createDivineGambaService(
    {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    },
    () => client,
  )
}

const MACHINE = resolveDivineGambaMachine([], [])

function begunPlay() {
  return {
    play_id: 7,
    seed: 123,
    sim_version: 1,
    stake: 1,
    ball_count: 3,
    stake_price: 20,
    price_per_ball: 20,
    modifier_ids: [],
    machine: MACHINE,
    essence_spent: 60,
    essence_balance: 940,
    was_processed: true,
  }
}

describe('Divine Gamba service', () => {
  it('reads the owned parts', async () => {
    const service = createService(fakeClient({
      rows: [{ part_id: 'brass-rails', acquired_at: '2026-09-17T10:00:00Z' }],
    }))
    await expect(service.loadOwnedParts()).resolves.toEqual([
      { partId: 'brass-rails', acquiredAt: '2026-09-17T10:00:00Z' },
    ])
  })

  it('sends only the count, the stake and the modifier ids when beginning a play', async () => {
    const rpc = vi.fn(() => begunPlay())
    const client = fakeClient({ rpc })
    const service = createService(client)
    const result = await service.beginPlay('op-1', 3, 1, ['steady-hand'])
    expect(rpc).toHaveBeenCalledWith('begin_divine_gamba_play', {
      p_operation_id: 'op-1',
      p_ball_count: 3,
      p_stake: 1,
      p_modifier_ids: ['steady-hand'],
    })
    expect(result).toMatchObject({ playId: 7, seed: 123, stakePrice: 20, essenceBalance: 940, wasProcessed: true })
    expect(result.machine.pockets).toHaveLength(9)
  })

  it('refuses an empty operation id and a bad ball count before calling', async () => {
    const rpc = vi.fn(() => begunPlay())
    const service = createService(fakeClient({ rpc }))
    await expect(service.beginPlay(' ', 3, 1, [])).rejects.toThrow('operation ID')
    await expect(service.beginPlay('op', 0, 1, [])).rejects.toThrow('1 to 20')
    await expect(service.beginPlay('op', 21, 1, [])).rejects.toThrow('1 to 20')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a begun play that is missing its machine', async () => {
    const service = createService(fakeClient({ rpc: () => ({ ...begunPlay(), machine: null }) }))
    await expect(service.beginPlay('op', 3, 1, [])).rejects.toThrow('invalid response')
  })

  it('settles through the Edge Function by play id', async () => {
    const invoke = vi.fn(() => ({
      data: {
        play_id: 7,
        essence_spent: 60,
        essence_won: 24,
        box_count: 1,
        essence_balance: 964,
        was_processed: true,
        balls: [
          { ball_index: 0, parent_index: null, pocket_index: 2, landed_tick: 300, essence_won: 24, box_rarity: null, box_definition_id: null, box_instance_id: null },
          { ball_index: 1, parent_index: null, pocket_index: 0, landed_tick: 310, essence_won: 0, box_rarity: 'rare', box_definition_id: 'loot-box-rare', box_instance_id: 'inst-1' },
        ],
      },
    }))
    const service = createService(fakeClient({ invoke }))
    const result = await service.settlePlay(7)
    expect(invoke).toHaveBeenCalledWith(DIVINE_GAMBA_SETTLE_FUNCTION, { body: { playId: 7 } })
    expect(result.essenceWon).toBe(24)
    expect(result.balls[1]).toEqual({
      ballIndex: 1,
      parentIndex: null,
      pocketIndex: 0,
      landedTick: 310,
      essenceWon: 0,
      boxRarity: 'rare',
      boxDefinitionId: 'loot-box-rare',
      boxInstanceId: 'inst-1',
    })
  })

  it('surfaces the message the Edge Function sent when it refuses', async () => {
    const service = createService(fakeClient({
      invoke: () => ({
        error: { context: new Response(JSON.stringify({ error: 'No such play.' }), { status: 404 }) },
      }),
    }))
    await expect(service.settlePlay(9)).rejects.toThrow('No such play.')
  })

  it('buys a part by id and reads back what it cost', async () => {
    const rpc = vi.fn(() => ({
      part_id: 'brass-rails', essence_spent: 600, shards_spent: 10, essence_balance: 400, was_processed: true,
    }))
    const service = createService(fakeClient({ rpc }))
    await expect(service.buyPart('op-2', 'brass-rails')).resolves.toEqual({
      partId: 'brass-rails', essenceSpent: 600, shardsSpent: 10, essenceBalance: 400, wasProcessed: true,
    })
    expect(rpc).toHaveBeenCalledWith('buy_divine_gamba_part', { p_operation_id: 'op-2', p_part_id: 'brass-rails' })
  })
})
