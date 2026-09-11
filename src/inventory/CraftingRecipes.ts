import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemInstance } from './InventoryTypes'
import type { CampBuildingId } from '../content/camp/CampTypes'

/**
 * What a material can be turned into.
 *
 * Mirrors the server table that actually decides the trade. This registry is
 * presentation only: it names and describes a recipe, and the numbers here are
 * a copy of the server's for showing a cost before the player commits. The
 * server re-reads its own row and ignores anything the browser sends beyond
 * the recipe ID.
 */
export interface CraftingRecipeInput {
  definitionId: string
  quantity: number
}

export interface CraftingRecipe {
  id: string
  name: string
  description: string
  /** Every input the craft consumes, in the order the server consumes them. */
  inputs: readonly CraftingRecipeInput[]
  /** The first input, as the server's single-input columns still name it. */
  inputDefinitionId: string
  inputQuantity: number
  outputDefinitionId: string
  outputQuantity: number
  /** A recipe crafted at a Camp building rather than at the bag's workbench. */
  campBuildingId?: CampBuildingId
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
    inputs: [{ definitionId: 'scrap', quantity: 8 }],
    inputDefinitionId: 'scrap',
    inputQuantity: 8,
    outputDefinitionId: 'river-worm',
    outputQuantity: 1,
  },
  'glow-grub-from-scrap': {
    id: 'glow-grub-from-scrap',
    name: 'Coax a glow grub',
    description: 'A lantern housing beaten from scrap, and the grub that crawls in to live under it.',
    inputs: [{ definitionId: 'scrap', quantity: 24 }],
    inputDefinitionId: 'scrap',
    inputQuantity: 24,
    outputDefinitionId: 'glow-grub',
    outputQuantity: 1,
  },
  'moonwater-lure-from-scrap': {
    id: 'moonwater-lure-from-scrap',
    name: 'Cast a moonwater lure',
    description: 'Polished plate and a silver pin, shaped to catch the moon on the pond.',
    inputs: [{ definitionId: 'scrap', quantity: 60 }],
    inputDefinitionId: 'scrap',
    inputQuantity: 60,
    outputDefinitionId: 'moonwater-lure',
    outputQuantity: 1,
  },
  'river-worm-at-the-bench': {
    id: 'river-worm-at-the-bench',
    name: 'Turn a worm float',
    description: 'A float whittled from timber and a hook from the scrap pile. Cheaper in scrap than digging.',
    inputs: [{ definitionId: 'timber', quantity: 5 }, { definitionId: 'scrap', quantity: 4 }],
    inputDefinitionId: 'timber',
    inputQuantity: 5,
    outputDefinitionId: 'river-worm',
    outputQuantity: 1,
    campBuildingId: 'tackle-bench',
  },
  'glow-grub-at-the-bench': {
    id: 'glow-grub-at-the-bench',
    name: 'Carve a grub lantern',
    description: 'A timber housing with a scrap-metal gate, and the grub that moves in under it.',
    inputs: [{ definitionId: 'timber', quantity: 15 }, { definitionId: 'scrap', quantity: 12 }],
    inputDefinitionId: 'timber',
    inputQuantity: 15,
    outputDefinitionId: 'glow-grub',
    outputQuantity: 1,
    campBuildingId: 'tackle-bench',
  },
} as const satisfies Record<string, CraftingRecipe>

export type CraftingRecipeId = keyof typeof CRAFTING_RECIPES

export const ALL_CRAFTING_RECIPES: readonly CraftingRecipe[] =
  Object.values(CRAFTING_RECIPES)

/** The recipes the bag's workbench offers: everything not tied to a Camp building. */
export const WORKBENCH_RECIPES: readonly CraftingRecipe[] =
  ALL_CRAFTING_RECIPES.filter((recipe) => recipe.campBuildingId === undefined)

export function getCraftingRecipesForBuilding(
  buildingId: CampBuildingId,
): readonly CraftingRecipe[] {
  return ALL_CRAFTING_RECIPES.filter((recipe) => recipe.campBuildingId === buildingId)
}

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
  return recipe.inputs.reduce(
    (batches, input) => Math.min(
      batches,
      Math.floor(countHeldQuantity(items, input.definitionId) / input.quantity),
    ),
    Number.POSITIVE_INFINITY,
  )
}

export function getCraftingRecipeOutputName(recipe: CraftingRecipe): string {
  return getInventoryItemDefinition(recipe.outputDefinitionId)?.name ?? recipe.outputDefinitionId
}

export function getCraftingRecipeInputName(recipe: CraftingRecipe): string {
  return getInventoryItemDefinition(recipe.inputDefinitionId)?.name ?? recipe.inputDefinitionId
}

/** "5 Timber · 4 Scrap": every input, the way a cost is read. */
export function formatCraftingRecipeCost(recipe: CraftingRecipe): string {
  return recipe.inputs
    .map((input) => `${input.quantity} ${getInventoryItemDefinition(input.definitionId)?.name ?? input.definitionId}`)
    .join(' · ')
}
