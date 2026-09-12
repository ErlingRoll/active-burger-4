// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { ContractBoard } from './ContractBoard'
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
    repeatClaims: 0,
    claimedAt: null,
    ...overrides,
  }
}

function state(contracts: ContractAssignment[], dailyClaimed = 0): ContractState {
  return { serverTime: SERVER_TIME, receivedAt: Date.now(), dailyClaimed, contracts }
}

const BOARD = state([
  assignment({ assignmentId: 1, definitionId: 'daily-catch', slot: 1, target: 5, progress: 2 }),
  assignment({ assignmentId: 2, definitionId: 'daily-descend', slot: 2, target: 8, progress: 11 }),
  assignment({ assignmentId: 3, definitionId: 'daily-unboxing', slot: 3, target: 2, progress: 0 }),
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
], 1)

/** The board after the second slot was claimed: a fresh contract in its place, the tally up one. */
const AFTER_CLAIM = state([
  BOARD.contracts[0]!,
  assignment({ assignmentId: 9, definitionId: 'daily-cull', slot: 2, target: 300, progress: 0, windowStart: '2026-09-13T12:01:00.000Z' }),
  BOARD.contracts[2]!,
  BOARD.contracts[3]!,
], 2)

function fakeService(overrides: Partial<ContractService> = {}): ContractService {
  return {
    loadState: vi.fn(async () => BOARD),
    claimReward: vi.fn(async () => ({ paid: [], wasProcessed: true, state: BOARD })),
    ...overrides,
  }
}

describe('ContractBoard', () => {
  it('reads the board and shows each contract as a line with its ask, bar and pay', async () => {
    renderComponent(<ContractBoard service={fakeService()} configurationError={null} />)

    expect(await screen.findByRole('heading', { name: 'Contracts' })).toBeVisible()
    expect(screen.getByText(/1 claimed today/)).toBeVisible()

    const daily = screen.getByRole('list', { name: 'Daily contracts' })
    expect(within(daily).getAllByRole('listitem', { name: /:/ })).toHaveLength(3)
    const catchRow = within(daily).getByRole('listitem', { name: /A day's catch: 2 of 5/ })
    expect(within(catchRow).getByText('Catch 5 fish')).toBeVisible()
    expect(within(catchRow).getByRole('progressbar', { name: /A day's catch progress/ })).toHaveAttribute('aria-valuenow', '2')
    expect(within(catchRow).getByText('Roe')).toBeInTheDocument()
    expect(within(catchRow).queryByRole('button', { name: 'Claim' })).toBeNull()

    const descendRow = within(daily).getByRole('listitem', { name: /Down the stairs: ready to claim/ })
    // Progress past the target is shown at the target, never beyond it.
    expect(within(descendRow).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8')
    expect(within(descendRow).getByRole('button', { name: 'Claim' })).toBeEnabled()

    const weekly = screen.getByRole('list', { name: 'Weekly contract' })
    expect(within(weekly).getByRole('listitem', { name: /The angler: 9 of 25/ })).toBeVisible()
    expect(screen.getByText('This week')).toBeVisible()
  })

  it('claims a finished daily, toasts what it paid, and shows the contract dealt in its place', async () => {
    const service = fakeService({
      claimReward: vi.fn(async () => ({
        paid: [{ definitionId: 'timber', quantity: 12 }, { definitionId: 'stone', quantity: 12 }],
        wasProcessed: true,
        state: AFTER_CLAIM,
      })),
    })
    const { user } = renderComponent(<ContractBoard service={service} configurationError={null} />)

    const descendRow = await screen.findByRole('listitem', { name: /Down the stairs: ready to claim/ })
    await user.click(within(descendRow).getByRole('button', { name: 'Claim' }))

    await waitFor(() => {
      expect(service.claimReward).toHaveBeenCalledWith(expect.any(String), 2)
    })
    expect(await screen.findByRole('listitem', { name: /A cull: 0 of 300/ })).toBeVisible()
    expect(screen.queryByRole('listitem', { name: /Down the stairs/ })).toBeNull()
    expect(screen.getByText(/2 claimed today/)).toBeVisible()
    expect(screen.getAllByText('Contract fulfilled')).toHaveLength(2)
  })

  it('shows half pay on a contract dealt for the third time today', async () => {
    const repeated = state([
      assignment({ assignmentId: 5, definitionId: 'daily-catch', slot: 1, target: 5, progress: 5, repeatClaims: 2 }),
    ])
    renderComponent(<ContractBoard service={fakeService({ loadState: vi.fn(async () => repeated) })} configurationError={null} />)

    const row = await screen.findByRole('listitem', { name: /A day's catch: ready to claim/ })
    const reward = within(row).getByRole('list', { name: 'Reward, halved for a repeat' })
    expect(within(reward).getByText('2')).toBeVisible()
    expect(within(reward).getByText('½')).toBeVisible()
  })

  it('marks a claimed weekly rather than replacing it', async () => {
    const claimedWeekly = state(BOARD.contracts.map((entry) =>
      entry.cadence === 'weekly' ? { ...entry, progress: 30, claimedAt: '2026-09-13T11:00:00.000Z' } : entry,
    ))
    renderComponent(<ContractBoard service={fakeService({ loadState: vi.fn(async () => claimedWeekly) })} configurationError={null} />)

    const row = await screen.findByRole('listitem', { name: /The angler: claimed/ })
    expect(within(row).getByText('Claimed')).toBeVisible()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('says so when a claim had already landed, and re-reads the board when a claim fails', async () => {
    const service = fakeService({
      claimReward: vi.fn()
        .mockResolvedValueOnce({ paid: [], wasProcessed: false, state: BOARD })
        .mockRejectedValueOnce(new Error('This contract is not finished yet.')),
    })
    const { user } = renderComponent(<ContractBoard service={service} configurationError={null} />)

    const descendRow = await screen.findByRole('listitem', { name: /Down the stairs: ready to claim/ })
    await user.click(within(descendRow).getByRole('button', { name: 'Claim' }))
    expect(await screen.findByText('Down the stairs was already claimed.')).toBeVisible()

    await user.click(within(descendRow).getByRole('button', { name: 'Claim' }))
    expect(await screen.findByText('This contract is not finished yet.')).toBeVisible()
    await waitFor(() => {
      expect(service.loadState).toHaveBeenCalledTimes(2)
    })
  })

  it('explains itself when the service is missing or the board cannot be read', async () => {
    renderComponent(<ContractBoard service={null} configurationError="Supabase is not configured." />)
    expect(screen.getByRole('status')).toHaveTextContent('Supabase is not configured.')

    const failing = fakeService({ loadState: vi.fn(async () => { throw new Error('The board is closed.') }) })
    renderComponent(<ContractBoard service={failing} configurationError={null} />)
    expect(await screen.findByText('The board is closed.')).toBeVisible()
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
