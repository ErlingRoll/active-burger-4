import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_CRAFTING_RECIPES, CRAFTING_RECIPES } from '../src/inventory/CraftingRecipes'
import { getInventoryItemDefinition } from '../src/inventory/ItemDefinitions'
import { getCampBuildingDefinition } from '../src/content/camp/CampBuildings'

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
 * Two seed shapes exist. The first migrations named one input in two
 * columns; the Camp's construction migration added an `inputs` list and a
 * `camp_building_id`, and backfilled the list from the two columns for every
 * row before it. The replay does the same, so both shapes compare as one.
 */

const migrationsDirectory = path.resolve(import.meta.dirname, '../supabase/migrations')

interface ServerRecipeInput {
  definitionId: string
  quantity: number
}

interface ServerRecipe {
  id: string
  inputs: ServerRecipeInput[]
  outputDefinitionId: string
  outputQuantity: number
  campBuildingId: string | null
}

const SINGLE_INPUT_COLUMNS =
  /\(\s*id,\s*input_definition_id,\s*input_quantity,\s*output_definition_id,\s*output_quantity\s*\)/
const LISTED_INPUT_COLUMNS =
  /\(\s*id,\s*input_definition_id,\s*input_quantity,\s*output_definition_id,\s*output_quantity,\s*inputs,\s*camp_building_id\s*\)/

function parseInputs(literal: string): ServerRecipeInput[] {
  const rows: unknown = JSON.parse(literal)
  expect(Array.isArray(rows), `a JSON array of inputs in ${literal}`).toBe(true)
  return (rows as { definitionId: string, quantity: number }[]).map((row) => ({
    definitionId: row.definitionId,
    quantity: row.quantity,
  }))
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
      /insert into public\.inventory_crafting_recipes\s*(\([^)]*\))\s*values([\s\S]*?)(?:on conflict|;)/g,
    )
    for (const [, columns, tuples] of inserts) {
      if (columns !== undefined && SINGLE_INPUT_COLUMNS.test(columns)) {
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
            inputs: [{ definitionId: inputDefinitionId, quantity: Number(inputQuantity) }],
            outputDefinitionId,
            outputQuantity: Number(outputQuantity),
            campBuildingId: null,
          })
        }
      } else if (columns !== undefined && LISTED_INPUT_COLUMNS.test(columns)) {
        for (const row of (tuples ?? '').matchAll(
          /\(\s*'([a-z0-9-]+)',\s*'([a-z0-9-]+)',\s*(\d+),\s*'([a-z0-9-]+)',\s*(\d+),\s*'(\[[^']*\])'::jsonb,\s*(?:'([a-z0-9-]+)'|null)\s*\)/g,
        )) {
          const [, id, , , outputDefinitionId, outputQuantity, inputs, campBuildingId] = row
          if (
            id === undefined || outputDefinitionId === undefined ||
            outputQuantity === undefined || inputs === undefined
          ) {
            continue
          }
          recipes.set(id, {
            id,
            inputs: parseInputs(inputs),
            outputDefinitionId,
            outputQuantity: Number(outputQuantity),
            campBuildingId: campBuildingId ?? null,
          })
        }
      } else {
        throw new Error(`${file} seeds inventory_crafting_recipes with columns this test does not read: ${columns ?? ''}`)
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
        inputs: recipe.inputs,
        outputDefinitionId: recipe.outputDefinitionId,
        outputQuantity: recipe.outputQuantity,
        campBuildingId: recipe.campBuildingId ?? null,
      }).toEqual({
        inputs: row?.inputs,
        outputDefinitionId: row?.outputDefinitionId,
        outputQuantity: row?.outputQuantity,
        campBuildingId: row?.campBuildingId,
      })
    }
  })

  it('names the first input in the single-input fields, as the server does', () => {
    for (const recipe of ALL_CRAFTING_RECIPES) {
      expect(recipe.inputDefinitionId).toBe(recipe.inputs[0]?.definitionId)
      expect(recipe.inputQuantity).toBe(recipe.inputs[0]?.quantity)
    }
  })

  it('names items the client can describe on both sides of every server row', () => {
    for (const row of server.values()) {
      for (const input of row.inputs) {
        expect(getInventoryItemDefinition(input.definitionId), input.definitionId).toBeDefined()
      }
      expect(getInventoryItemDefinition(row.outputDefinitionId), row.outputDefinitionId).toBeDefined()
      if (row.campBuildingId !== null) {
        expect(getCampBuildingDefinition(row.campBuildingId), row.campBuildingId).toBeDefined()
      }
    }
  })
})
