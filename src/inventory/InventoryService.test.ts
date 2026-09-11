import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createInventoryService } from './InventoryService'

const itemRow = {
  id: 'item-1',
  definition_id: 'river-minnow',
  quantity: 1,
  bound: false,
  favorite: false,
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
      favorite: false,
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
        scrap_awarded: 0,
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
      scrapAwarded: 0,
      wasProcessed: true,
    })
  })

  it('salvages a whole list in one request and reports what was kept back', async () => {
    const rpc = vi.fn((name: string) => {
      expect(name).toBe('salvage_inventory_items')
      return [{
        items_salvaged: 2,
        items_skipped: 1,
        essence_awarded: 14,
        scrap_awarded: 0,
        was_processed: true,
      }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.salvageItems('sweep-1', ['item-1', 'item-2', 'item-3'])).resolves.toEqual({
      itemsSalvaged: 2,
      itemsSkipped: 1,
      essenceAwarded: 14,
      scrapAwarded: 0,
      wasProcessed: true,
    })
    expect(rpc).toHaveBeenCalledWith('salvage_inventory_items', {
      p_operation_id: 'sweep-1',
      p_item_instance_ids: ['item-1', 'item-2', 'item-3'],
    })
  })

  it('refuses an empty sweep before making an RPC call', async () => {
    const client = fakeClient()
    const service = createService(client)

    await expect(service.salvageItems('sweep-1', [])).rejects.toThrow(/at least one item/)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('sets a favorite on one row or on a whole definition', async () => {
    const rpc = vi.fn((name: string, params: Record<string, unknown>) => {
      if (name === 'set_inventory_item_favorite') {
        return [{ item_instance_id: params.p_item_instance_id, favorite: params.p_favorite }]
      }
      expect(name).toBe('set_inventory_definition_favorite')
      return [{ definition_id: params.p_definition_id, favorite: params.p_favorite }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.setItemFavorite('item-1', true)).resolves.toEqual({
      itemInstanceId: 'item-1',
      favorite: true,
    })
    await expect(service.setDefinitionFavorite('scrap', false)).resolves.toEqual({
      definitionId: 'scrap',
      favorite: false,
    })
  })

  it('loads the definitions the player has starred as a whole', async () => {
    const service = createService(fakeClient({
      inventory: [{ definition_id: 'scrap' }, { definition_id: 'timber' }],
    }))

    await expect(service.loadFavoriteDefinitionIds()).resolves.toEqual(['scrap', 'timber'])
  })

  it('sends only the recipe and batch count when crafting', async () => {
    const rpc = vi.fn((name: string) => {
      expect(name).toBe('craft_inventory_item')
      return [{
        recipe_id: 'river-worm-from-scrap',
        input_definition_id: 'scrap',
        input_spent: 8,
        output_definition_id: 'river-worm',
        output_quantity: 1,
        was_processed: true,
      }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.craftItem('craft-1', 'river-worm-from-scrap')).resolves.toEqual({
      recipeId: 'river-worm-from-scrap',
      inputDefinitionId: 'scrap',
      inputSpent: 8,
      outputDefinitionId: 'river-worm',
      outputQuantity: 1,
      wasProcessed: true,
    })
    // The cost is the server's to decide: nothing about price or which stacks
    // pay it leaves the browser.
    expect(rpc).toHaveBeenCalledWith('craft_inventory_item', {
      p_operation_id: 'craft-1',
      p_recipe_id: 'river-worm-from-scrap',
      p_quantity: 1,
    })
  })

  it('rejects a craft response that is missing its costs', async () => {
    const rpc = vi.fn(() => [{
      recipe_id: 'river-worm-from-scrap',
      output_definition_id: 'river-worm',
      was_processed: true,
    }])
    const service = createService(fakeClient({ rpc }))

    await expect(service.craftItem('craft-1', 'river-worm-from-scrap')).rejects.toThrow(
      /crafted item row/,
    )
  })

  it('maps development inventory grants through the grant RPC', async () => {
    const rpc = vi.fn((name: string) => {
      expect(name).toBe('grant_development_inventory_items')
      return [{
        item_instance_id: 'item-2',
        definition_id: 'loot-box-common',
        quantity: 3,
        bound: false,
        favorite: false,
        metadata: {},
        source_type: 'system',
        source_id: 'development-menu',
        created_at: itemRow.created_at,
        updated_at: itemRow.updated_at,
        was_processed: true,
      }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.grantDevelopmentItems('grant-1', [{
      definitionId: 'loot-box-common',
      quantity: 3,
    }])).resolves.toEqual([{
      itemInstanceId: 'item-2',
      definitionId: 'loot-box-common',
      quantity: 3,
      bound: false,
      favorite: false,
      metadata: {},
      source: {
        type: 'system',
        id: 'development-menu',
      },
      createdAt: itemRow.created_at,
      updatedAt: itemRow.updated_at,
      wasProcessed: true,
    }])
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
