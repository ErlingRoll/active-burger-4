// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, within } from '../../testing/render'
import { GameDashboard, type GameDashboardProps } from './GameDashboard'
import type { ActiveDungeonRun } from '../../persistence'

const ACTIVE_RUN = {
  runId: 'run-1',
  dungeonId: 'sunken-keep',
  characterClassId: 'knight',
  floor: 3,
  maxFloor: 10,
} as unknown as ActiveDungeonRun

function renderDashboard(overrides: Partial<GameDashboardProps> = {}) {
  const onForfeitRun = vi.fn(() => Promise.resolve())
  const props: GameDashboardProps = {
    accountId: 'account-1',
    approvedNickname: 'Mira',
    providerDisplayName: null,
    email: null,
    essenceBalance: 120,
    presenceService: null,
    presenceConfigurationError: null,
    leaderboardService: null,
    leaderboardConfigurationError: null,
    activeRun: ACTIVE_RUN,
    runLoadState: 'ready',
    runLoadError: null,
    onOpenRunSetup: vi.fn(),
    onOpenMetaProgression: vi.fn(),
    onOpenFishing: vi.fn(),
    onOpenChampions: vi.fn(),
    onOpenInventory: vi.fn(),
    onOpenAbyss: vi.fn(),
    championAvailability: 'available',
    onContinueRun: vi.fn(),
    onForfeitRun,
    ...overrides,
  }
  return { ...renderComponent(<GameDashboard {...props} />), onForfeitRun }
}

describe('GameDashboard forfeit flow', () => {
  it('does not forfeit until the player confirms', async () => {
    const { user, onForfeitRun } = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Forfeit run' }))

    expect(screen.getByRole('dialog', { name: 'Forfeit dungeon run?' })).toBeInTheDocument()
    expect(onForfeitRun).not.toHaveBeenCalled()
  })

  it('forfeits once confirmed', async () => {
    const { user, onForfeitRun } = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Forfeit run' }))
    const dialog = screen.getByRole('dialog', { name: 'Forfeit dungeon run?' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Forfeit run' }),
    )

    expect(onForfeitRun).toHaveBeenCalledTimes(1)
  })

  it('abandons the forfeit when the player cancels', async () => {
    const { user, onForfeitRun } = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Forfeit run' }))
    const dialog = screen.getByRole('dialog', { name: 'Forfeit dungeon run?' })
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onForfeitRun).not.toHaveBeenCalled()
  })

  it('reports a failed forfeit instead of silently leaving the run in place', async () => {
    const { user } = renderDashboard({
      onForfeitRun: vi.fn(() => Promise.reject(new Error('Network unreachable'))),
    })

    await user.click(screen.getByRole('button', { name: 'Forfeit run' }))
    const dialog = screen.getByRole('dialog', { name: 'Forfeit dungeon run?' })
    await user.click(within(dialog).getByRole('button', { name: 'Forfeit run' }))

    expect(await screen.findByText('Network unreachable')).toBeInTheDocument()
  })
})
