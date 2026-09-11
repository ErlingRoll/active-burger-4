// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, within } from '../../testing/render'
import { RunSetupScreen, type RunSetupScreenProps } from './RunSetupScreen'
import { DEFAULT_SETTINGS } from '../../persistence'
import type { CharacterService, ChampionSnapshot } from '../../characters'
import type { CampService, CampState } from '../../camp/CampTypes'

const NOW = Date.now()

function champion(championId: string, name: string, exhaustionUntil: string | null = null): ChampionSnapshot {
  return {
    championId,
    name,
    sourceRunId: `run-${championId}`,
    contentVersion: 'test',
    build: {
      schemaVersion: 1,
      classId: 'knight',
      skills: [{ skillId: 'basic-attack', level: 1 }],
      selectedUpgradeIds: [],
      equipment: {},
      behaviorProfileId: 'balanced',
    },
    exhaustionUntil,
    archived: false,
    createdAt: '2026-09-10T00:00:00.000Z',
  }
}

const rested = champion('champion-rested', 'Mira of the Keep')
const exhausted = champion(
  'champion-exhausted',
  'Tolan the Spent',
  new Date(NOW + 2.5 * 3_600_000 + 30_000).toISOString(),
)
const working = champion('champion-working', 'Bryn at the Woodline')

const CAMP_STATE = {
  serverTime: new Date(NOW).toISOString(),
  receivedAt: NOW,
  storehouseCapHours: 12,
  buildings: [{ buildingId: 'woodline', level: 1 }],
  assignments: [{
    championId: working.championId,
    jobId: 'woodline-timber',
    sheet: { tempo: 1, staminaHours: 10, load: 1, giantJobId: null },
    assignedAt: new Date(NOW).toISOString(),
    accruedFrom: new Date(NOW).toISOString(),
    ratePerHour: 4,
    capHours: 10,
    pendingUnits: 0,
  }],
  championFloors: {},
} as unknown as CampState

function renderAbyssSetup(
  champions: ChampionSnapshot[],
  overrides: Partial<RunSetupScreenProps> = {},
) {
  const onStart = vi.fn(() => Promise.resolve())
  const characterService = {
    loadCharacters: vi.fn(async () => ({ characters: [], revisions: [], champions })),
  } as unknown as CharacterService
  const campService = {
    loadState: vi.fn(async () => CAMP_STATE),
  } as unknown as CampService
  const props: RunSetupScreenProps = {
    settings: DEFAULT_SETTINGS,
    writeError: null,
    startState: 'idle',
    inventoryService: null,
    inventoryError: null,
    characterService,
    characterError: null,
    campService,
    maximumDungeonFloor: 10,
    artifactSlotCount: 1,
    initialMode: 'infinite-abyss',
    onStart,
    onSelectCharacterClass: vi.fn(),
    onToggleWorldModifier: vi.fn(),
    onSelectTargetPriority: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
  return { ...renderComponent(<RunSetupScreen {...props} />), onStart }
}

describe('RunSetupScreen Abyss Champion picker', () => {
  it('offers only the Champions that can descend, and names the rest with the reason', async () => {
    renderAbyssSetup([rested, exhausted, working])

    const picker = await screen.findByRole('region', { name: 'Mira of the Keep' })
    expect(picker).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mira of the Keep/ })).toBeInTheDocument()

    // The Camp state arrives after the roster; the working Champion leaves the list then.
    const held = await screen.findByRole('list', { name: 'Champions not offered' })
    expect(within(held).getByText(/^Exhausted · 2h \d+m remaining\./)).toBeInTheDocument()
    expect(within(held).getByText(/^Working · Woodline\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tolan the Spent/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Bryn at the Woodline/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Start Run/ })).toBeEnabled()
  })

  it('starts the run with the Champion that is offered', async () => {
    const { user, onStart } = renderAbyssSetup([exhausted, rested])

    await screen.findByRole('region', { name: 'Mira of the Keep' })
    await user.click(screen.getByRole('button', { name: /Start Run/ }))

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      modeId: 'infinite-abyss',
      championId: rested.championId,
    }))
  })

  it('explains an empty picker and keeps Start disabled when nobody can descend', async () => {
    renderAbyssSetup([exhausted, working])

    const held = await screen.findByRole('list', { name: 'Champions not offered' })
    expect(within(held).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent(/No Champion can descend right now/)
    expect(screen.queryByRole('button', { name: /Select Champion|Selected for run/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Start Run/ })).toBeDisabled()
  })

  it('still asks for a first Champion when the roster is empty', async () => {
    renderAbyssSetup([])

    expect(await screen.findByText(/Complete a dungeon and save a Champion/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Champions not offered' })).toBeNull()
    expect(screen.getByRole('button', { name: /Start Run/ })).toBeDisabled()
  })
})
