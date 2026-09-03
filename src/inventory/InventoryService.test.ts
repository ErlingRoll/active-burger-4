import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createInventoryService } from './InventoryService'

const itemRow = {
  id: 'item-1',
  definition_id: 'river-minnow',
  quantity: 1,
  bound: false,
  metadata: { rarity: 'common', sizePercentile: 0.25 },
  source_type: 'fishing',
  source_id: 'fishing-attempt-1',
  created_at: '2026-09-04T00:00:00.000Z',
  updated_at: '2026-09-04T00:00:00.000Z',
}

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
  inventory?: unknown
  rpc?: (name: string, params: Record<string, unknown>) => unknown
} = {}): SupabaseClient {
  return {
    from: vi.fn(() => query(options.inventory ?? [])),
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => ({
      data: options.rpc?.(name, params) ?? [],
      error: null,
    })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createInventoryService(
    {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    },
    () => client,
  )
}

describe('InventoryService', () => {
  it('loads and maps owner inventory rows', async () => {
    const service = createService(fakeClient({ inventory: [itemRow] }))

    await expect(service.loadInventory()).resolves.toEqual([{
      itemInstanceId: 'item-1',
      definitionId: 'river-minnow',
      quantity: 1,
      bound: false,
      metadata: itemRow.metadata,
      source: {
        type: 'fishing',
        id: 'fishing-attempt-1',
      },
      createdAt: itemRow.created_at,
      updatedAt: itemRow.updated_at,
    }])
  })

  it('filters inventory by the shared definition category', async () => {
    const service = createService(fakeClient({
      inventory: [
        itemRow,
        { ...itemRow, id: 'item-2', definition_id: 'starter-fishing-rod' },
      ],
    }))

    await expect(service.loadInventory('fish')).resolves.toHaveLength(1)
    await expect(service.loadInventory('rod')).resolves.toMatchObject([{
      itemInstanceId: 'item-2',
      definitionId: 'starter-fishing-rod',
    }])
  })

  it('maps reserve, release, and salvage mutations', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'reserve_inventory_items') {
        return [{
          reservation_id: 'reservation-1',
          item_instance_id: 'item-1',
          quantity_reserved: 1,
          was_processed: true,
        }]
      }
      if (name === 'release_inventory_reservation') {
        return [{
          reservation_id: 'reservation-1',
          quantity_released: 1,
          was_processed: true,
        }]
      }
      return [{
        item_instance_id: 'item-1',
        essence_awarded: 2,
        was_processed: true,
      }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.reserveItems('reserve-1', 'run-start', [{
      itemInstanceId: 'item-1',
      quantity: 1,
    }])).resolves.toEqual([{
      reservationId: 'reservation-1',
      itemInstanceId: 'item-1',
      quantityReserved: 1,
      wasProcessed: true,
    }])
    await expect(service.releaseReservation('release-1', 'reservation-1')).resolves.toEqual({
      reservationId: 'reservation-1',
      quantityReleased: 1,
      wasProcessed: true,
    })
    await expect(service.salvageItem('salvage-1', 'item-1')).resolves.toEqual({
      itemInstanceId: 'item-1',
      essenceAwarded: 2,
      wasProcessed: true,
    })
  })

  it('rejects invalid local requests before making an RPC call', async () => {
    const client = fakeClient()
    const service = createService(client)

    await expect(service.consumeItems('operation-1', [{
      itemInstanceId: 'item-1',
      quantity: 0,
    }])).rejects.toThrow(/consumption is invalid/)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('rejects malformed inventory responses', async () => {
    const service = createService(fakeClient({
      inventory: [{ ...itemRow, quantity: 0 }],
    }))

    await expect(service.loadInventory()).rejects.toThrow(/invalid response/)
  })
})
