// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { ChampionManagementScreen } from './ChampionManagementScreen'
import type { CharacterService, ChampionSnapshot } from './CharacterTypes'
import type { InventoryItemInstance, InventoryService } from '../inventory'

const NOW = Date.now()

const champion: ChampionSnapshot = {
  championId: 'champion-1',
  name: 'Mira of the Keep',
  sourceRunId: 'run-1',
  contentVersion: 'test',
  build: {
    schemaVersion: 1,
    classId: 'knight',
    skills: [
      { skillId: 'basic-attack', level: 1 },
      { skillId: 'whirlwind', level: 2 },
    ],
    selectedUpgradeIds: [],
    equipment: {},
    behaviorProfileId: 'balanced',
  },
  // Two and a half hours plus a little, so the countdown rounds to 2h 31m
  // rather than sitting on a minute boundary the clock could tick past.
  exhaustionUntil: new Date(NOW + 2.5 * 3_600_000 + 30_000).toISOString(),
  archived: false,
  createdAt: '2026-09-10T00:00:00.000Z',
}

const koi: InventoryItemInstance = {
  itemInstanceId: 'fish-1',
  definitionId: 'revival-koi',
  quantity: 1,
  bound: false,
  metadata: { rarity: 'epic', sizePercentile: 0.5 },
  source: { type: 'fishing', id: null },
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
}

function renderScreen(fish: InventoryItemInstance[]) {
  const reviveChampion = vi.fn(async () => ({
    ...champion,
    exhaustionUntil: null,
    fishInstanceId: koi.itemInstanceId,
    exhaustionReductionSeconds: 9_000,
    wasProcessed: true,
  }))
  const service = {
    loadCharacters: vi.fn(async () => ({ characters: [], revisions: [], champions: [champion] })),
    reviveChampion,
  } as unknown as CharacterService
  const inventoryService = {
    loadInventory: vi.fn(async () => fish),
  } as unknown as InventoryService
  const rendered = renderComponent(
    <ChampionManagementScreen
      service={service}
      inventoryService={inventoryService}
      inventoryError={null}
      campService={null}
      configurationError={null}
      onBack={vi.fn()}
    />,
  )
  return { ...rendered, reviveChampion }
}

describe('ChampionManagementScreen exhaustion', () => {
  it('labels an exhausted Champion and revives it with a chosen Revival Koi', async () => {
    const { user, reviveChampion } = renderScreen([koi])

    const details = await screen.findByRole('region', { name: 'Mira of the Keep' })
    expect(within(details).getByText(/^Exhausted · 2h \d+m remaining$/)).toBeInTheDocument()

    await user.click(within(details).getByRole('button', { name: 'Revive' }))
    const picker = screen.getByRole('region', { name: 'Choose a Revival Koi' })
    await user.click(within(picker).getByRole('button', { name: /Revival Koi/ }))

    await waitFor(() => {
      expect(reviveChampion).toHaveBeenCalledWith(expect.any(String), 'champion-1', 'fish-1')
    })
    await waitFor(() => {
      expect(within(details).getByText('Available')).toBeInTheDocument()
    })
    expect(within(details).queryByRole('button', { name: 'Revive' })).not.toBeInTheDocument()
  })

  it('tells the player to go fishing when no Revival Koi is left', async () => {
    const { user } = renderScreen([])

    const details = await screen.findByRole('region', { name: 'Mira of the Keep' })
    await user.click(within(details).getByRole('button', { name: 'Revive' }))

    expect(screen.getByText('You are out of Revival Koi. Go fish')).toBeInTheDocument()
  })
})
