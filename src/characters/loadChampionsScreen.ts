import type { CampState } from '../camp/CampTypes'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import type { AppServices } from '../services/AppServices'
import type { ChampionSnapshot } from './CharacterTypes'

/**
 * What the roster needs before it can paint: the Champions, the Revival Koi
 * that can wake an exhausted one, and who is working at the Camp. The Camp is
 * best effort, exactly as it is on the screen: the page reads fine without
 * it and only loses the labour lines. Service types only; never the screen.
 */
export interface ChampionsScreenData {
  champions: ChampionSnapshot[]
  fish: InventoryItemInstance[]
  camp: CampState | null
}

export async function loadChampionsScreen(
  services: AppServices,
): Promise<ChampionsScreenData | null> {
  const characters = services.characters.service
  const inventory = services.inventory.service
  if (!characters || !inventory) {
    return null
  }
  const [collection, fish, camp] = await Promise.all([
    characters.loadCharacters(),
    inventory.loadInventory('fish'),
    services.camp.service?.loadState().catch(() => null) ?? Promise.resolve(null),
  ])
  return { champions: collection.champions, fish, camp }
}
