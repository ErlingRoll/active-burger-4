import { describe, expect, it, vi } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { createHubPresenceService } from './HubPresenceService'

function createService(client: SupabaseClient) {
  return createHubPresenceService({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'test-key',
  }, () => client)
}

describe('HubPresenceService', () => {
  it('tracks visitors and resolves realtime names through the canonical RPC', async () => {
    let presenceSyncHandler: (() => void) | undefined
    const presenceState = {
      sessionOne: [{ playerId: 'player-one' }],
      sessionTwo: [{ playerId: 'player-two' }, { playerId: 'player-one' }],
    }
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => {
        presenceSyncHandler = handler
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
      track: vi.fn(async () => 'ok'),
      presenceState: vi.fn(() => presenceState),
    } as unknown as RealtimeChannel
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
      rpc: vi.fn(async () => ({
        data: [
          { player_id: 'player-one', player_name: 'Mira' },
          { player_id: 'player-two', player_name: 'Toren' },
        ],
        error: null,
      })),
    } as unknown as SupabaseClient
    const service = createService(client)
    const received: unknown[][] = []
    const unsubscribe = service.subscribeToVisitors((visitors) => {
      received.push(visitors)
    }, () => {
      throw new Error('unexpected presence error')
    })

    await service.trackVisitor({ playerId: 'player-one' })
    presenceSyncHandler?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(channel.track).toHaveBeenCalledWith({ playerId: 'player-one' })
    expect(client.rpc).toHaveBeenCalledWith('get_player_display_names', {
      p_player_ids: ['player-one', 'player-two'],
    })
    expect(received).toEqual([[
      { playerId: 'player-one', playerName: 'Mira' },
      { playerId: 'player-two', playerName: 'Toren' },
    ]])

    unsubscribe()
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('rejects malformed visitor presence before sending it', async () => {
    const service = createService({} as SupabaseClient)

    await expect(service.trackVisitor({ playerId: '  ' })).rejects.toThrow(
      'Hub visitor presence is invalid.',
    )
  })
})
