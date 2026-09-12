// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { ContractsScreen } from './ContractsScreen'
import { formatTimeLeft } from './ContractTypes'
import type { ContractAssignment, ContractService, ContractState } from './ContractTypes'

const SERVER_TIME = '2026-09-13T12:00:00.000Z'

function assignment(overrides: Partial<ContractAssignment> & Pick<ContractAssignment, 'assignmentId' | 'definitionId'>): ContractAssignment {
  return {
    cadence: 'daily',
    periodKey: '2026-09-13',
    windowStart: '2026-09-13T00:00:00.000Z',
    windowEnd: '2026-09-14T00:00:00.000Z',
    slot: 1,
    target: 5,
    progress: 0,
    claimedAt: null,
    ...overrides,
  }
}

function state(contracts: ContractAssignment[]): ContractState {
  return { serverTime: SERVER_TIME, receivedAt: Date.now(), contracts }
}

const BOARD = state([
  assignment({ assignmentId: 1, definitionId: 'daily-catch', slot: 1, target: 5, progress: 2 }),
  assignment({ assignmentId: 2, definitionId: 'daily-descend', slot: 2, target: 8, progress: 11 }),
  assignment({ assignmentId: 3, definitionId: 'daily-unboxing', slot: 3, target: 2, progress: 2, claimedAt: '2026-09-13T10:00:00.000Z' }),
  assignment({
    assignmentId: 4,
    definitionId: 'weekly-angler',
    cadence: 'weekly',
    periodKey: '2026-W37',
    windowStart: '2026-09-07T00:00:00.000Z',
    windowEnd: '2026-09-14T00:00:00.000Z',
    target: 25,
    progress: 9,
  }),
])

function fakeService(overrides: Partial<ContractService> = {}): ContractService {
  return {
    loadState: vi.fn(async () => BOARD),
    claimReward: vi.fn(async () => ({ paid: [], wasProcessed: true, state: BOARD })),
    ...overrides,
  }
}

describe('ContractsScreen', () => {
  it('reads the board and shows each contract with its ask, progress and reward', async () => {
    renderComponent(<ContractsScreen service={fakeService()} configurationError={null} onBack={() => {}} />)

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'This week' })).toBeVisible()

    const catchCard = screen.getByRole('listitem', { name: /A day's catch: 2 of 5/ })
    expect(within(catchCard).getByText('Catch 5 fish')).toBeVisible()
    expect(within(catchCard).getByText('4 Roe')).toBeVisible()
    expect(within(catchCard).getByRole('progressbar', { name: /A day's catch progress/ })).toHaveAttribute('aria-valuenow', '2')
    expect(within(catchCard).getByRole('button', { name: 'In progress' })).toBeDisabled()

    const descendCard = screen.getByRole('listitem', { name: /Down the stairs: ready to claim/ })
    // Progress past the target is shown at the target, never beyond it.
    expect(within(descendCard).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8')
    expect(within(descendCard).getByRole('button', { name: 'Claim' })).toBeEnabled()

    const claimedCard = screen.getByRole('listitem', { name: /Unboxing: claimed/ })
    expect(within(claimedCard).getByRole('button', { name: 'Claimed' })).toBeDisabled()

    const weeklyCard = screen.getByRole('listitem', { name: /The angler: 9 of 25/ })
    expect(within(weeklyCard).getByText('Catch 25 fish')).toBeVisible()
  })

  it('claims a finished contract, toasts what it paid, and takes the server state as the truth', async () => {
    const after = state(BOARD.contracts.map((entry) =>
      entry.assignmentId === 2 ? { ...entry, claimedAt: '2026-09-13T12:01:00.000Z' } : entry,
    ))
    const service = fakeService({
      claimReward: vi.fn(async () => ({
        paid: [{ definitionId: 'timber', quantity: 12 }, { definitionId: 'stone', quantity: 12 }],
        wasProcessed: true,
        state: after,
      })),
    })
    const { user } = renderComponent(<ContractsScreen service={service} configurationError={null} onBack={() => {}} />)

    const descendCard = await screen.findByRole('listitem', { name: /Down the stairs: ready to claim/ })
    await user.click(within(descendCard).getByRole('button', { name: 'Claim' }))

    await waitFor(() => {
      expect(service.claimReward).toHaveBeenCalledWith(expect.any(String), 2)
    })
    expect(await screen.findByRole('listitem', { name: /Down the stairs: claimed/ })).toBeVisible()
    expect(screen.getAllByText('Contract fulfilled').length).toBe(2)
    expect(screen.getByText('Timber')).toBeVisible()
    expect(screen.getByText('Stone')).toBeVisible()
  })

  it('says so when a claim had already landed, and re-reads the board when a claim fails', async () => {
    const service = fakeService({
      claimReward: vi.fn()
        .mockResolvedValueOnce({ paid: [], wasProcessed: false, state: BOARD })
        .mockRejectedValueOnce(new Error('This contract is not finished yet.')),
    })
    const { user } = renderComponent(<ContractsScreen service={service} configurationError={null} onBack={() => {}} />)

    const descendCard = await screen.findByRole('listitem', { name: /Down the stairs: ready to claim/ })
    await user.click(within(descendCard).getByRole('button', { name: 'Claim' }))
    expect(await screen.findByText('Down the stairs was already claimed.')).toBeVisible()

    await user.click(within(descendCard).getByRole('button', { name: 'Claim' }))
    expect(await screen.findByText('This contract is not finished yet.', { selector: '.persistence-error' })).toBeVisible()
    await waitFor(() => {
      expect(service.loadState).toHaveBeenCalledTimes(2)
    })
  })

  it('explains itself when the service is missing or the board cannot be read', async () => {
    renderComponent(<ContractsScreen service={null} configurationError="Supabase is not configured." onBack={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Supabase is not configured.')

    const failing = fakeService({ loadState: vi.fn(async () => { throw new Error('The board is closed.') }) })
    renderComponent(<ContractsScreen service={failing} configurationError={null} onBack={() => {}} />)
    expect(await screen.findByText('The board is closed.')).toBeVisible()
  })

  it('goes back when asked', async () => {
    const onBack = vi.fn()
    const { user } = renderComponent(<ContractsScreen service={fakeService()} configurationError={null} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /Back to the refuge/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('formatTimeLeft', () => {
  const now = Date.parse(SERVER_TIME)

  it('reads days, hours and minutes at the right scale', () => {
    expect(formatTimeLeft('2026-09-14T00:00:00.000Z', now)).toBe('12h 0m left')
    expect(formatTimeLeft('2026-09-13T12:07:00.000Z', now)).toBe('7m left')
    expect(formatTimeLeft('2026-09-16T15:00:00.000Z', now)).toBe('3d 3h left')
    expect(formatTimeLeft('2026-09-13T12:00:10.000Z', now)).toBe('1m left')
  })

  it('never shows a negative window', () => {
    expect(formatTimeLeft('2026-09-13T11:00:00.000Z', now)).toBe('Ending now')
    expect(formatTimeLeft('not a date', now)).toBe('Ending now')
  })
})
