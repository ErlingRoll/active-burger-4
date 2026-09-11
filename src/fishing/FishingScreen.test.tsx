// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { FishingScreen } from './FishingScreen'
import type { BeginFishingInput, FishingService } from './FishingService'
import type { InventoryItemInstance, InventoryService } from '../inventory/InventoryTypes'

function item(
  definitionId: string,
  itemInstanceId: string,
  overrides: Partial<InventoryItemInstance> = {},
): InventoryItemInstance {
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
    ...overrides,
  }
}

/* Three rows of worm, two of them the same kind, and two rods of one name. */
const items = [
  item('river-worm', 'worm-oldest', { quantity: 1, createdAt: '2026-09-01T00:00:00.000Z' }),
  item('river-worm', 'worm-newer', { quantity: 4 }),
  item('glow-grub', 'grub-1', { quantity: 2 }),
  item('silverline-fishing-rod', 'rod-fortune', {
    metadata: {
      rarity: 'uncommon',
      modifierIds: ['rarity', 'speed'],
      modifierTiers: { rarity: 2, speed: 4 },
      rarityBonusPercent: 11,
      speedPercent: 2,
    },
  }),
  item('silverline-fishing-rod', 'rod-keeper', {
    metadata: {
      rarity: 'uncommon',
      modifierIds: ['bait-retention'],
      modifierTiers: { 'bait-retention': 1 },
      baitRetentionPercent: 48,
    },
  }),
]

function renderFishingScreen() {
  const inventoryService = {
    loadInventory: vi.fn(() => Promise.resolve(items)),
  } as unknown as InventoryService
  const beginAttempt = vi.fn((input: BeginFishingInput) => Promise.resolve({
    attemptId: input.attemptId,
    mode: input.mode,
    status: 'pending' as const,
    resolveAt: '2099-01-01T00:00:00.000Z',
    pityAt: '2099-01-01T00:00:00.000Z',
    resolveAtClientTime: Date.now() + 600_000,
    pityAtClientTime: Date.now() + 600_000,
    wasProcessed: false,
  }))
  const fishingService = {
    beginAttempt,
    resolveAttempt: vi.fn(),
    publishActivity: vi.fn(() => Promise.resolve()),
    loadActiveAnglers: vi.fn(() => Promise.resolve([])),
    trackAngler: vi.fn(() => Promise.resolve()),
    subscribeToActivity: vi.fn(() => () => {}),
  } as unknown as FishingService
  const result = renderComponent(
    <FishingScreen
      fishingService={fishingService}
      inventoryService={inventoryService}
      lootBoxService={null}
      configurationError={null}
      activityPlayerId="player-1"
      activityPlayerApprovedNickname="Mira"
      activityPlayerProviderName={null}
      activityPlayerEmail={null}
    />,
  )
  return { ...result, beginAttempt }
}

describe('FishingScreen loadout', () => {
  it('offers each kind of bait once, counted across its rows', async () => {
    const { user } = renderFishingScreen()
    await screen.findByRole('button', { name: /Basic Bait/ })

    await user.click(screen.getByRole('button', { name: /Basic Bait/ }))

    const list = screen.getByRole('listbox', { name: 'Bait' })
    const rows = within(list).getAllByRole('option')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Basic Bait'),
      expect.stringContaining('Glow Grub'),
      expect.stringContaining('River Worm'),
    ])
    expect(within(list).getByRole('option', { name: /River Worm/ })).toHaveTextContent('×5')
    expect(within(list).getByRole('option', { name: /River Worm/ })).toHaveTextContent('rarity +10%')
    expect(within(list).getByRole('option', { name: /Glow Grub/ })).toHaveTextContent('×2')
  })

  it('spends the oldest row of the chosen bait', async () => {
    const { user, beginAttempt } = renderFishingScreen()
    await screen.findByRole('button', { name: /Basic Bait/ })
    await user.click(screen.getByRole('button', { name: /Basic Bait/ }))
    await user.click(screen.getByRole('option', { name: /River Worm/ }))
    expect(screen.getByRole('button', { name: /River Worm/ })).toHaveTextContent('×5')

    await user.click(screen.getByRole('button', { name: 'Cast' }))

    await waitFor(() => expect(beginAttempt).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(beginAttempt).toHaveBeenCalledWith(expect.objectContaining({
      baitDefinitionId: 'river-worm',
      baitInstanceId: 'worm-oldest',
      rodInstanceId: null,
    }))
  })

  it('tells two rods of one name apart by their rolls', async () => {
    const { user } = renderFishingScreen()
    await screen.findByRole('button', { name: /Wooden rod/ })

    await user.click(screen.getByRole('button', { name: /Wooden rod/ }))

    const list = screen.getByRole('listbox', { name: 'Rod' })
    const silverlines = within(list).getAllByRole('option', { name: /Silverline rod/ })
    expect(silverlines).toHaveLength(2)
    expect(silverlines.map((row) => row.textContent)).toEqual([
      expect.stringContaining('T2 +11% Fortune, T4 +2% Quick Line'),
      expect.stringContaining('T1 +48% Bait Keeper'),
    ])

    await user.hover(silverlines[1] as HTMLElement)
    const card = screen.getByRole('tooltip')
    expect(card).toHaveTextContent('Bait Keeper')
    expect(card).toHaveTextContent('T1 · +48%')
    expect(card).toHaveTextContent('Can preserve non-unlimited bait after a catch.')
  })
})
