// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { CampScreen } from './CampScreen'
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
      { buildingId: 'rift-anchor', level: 0 },
      { buildingId: 'smokehouse', level: 0 },
      { buildingId: 'forge', level: 0 },
    ],
    assignments: [],
    championFloors: { 'champion-1': 20 },
  }
}

function fishInstance(definitionId: string, metadata: Record<string, unknown>): InventoryItemInstance {
  return {
    itemInstanceId: `${definitionId}-${JSON.stringify(metadata).length}`,
    definitionId,
    quantity: 1,
    bound: false,
    metadata,
    source: { type: 'fishing', id: null },
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  }
}

/** A rare reliquary with a middling roll, the way a box would have made it. */
const RELIQUARY: InventoryItemInstance = {
  itemInstanceId: 'artifact-1',
  definitionId: 'artifact-ember-reliquary',
  quantity: 1,
  bound: false,
  metadata: {
    baseId: 'ember-reliquary',
    rarity: 'rare',
    implicit: { id: 'corpse-detonation', tier: 3, value: 35 },
    modifiers: [
      { id: 'max-hp', tier: 4, value: 6 },
      { id: 'attack-speed', tier: 5, value: 4 },
      { id: 'crit-chance', tier: 3, value: 4 },
    ],
  },
  source: { type: 'loot-box', id: null },
  createdAt: SERVER_TIME,
  updatedAt: SERVER_TIME,
}

/** The Rift anchor, Smokehouse and Forge built, and Mira exhausted and resting at the anchor. */
function anchorState(): CampState {
  const exhausted = { ...champion, exhaustionUntil: new Date(Date.now() + 10 * 3_600_000).toISOString() }
  const sheet = deriveCampLabourSheet(
    { build: exhausted.build, sourceFloor: 20 },
    CAMP_JOB_DEFINITIONS['anchor-rest'],
  )
  return {
    ...emptyState(),
    buildings: emptyState().buildings.map((building) =>
      building.buildingId === 'rift-anchor' || building.buildingId === 'smokehouse' || building.buildingId === 'forge'
        ? { ...building, level: 1 }
        : building,
    ),
    assignments: [{
      championId: 'champion-1',
      jobId: 'anchor-rest',
      sheet,
      assignedAt: '2026-09-11T10:00:00.000Z',
      accruedFrom: '2026-09-11T10:00:00.000Z',
      ratePerHour: 30 * sheet.output,
      capHours: 6,
      pendingUnits: 60,
    }],
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
  fish?: InventoryItemInstance[]
  artifacts?: InventoryItemInstance[]
}

function renderScreen(initial: CampState, options: RenderOptions = {}) {
  const assignChampion = vi.fn(async () => workingState())
  const unassignChampion = vi.fn(async () => ({
    paid: [{ championId: 'champion-1', jobId: 'woodline-timber' as const, effect: 'item' as const, definitionId: 'timber', units: 15, bonusUnits: 0 }],
    wasProcessed: true,
    state: emptyState(),
  }))
  const advanceClock = vi.fn(async () => workingState())
  const claimProduction = vi.fn(async () => (initial.assignments[0]?.jobId === 'anchor-rest'
    ? {
        paid: [{ championId: 'champion-1', jobId: 'anchor-rest' as const, effect: 'exhaustion-relief' as const, definitionId: null, units: 60, bonusUnits: 0 }],
        wasProcessed: true,
        state: { ...anchorState(), assignments: anchorState().assignments.map((assignment) => ({ ...assignment, accruedFrom: SERVER_TIME })) },
      }
    : {
        paid: [{ championId: 'champion-1', jobId: 'woodline-timber' as const, effect: 'item' as const, definitionId: 'timber', units: 15, bonusUnits: 4 }],
        wasProcessed: true,
        state: { ...workingState(), assignments: workingState().assignments.map((assignment) => ({ ...assignment, accruedFrom: SERVER_TIME })) },
      }))
  const gutFish = vi.fn(async () => ({ definitionId: 'silver-perch', roeGranted: 3, wasProcessed: true }))
  const cureFish = vi.fn(async () => ({ definitionId: 'silver-perch', enchantmentId: 'bright-scales', roeSpent: 3, wasProcessed: true }))
  const reforgeArtifact = vi.fn(async () => ({
    definitionId: 'artifact-ember-reliquary',
    metadata: RELIQUARY.metadata,
    scrapSpent: 45,
    shardsSpent: 3,
    wasProcessed: true,
  }))
  const upgradeBuilding = vi.fn(async () => ({ wasProcessed: true, state: builtState() }))
  const service = {
    loadState: vi.fn(async () => initial),
    assignChampion,
    unassignChampion,
    claimProduction,
    advanceClock,
    upgradeBuilding,
    gutFish,
    cureFish,
    reforgeArtifact,
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
    loadInventory: vi.fn(async (category?: string) => (
      category === 'fish' ? options.fish ?? [] : category === 'artifact' ? options.artifacts ?? [] : options.materials ?? []
    )),
    craftItem,
  } as unknown as InventoryService
  const onBack = vi.fn()
  const rendered = renderComponent(
    <CampScreen
      service={service}
      configurationError={null}
      characterService={characterService}
      inventoryService={inventoryService}
      developmentToolsEnabled={options.developmentToolsEnabled ?? false}
      onBack={onBack}
    />,
  )
  return { ...rendered, assignChampion, unassignChampion, claimProduction, advanceClock, upgradeBuilding, craftItem, gutFish, cureFish, reforgeArtifact, onBack }
}

/** Opens a building's inspector from its plot on the ground. */
async function openPlot(user: ReturnType<typeof renderScreen>['user'], name: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
  await screen.findByRole('heading', { name })
}

describe('CampScreen', () => {
  it('shows the sheet a Champion would work a job with, and sends it there', async () => {
    const { user, assignChampion } = renderScreen(emptyState())

    await openPlot(user, 'Woodline')
    await user.click(await screen.findByRole('button', { name: 'Send a Champion' }))

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
    expect(screen.getAllByText('1/1 working', { exact: false }).length).toBeGreaterThan(0)
  })

  it('claims the whole Camp and reads out what it paid', async () => {
    const { user, claimProduction } = renderScreen(workingState())

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
    const { user, unassignChampion } = renderScreen(workingState())

    await openPlot(user, 'Woodline')
    await user.click(await screen.findByRole('button', { name: 'Bring back' }))

    await waitFor(() => {
      expect(unassignChampion).toHaveBeenCalledWith(expect.any(String), 'champion-1')
    })
    expect(await screen.findByText('Camp production claimed')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Send a Champion' })).toBeInTheDocument()
  })

  it('prices the next level against the bag and buys it when the bag can pay', async () => {
    const { user, upgradeBuilding } = renderScreen(emptyState(), {
      materials: [material('timber', 50), material('stone', 30)],
    })

    // The Storehouse wants 48 timber and 48 stone; the bag is short of stone.
    await openPlot(user, 'Storehouse')
    const storehouse = await screen.findByRole('button', { name: 'Upgrade the storehouse' })
    expect(storehouse).toBeDisabled()
    expect(screen.getByText('48 Stone')).toHaveAttribute('data-short', 'true')

    // The bench wants 40 timber and 20 stone, which the bag has; its plot says so.
    expect(screen.getByRole('button', { name: /^Tackle bench/ })).toHaveTextContent('Ready to build')
    await openPlot(user, 'Tackle bench')
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
    const { user, craftItem } = renderScreen(builtState(), {
      materials: [material('timber', 5), material('scrap', 4)],
    })

    await openPlot(user, 'Tackle bench')
    const worm = await screen.findByRole('button', { name: 'Turn a worm float: make 1 River Worm' })
    expect(worm).toBeEnabled()
    expect(screen.getByRole('button', { name: /Carve a grub lantern/ })).toBeDisabled()
    await user.click(worm)

    await waitFor(() => {
      expect(craftItem).toHaveBeenCalledWith(expect.any(String), 'river-worm-at-the-bench', 1)
    })
    expect(await screen.findByText('Crafted')).toBeInTheDocument()
  })

  it('reads a claim at the anchor as minutes of rest', async () => {
    const { user, claimProduction } = renderScreen(anchorState())

    expect(await screen.findByText('1/1 resting', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Claim/ }))

    await waitFor(() => {
      expect(claimProduction).toHaveBeenCalled()
    })
    expect(await screen.findByText('Mira of the Keep rested 60 minutes off its exhaustion at the anchor.')).toBeInTheDocument()
  })

  it('guts a fish for roe and cures a meal fish with it', async () => {
    const perch = fishInstance('silver-perch', { rarity: 'rare', sizePercentile: 0.5 })
    const koi = fishInstance('revival-koi', { rarity: 'epic', sizePercentile: 0.9 })
    const { user, gutFish, cureFish } = renderScreen(anchorState(), {
      materials: [material('roe', 3)],
      fish: [perch, koi],
    })

    await openPlot(user, 'Smokehouse')
    await user.click(await screen.findByRole('button', { name: 'Gut a fish' }))
    // A rare perch of middling size: 3 × (0.75 + 0.25) = 3 roe.
    await user.click(await screen.findByRole('button', { name: 'Gut Silver Perch: → 3 roe' }))
    await waitFor(() => {
      expect(gutFish).toHaveBeenCalledWith(expect.any(String), perch.itemInstanceId)
    })
    expect(await screen.findByText('Gutted')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Cure a fish' }))
    expect(await screen.findByRole('button', { name: 'Cure Revival Koi: Not a meal fish' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cure Silver Perch: 3 roe → Bright Scales (+15%)' }))
    await waitFor(() => {
      expect(cureFish).toHaveBeenCalledWith(expect.any(String), perch.itemInstanceId)
    })
    expect(await screen.findByText('Cured')).toBeInTheDocument()
  })

  it('reforges an artifact for scrap and shards, and prices it by rarity', async () => {
    const { user, reforgeArtifact } = renderScreen(anchorState(), {
      materials: [material('scrap', 45), material('rift-shard', 3)],
      artifacts: [RELIQUARY],
    })

    await openPlot(user, 'Forge')
    await user.click(await screen.findByRole('button', { name: 'Reforge an artifact' }))
    const option = await screen.findByRole('button', { name: 'Reforge Ember Reliquary, Rare' })
    expect(option).toHaveTextContent('45 Scrap')
    expect(option).toHaveTextContent('3 Rift shard')
    expect(option).toBeEnabled()
    await user.click(option)

    await waitFor(() => {
      expect(reforgeArtifact).toHaveBeenCalledWith(expect.any(String), 'artifact-1')
    })
    expect(await screen.findByText('Reforged')).toBeInTheDocument()
  })

  it('lets a development build skip the clock ahead', async () => {
    const { user, advanceClock } = renderScreen(workingState(), { developmentToolsEnabled: true })

    await user.click(await screen.findByRole('button', { name: '+8h' }))

    await waitFor(() => {
      expect(advanceClock).toHaveBeenCalledWith(8)
    })
  })

  it('hides the clock-skipping row from an ordinary build', async () => {
    renderScreen(workingState())

    await screen.findByRole('button', { name: /^Woodline/ })
    expect(screen.queryByRole('group', { name: 'Development tools' })).toBeNull()
  })

  it('shows each plot at a glance and opens its inspector', async () => {
    const { user } = renderScreen(workingState())

    const woodline = await screen.findByRole('button', { name: /^Woodline/ })
    expect(woodline).toHaveTextContent('1/1 working')
    expect(woodline).toHaveAttribute('data-built', 'true')
    expect(screen.getByRole('button', { name: /^Forge/ })).toHaveAttribute('data-built', 'false')
    expect(screen.getByRole('button', { name: /^Trophy hall/ })).toBeDisabled()

    await user.click(woodline)
    expect(await screen.findByRole('heading', { name: 'Woodline' })).toBeInTheDocument()
    expect(woodline).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Close the woodline' }))
    expect(screen.queryByRole('heading', { name: 'Woodline' })).toBeNull()
  })

  it('walks back to the refuge from its own button', async () => {
    const { user, onBack } = renderScreen(emptyState())

    await user.click(await screen.findByRole('button', { name: /Refuge/ }))

    expect(onBack).toHaveBeenCalled()
  })
})
