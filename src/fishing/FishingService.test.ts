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

  it('gives a successful manual reel a deterministic quality bonus', () => {
    const manualCatch = resolveFishingCatch(12399, {
      mode: 'manual',
      manualSuccess: true,
    })
    expect(manualCatch.metadata.rarity).toBe(Rarity.Uncommon)
    expect(manualCatch.definitionId).toBe('silver-perch')
    expect(manualCatch.metadata.sizePercentile).toBeCloseTo(0.5899)
  })
})

describe('FishingService', () => {
  it('begins and resolves a timed fishing attempt', async () => {
    const client = {
      rpc: vi.fn(async (name: string) => name === 'begin_fishing_attempt'
        ? {
            data: [{
              attempt_id: 'attempt-1',
              mode_id: 'manual',
              status: 'pending',
              resolve_at: '2026-09-04T16:00:05.000Z',
              pity_at: '2026-09-04T16:00:50.000Z',
              was_processed: true,
            }],
            error: null,
          }
        : {
            data: [{
              attempt_id: 'attempt-1',
              item_instance_id: 'fish-1',
              fish_definition_id: 'river-minnow',
              fish_metadata: {
                speciesId: 'river-minnow',
                rarity: 'common',
                sizePercentile: 0.5345,
              },
              was_processed: true,
            }],
            error: null,
          }),
    } as unknown as SupabaseClient
    const service = createService(client)

    await expect(service.beginAttempt({
      attemptId: 'attempt-1',
      mode: 'manual',
      baitDefinitionId: 'basic-bait',
      baitInstanceId: null,
      rodInstanceId: null,
    })).resolves.toEqual({
      attemptId: 'attempt-1',
      mode: 'manual',
      status: 'pending',
      resolveAt: '2026-09-04T16:00:05.000Z',
      pityAt: '2026-09-04T16:00:50.000Z',
      wasProcessed: true,
    })

    await expect(service.resolveAttempt({
      attemptId: 'attempt-1',
      manualSuccess: true,
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

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'begin_fishing_attempt', {
      p_attempt_id: 'attempt-1',
      p_mode_id: 'manual',
      p_bait_definition_id: 'basic-bait',
      p_bait_instance_id: null,
      p_rod_instance_id: null,
    })
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'resolve_fishing_attempt', {
      p_attempt_id: 'attempt-1',
      p_manual_success: true,
    })
  })

  it('rejects malformed fishing responses', async () => {
    const service = createService(fakeClient([{
      attempt_id: 'attempt-1',
      mode_id: 'unknown',
      status: 'pending',
      resolve_at: 'not-a-date',
      pity_at: 'not-a-date',
      was_processed: true,
    }]))

    await expect(service.beginAttempt({
      attemptId: 'attempt-1',
      mode: 'auto',
      baitDefinitionId: 'basic-bait',
      baitInstanceId: null,
      rodInstanceId: null,
    })).rejects.toThrow(/invalid response/)
  })
})
