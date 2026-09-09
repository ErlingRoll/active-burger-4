// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Rarity } from '../content/rarity/Rarity'
import { renderComponent, screen } from '../testing/render'
import { LootBoxOpening } from './LootBoxOpening'
import type { LootBoxOpeningItem } from './LootBoxService'
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
    result: null,
    error: null,
    ...overrides,
  }
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
          result: {
            boxInstanceId: 'box-1',
            boxRarity: Rarity.Legendary,
            items: [
              reward('glow-grub', 'a'),
              reward('moonwater-lure', 'b'),
              reward('river-minnow', 'c'),
              reward('revival-koi', 'd'),
            ],
            wasProcessed: true,
          },
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
          result: {
            boxInstanceId: 'box-1',
            boxRarity: Rarity.Common,
            items: [reward('river-minnow', 'a')],
            wasProcessed: true,
          },
        })}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Take it' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
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
