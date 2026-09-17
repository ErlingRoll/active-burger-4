import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createDivineGambaService, DIVINE_GAMBA_SETTLE_FUNCTION } from './DivineGambaService'
import { DIVINE_GAMBA_MACHINE } from './DivineGambaRegistry'

function fakeClient(options: {
  rpc?: (name: string, params: Record<string, unknown>) => unknown
  invoke?: (name: string, options: { body: unknown }) => { data?: unknown, error?: unknown }
} = {}): SupabaseClient {
  return {
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

function begunPlay() {
  return {
    play_id: 7,
    seed: 123,
    sim_version: 1,
    stake: 1,
    ball_count: 3,
    stake_price: 20,
    price_per_ball: 20,
    machine: DIVINE_GAMBA_MACHINE,
    essence_spent: 60,
    essence_balance: 940,
    was_processed: true,
  }
}

describe('Divine Gamba service', () => {
  it('sends only the count and the stake when beginning a play', async () => {
    const rpc = vi.fn(() => begunPlay())
    const client = fakeClient({ rpc })
    const service = createService(client)
    const result = await service.beginPlay('op-1', 3, 1)
    expect(rpc).toHaveBeenCalledWith('begin_divine_gamba_play', {
      p_operation_id: 'op-1',
      p_ball_count: 3,
      p_stake: 1,
    })
    expect(result).toMatchObject({ playId: 7, seed: 123, stakePrice: 20, essenceBalance: 940, wasProcessed: true })
    expect(result.machine).toEqual(DIVINE_GAMBA_MACHINE)
  })

  it('keeps only the machine the simulation reads, whatever else the server stored beside it', async () => {
    const service = createService(fakeClient({
      rpc: () => ({ ...begunPlay(), machine: { ...DIVINE_GAMBA_MACHINE, pricePercent: 135, effects: [] } }),
    }))
    const result = await service.beginPlay('op', 3, 1)
    expect(result.machine).toEqual(DIVINE_GAMBA_MACHINE)
  })

  it('refuses an empty operation id and a bad ball count before calling', async () => {
    const rpc = vi.fn(() => begunPlay())
    const service = createService(fakeClient({ rpc }))
    await expect(service.beginPlay(' ', 3, 1)).rejects.toThrow('operation ID')
    await expect(service.beginPlay('op', 0, 1)).rejects.toThrow('1 to 20')
    await expect(service.beginPlay('op', 21, 1)).rejects.toThrow('1 to 20')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a begun play that is missing its machine', async () => {
    const service = createService(fakeClient({ rpc: () => ({ ...begunPlay(), machine: null }) }))
    await expect(service.beginPlay('op', 3, 1)).rejects.toThrow('invalid response')
  })

  it('lists the pending plays with when they were begun', async () => {
    const service = createService(fakeClient({
      rpc: () => [{ ...begunPlay(), created_at: '2026-09-17T10:00:00Z' }],
    }))
    const pending = await service.loadPendingPlays()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ playId: 7, ballCount: 3, createdAt: '2026-09-17T10:00:00Z' })
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
          { ball_index: 0, pocket_index: 2, landed_tick: 300, essence_won: 24, box_rarity: null, box_definition_id: null, box_instance_id: null },
          { ball_index: 1, pocket_index: 0, landed_tick: 310, essence_won: 0, box_rarity: 'rare', box_definition_id: 'loot-box-rare', box_instance_id: 'inst-1' },
        ],
      },
    }))
    const service = createService(fakeClient({ invoke }))
    const result = await service.settlePlay(7)
    expect(invoke).toHaveBeenCalledWith(DIVINE_GAMBA_SETTLE_FUNCTION, { body: { playId: 7 } })
    expect(result.essenceWon).toBe(24)
    expect(result.balls[1]).toEqual({
      ballIndex: 1,
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
})
