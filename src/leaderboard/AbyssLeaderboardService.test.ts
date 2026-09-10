import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAbyssLeaderboardService } from './AbyssLeaderboardService'

function createService(rpc: ReturnType<typeof vi.fn>) {
  return createAbyssLeaderboardService({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'test-key',
  }, () => ({ rpc }) as unknown as SupabaseClient)
}

describe('AbyssLeaderboardService', () => {
  it('reads the standings from the depth ranking', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { profile_id: 'a', display_name: 'Sablewick', deepest_floor: 41, rank: 1 },
        { profile_id: 'b', display_name: 'Kestrel', deepest_floor: 12, rank: 2 },
      ],
      error: null,
    })

    const entries = await createService(rpc).load()

    expect(rpc).toHaveBeenCalledWith('get_abyss_depth_leaderboard')
    expect(entries).toEqual([
      { profileId: 'a', displayName: 'Sablewick', deepestFloor: 41, rank: 1 },
      { profileId: 'b', displayName: 'Kestrel', deepestFloor: 12, rank: 2 },
    ])
  })

  it('rejects a response that is not a board of floors', async () => {
    // A floor is a whole number of at least one. Essence was a balance and could
    // be any of those things; depth cannot, and the board says so rather than
    // rendering whatever arrives.
    const rpc = vi.fn().mockResolvedValue({
      data: [{ profile_id: 'a', display_name: 'Sablewick', deepest_floor: 4.5, rank: 1 }],
      error: null,
    })

    await expect(createService(rpc).load()).rejects.toThrow(
      'Abyss leaderboard returned an invalid response.',
    )
  })

  it('rejects more rows than the top ten and the reader', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: Array.from({ length: 12 }, (_, index) => ({
        profile_id: `p${index}`,
        display_name: `Player ${index}`,
        deepest_floor: 20 - index,
        rank: index + 1,
      })),
      error: null,
    })

    await expect(createService(rpc).load()).rejects.toThrow(
      'Abyss leaderboard returned an invalid response.',
    )
  })
})
