import { describe, expect, it, vi } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Rarity } from '../content/rarity/Rarity'
import {
  FISHING_ROD_MODIFIER_COUNT_BY_RARITY,
  FISHING_ROD_MODIFIERS,
  FISHING_BAITS,
  FISHING_ENCHANTMENTS,
  FISH_DEFINITIONS,
  FISH_DROP_TABLE,
  formatFishingBaitEffect,
  formatFishingEnchantment,
  formatFishingRodModifiers,
  formatFishingSalvageValue,
  formatFishSizeKg,
  resolveFishingCatch,
} from './FishingContent'
import { createFishingService, type FishingAnglerPresence } from './FishingService'

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
  it('formats fish size as kilograms for player-facing labels', () => {
    expect(formatFishSizeKg(0.5345)).toBe('0.53 kg')
    expect(formatFishSizeKg(undefined)).toBe('Unknown')
  })

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
    const manualCatch = resolveFishingCatch(8099, {
      mode: 'manual',
      manualSuccess: true,
    })
    expect(manualCatch.metadata.rarity).toBe(Rarity.Epic)
    expect(manualCatch.definitionId).toBe('comet-eel')
    expect(manualCatch.metadata.sizePercentile).toBeCloseTo(0.1599)
  })

  it('keeps the ten fish drop table weighted to exactly one hundred percent', () => {
    expect(FISH_DROP_TABLE.reduce((total, fish) => total + fish.baseDropChance, 0)).toBe(100)
    expect(FISH_DROP_TABLE).toHaveLength(10)
    for (const fish of FISH_DROP_TABLE) {
      expect(FISH_DEFINITIONS[fish.definitionId]).toMatchObject({
        id: fish.definitionId,
      })
    }
  })

  it('uses a distinct icon for every fish visual', () => {
    const icons = Object.values(FISH_DEFINITIONS).map((definition) => definition.visual.icon)

    expect(new Set(icons).size).toBe(Object.keys(FISH_DEFINITIONS).length)
    expect(FISH_DEFINITIONS['lantern-pike'].visual.icon).toBe('lantern-pike')
  })

  it('defines a unique modifier pool for every rod rarity', () => {
    expect(Object.keys(FISHING_ROD_MODIFIERS)).toHaveLength(5)
    expect(FISHING_ROD_MODIFIER_COUNT_BY_RARITY).toEqual({
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5,
    })
  })

  it('formats only known rod modifiers from inventory metadata', () => {
    expect(formatFishingRodModifiers({
      modifierIds: ['speed', 'bait-retention', 'unknown'],
    })).toBe('Quick Line, Bait Keeper')
    expect(formatFishingRodModifiers({ modifierIds: [] })).toBe('No modifiers')
  })

  it('defines bait tiers with deterministic player-facing effects', () => {
    expect(Object.keys(FISHING_BAITS)).toEqual([
      'basic-bait',
      'river-worm',
      'glow-grub',
      'moonwater-lure',
    ])
    expect(formatFishingBaitEffect('glow-grub')).toBe(
      'rarity +18% · size +5% · loot boxes +1%',
    )
    expect(formatFishingBaitEffect('basic-bait')).toBe('Unlimited · common fish')
  })

  it('applies bait quality to deterministic local catch resolution', () => {
    const basicCatch = resolveFishingCatch(8999)
    const premiumCatch = resolveFishingCatch(8999, {
      baitDefinitionId: 'moonwater-lure',
    })
    expect(premiumCatch.metadata.sizePercentile).toBeGreaterThan(basicCatch.metadata.sizePercentile)
    expect(['moon-carp', 'tideback-catfish', 'revival-koi', 'comet-eel', 'star-koi'])
      .toContain(premiumCatch.definitionId)
  })

  it('defines and formats the server-known enchantment pool', () => {
    expect(Object.keys(FISHING_ENCHANTMENTS)).toEqual([
      'bright-scales',
      'deep-current',
      'astral-mark',
    ])
    expect(formatFishingEnchantment({
      enchantmentId: 'deep-current',
      enchantmentValue: 25,
    })).toBe('Deep Current · +25% meal effect')
    expect(formatFishingEnchantment({
      enchantmentId: 'unknown',
      enchantmentValue: 99,
    })).toBeNull()
  })

  it('formats the authoritative salvage value from fish metadata', () => {
    expect(formatFishingSalvageValue('revival-koi', {
      sizePercentile: 0.5,
    })).toBe('Salvage value: 20 Essence')
    expect(formatFishingSalvageValue('river-minnow', {
      sizePercentile: 0.5,
      enchantmentId: 'bright-scales',
    })).toBe('Salvage value: 2 Essence')
    expect(formatFishingSalvageValue('river-minnow', {
      sizePercentile: 2,
    })).toBe('Salvage value unavailable')
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
              server_time: '2026-09-04T15:59:55.000Z',
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
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-04T15:59:50.000Z'))

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
      resolveAtClientTime: Date.parse('2026-09-04T16:00:00.000Z'),
      pityAtClientTime: Date.parse('2026-09-04T16:00:45.000Z'),
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
      server_time: 'not-a-date',
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

  it('loads validated active fishing anglers', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: [{
          attempt_id: 'attempt-1',
          player_id: 'c9a03b84-1264-42cf-ae8a-3c754d194eca',
          player_name: 'Mira',
        }],
        error: null,
      })),
    } as unknown as SupabaseClient
    const service = createService(client)

    await expect(service.loadActiveAnglers()).resolves.toEqual([{
      attemptId: 'attempt-1',
      playerId: 'c9a03b84-1264-42cf-ae8a-3c754d194eca',
      playerName: 'Mira',
      phase: 'waiting',
    }])
    expect(client.rpc).toHaveBeenCalledWith('get_active_fishing_anglers')
  })

  it('publishes and receives validated shared pond activity', async () => {
    let broadcastHandler: ((message: { payload: unknown }) => void) | undefined
    let presenceSyncHandler: (() => void) | undefined
    const presence = {
      attemptId: 'attempt-1',
      playerId: 'player-1',
      playerName: 'Mira',
      phase: 'catching',
      fishDefinitionId: 'moon-carp',
      rarity: Rarity.Rare,
    } satisfies FishingAnglerPresence
    const presenceState = {
      'presence-1': [presence],
    }
    const channel = {
      on: vi.fn((type: string, _filter: unknown, handler: typeof broadcastHandler) => {
        if (type === 'broadcast') {
          broadcastHandler = handler
        } else {
          presenceSyncHandler = handler as () => void
        }
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED')
        return channel
      }),
      send: vi.fn(async () => 'ok'),
      track: vi.fn()
        .mockResolvedValueOnce('timed out')
        .mockResolvedValue('ok'),
      presenceState: vi.fn(() => presenceState),
    } as unknown as RealtimeChannel
    const client = {
      rpc: vi.fn(),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
    } as unknown as SupabaseClient
    const service = createService(client)
    const event = {
      eventId: 'event-1',
      attemptId: 'attempt-1',
      playerId: 'player-1',
      playerName: 'Mira',
      kind: 'catch' as const,
      fishDefinitionId: 'moon-carp',
      rarity: Rarity.Rare,
      occurredAt: '2026-09-04T16:00:05.000Z',
    }
    const received: unknown[] = []
    const presentAnglers: unknown[][] = []

    const unsubscribe = service.subscribeToActivity((activity) => {
      received.push(activity)
    }, () => {
      throw new Error('unexpected activity subscription error')
    }, (anglers) => {
      presentAnglers.push(anglers)
    })
    await service.publishActivity(event)
    broadcastHandler?.({ payload: event })
    presenceSyncHandler?.()

    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'fishing-activity',
      payload: event,
    })
    expect(received).toEqual([event])
    expect(presentAnglers).toEqual([presenceState['presence-1']])

    await service.trackAngler(presenceState['presence-1'][0])
    expect(channel.track).toHaveBeenCalledWith(presenceState['presence-1'][0])
    await service.trackAngler({
      attemptId: 'pond:player-1',
      playerId: 'player-1',
      playerName: 'Mira',
      phase: 'idle',
    })
    expect(channel.track).toHaveBeenLastCalledWith({
      attemptId: 'pond:player-1',
      playerId: 'player-1',
      playerName: 'Mira',
      phase: 'idle',
    })
    expect(channel.track).toHaveBeenCalledTimes(3)

    unsubscribe()
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })
})
