// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor } from '../testing/render'
import { ShopScreen } from '../shop/ShopScreen'
import { InventoryScreen } from '../loot/LootBoxScreen'
import { ChampionManagementScreen } from '../characters/ChampionManagementScreen'
import { RunChronicleScreen } from '../run-history/RunChronicleScreen'
import { FishingScreen } from '../fishing/FishingScreen'
import { CampScreen } from '../camp/CampScreen'
import { CollectionsScreen } from '../collections/CollectionsScreen'
import type { CollectionService } from '../collections/CollectionService'
import type { CollectionState } from '../content/collections/Collections'
import { RunSetupScreen } from './screens/RunSetupScreen'
import { DEFAULT_SETTINGS } from '../persistence'
import type { DungeonRunPersistenceService } from '../persistence'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import type { ShopService } from '../shop/ShopTypes'
import type { CharacterService, ChampionSnapshot } from '../characters'
import type { CampService, CampState } from '../camp/CampTypes'

/**
 * Every screen with a loader accepts what the loader produced as
 * `initialData` and paints populated at once, without fetching again; and
 * without it, fetches for itself exactly as it did before the navigator
 * existed. The shop also proves that a seeded screen still refreshes after
 * its own mutations, which is the one thing seeding must not switch off.
 */

const NOW = '2026-09-12T10:00:00.000Z'

const champion: ChampionSnapshot = {
  championId: 'champion-1',
  name: 'Mira of the Keep',
  sourceRunId: 'run-1',
  contentVersion: 'test',
  build: {
    schemaVersion: 1,
    classId: 'knight',
    skills: [{ skillId: 'basic-attack', level: 1 }],
    selectedUpgradeIds: [],
    equipment: {},
    behaviorProfileId: 'balanced',
  },
  exhaustionUntil: null,
  archived: false,
  createdAt: NOW,
}

const scrap: InventoryItemInstance = {
  itemInstanceId: 'scrap-1',
  definitionId: 'river-worm',
  quantity: 4,
  bound: false,
  favorite: false,
  metadata: {},
  source: { type: 'system', id: null },
  createdAt: NOW,
  updatedAt: NOW,
}

function inventoryStub(items: InventoryItemInstance[] = []): InventoryService {
  return {
    loadInventory: vi.fn(async () => items),
    loadFavoriteDefinitionIds: vi.fn(async () => []),
  } as unknown as InventoryService
}

function characterStub(): CharacterService {
  return {
    loadCharacters: vi.fn(async () => ({ characters: [], revisions: [], champions: [champion] })),
  } as unknown as CharacterService
}

const CAMP_STATE: CampState = {
  serverTime: NOW,
  receivedAt: Date.parse(NOW),
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
  championFloors: {},
}

describe('the shop', () => {
  function shopStub(): ShopService {
    return {
      loadPriceBands: vi.fn(async () => []),
      loadStock: vi.fn(async () => [
        { definitionId: 'river-worm', quantityOffered: 2, quantityBought: 0, unitPrice: 5 },
      ]),
      buyItem: vi.fn(async () => ({
        definitionId: 'river-worm',
        quantityBought: 1,
        essenceSpent: 5,
        essenceBalance: 95,
        wasProcessed: true,
      })),
    } as unknown as ShopService
  }

  it('starts ready with the loader result and does not fetch again', () => {
    const shopService = shopStub()
    renderComponent(
      <ShopScreen
        shopService={shopService}
        inventoryService={inventoryStub()}
        configurationError={null}
        onBack={vi.fn()}
        onEssenceChanged={vi.fn()}
        initialData={{
          bands: [],
          stock: [{ definitionId: 'river-worm', quantityOffered: 3, quantityBought: 0, unitPrice: 5 }],
          items: [],
        }}
      />,
    )

    expect(screen.getByText('3 left today')).toBeInTheDocument()
    expect(screen.queryByText('Opening the shop…')).toBeNull()
    expect(shopService.loadStock).not.toHaveBeenCalled()
  })

  it('starts loading and fetches for itself without one', async () => {
    const shopService = shopStub()
    renderComponent(
      <ShopScreen
        shopService={shopService}
        inventoryService={inventoryStub()}
        configurationError={null}
        onBack={vi.fn()}
        onEssenceChanged={vi.fn()}
      />,
    )

    expect(screen.getByText('Opening the shop…')).toBeInTheDocument()
    expect(await screen.findByText('2 left today')).toBeInTheDocument()
    expect(shopService.loadStock).toHaveBeenCalledTimes(1)
  })

  it('shows the loader error instead of fetching', () => {
    const shopService = shopStub()
    renderComponent(
      <ShopScreen
        shopService={shopService}
        inventoryService={inventoryStub()}
        configurationError={null}
        onBack={vi.fn()}
        onEssenceChanged={vi.fn()}
        initialLoadError="The shop is closed."
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('The shop is closed.')
    expect(shopService.loadStock).not.toHaveBeenCalled()
  })

  it('still refreshes after a purchase when seeded', async () => {
    const shopService = shopStub()
    const { user } = renderComponent(
      <ShopScreen
        shopService={shopService}
        inventoryService={inventoryStub()}
        configurationError={null}
        onBack={vi.fn()}
        onEssenceChanged={vi.fn()}
        initialData={{
          bands: [],
          stock: [{ definitionId: 'river-worm', quantityOffered: 3, quantityBought: 0, unitPrice: 5 }],
          items: [],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Buy one' }))

    await waitFor(() => {
      expect(shopService.loadStock).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('2 left today')).toBeInTheDocument()
  })
})

describe('the inventory', () => {
  it('starts ready with the loader result and does not fetch again', () => {
    const inventoryService = inventoryStub()
    renderComponent(
      <InventoryScreen
        inventoryService={inventoryService}
        lootBoxService={null}
        configurationError={null}
        onBack={vi.fn()}
        initialData={{ items: [scrap], favoriteDefinitionIds: [] }}
      />,
    )

    expect(screen.queryByText('Loading inventory…')).toBeNull()
    expect(inventoryService.loadInventory).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const inventoryService = inventoryStub([scrap])
    renderComponent(
      <InventoryScreen
        inventoryService={inventoryService}
        lootBoxService={null}
        configurationError={null}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('Loading inventory…')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Loading inventory…')).toBeNull()
    })
    expect(inventoryService.loadInventory).toHaveBeenCalledTimes(1)
  })
})

describe('the champions', () => {
  it('starts ready with the loader result and does not fetch again', () => {
    const service = characterStub()
    const inventoryService = inventoryStub()
    renderComponent(
      <ChampionManagementScreen
        service={service}
        inventoryService={inventoryService}
        inventoryError={null}
        campService={null}
        configurationError={null}
        onBack={vi.fn()}
        initialData={{ champions: [champion], fish: [], camp: null }}
      />,
    )

    expect(screen.getByRole('region', { name: 'Mira of the Keep' })).toBeInTheDocument()
    expect(service.loadCharacters).not.toHaveBeenCalled()
    expect(inventoryService.loadInventory).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const service = characterStub()
    renderComponent(
      <ChampionManagementScreen
        service={service}
        inventoryService={inventoryStub()}
        inventoryError={null}
        campService={null}
        configurationError={null}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('Loading Champions…')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Mira of the Keep' })).toBeInTheDocument()
    expect(service.loadCharacters).toHaveBeenCalledTimes(1)
  })
})

describe('the chronicle', () => {
  function persistenceStub(): DungeonRunPersistenceService {
    return {
      listFinishedRuns: vi.fn(async () => []),
    } as unknown as DungeonRunPersistenceService
  }

  it('starts ready with the loader result and does not fetch again', () => {
    const service = persistenceStub()
    renderComponent(
      <RunChronicleScreen
        service={service}
        configurationError={null}
        onBack={vi.fn()}
        initialData={{ runs: [] }}
      />,
    )

    expect(screen.queryByText('Reading the chronicle…')).toBeNull()
    expect(service.listFinishedRuns).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const service = persistenceStub()
    renderComponent(
      <RunChronicleScreen service={service} configurationError={null} onBack={vi.fn()} />,
    )

    expect(screen.getByText('Reading the chronicle…')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Reading the chronicle…')).toBeNull()
    })
    expect(service.listFinishedRuns).toHaveBeenCalledTimes(1)
  })
})

describe('the fishing pond', () => {
  it('starts ready with the loader result and does not fetch again', () => {
    const inventoryService = inventoryStub()
    renderComponent(
      <FishingScreen
        fishingService={null}
        inventoryService={inventoryService}
        lootBoxService={null}
        configurationError={null}
        activityPlayerId="account-1"
        activityPlayerApprovedNickname="Mira"
        activityPlayerProviderName={null}
        activityPlayerEmail={null}
        initialData={{ items: [] }}
      />,
    )

    expect(inventoryService.loadInventory).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const inventoryService = inventoryStub()
    renderComponent(
      <FishingScreen
        fishingService={null}
        inventoryService={inventoryService}
        lootBoxService={null}
        configurationError={null}
        activityPlayerId="account-1"
        activityPlayerApprovedNickname="Mira"
        activityPlayerProviderName={null}
        activityPlayerEmail={null}
      />,
    )

    await waitFor(() => {
      expect(inventoryService.loadInventory).toHaveBeenCalledTimes(1)
    })
  })
})

describe('run preparation', () => {
  function renderSetup(initialData?: { fish: InventoryItemInstance[]; artifacts: InventoryItemInstance[] | null; champions: ChampionSnapshot[] }) {
    const characterService = characterStub()
    const inventoryService = inventoryStub()
    renderComponent(
      <RunSetupScreen
        settings={DEFAULT_SETTINGS}
        writeError={null}
        startState="idle"
        inventoryService={inventoryService}
        inventoryError={null}
        characterService={characterService}
        characterError={null}
        campService={null}
        maximumDungeonFloor={10}
        artifactSlotCount={1}
        initialMode="infinite-abyss"
        onStart={vi.fn(() => Promise.resolve())}
        onSelectCharacterClass={vi.fn()}
        onToggleWorldModifier={vi.fn()}
        onSelectTargetPriority={vi.fn()}
        onBack={vi.fn()}
        initialData={initialData}
      />,
    )
    return { characterService, inventoryService }
  }

  it('starts ready with the loader result and does not fetch again', () => {
    const { characterService, inventoryService } = renderSetup({
      fish: [],
      artifacts: [],
      champions: [champion],
    })

    expect(screen.getByRole('region', { name: 'Mira of the Keep' })).toBeInTheDocument()
    expect(characterService.loadCharacters).not.toHaveBeenCalled()
    expect(inventoryService.loadInventory).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const { characterService, inventoryService } = renderSetup()

    expect(await screen.findByRole('region', { name: 'Mira of the Keep' })).toBeInTheDocument()
    expect(characterService.loadCharacters).toHaveBeenCalledTimes(1)
    expect(inventoryService.loadInventory).toHaveBeenCalledWith('fish')
  })
})

describe('the Camp', () => {
  function campStub(): CampService {
    return {
      loadState: vi.fn(async () => CAMP_STATE),
    } as unknown as CampService
  }

  it('starts ready with the loader result and does not fetch again', () => {
    const service = campStub()
    const characterService = characterStub()
    renderComponent(
      <CampScreen
        service={service}
        configurationError={null}
        characterService={characterService}
        inventoryService={inventoryStub()}
        onBack={vi.fn()}
        initialData={{ state: CAMP_STATE, champions: [champion], materials: [] }}
      />,
    )

    expect(screen.queryByText('Walking out to the Camp…')).toBeNull()
    expect(service.loadState).not.toHaveBeenCalled()
    expect(characterService.loadCharacters).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const service = campStub()
    renderComponent(
      <CampScreen
        service={service}
        configurationError={null}
        characterService={characterStub()}
        inventoryService={inventoryStub()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('Walking out to the Camp…')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Walking out to the Camp…')).toBeNull()
    })
    expect(service.loadState).toHaveBeenCalledTimes(1)
  })
})

describe('the collections', () => {
  const COLLECTION_STATE: CollectionState = { fish: [], artifacts: [], classes: [] }
  function collectionStub(): CollectionService {
    return {
      loadState: vi.fn(async () => COLLECTION_STATE),
    } as unknown as CollectionService
  }

  it('starts ready with the loader result and does not fetch again', () => {
    const service = collectionStub()
    renderComponent(
      <CollectionsScreen
        service={service}
        configurationError={null}
        onBack={vi.fn()}
        initialData={{ state: COLLECTION_STATE }}
      />,
    )

    expect(screen.queryByText('Opening the cases…')).toBeNull()
    expect(service.loadState).not.toHaveBeenCalled()
  })

  it('fetches for itself without one', async () => {
    const service = collectionStub()
    renderComponent(
      <CollectionsScreen service={service} configurationError={null} onBack={vi.fn()} />,
    )

    expect(screen.getByText('Opening the cases…')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Opening the cases…')).toBeNull()
    })
    expect(service.loadState).toHaveBeenCalledTimes(1)
  })
})
