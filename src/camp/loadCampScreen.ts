import type { ChampionSnapshot } from '../characters/CharacterTypes'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import type { AppServices } from '../services/AppServices'
import type { CampState } from './CampTypes'

/**
 * What the Camp needs before it can paint: its own state, the roster that
 * can work there, and the materials in the bag. Service types only; never the
 * screen.
 */
export interface CampScreenData {
  state: CampState
  /** The roster with archived Champions already left out. */
  champions: ChampionSnapshot[]
  materials: InventoryItemInstance[]
}

export async function loadCampScreen(services: AppServices): Promise<CampScreenData | null> {
  const camp = services.camp.service
  const characters = services.characters.service
  if (!camp || !characters) {
    return null
  }
  const [state, collection, materials] = await Promise.all([
    camp.loadState(),
    characters.loadCharacters(),
    services.inventory.service?.loadInventory('material') ?? Promise.resolve([]),
  ])
  return {
    state,
    champions: collection.champions.filter((champion) => !champion.archived),
    materials,
  }
}
