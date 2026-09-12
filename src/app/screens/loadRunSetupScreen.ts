import type { ChampionSnapshot } from '../../characters/CharacterTypes'
import type { InventoryItemInstance } from '../../inventory/InventoryTypes'
import type { AppServices } from '../../services/AppServices'

/**
 * What run preparation needs before it can paint: the fish for the meal
 * slots, the artifacts a dungeon run may carry, and the roster. The three are
 * fetched in parallel. Artifacts are best effort, as they are on the screen,
 * where a failed artifact load is a quiet empty rack rather than an error.
 * Service types only; never the screen.
 */
export interface RunSetupScreenData {
  fish: InventoryItemInstance[]
  /** `null` when the artifact rack could not be read. */
  artifacts: InventoryItemInstance[] | null
  champions: ChampionSnapshot[]
}

export async function loadRunSetupScreen(
  services: AppServices,
): Promise<RunSetupScreenData | null> {
  const inventory = services.inventory.service
  const characters = services.characters.service
  if (!inventory || !characters) {
    return null
  }
  const [fish, artifacts, collection] = await Promise.all([
    inventory.loadInventory('fish'),
    inventory.loadInventory('artifact').catch(() => null),
    characters.loadCharacters(),
  ])
  return { fish, artifacts, champions: collection.champions }
}
