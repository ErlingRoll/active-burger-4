import { describe, expect, it, vi } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { createHubPresenceService, type HubVisitor } from './HubPresenceService'

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
      sessionOne: [{ playerId: 'player-one', position: { x: 50, y: 72 } }],
      sessionTwo: [
        { playerId: 'player-two', position: { x: 62, y: 64 } },
        { playerId: 'player-one', position: { x: 50, y: 72 } },
      ],
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

    await service.trackVisitor({ playerId: 'player-one', position: { x: 50, y: 72 } })
    presenceSyncHandler?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(channel.track).toHaveBeenCalledWith({
      playerId: 'player-one',
      position: { x: 50, y: 72 },
    })
    expect(client.rpc).toHaveBeenCalledWith('get_player_display_names', {
      p_player_ids: ['player-one', 'player-two'],
    })
    expect(received).toEqual([[
      { playerId: 'player-one', playerName: 'Mira', position: { x: 50, y: 72 } },
      { playerId: 'player-two', playerName: 'Toren', position: { x: 62, y: 64 } },
    ]])

    unsubscribe()
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('rejects malformed visitor presence before sending it', async () => {
    const service = createService({} as SupabaseClient)

    await expect(service.trackVisitor({ playerId: '  ', position: { x: 50, y: 72 } })).rejects.toThrow(
      'Hub visitor presence is invalid.',
    )
    await expect(service.trackVisitor({ playerId: 'player-one' })).rejects.toThrow(
      'Hub visitor presence is invalid.',
    )
    await expect(service.trackVisitor({ playerId: 'player-one', position: { x: 95, y: 72 } })).rejects.toThrow(
      'Hub visitor presence is invalid.',
    )
  })

  it('keeps legacy visitors visible with a stable fallback position', async () => {
    let presenceSyncHandler: (() => void) | undefined
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => {
        presenceSyncHandler = handler
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
      presenceState: vi.fn(() => ({
        legacySession: [{ playerId: 'legacy-player' }],
      })),
    } as unknown as RealtimeChannel
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
      rpc: vi.fn(async () => ({
        data: [{ player_id: 'legacy-player', player_name: 'Mira' }],
        error: null,
      })),
    } as unknown as SupabaseClient
    const service = createService(client)
    const received: HubVisitor[][] = []
    const unsubscribe = service.subscribeToVisitors((visitors) => {
      received.push(visitors)
    }, () => {
      throw new Error('unexpected presence error')
    })

    presenceSyncHandler?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(received).toHaveLength(1)
    expect(received[0][0]).toMatchObject({
      playerId: 'legacy-player',
      playerName: 'Mira',
    })
    expect(received[0][0].position).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }))

    unsubscribe()
  })

  it('broadcasts and receives validated hub movement', async () => {
    let movementHandler: ((event: { payload: unknown }) => void) | undefined
    const channel = {
      on: vi.fn((_type: string, filter: { event?: string }, handler: (event: { payload: unknown }) => void) => {
        if (filter.event === 'hub-movement') {
          movementHandler = handler
        }
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
      send: vi.fn(async () => 'ok'),
    } as unknown as RealtimeChannel
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
    } as unknown as SupabaseClient
    const service = createService(client)
    const received: unknown[] = []
    const unsubscribe = service.subscribeToMovements((movement) => {
      received.push(movement)
    }, () => {
      throw new Error('unexpected movement error')
    })

    await service.sendMovement({ playerId: 'player-one', position: { x: 51, y: 70 } })
    movementHandler?.({ payload: { playerId: 'player-two', position: { x: 62, y: 74 } } })
    movementHandler?.({ payload: { playerId: 'player-two', position: { x: 105, y: 74 } } })

    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'hub-movement',
      payload: { playerId: 'player-one', position: { x: 51, y: 70 } },
    })
    expect(received).toEqual([
      { playerId: 'player-two', position: { x: 62, y: 74 } },
    ])

    unsubscribe()
  })

  it('broadcasts and receives position resync requests', async () => {
    let requestHandler: ((event: { payload: unknown }) => void) | undefined
    const channel = {
      on: vi.fn((_type: string, filter: { event?: string }, handler: (event: { payload: unknown }) => void) => {
        if (filter.event === 'hub-position-request') {
          requestHandler = handler
        }
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
      send: vi.fn(async () => 'ok'),
    } as unknown as RealtimeChannel
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
    } as unknown as SupabaseClient
    const service = createService(client)
    const received: unknown[] = []
    const unsubscribe = service.subscribeToPositionRequests((request) => {
      received.push(request)
    }, () => {
      throw new Error('unexpected position request error')
    })

    await service.requestPositions({ playerId: 'joining-player' })
    requestHandler?.({ payload: { playerId: 'new-player' } })
    requestHandler?.({ payload: { playerId: ' ' } })

    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'hub-position-request',
      payload: { playerId: 'joining-player' },
    })
    expect(received).toEqual([{ playerId: 'new-player' }])

    unsubscribe()
  })

  it('broadcasts approved campfire signals and ignores malformed incoming payloads', async () => {
    let signalHandler: ((event: { payload: unknown }) => void) | undefined
    const channel = {
      on: vi.fn((type: string, _filter: unknown, handler: (event: { payload: unknown }) => void) => {
        if (type === 'broadcast') {
          signalHandler = handler
        }
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
      send: vi.fn(async () => 'ok'),
    } as unknown as RealtimeChannel
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
    } as unknown as SupabaseClient
    const service = createService(client)
    const received: unknown[] = []
    const unsubscribe = service.subscribeToSignals((signal) => {
      received.push(signal)
    }, () => {
      throw new Error('unexpected signal error')
    })

    await service.sendSignal({ playerId: 'player-one', signalId: 'wave' })
    signalHandler?.({ payload: { playerId: 'player-two', signalId: 'ready-to-descend' } })
    signalHandler?.({ payload: { playerId: 'player-two', signalId: 'not-an-approved-signal' } })

    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'campfire-signal',
      payload: { playerId: 'player-one', signalId: 'wave' },
    })
    expect(received).toEqual([
      { playerId: 'player-two', signalId: 'ready-to-descend' },
    ])

    unsubscribe()
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('keeps the shared hub channel open until presence and signal listeners both unsubscribe', () => {
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
    } as unknown as RealtimeChannel
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
    } as unknown as SupabaseClient
    const service = createService(client)
    const onError = () => {
      throw new Error('unexpected hub error')
    }
    const unsubscribeFromVisitors = service.subscribeToVisitors(() => {}, onError)
    const unsubscribeFromSignals = service.subscribeToSignals(() => {}, onError)

    expect(channel.subscribe).toHaveBeenCalledTimes(1)
    unsubscribeFromSignals()
    expect(client.removeChannel).not.toHaveBeenCalled()

    unsubscribeFromVisitors()
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })
})
