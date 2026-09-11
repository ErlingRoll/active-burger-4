import { RUN_GAME_VERSION } from '../appState'
import { APP_ENVIRONMENT } from '../../shared'
import type { CharacterService } from '../../characters'
import type { InventoryService } from '../../inventory'
import { DevelopmentInventoryGrants } from '../../inventory'
// Imported from the owning module, not the barrel: the barrel keeps screens
// and tools out so route chunks stay split.
import { DevelopmentChampionGenerator } from '../../characters/DevelopmentChampionGenerator'

interface DevelopmentToolsMenuProps {
  inventoryService: InventoryService | null
  characterService: CharacterService | null
}

/**
 * The header's development tools, behind one "Dev tools" toggle.
 *
 * Rendered only for an administrator on a build with the tools on; the header
 * decides that. Each section is its own component so the inventory grants and
 * the Champion generator can be tested on their own.
 */
export function DevelopmentToolsMenu({
  inventoryService,
  characterService,
}: DevelopmentToolsMenuProps) {
  return (
    <details className="development-inventory-menu">
      <summary className="development-inventory-toggle">Dev tools</summary>
      <div className="development-inventory-panel">
        <p className="development-inventory-kicker">Development tools · {APP_ENVIRONMENT} backend</p>
        <section className="development-tools-section" aria-labelledby="development-tools-inventory-title">
          <h3 id="development-tools-inventory-title">Inventory</h3>
          <DevelopmentInventoryGrants inventoryService={inventoryService} />
        </section>
        <section className="development-tools-section" aria-labelledby="development-tools-champions-title">
          <h3 id="development-tools-champions-title">Champions</h3>
          <DevelopmentChampionGenerator
            characterService={characterService}
            contentVersion={RUN_GAME_VERSION}
          />
        </section>
      </div>
    </details>
  )
}
