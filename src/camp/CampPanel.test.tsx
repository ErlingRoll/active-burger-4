// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { CampPanel } from './CampPanel'
import type { CampService, CampState } from './CampTypes'
import type { CharacterService, ChampionSnapshot } from '../characters/CharacterTypes'
import type { InventoryItemInstance, InventoryService } from '../inventory/InventoryTypes'
import { deriveCampLabourSheet } from '../content/camp/CampLabour'
import { CAMP_JOB_DEFINITIONS } from '../content/camp/CampJobs'

const champion: ChampionSnapshot = {
  championId: 'champion-1',
  name: 'Mira of the Keep',
  sourceRunId: 'run-1',
  contentVersion: 'test',
  build: {
    schemaVersion: 1,
    level: 30,
    classId: 'knight',
    skills: [{ skillId: 'whirlwind', level: 3 }],
    selectedUpgradeIds: [],
    equipment: {
      weapon: {
        itemId: 'iron-sword',
        rarity: 'legendary',
        setId: 'splintering',
        modifiers: [{ id: 'attack-speed', tier: 1, value: 20, sourceId: 'test' }],
      },
    },
    behaviorProfileId: 'aggressive',
  },
  exhaustionUntil: null,
  archived: false,
  createdAt: '2026-09-10T00:00:00.000Z',
}

const SERVER_TIME = '2026-09-11T12:00:00.000Z'

function material(definitionId: string, quantity: number): InventoryItemInstance {
  return {
    itemInstanceId: `${definitionId}-stack`,
    definitionId,
    quantity,
    bound: false,
    metadata: {},
    source: { type: 'system', id: null },
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  }
}

function emptyState(): CampState {
  return {
    serverTime: SERVER_TIME,
    receivedAt: Date.now(),
    storehouseCapHours: 8,
    buildings: [
      { buildingId: 'storehouse', level: 1 },
      { buildingId: 'woodline', level: 1 },
      { buildingId: 'quarry', level: 1 },
      { buildingId: 'tackle-bench', level: 0 },
    ],
    assignments: [],
    championFloors: { 'champion-1': 20 },
  }
}

function workingState(): CampState {
  const sheet = deriveCampLabourSheet(
    { build: champion.build, sourceFloor: 20 },
    CAMP_JOB_DEFINITIONS['woodline-timber'],
  )
  return {
    ...emptyState(),
    assignments: [{
      championId: 'champion-1',
      jobId: 'woodline-timber',
      sheet,
      assignedAt: '2026-09-11T09:00:00.000Z',
      accruedFrom: '2026-09-11T09:00:00.000Z',
      ratePerHour: 4 * sheet.output,
      capHours: 6,
      pendingUnits: 15,
    }],
  }
}

function builtState(): CampState {
  return {
    ...emptyState(),
    buildings: emptyState().buildings.map((building) =>
      building.buildingId === 'tackle-bench' ? { ...building, level: 1 } : building,
    ),
  }
}

interface RenderOptions {
  developmentToolsEnabled?: boolean
  materials?: InventoryItemInstance[]
}

function renderPanel(initial: CampState, options: RenderOptions = {}) {
  const assignChampion = vi.fn(async () => workingState())
  const unassignChampion = vi.fn(async () => ({
    paid: [{ championId: 'champion-1', jobId: 'woodline-timber' as const, definitionId: 'timber', units: 15, bonusUnits: 0 }],
    wasProcessed: true,
    state: emptyState(),
  }))
  const advanceClock = vi.fn(async () => workingState())
  const claimProduction = vi.fn(async () => ({
    paid: [{ championId: 'champion-1', jobId: 'woodline-timber' as const, definitionId: 'timber', units: 15, bonusUnits: 4 }],
    wasProcessed: true,
    state: { ...workingState(), assignments: workingState().assignments.map((assignment) => ({ ...assignment, accruedFrom: SERVER_TIME })) },
  }))
  const upgradeBuilding = vi.fn(async () => ({ wasProcessed: true, state: builtState() }))
  const service = {
    loadState: vi.fn(async () => initial),
    assignChampion,
    unassignChampion,
    claimProduction,
    advanceClock,
    upgradeBuilding,
  } as unknown as CampService
  const characterService = {
    loadCharacters: vi.fn(async () => ({ characters: [], revisions: [], champions: [champion] })),
  } as unknown as CharacterService
  const craftItem = vi.fn(async () => ({
    recipeId: 'river-worm-at-the-bench',
    inputDefinitionId: 'timber',
    inputSpent: 5,
    outputDefinitionId: 'river-worm',
    outputQuantity: 1,
    wasProcessed: true,
  }))
  const inventoryService = {
    loadInventory: vi.fn(async () => options.materials ?? []),
    craftItem,
  } as unknown as InventoryService
  const onClose = vi.fn()
  const rendered = renderComponent(
    <CampPanel
      service={service}
      configurationError={null}
      characterService={characterService}
      inventoryService={inventoryService}
      developmentToolsEnabled={options.developmentToolsEnabled ?? false}
      onClose={onClose}
    />,
  )
  return { ...rendered, assignChampion, unassignChampion, claimProduction, advanceClock, upgradeBuilding, craftItem, onClose }
}

describe('CampPanel', () => {
  it('shows the sheet a Champion would work a job with, and sends it there', async () => {
    const { user, assignChampion } = renderPanel(emptyState())

    const sendButtons = await screen.findAllByRole('button', { name: 'Send a Champion' })
    await user.click(sendButtons[0]!)

    const picker = screen.getByRole('group', { name: 'Choose a Champion for Fell timber' })
    const option = within(picker).getByRole('button', { name: /Mira of the Keep/ })
    // Level 30 on floor 20 is ×1.3 strength, +20% attack speed and an aggressive
    // profile: 1.3 × 1.1 × 1.2 = 1.716 tempo. One legendary Splintering piece and
    // a level-3 melee skill put the fit at ×1.055, which two decimals show as 1.05.
    expect(option).toHaveTextContent('Tempo ×1.72 · Stamina 6h · Load ×1.3 · Fit ×1.05')

    await user.click(option)

    await waitFor(() => {
      expect(assignChampion).toHaveBeenCalledWith(expect.any(String), 'champion-1', 'woodline-timber')
    })
    expect(await screen.findByRole('button', { name: 'Bring back' })).toBeInTheDocument()
    expect(screen.getByText('1/1 working', { exact: false })).toBeInTheDocument()
  })

  it('claims the whole Camp and reads out what it paid', async () => {
    const { user, claimProduction } = renderPanel(workingState())

    const claim = await screen.findByRole('button', { name: /^Claim/ })
    await user.click(claim)

    await waitFor(() => {
      expect(claimProduction).toHaveBeenCalledWith(expect.any(String))
    })
    expect(await screen.findByText('Camp production claimed')).toBeInTheDocument()
    expect(screen.getByText('×19')).toBeInTheDocument()
    expect(screen.getByText('4 from a lucky haul')).toBeInTheDocument()
  })

  it('brings a Champion back and pays what it produced', async () => {
    const { user, unassignChampion } = renderPanel(workingState())

    await user.click(await screen.findByRole('button', { name: 'Bring back' }))

    await waitFor(() => {
      expect(unassignChampion).toHaveBeenCalledWith(expect.any(String), 'champion-1')
    })
    expect(await screen.findByText('Camp production claimed')).toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: 'Send a Champion' })).toHaveLength(2)
  })

  it('prices the next level against the bag and buys it when the bag can pay', async () => {
    const { user, upgradeBuilding } = renderPanel(emptyState(), {
      materials: [material('timber', 50), material('stone', 30)],
    })

    // The Storehouse wants 48 timber and 48 stone; the bag is short of stone.
    const storehouse = await screen.findByRole('button', { name: 'Upgrade the storehouse' })
    expect(storehouse).toBeDisabled()
    expect(screen.getByText('48 Stone')).toHaveAttribute('data-short', 'true')

    // The bench wants 40 timber and 20 stone, which the bag has.
    const build = screen.getByRole('button', { name: 'Build the tackle bench' })
    expect(build).toBeEnabled()
    await user.click(build)

    await waitFor(() => {
      expect(upgradeBuilding).toHaveBeenCalledWith(expect.any(String), 'tackle-bench')
    })
    expect(await screen.findByText('Tackle bench built.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Turn a worm float/ })).toBeInTheDocument()
  })

  it('crafts at the bench once it is built', async () => {
    const { user, craftItem } = renderPanel(builtState(), {
      materials: [material('timber', 5), material('scrap', 4)],
    })

    const worm = await screen.findByRole('button', { name: 'Turn a worm float: make 1 River Worm' })
    expect(worm).toBeEnabled()
    expect(screen.getByRole('button', { name: /Carve a grub lantern/ })).toBeDisabled()
    await user.click(worm)

    await waitFor(() => {
      expect(craftItem).toHaveBeenCalledWith(expect.any(String), 'river-worm-at-the-bench', 1)
    })
    expect(await screen.findByText('Crafted')).toBeInTheDocument()
  })

  it('lets a development build skip the clock ahead', async () => {
    const { user, advanceClock } = renderPanel(workingState(), { developmentToolsEnabled: true })

    await user.click(await screen.findByRole('button', { name: '+8h' }))

    await waitFor(() => {
      expect(advanceClock).toHaveBeenCalledWith(8)
    })
  })

  it('hides the clock-skipping row from an ordinary build', async () => {
    renderPanel(workingState())

    await screen.findByRole('button', { name: 'Bring back' })
    expect(screen.queryByRole('group', { name: 'Development tools' })).toBeNull()
  })

  it('closes from its own button', async () => {
    const { user, onClose } = renderPanel(emptyState())

    await user.click(await screen.findByRole('button', { name: 'Close the Camp' }))

    expect(onClose).toHaveBeenCalled()
  })
})
