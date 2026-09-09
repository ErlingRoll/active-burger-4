import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createShopService } from './ShopService'
import { getRemainingStock } from './ShopTypes'

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
  rows?: unknown
  rpc?: (name: string, params: Record<string, unknown>) => unknown
} = {}): SupabaseClient {
  return {
    from: vi.fn(() => query(options.rows ?? [])),
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => ({
      data: options.rpc?.(name, params) ?? [],
      error: null,
    })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createShopService(
    {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    },
    () => client,
  )
}

describe('shop service', () => {
  it('maps the price list', async () => {
    const service = createService(fakeClient({
      rows: [{
        definition_id: 'scrap',
        sell_price: 1,
        buy_price: 3,
        stock_weight: 0,
        stock_quantity: 1,
      }],
    }))

    await expect(service.loadPriceBands()).resolves.toEqual([{
      definitionId: 'scrap',
      sellPrice: 1,
      buyPrice: 3,
      stockWeight: 0,
      stockQuantity: 1,
    }])
  })

  it('maps the day\'s shelf', async () => {
    const service = createService(fakeClient({
      rpc: () => [{
        definition_id: 'river-worm',
        quantity_offered: 10,
        quantity_bought: 3,
        unit_price: 18,
      }],
    }))

    const stock = await service.loadStock()
    expect(stock).toEqual([{
      definitionId: 'river-worm',
      quantityOffered: 10,
      quantityBought: 3,
      unitPrice: 18,
    }])
    expect(getRemainingStock(stock[0]!)).toBe(7)
  })

  it('sends only the item and quantity when selling', async () => {
    const rpc = vi.fn((name: string) => {
      expect(name).toBe('sell_to_shop')
      return [{
        item_instance_id: 'item-1',
        definition_id: 'scrap',
        quantity_sold: 4,
        essence_awarded: 4,
        essence_balance: 104,
        was_processed: true,
      }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.sellItem('sell-1', 'item-1', 4)).resolves.toEqual({
      itemInstanceId: 'item-1',
      definitionId: 'scrap',
      quantitySold: 4,
      essenceAwarded: 4,
      essenceBalance: 104,
      wasProcessed: true,
    })
    // The price is the shop's to decide. Nothing about it leaves the browser.
    expect(rpc).toHaveBeenCalledWith('sell_to_shop', {
      p_operation_id: 'sell-1',
      p_item_instance_id: 'item-1',
      p_quantity: 4,
    })
  })

  it('sends only the definition and quantity when buying', async () => {
    const rpc = vi.fn((name: string) => {
      expect(name).toBe('buy_from_shop')
      return [{
        definition_id: 'glow-grub',
        quantity_bought: 1,
        essence_spent: 54,
        essence_balance: 50,
        was_processed: true,
      }]
    })
    const service = createService(fakeClient({ rpc }))

    await expect(service.buyItem('buy-1', 'glow-grub')).resolves.toMatchObject({
      definitionId: 'glow-grub',
      essenceSpent: 54,
    })
    expect(rpc).toHaveBeenCalledWith('buy_from_shop', {
      p_operation_id: 'buy-1',
      p_definition_id: 'glow-grub',
      p_quantity: 1,
    })
  })

  it('rejects a sale response that does not say what it paid', async () => {
    const service = createService(fakeClient({
      rpc: () => [{ item_instance_id: 'item-1', definition_id: 'scrap', was_processed: true }],
    }))

    await expect(service.sellItem('sell-1', 'item-1')).rejects.toThrow(/one sale row/)
  })

  it('refuses an operation ID that is not there', async () => {
    const service = createService(fakeClient())

    await expect(service.buyItem('', 'glow-grub')).rejects.toThrow(/operation ID/)
  })
})
