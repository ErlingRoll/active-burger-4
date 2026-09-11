import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemInstance } from './InventoryTypes'

/**
 * What a material can be turned into.
 *
 * One input and one output each, mirroring the server table that actually
 * decides the trade. This registry is presentation only: it names and describes
 * a recipe for the bag, and the numbers here are a copy of the server's for
 * showing a cost before the player commits. The server re-reads its own row and
 * ignores anything the browser sends beyond the recipe ID.
 */
export interface CraftingRecipe {
  id: string
  name: string
  description: string
  inputDefinitionId: string
  inputQuantity: number
  outputDefinitionId: string
  outputQuantity: number
}

/*
 * Every row here mirrors a row the migrations seed into
 * `inventory_crafting_recipes`, and tests/craftingRecipes.test.ts fails the
 * build when the two drift: this registry once listed one recipe while the
 * server offered three, and the bag showed only the first.
 */
export const CRAFTING_RECIPES = {
  'river-worm-from-scrap': {
    id: 'river-worm-from-scrap',
    name: 'Dig for worms',
    description: 'Bent buckles and bowstring make a passable hook and a lure to hang off it.',
    inputDefinitionId: 'scrap',
    inputQuantity: 8,
    outputDefinitionId: 'river-worm',
    outputQuantity: 1,
  },
  'glow-grub-from-scrap': {
    id: 'glow-grub-from-scrap',
    name: 'Coax a glow grub',
    description: 'A lantern housing beaten from scrap, and the grub that crawls in to live under it.',
    inputDefinitionId: 'scrap',
    inputQuantity: 24,
    outputDefinitionId: 'glow-grub',
    outputQuantity: 1,
  },
  'moonwater-lure-from-scrap': {
    id: 'moonwater-lure-from-scrap',
    name: 'Cast a moonwater lure',
    description: 'Polished plate and a silver pin, shaped to catch the moon on the pond.',
    inputDefinitionId: 'scrap',
    inputQuantity: 60,
    outputDefinitionId: 'moonwater-lure',
    outputQuantity: 1,
  },
} as const satisfies Record<string, CraftingRecipe>

export type CraftingRecipeId = keyof typeof CRAFTING_RECIPES

export const ALL_CRAFTING_RECIPES: readonly CraftingRecipe[] =
  Object.values(CRAFTING_RECIPES)

export function isCraftingRecipeId(value: unknown): value is CraftingRecipeId {
  return typeof value === 'string' && value in CRAFTING_RECIPES
}

export function getCraftingRecipe(recipeId: string): CraftingRecipe | undefined {
  return isCraftingRecipeId(recipeId) ? CRAFTING_RECIPES[recipeId] : undefined
}

/** How much of one definition the player holds, across every stack of it. */
export function countHeldQuantity(
  items: readonly InventoryItemInstance[],
  definitionId: string,
): number {
  return items.reduce(
    (total, item) => (item.definitionId === definitionId ? total + item.quantity : total),
    0,
  )
}

/** How many batches the player can afford right now. Zero means the button is off. */
export function countAffordableBatches(
  items: readonly InventoryItemInstance[],
  recipe: CraftingRecipe,
): number {
  return Math.floor(countHeldQuantity(items, recipe.inputDefinitionId) / recipe.inputQuantity)
}

export function getCraftingRecipeOutputName(recipe: CraftingRecipe): string {
  return getInventoryItemDefinition(recipe.outputDefinitionId)?.name ?? recipe.outputDefinitionId
}

export function getCraftingRecipeInputName(recipe: CraftingRecipe): string {
  return getInventoryItemDefinition(recipe.inputDefinitionId)?.name ?? recipe.inputDefinitionId
}
