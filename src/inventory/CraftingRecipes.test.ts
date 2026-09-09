import { describe, expect, it } from 'vitest'
import {
  ALL_CRAFTING_RECIPES,
  countAffordableBatches,
  countHeldQuantity,
  getCraftingRecipe,
  getCraftingRecipeInputName,
  getCraftingRecipeOutputName,
} from './CraftingRecipes'
import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemInstance } from './InventoryTypes'

function stack(definitionId: string, quantity: number): InventoryItemInstance {
  return {
    itemInstanceId: `${definitionId}-${quantity}`,
    definitionId,
    quantity,
    bound: false,
    metadata: {},
    source: { type: 'system', id: null },
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  }
}

describe('crafting recipes', () => {
  it('names an item that exists on both sides of every recipe', () => {
    for (const recipe of ALL_CRAFTING_RECIPES) {
      expect(getInventoryItemDefinition(recipe.inputDefinitionId)).toBeDefined()
      expect(getInventoryItemDefinition(recipe.outputDefinitionId)).toBeDefined()
    }
  })

  it('turns scrap into bait, which is the point of having scrap', () => {
    const recipe = getCraftingRecipe('river-worm-from-scrap')
    expect(recipe).toBeDefined()
    expect(getCraftingRecipeInputName(recipe!)).toBe('Scrap')
    expect(getCraftingRecipeOutputName(recipe!)).toBe('River Worm')
  })

  it('counts a material across every stack of it', () => {
    const items = [stack('scrap', 5), stack('scrap', 12), stack('river-worm', 3)]
    expect(countHeldQuantity(items, 'scrap')).toBe(17)
  })

  it('affords whole batches only', () => {
    const recipe = getCraftingRecipe('river-worm-from-scrap')!
    expect(countAffordableBatches([stack('scrap', 7)], recipe)).toBe(0)
    expect(countAffordableBatches([stack('scrap', 8)], recipe)).toBe(1)
    expect(countAffordableBatches([stack('scrap', 8), stack('scrap', 9)], recipe)).toBe(2)
  })

  it('affords nothing when the bag holds none of the input', () => {
    const recipe = getCraftingRecipe('river-worm-from-scrap')!
    expect(countAffordableBatches([stack('river-worm', 40)], recipe)).toBe(0)
  })
})
