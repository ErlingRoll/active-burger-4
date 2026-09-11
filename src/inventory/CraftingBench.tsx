import { useState } from 'react'
import { getRewardIcon } from '../loot/RewardIcon'
import { useToaster } from '../ui/ToasterContext'
import {
  WORKBENCH_RECIPES,
  countAffordableBatches,
  countHeldQuantity,
  formatCraftingRecipeCost,
  getCraftingRecipeOutputName,
  type CraftingRecipe,
} from './CraftingRecipes'
import type { InventoryItemInstance, InventoryService } from './InventoryTypes'

/**
 * Where a material becomes something worth having.
 *
 * One component rather than one per screen: the bag exists on the stores screen
 * and again in the pond's drawer, and an inventory feature that ships to only
 * one of them is half a feature. Both mount this, so a recipe added to the
 * registry appears in both places without either screen being touched.
 *
 * A recipe with nothing to spend on it is shown greyed rather than hidden. A
 * player who has never seen the workbench cannot know that scrap is worth
 * carrying home, and an empty panel that explains itself teaches that in one
 * glance.
 */
interface CraftingBenchProps {
  items: readonly InventoryItemInstance[]
  service: InventoryService | null
  /** Another operation on the same bag is running; the bench stands down. */
  busy?: boolean
  /** Reload the bag once a craft has changed it. */
  onCrafted: () => Promise<void> | void
  onError: (message: string) => void
}

export function CraftingBench({
  items,
  service,
  busy = false,
  onCrafted,
  onError,
}: CraftingBenchProps) {
  const { showLootToast } = useToaster()
  const [craftingRecipeId, setCraftingRecipeId] = useState<string | null>(null)

  const craft = async (recipe: CraftingRecipe): Promise<void> => {
    if (!service || busy || craftingRecipeId !== null) {
      return
    }
    setCraftingRecipeId(recipe.id)
    try {
      const result = await service.craftItem(crypto.randomUUID(), recipe.id, 1)
      showLootToast({
        title: 'Crafted',
        itemName: getCraftingRecipeOutputName(recipe),
        icon: getRewardIcon(result.outputDefinitionId),
        reward: `×${result.outputQuantity}`,
      })
      await onCrafted()
    } catch (craftError: unknown) {
      onError(craftError instanceof Error ? craftError.message : 'Unable to craft that.')
    } finally {
      setCraftingRecipeId(null)
    }
  }

  return (
    <section className="crafting-bench" aria-labelledby="crafting-bench-title">
      <header className="crafting-bench-heading">
        <p className="screen-kicker">Workbench</p>
        <h4 id="crafting-bench-title">Make something of it</h4>
      </header>
      <ul className="crafting-recipe-list">
        {WORKBENCH_RECIPES.map((recipe) => {
          const held = countHeldQuantity(items, recipe.inputDefinitionId)
          const affordable = countAffordableBatches(items, recipe)
          const isCrafting = craftingRecipeId === recipe.id
          const disabled = !service || busy || craftingRecipeId !== null || affordable < 1
          return (
            <li className="crafting-recipe" key={recipe.id} data-affordable={affordable > 0 ? 'true' : undefined}>
              <span className="crafting-recipe-icon" aria-hidden="true">
                {getRewardIcon(recipe.outputDefinitionId)}
              </span>
              <div className="crafting-recipe-copy">
                <strong>{recipe.name}</strong>
                <small>{recipe.description}</small>
                <span className="crafting-recipe-cost">
                  {formatCraftingRecipeCost(recipe)}
                  <span className="crafting-recipe-held">{held} held</span>
                </span>
              </div>
              <button
                className="secondary-action crafting-recipe-action"
                type="button"
                disabled={disabled}
                onClick={() => { void craft(recipe) }}
              >
                {isCrafting ? 'Making…' : `Make ×${recipe.outputQuantity}`}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
