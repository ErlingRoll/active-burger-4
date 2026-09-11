// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Rarity } from '../content/rarity/Rarity'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import { renderComponent, screen, within } from '../testing/render'
import { LootBoxShelf } from './LootBoxShelf'
import { stackLootBoxes } from './LootBoxStacks'

function box(rarity: string, itemInstanceId: string): InventoryItemInstance {
  return {
    itemInstanceId,
    definitionId: `loot-box-${rarity}`,
    quantity: 1,
    bound: false,
    metadata: {},
    source: { type: 'abyss-reward', id: null },
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  }
}

describe('stackLootBoxes', () => {
  it('counts identical boxes as one row', () => {
    const stacks = stackLootBoxes([
      box('legendary', 'a'),
      box('legendary', 'b'),
      box('legendary', 'c'),
      box('rare', 'd'),
    ])

    expect(stacks.map((stack) => [stack.name, stack.quantity])).toEqual([
      ['Legendary Loot Box', 3],
      ['Rare Loot Box', 1],
    ])
  })

  it('puts the best box at the top of the shelf', () => {
    const stacks = stackLootBoxes([
      box('common', 'a'),
      box('epic', 'b'),
      box('uncommon', 'c'),
    ])

    expect(stacks.map((stack) => stack.rarity)).toEqual([
      Rarity.Epic,
      Rarity.Uncommon,
      Rarity.Common,
    ])
  })

  it('keeps one instance of each kind to spend', () => {
    const [stack] = stackLootBoxes([box('rare', 'first'), box('rare', 'second')])

    expect(stack?.first.itemInstanceId).toBe('first')
  })
})

describe('LootBoxShelf', () => {
  // The list pages to the rows its container has room for, and a container has
  // no height in jsdom, so each of these renders one kind at a time.
  it.each([
    ['legendary', 'Legendary Loot Box', '4 items inside'],
    ['rare', 'Rare Loot Box', '2 items inside'],
    ['common', 'Common Loot Box', '1 item inside'],
  ])('says what a %s box is worth before it is opened', (rarity, name, worth) => {
    renderComponent(
      <LootBoxShelf
        stacks={stackLootBoxes([box(rarity, 'a')])}
        label="Unopened loot boxes"
        opening={false}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText(name)).toBeInTheDocument()
    expect(screen.getByText(worth)).toBeInTheDocument()
  })

  it('shows the drop table and its odds when a box is focused', async () => {
    renderComponent(
      <LootBoxShelf
        stacks={stackLootBoxes([box('legendary', 'a')])}
        label="Unopened loot boxes"
        opening={false}
        onOpen={vi.fn()}
      />,
    )

    screen.getByRole('button', { name: 'Open one' }).focus()

    const card = await screen.findByRole('tooltip')
    expect(within(card).getByText('Legendary · 4 draws')).toBeInTheDocument()
    // The published odds are the server's, out of a thousand: a legendary box
    // draws a glow grub a fifth of the time.
    expect(within(card).getByText('20.0%')).toBeInTheDocument()
    expect(within(card).getByText('Glow Grub')).toBeInTheDocument()
    expect(within(card).getByText('Wooden rod')).toBeInTheDocument()
  })

  it('spends an instance of the kind that was asked for', async () => {
    const onOpen = vi.fn()
    const { user } = renderComponent(
      <LootBoxShelf
        stacks={stackLootBoxes([box('epic', 'epic-1'), box('epic', 'epic-2')])}
        label="Unopened loot boxes"
        opening={false}
        onOpen={onOpen}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open one' }))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen.mock.calls[0]?.[0]).toMatchObject({
      definitionId: 'loot-box-epic',
      quantity: 2,
    })
  })

  it('holds every button shut while a box is in flight', () => {
    renderComponent(
      <LootBoxShelf
        stacks={stackLootBoxes([box('rare', 'a'), box('common', 'b')])}
        label="Unopened loot boxes"
        opening
        onOpen={vi.fn()}
      />,
    )

    for (const button of screen.getAllByRole('button', { name: 'Opening…' })) {
      expect(button).toBeDisabled()
    }
  })
})
