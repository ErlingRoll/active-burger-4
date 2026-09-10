// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { RunChronicleScreen } from './RunChronicleScreen'
import { createGame } from '../game/Game'
import type {
  DungeonRunPersistenceService,
  DungeonRunSnapshotRecord,
  FinishedDungeonRun,
} from '../persistence'

const DUNGEON_RUN: FinishedDungeonRun = {
  runId: 'run-1',
  outcome: 'victory',
  modeId: 'dungeon',
  dungeonId: 'default-dungeon',
  characterClassId: 'ranger',
  worldModifierIds: ['swarming'],
  reachedFloor: 10,
  maxFloor: 10,
  level: 24,
  killCount: 812,
  essenceEarned: 305,
  gameVersion: 'test',
  startedAt: '2026-09-09T10:00:00.000Z',
  completedAt: '2026-09-09T10:41:00.000Z',
}

const ABYSS_RUN: FinishedDungeonRun = {
  ...DUNGEON_RUN,
  runId: 'run-2',
  outcome: 'defeat',
  modeId: 'infinite-abyss',
  reachedFloor: 47,
  level: 61,
  killCount: 4_120,
  essenceEarned: 0,
  completedAt: '2026-09-08T21:12:00.000Z',
}

function terminalSnapshot(payload: unknown): DungeonRunSnapshotRecord {
  return {
    kind: 'victory',
    floor: 10,
    payload,
    capturedAt: '2026-09-09T10:41:00.000Z',
  }
}

function storedCheckpoint(): unknown {
  return JSON.parse(JSON.stringify(createGame({ seed: 7 }).createCheckpoint()))
}

function fakeService(overrides: {
  runs?: FinishedDungeonRun[]
  snapshot?: DungeonRunSnapshotRecord | null
  snapshotError?: Error
} = {}) {
  const loadTerminalSnapshot = vi.fn(async () => {
    if (overrides.snapshotError) {
      throw overrides.snapshotError
    }
    return overrides.snapshot === undefined
      ? terminalSnapshot(storedCheckpoint())
      : overrides.snapshot
  })
  const service = {
    listFinishedRuns: vi.fn(async () => overrides.runs ?? [DUNGEON_RUN, ABYSS_RUN]),
    loadTerminalSnapshot,
  } as unknown as DungeonRunPersistenceService
  return { service, loadTerminalSnapshot }
}

function renderChronicle(service: DungeonRunPersistenceService | null) {
  return renderComponent(
    <RunChronicleScreen
      service={service}
      configurationError={service === null ? 'Supabase is not configured.' : null}
      onBack={vi.fn()}
    />,
  )
}

describe('RunChronicleScreen', () => {
  it('lists finished runs newest first with what each one reached', async () => {
    const { service } = fakeService()
    renderChronicle(service)

    const entries = await screen.findAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(within(entries[0] as HTMLElement).getByText('Victory')).toBeInTheDocument()
    expect(within(entries[0] as HTMLElement).getByText('Floor 10 / 10')).toBeInTheDocument()
    expect(within(entries[0] as HTMLElement).getByText('305')).toBeInTheDocument()
    // The Abyss has no contract to measure against and pays no Essence.
    expect(within(entries[1] as HTMLElement).getByText('Floor 47')).toBeInTheDocument()
    expect(within(entries[1] as HTMLElement).queryByText('Essence')).not.toBeInTheDocument()
    // The tally in the chrome, which is what the screen is read for at a glance.
    const summary = screen.getByRole('button', { name: /Back to the refuge/ }).parentElement
    expect(summary).not.toBeNull()
    expect(within(summary as HTMLElement).getByText('Victories').nextSibling)
      .toHaveTextContent('1')
    expect(within(summary as HTMLElement).getByText('Deepest').nextSibling)
      .toHaveTextContent('Floor 47')
  })

  it('reads the report of the run the player opens, and only that run', async () => {
    const { service, loadTerminalSnapshot } = fakeService()
    const { user } = renderChronicle(service)

    const entries = await screen.findAllByRole('listitem')
    await user.click(within(entries[0] as HTMLElement).getByRole('button'))

    expect(await screen.findByRole('heading', { name: 'Skill damage' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Skill healing' })).toBeInTheDocument()
    expect(screen.getByText('Swarming')).toBeInTheDocument()
    expect(loadTerminalSnapshot).toHaveBeenCalledTimes(1)
    expect(loadTerminalSnapshot).toHaveBeenCalledWith('run-1')
  })

  it('collapses a run again without reading it a second time', async () => {
    const { service, loadTerminalSnapshot } = fakeService()
    const { user } = renderChronicle(service)

    const entries = await screen.findAllByRole('listitem')
    const summary = within(entries[0] as HTMLElement).getByRole('button')
    await user.click(summary)
    await screen.findByRole('heading', { name: 'Skill damage' })
    await user.click(summary)

    expect(screen.queryByRole('heading', { name: 'Skill damage' })).not.toBeInTheDocument()

    await user.click(summary)
    await screen.findByRole('heading', { name: 'Skill damage' })
    expect(loadTerminalSnapshot).toHaveBeenCalledTimes(1)
  })

  it('says a record is from an older version rather than showing empty figures', async () => {
    const { service } = fakeService({
      snapshot: terminalSnapshot({ version: 999, gameState: {} }),
    })
    const { user } = renderChronicle(service)

    const entries = await screen.findAllByRole('listitem')
    await user.click(within(entries[0] as HTMLElement).getByRole('button'))

    expect(await screen.findByText(/earlier version of the game/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Skill damage' })).not.toBeInTheDocument()
  })

  it('says a run kept no record when it saved none', async () => {
    const { service } = fakeService({ snapshot: null })
    const { user } = renderChronicle(service)

    const entries = await screen.findAllByRole('listitem')
    await user.click(within(entries[0] as HTMLElement).getByRole('button'))

    expect(await screen.findByText(/saved no final record/)).toBeInTheDocument()
  })

  it('reports a failed read against the run it failed for', async () => {
    const { service } = fakeService({ snapshotError: new Error('Network unreachable.') })
    const { user } = renderChronicle(service)

    const entries = await screen.findAllByRole('listitem')
    await user.click(within(entries[0] as HTMLElement).getByRole('button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unreachable.')
  })

  it('invites a first run when nothing has been finished yet', async () => {
    const { service } = fakeService({ runs: [] })
    renderChronicle(service)

    expect(await screen.findByRole('heading', { name: 'Nothing written yet' }))
      .toBeInTheDocument()
  })

  it('explains itself when the chronicle cannot be reached at all', async () => {
    renderChronicle(null)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Supabase is not configured.')
    })
  })

  it('reports the read failing rather than an empty chronicle', async () => {
    const service = {
      listFinishedRuns: vi.fn(async () => {
        throw new Error('The chronicle is closed.')
      }),
      loadTerminalSnapshot: vi.fn(),
    } as unknown as DungeonRunPersistenceService
    renderChronicle(service)

    expect(await screen.findByRole('alert')).toHaveTextContent('The chronicle is closed.')
  })
})
