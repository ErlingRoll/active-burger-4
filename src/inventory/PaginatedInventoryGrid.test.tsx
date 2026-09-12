// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, within } from '../testing/render'
import { PaginatedInventoryGrid } from './PaginatedInventoryGrid'
import type { InventoryItemInstance } from './InventoryTypes'

function item(definitionId: string, itemInstanceId: string): InventoryItemInstance {
  return {
    itemInstanceId,
    definitionId,
    quantity: 1,
    bound: false,
    favorite: false,
    metadata: {},
    source: { type: 'fishing', id: null },
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  }
}

const items = [item('river-worm', 'worm-1'), item('glow-grub', 'grub-1')]

function renderGrid(overrides: Partial<Parameters<typeof PaginatedInventoryGrid>[0]> = {}) {
  const onSelect = vi.fn()
  const result = renderComponent(
    <PaginatedInventoryGrid
      items={items}
      label="Owned items"
      getItemIcon={() => '◉'}
      getItemDetail={(entry) => `detail for ${entry.definitionId}`}
      getItemEssence={() => 4}
      onSelect={onSelect}
      {...overrides}
    />,
  )
  // Located by name rather than by position: the grid sorts by rarity, so the
  // Glow Grub sits ahead of the River Worm.
  const slotFor = (name: string): HTMLElement =>
    screen.getByRole('listitem', { name: new RegExp(`^${name},`) })
  return { ...result, onSelect, slotFor }
}

describe('PaginatedInventoryGrid selection', () => {
  it('keeps the pick when the pointer moves to another slot', async () => {
    const { user, onSelect, slotFor } = renderGrid()
    const worm = slotFor('River Worm')

    await user.click(worm)
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ itemInstanceId: 'worm-1' }))

    // Passing over a neighbour used to run the shared tooltip closer, which
    // cleared the pick and emptied the inspector.
    await user.hover(slotFor('Glow Grub'))
    await user.unhover(slotFor('Glow Grub'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(worm).toHaveAttribute('data-selected', 'true')
  })

  it('keeps the pick when the pointer leaves the grid entirely', async () => {
    const { user, onSelect, slotFor } = renderGrid()
    const worm = slotFor('River Worm')

    await user.click(worm)
    await user.unhover(worm)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(worm).toHaveAttribute('data-selected', 'true')
  })

  it('drops the pick when the same slot is clicked again', async () => {
    const { user, onSelect, slotFor } = renderGrid()
    const worm = slotFor('River Worm')

    await user.click(worm)
    await user.click(worm)

    expect(onSelect).toHaveBeenLastCalledWith(null)
    expect(worm).not.toHaveAttribute('data-selected')
  })
})

describe('PaginatedInventoryGrid favorites', () => {
  it('wears a star on a favorited slot and says so to a reader', () => {
    const { slotFor } = renderGrid({
      items: [{ ...item('river-worm', 'worm-1'), favorite: true }, item('glow-grub', 'grub-1')],
    })

    expect(slotFor('River Worm')).toHaveAttribute('data-favorite', 'true')
    expect(slotFor('River Worm')).toHaveAccessibleName(/favorite$/)
    expect(slotFor('Glow Grub')).not.toHaveAttribute('data-favorite')
  })

  it('lets the screen decide what counts as a favorite', () => {
    const { slotFor } = renderGrid({
      isItemFavorite: (entry) => entry.definitionId === 'glow-grub',
    })

    expect(slotFor('Glow Grub')).toHaveAttribute('data-favorite', 'true')
    expect(slotFor('River Worm')).not.toHaveAttribute('data-favorite')
  })
})

describe('PaginatedInventoryGrid hover card', () => {
  it('carries the same facts as the inspector', async () => {
    const { user, slotFor } = renderGrid()

    await user.hover(slotFor('River Worm'))

    const card = await screen.findByRole('tooltip')
    expect(within(card).getByText('River Worm')).toBeInTheDocument()
    expect(within(card).getByText('Uncommon')).toBeInTheDocument()
    expect(within(card).getByText('Quantity')).toBeInTheDocument()
    expect(within(card).getByText('Source')).toBeInTheDocument()
    expect(within(card).getByText('Salvage')).toBeInTheDocument()
  })

  it('lists a rod\'s rolls one per line with their tiers, as an artifact\'s card does', async () => {
    const rod: InventoryItemInstance = {
      ...item('tideback-fishing-rod', 'rod-1'),
      metadata: {
        rarity: 'rare',
        modifierIds: ['rarity', 'bait-retention', 'speed'],
        modifierTiers: { rarity: 5, 'bait-retention': 1, speed: 2 },
        rarityBonusPercent: 1,
        baitRetentionPercent: 45,
        speedPercent: 4,
      },
    }
    const { user } = renderGrid({ items: [rod] })

    await user.hover(screen.getByRole('listitem', { name: /^Tideback rod,/ }))

    const card = await screen.findByRole('tooltip')
    const rows = within(card).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      '+1% FortuneT5',
      '+45% Bait KeeperT1',
      '+4% Quick LineT2',
    ])
    expect(within(card).queryByText(/Fortune,/)).not.toBeInTheDocument()
  })

  it('offers no way to spend an item from a card the pointer can leave', async () => {
    const { user, slotFor } = renderGrid()

    await user.hover(slotFor('River Worm'))

    const card = await screen.findByRole('tooltip')
    expect(within(card).queryByRole('button')).not.toBeInTheDocument()
  })

  it('closes when the pointer leaves, without disturbing the pick', async () => {
    const { user, onSelect, slotFor } = renderGrid()
    const worm = slotFor('River Worm')

    await user.click(worm)
    await user.hover(worm)
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()

    await user.unhover(worm)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
