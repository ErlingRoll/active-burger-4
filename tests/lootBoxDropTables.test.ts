import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { RARITIES, Rarity } from '../src/content/rarity/Rarity'
import {
  LOOT_BOX_DROP_TABLES,
  LOOT_BOX_ITEM_COUNTS,
  LOOT_BOX_ROLL_RANGE,
} from '../src/loot/LootBoxContents'

/**
 * The odds shown to the player are the odds the server rolls.
 *
 * The roll lives in `open_loot_box` and the hover card reads a copy of the
 * table in TypeScript, which is a duplication with a real failure mode: the
 * interface quietly advertising a drop rate the database stopped using. The
 * migration is parsed here so that changing one without the other fails the
 * build instead of misleading a player.
 */

const migrationsDirectory = path.resolve(import.meta.dirname, '../supabase/migrations')

/** The newest migration that redefines the drop tables is the one in force. */
function currentDropTableMigration(): string {
  const candidates = readdirSync(migrationsDirectory)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => readFileSync(path.join(migrationsDirectory, entry), 'utf8'))
    .filter((source) => source.includes('v_drop_table := case v_box_rarity'))

  const newest = candidates.at(-1)
  expect(newest, 'a migration defining the loot-box drop tables').toBeDefined()
  return newest ?? ''
}

/** Reads a `case v_box_rarity when ... else ... end` block into a map. */
function parseRarityCase(sql: string, variable: string): Map<string, string> {
  const block = new RegExp(`${variable} := case v_box_rarity([\\s\\S]*?)\\n  end;`)
    .exec(sql)?.[1]
  expect(block, `a case block for ${variable}`).toBeDefined()

  const values = new Map<string, string>()
  for (const match of (block ?? '').matchAll(/when '([a-z]+)' then\s+(.+?)\s*$/gm)) {
    const [, rarity, value] = match
    if (rarity !== undefined && value !== undefined) {
      values.set(rarity, value)
    }
  }
  const fallback = /else\s+(.+?)\s*$/m.exec(block ?? '')?.[1]
  expect(fallback, `an else branch for ${variable}`).toBeDefined()
  // The ladder names four rarities and lets legendary fall through, so that
  // an unlisted rarity cannot silently produce nothing.
  values.set(Rarity.Legendary, fallback ?? '')
  return values
}

/** `[["river-minnow",550],...]` of cumulative cutoffs into per-entry weights. */
function parseDropTable(literal: string): { definitionId: string, weight: number }[] {
  const json = /'(\[[\s\S]*?\])'::jsonb/.exec(literal)?.[1]
  expect(json, `a jsonb array in ${literal}`).toBeDefined()
  const rows: unknown = JSON.parse(json ?? '[]')
  expect(Array.isArray(rows)).toBe(true)

  let previousCutoff = 0
  return (rows as [string, number][]).map(([definitionId, cutoff]) => {
    const weight = cutoff - previousCutoff
    previousCutoff = cutoff
    return { definitionId, weight }
  })
}

describe('loot box contents', () => {
  const migration = currentDropTableMigration()

  it('publishes the drop table the migration rolls against', () => {
    const sqlTables = parseRarityCase(migration, 'v_drop_table')

    for (const rarity of RARITIES) {
      const literal = sqlTables.get(rarity)
      expect(literal, `a drop table for ${rarity}`).toBeDefined()
      expect(parseDropTable(literal ?? ''), `the ${rarity} drop table`)
        .toEqual(LOOT_BOX_DROP_TABLES[rarity].map((entry) => ({ ...entry })))
    }
  })

  it('publishes the number of draws the migration makes', () => {
    const sqlCounts = parseRarityCase(migration, 'v_draw_count')

    for (const rarity of RARITIES) {
      expect(Number(sqlCounts.get(rarity)), `draws for ${rarity}`)
        .toBe(LOOT_BOX_ITEM_COUNTS[rarity])
    }
  })

  it('gives every roll an outcome', () => {
    for (const rarity of RARITIES) {
      const total = LOOT_BOX_DROP_TABLES[rarity]
        .reduce((sum, entry) => sum + entry.weight, 0)

      expect(total, `the ${rarity} table's total weight`).toBe(LOOT_BOX_ROLL_RANGE)
    }
  })

  it('opens more of a box the rarer it is', () => {
    expect(LOOT_BOX_ITEM_COUNTS[Rarity.Legendary])
      .toBeGreaterThan(LOOT_BOX_ITEM_COUNTS[Rarity.Common])
  })
})
