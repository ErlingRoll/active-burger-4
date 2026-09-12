import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCollectionService } from './CollectionService'

const STATE = {
  fish: [
    { definition_id: 'river-minnow', catches: 4, best_rarity: 'uncommon', record_size_percentile: 0.62 },
    // Postgres numerics arrive as strings through some clients; both shapes read.
    { definition_id: 'lantern-pike', catches: 1, best_rarity: 'rare', record_size_percentile: '0.91' },
  ],
  artifacts: [
    { definition_id: 'artifact-ember-reliquary', found: 2, best_rarity: 'epic' },
  ],
  classes: [
    { class_id: 'knight', victories: 3, deepest_abyss_floor: 14 },
  ],
}

function fakeClient(data: unknown, error: Error | null = null): SupabaseClient {
  return {
    rpc: vi.fn(async () => ({ data, error })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createCollectionService(
    { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test-key' },
    () => client,
  )
}

describe('collection service', () => {
  it('maps the three pages', async () => {
    const client = fakeClient(STATE)
    const state = await createService(client).loadState()

    expect(client.rpc).toHaveBeenCalledWith('get_collection_state', {})
    expect(state).toEqual({
      fish: [
        { definitionId: 'river-minnow', catches: 4, bestRarity: 'uncommon', recordSizePercentile: 0.62 },
        { definitionId: 'lantern-pike', catches: 1, bestRarity: 'rare', recordSizePercentile: 0.91 },
      ],
      artifacts: [{ definitionId: 'artifact-ember-reliquary', found: 2, bestRarity: 'epic' }],
      classes: [{ classId: 'knight', victories: 3, deepestAbyssFloor: 14 }],
    })
  })

  it('reads an empty account as three empty pages', async () => {
    const state = await createService(fakeClient({ fish: [], artifacts: [], classes: [] })).loadState()
    expect(state).toEqual({ fish: [], artifacts: [], classes: [] })
  })

  it('drops a rarity the content cannot place rather than inventing one', async () => {
    const state = await createService(fakeClient({
      ...STATE,
      artifacts: [{ definition_id: 'artifact-ember-reliquary', found: 1, best_rarity: 'mythic' }],
    })).loadState()
    expect(state.artifacts[0]?.bestRarity).toBeNull()
  })

  it('refuses a page it cannot read', async () => {
    await expect(createService(fakeClient({ fish: [{ definition_id: 'x' }], artifacts: [], classes: [] })).loadState())
      .rejects.toThrow(/invalid response/)
    await expect(createService(fakeClient({ fish: [] })).loadState()).rejects.toThrow(/three pages/)
  })

  it('surfaces a server error as a rejection', async () => {
    await expect(createService(fakeClient(null, new Error('Authentication is required.'))).loadState())
      .rejects.toThrow('Authentication is required.')
  })
})
