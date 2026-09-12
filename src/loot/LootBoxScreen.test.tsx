// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen } from '../testing/render'
import { InventoryScreen } from './LootBoxScreen'
import type { InventoryItemInstance, InventoryService } from '../inventory'

function item(
  definitionId: string,
  itemInstanceId: string,
  quantity = 1,
): InventoryItemInstance {
  return {
    itemInstanceId,
    definitionId,
    quantity,
    bound: false,
    favorite: false,
    metadata: {},
    source: { type: 'fishing', id: null },
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  }
}

function renderInventoryScreen(items: InventoryItemInstance[]) {
  const inventoryService = {
    loadInventory: vi.fn(() => Promise.resolve(items)),
    loadFavoriteDefinitionIds: vi.fn(() => Promise.resolve([])),
  } as unknown as InventoryService
  return renderComponent(
    <InventoryScreen
      inventoryService={inventoryService}
      lootBoxService={null}
      configurationError={null}
      onBack={() => {}}
    />,
  )
}

describe('InventoryScreen bag header', () => {
  it('shows the scrap held beside what the shelf is worth', async () => {
    renderInventoryScreen([
      item('river-worm', 'worm-1'),
      item('scrap', 'scrap-1', 12),
      item('scrap', 'scrap-2', 30),
    ])

    expect(await screen.findByLabelText('42 scrap')).toBeInTheDocument()
    expect(screen.getByText('Scrap')).toBeInTheDocument()
    expect(screen.getByText('Worth')).toBeInTheDocument()
  })

  it('counts scrap from the whole bag, not the shelf the filter shows', async () => {
    const { user } = renderInventoryScreen([
      item('river-worm', 'worm-1'),
      item('scrap', 'scrap-1', 7),
    ])
    await screen.findByLabelText('7 scrap')

    await user.click(screen.getByRole('button', { name: /^Bait/ }))

    expect(screen.getByLabelText('7 scrap')).toBeInTheDocument()
  })
})
