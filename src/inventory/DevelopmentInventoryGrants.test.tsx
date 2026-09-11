// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor } from '../testing/render'
import { DevelopmentInventoryGrants } from './DevelopmentInventoryGrants'
import type { InventoryItemInstance, InventoryService } from './InventoryTypes'

function createInventoryService() {
  const grantDevelopmentItems = vi.fn(async (_operationId: string, items: { definitionId: string; quantity: number }[]) =>
    items.map((item): InventoryItemInstance => ({
      itemInstanceId: `instance-${item.definitionId}`,
      definitionId: item.definitionId,
      quantity: item.quantity,
      bound: false,
      favorite: false,
      metadata: {},
      source: { type: 'system', id: 'development-menu' },
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
    })),
  )
  return {
    service: { grantDevelopmentItems } as unknown as InventoryService,
    grantDevelopmentItems,
  }
}

describe('DevelopmentInventoryGrants', () => {
  it('grants a quick item with its fixed rarity and size', async () => {
    const { service, grantDevelopmentItems } = createInventoryService()
    const { user } = renderComponent(
      <DevelopmentInventoryGrants inventoryService={service} />,
    )

    await user.click(screen.getByRole('button', { name: 'Revival Koi, epic and large' }))

    await waitFor(() => {
      expect(grantDevelopmentItems).toHaveBeenCalledTimes(1)
    })
    const [, items] = grantDevelopmentItems.mock.calls[0]!
    expect(items).toEqual([{
      definitionId: 'revival-koi',
      quantity: 1,
      metadata: { speciesId: 'revival-koi', rarity: 'epic', sizePercentile: 0.9 },
    }])
  })

  it('grants the chosen item in the chosen quantity', async () => {
    const { service, grantDevelopmentItems } = createInventoryService()
    const { user } = renderComponent(
      <DevelopmentInventoryGrants inventoryService={service} />,
    )

    await user.selectOptions(screen.getByLabelText('Item'), 'scrap')
    const quantity = screen.getByLabelText('Quantity')
    await user.clear(quantity)
    await user.type(quantity, '250')
    await user.click(screen.getByRole('button', { name: 'Grant item' }))

    await waitFor(() => {
      expect(grantDevelopmentItems).toHaveBeenCalledTimes(1)
    })
    const [, items] = grantDevelopmentItems.mock.calls[0]!
    expect(items).toEqual([{ definitionId: 'scrap', quantity: 250 }])
  })
})
