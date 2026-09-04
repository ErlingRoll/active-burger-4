import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLootBoxService } from './LootBoxService'

function fakeClient(result: unknown): SupabaseClient {
  return {
    rpc: vi.fn(async () => ({ data: result, error: null })),
  } as unknown as SupabaseClient
}

describe('LootBoxService', () => {
  it('opens a box through the idempotent server RPC', async () => {
    const client = fakeClient([{
      box_instance_id: 'box-1',
      box_rarity: 'rare',
      item_instance_id: 'fish-1',
      definition_id: 'revival-koi',
      quantity: 1,
      metadata: {
        speciesId: 'revival-koi',
        rarity: 'rare',
        sizePercentile: 0.75,
      },
      was_processed: true,
    }])
    const service = createLootBoxService({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    }, () => client)

    await expect(service.openBox('operation-1', 'box-1')).resolves.toMatchObject({
      boxInstanceId: 'box-1',
      boxRarity: 'rare',
      definitionId: 'revival-koi',
      wasProcessed: true,
    })
    expect(client.rpc).toHaveBeenCalledWith('open_loot_box', {
      p_operation_id: 'operation-1',
      p_box_instance_id: 'box-1',
    })
  })

  it('rejects malformed opening results', async () => {
    const service = createLootBoxService({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    }, () => fakeClient([{
      box_instance_id: 'box-1',
      box_rarity: 'unknown',
    }]))

    await expect(service.openBox('operation-1', 'box-1'))
      .rejects.toThrow(/invalid response/)
  })
})
