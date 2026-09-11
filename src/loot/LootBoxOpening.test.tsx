// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Rarity } from '../content/rarity/Rarity'
import { renderComponent, screen } from '../testing/render'
import { LootBoxOpening } from './LootBoxOpening'
import type { LootBoxOpeningItem, LootBoxOpeningResult } from './LootBoxService'
import type { LootBoxOpeningSession } from './useLootBoxOpening'

function reward(definitionId: string, itemInstanceId: string): LootBoxOpeningItem {
  return {
    itemInstanceId,
    definitionId,
    quantity: 1,
    metadata: { rarity: Rarity.Legendary, speciesId: definitionId, sizePercentile: 0.5 },
  }
}

function session(overrides: Partial<LootBoxOpeningSession>): LootBoxOpeningSession {
  return {
    boxName: 'Legendary Loot Box',
    rarity: Rarity.Legendary,
    phase: 'charging',
    boxCount: 1,
    results: [],
    error: null,
    ...overrides,
  }
}

function opened(boxInstanceId: string, items: LootBoxOpeningItem[]): LootBoxOpeningResult {
  return { boxInstanceId, boxRarity: Rarity.Legendary, items, wasProcessed: true }
}

describe('LootBoxOpening', () => {
  it('shows nothing at all until a box is being opened', () => {
    renderComponent(<LootBoxOpening session={null} onDismiss={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('holds the screen while the box is charging, with no way to skip it', () => {
    renderComponent(
      <LootBoxOpening session={session({ phase: 'charging' })} onDismiss={vi.fn()} />,
    )

    expect(screen.getByRole('dialog', { name: 'Opening Legendary Loot Box' }))
      .toHaveAttribute('data-phase', 'charging')
    expect(screen.getByRole('status')).toHaveTextContent('Opening the legendary box…')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('reveals every item a box gave up', () => {
    renderComponent(
      <LootBoxOpening
        session={session({
          phase: 'revealing',
          results: [opened('box-1', [
            reward('glow-grub', 'a'),
            reward('moonwater-lure', 'b'),
            reward('river-minnow', 'c'),
            reward('revival-koi', 'd'),
          ])],
        })}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('Legendary box opened')).toBeInTheDocument()
    for (const name of ['Glow Grub', 'Moonwater Lure', 'River Minnow', 'Revival Koi']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Take all' })).toBeInTheDocument()
  })

  it('offers to take the one thing a single-draw box gave', async () => {
    const onDismiss = vi.fn()
    const { user } = renderComponent(
      <LootBoxOpening
        session={session({
          boxName: 'Common Loot Box',
          rarity: Rarity.Common,
          phase: 'revealing',
          results: [{
            boxInstanceId: 'box-1',
            boxRarity: Rarity.Common,
            items: [reward('river-minnow', 'a')],
            wasProcessed: true,
          }],
        })}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Take it' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('counts a batch off while it charges, and counts the haul together', () => {
    const { rerender } = renderComponent(
      <LootBoxOpening
        session={session({
          boxCount: 3,
          results: [opened('box-1', [reward('glow-grub', 'a')])],
        })}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Opening 3 legendary boxes… 1 of 3')

    rerender(
      <LootBoxOpening
        session={session({
          phase: 'revealing',
          boxCount: 3,
          results: [
            opened('box-1', [reward('glow-grub', 'a'), reward('river-minnow', 'b')]),
            opened('box-2', [reward('glow-grub', 'c'), reward('glow-grub', 'd')]),
            opened('box-3', [reward('moonwater-lure', 'e')]),
          ],
        })}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('3 legendary boxes opened')).toBeInTheDocument()
    // Three glow grubs are one card with a count, not three cards.
    expect(screen.getAllByText('Glow Grub')).toHaveLength(1)
    expect(screen.getByText('×3')).toBeInTheDocument()
    expect(screen.getByText('River Minnow')).toBeInTheDocument()
    expect(screen.getByText('Moonwater Lure')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take all' })).toBeInTheDocument()
  })

  it('keeps what a batch had already given when a later box fails', () => {
    renderComponent(
      <LootBoxOpening
        session={session({
          phase: 'failed',
          boxCount: 5,
          results: [opened('box-1', [reward('glow-grub', 'a')])],
          error: 'Loot box is not owned.',
        })}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Loot box is not owned.')
    expect(screen.getByText('1 box opened before it stopped')).toBeInTheDocument()
    expect(screen.getByText('Glow Grub')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take what came out' })).toBeInTheDocument()
  })

  it('reports a failed opening in place of the reward', () => {
    renderComponent(
      <LootBoxOpening
        session={session({ phase: 'failed', error: 'Loot box is not owned.' })}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Loot box is not owned.')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
