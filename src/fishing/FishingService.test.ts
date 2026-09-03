import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Rarity } from '../content/rarity/Rarity'
import { resolveFishingCatch } from './FishingContent'
import { createFishingService } from './FishingService'

function fakeClient(rpcResult: unknown): SupabaseClient {
  return {
    rpc: vi.fn(async () => ({ data: rpcResult, error: null })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createFishingService(
    {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    },
    () => client,
  )
}

describe('FishingContent', () => {
  it('resolves the same catch metadata for the same seed', () => {
    expect(resolveFishingCatch(12345)).toEqual(resolveFishingCatch(12345))
    expect(resolveFishingCatch(12345)).toEqual({
      definitionId: 'river-minnow',
      metadata: {
        speciesId: 'river-minnow',
        rarity: Rarity.Common,
        sizePercentile: 0.5345,
      },
    })
  })
})

describe('FishingService', () => {
  it('starts an idempotent source-specific fishing attempt', async () => {
    const client = fakeClient([{
      attempt_id: 'attempt-1',
      item_instance_id: 'fish-1',
      fish_definition_id: 'river-minnow',
      fish_metadata: {
        speciesId: 'river-minnow',
        rarity: 'common',
        sizePercentile: 0.5345,
      },
      was_processed: true,
    }])
    const service = createService(client)

    await expect(service.startAttempt({
      attemptId: 'attempt-1',
      spotId: 'river-bank',
      baitDefinitionId: 'basic-bait',
      rodInstanceId: null,
    })).resolves.toEqual({
      attemptId: 'attempt-1',
      itemInstanceId: 'fish-1',
      definitionId: 'river-minnow',
      metadata: {
        speciesId: 'river-minnow',
        rarity: 'common',
        sizePercentile: 0.5345,
      },
      wasProcessed: true,
    })

    expect(client.rpc).toHaveBeenCalledWith('start_fishing_attempt', {
      p_attempt_id: 'attempt-1',
      p_spot_id: 'river-bank',
      p_bait_definition_id: 'basic-bait',
      p_rod_instance_id: null,
    })
  })

  it('rejects malformed fishing responses', async () => {
    const service = createService(fakeClient([{
      attempt_id: 'attempt-1',
      item_instance_id: 'fish-1',
      fish_definition_id: 'river-minnow',
      fish_metadata: { rarity: 'unknown' },
      was_processed: true,
    }]))

    await expect(service.startAttempt({
      attemptId: 'attempt-1',
      spotId: 'river-bank',
      baitDefinitionId: 'basic-bait',
      rodInstanceId: null,
    })).rejects.toThrow(/invalid response/)
  })
})
