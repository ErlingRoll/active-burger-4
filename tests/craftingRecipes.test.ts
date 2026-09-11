import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_CRAFTING_RECIPES, CRAFTING_RECIPES } from '../src/inventory/CraftingRecipes'
import { getInventoryItemDefinition } from '../src/inventory/ItemDefinitions'

/**
 * The recipes the bag shows are the recipes the server crafts.
 *
 * `craft_inventory_item` re-reads its own row and ignores everything the
 * browser sends beyond the recipe id, so the TypeScript registry is
 * presentation only, and presentation drifts: the migrations seeded three
 * recipes while the registry listed one, and the bag offered only the first.
 * The seed rows are parsed here so that adding, retuning or retiring a recipe
 * on one side without the other fails the build.
 *
 * The same discipline is what the Camp's labour sheet and accrual twins will
 * lean on, so the test is written to be copied.
 */

const migrationsDirectory = path.resolve(import.meta.dirname, '../supabase/migrations')

interface ServerRecipe {
  id: string
  inputDefinitionId: string
  inputQuantity: number
  outputDefinitionId: string
  outputQuantity: number
}

/**
 * Replays every `insert into public.inventory_crafting_recipes ... values`
 * statement in migration order. The statements upsert on id, so a later
 * migration's row replaces an earlier one, and an
 * `update ... set active = false where id = '...'` retires a row.
 */
function serverRecipes(): Map<string, ServerRecipe> {
  const recipes = new Map<string, ServerRecipe>()
  const files = readdirSync(migrationsDirectory)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDirectory, file), 'utf8')
    const inserts = sql.matchAll(
      /insert into public\.inventory_crafting_recipes\s*\(\s*id,\s*input_definition_id,\s*input_quantity,\s*output_definition_id,\s*output_quantity\s*\)\s*values([\s\S]*?)(?:on conflict|;)/g,
    )
    for (const [, tuples] of inserts) {
      for (const row of (tuples ?? '').matchAll(
        /\(\s*'([a-z0-9-]+)',\s*'([a-z0-9-]+)',\s*(\d+),\s*'([a-z0-9-]+)',\s*(\d+)\s*\)/g,
      )) {
        const [, id, inputDefinitionId, inputQuantity, outputDefinitionId, outputQuantity] = row
        if (
          id === undefined || inputDefinitionId === undefined || inputQuantity === undefined ||
          outputDefinitionId === undefined || outputQuantity === undefined
        ) {
          continue
        }
        recipes.set(id, {
          id,
          inputDefinitionId,
          inputQuantity: Number(inputQuantity),
          outputDefinitionId,
          outputQuantity: Number(outputQuantity),
        })
      }
    }
    for (const retired of sql.matchAll(
      /update public\.inventory_crafting_recipes\s+set active = false\s+where id = '([a-z0-9-]+)'/g,
    )) {
      if (retired[1] !== undefined) {
        recipes.delete(retired[1])
      }
    }
  }
  return recipes
}

describe('crafting recipes', () => {
  const server = serverRecipes()

  it('finds the seed rows in the migrations', () => {
    expect(server.size).toBeGreaterThan(0)
  })

  it('lists exactly the recipes the server offers', () => {
    expect(Object.keys(CRAFTING_RECIPES).sort()).toEqual([...server.keys()].sort())
  })

  it('shows the same inputs and outputs the server will charge and pay', () => {
    for (const recipe of ALL_CRAFTING_RECIPES) {
      const row = server.get(recipe.id)
      expect(row, `a server row for ${recipe.id}`).toBeDefined()
      expect({
        inputDefinitionId: recipe.inputDefinitionId,
        inputQuantity: recipe.inputQuantity,
        outputDefinitionId: recipe.outputDefinitionId,
        outputQuantity: recipe.outputQuantity,
      }).toEqual({
        inputDefinitionId: row?.inputDefinitionId,
        inputQuantity: row?.inputQuantity,
        outputDefinitionId: row?.outputDefinitionId,
        outputQuantity: row?.outputQuantity,
      })
    }
  })

  it('names items the client can describe on both sides of every server row', () => {
    for (const row of server.values()) {
      expect(getInventoryItemDefinition(row.inputDefinitionId), row.inputDefinitionId).toBeDefined()
      expect(getInventoryItemDefinition(row.outputDefinitionId), row.outputDefinitionId).toBeDefined()
    }
  })
})
