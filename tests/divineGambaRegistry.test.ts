import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIVINE_GAMBA_BASE_BALL_PRICE,
  DIVINE_GAMBA_BOX_RARITY_WEIGHTS,
  DIVINE_GAMBA_MACHINE,
  DIVINE_GAMBA_POCKETS,
  DIVINE_GAMBA_ROWS,
  DIVINE_GAMBA_STAKES,
} from '../src/divine-gamba/DivineGambaRegistry'
import { BOX_RARITIES, SIM_VERSION } from '../src/divine-gamba/sim'
import { getInventoryItemDefinition } from '../src/inventory/ItemDefinitions'
import { assertDefined } from '../src/testing'

/**
 * The Divine Gamba the client describes is the Divine Gamba the server runs.
 *
 * The pocket table and the machine's constants are reference rows in the
 * migrations with a TypeScript mirror the screen reads before it asks the
 * server anything. The pair is held together here the way
 * tests/campRegistry.test.ts holds the Camp: the seed rows are parsed out of
 * the migrations, the last row for a key being the row in force, and
 * compared with the registry.
 */

const migrationsDirectory = path.resolve(import.meta.dirname, '../supabase/migrations')

function migrationSources(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => readFileSync(path.join(migrationsDirectory, entry), 'utf8'))
}

/** The rows of every `insert into <table> (<columns>) values ...` statement, in order. */
function seedRows(table: string, columns: string): string[] {
  const rows: string[] = []
  const statement = new RegExp(
    `insert into public\\.${table}\\s*\\(\\s*${columns}\\s*\\)\\s*values([\\s\\S]*?)(?:on conflict|;)`,
    'g',
  )
  for (const sql of migrationSources()) {
    for (const [, tuples] of sql.matchAll(statement)) {
      for (const [, row] of (tuples ?? '').matchAll(/\(((?:[^()']|'[^']*'|\([^()]*\))*)\)/g)) {
        if (row !== undefined) {
          rows.push(row)
        }
      }
    }
  }
  return rows
}

/** Splits a tuple's fields on the commas outside quotes, braces and parentheses. */
function fields(row: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let current = ''
  for (const character of row) {
    if (character === "'") {
      quoted = !quoted
    } else if (!quoted && (character === '(' || character === '{')) {
      depth += 1
    } else if (!quoted && (character === ')' || character === '}')) {
      depth -= 1
    }
    if (character === ',' && !quoted && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += character
    }
  }
  parts.push(current.trim())
  return parts
}

function unquote(field: string): string {
  return field.replace(/^'([\s\S]*)'(?:::\w+)?$/, '$1')
}

/**
 * Every seed statement upserts, so a later migration's row replaces an
 * earlier one with the same key. The parsers below replay that: the last row
 * for a key is the row in force.
 */
function latestByKey<TRow>(rows: TRow[], key: (row: TRow) => string): TRow[] {
  const byKey = new Map<string, TRow>()
  for (const row of rows) {
    byKey.set(key(row), row)
  }
  return [...byKey.values()]
}

describe('the Divine Gamba settings', () => {
  const row = seedRows(
    'divine_gamba_settings',
    'id,\\s*base_ball_price,\\s*board_rows,\\s*box_rarity_weights,\\s*sim_version',
  ).map(fields).at(-1)

  it('prices a ball, sizes the board, weights the boxes and names the simulation the same as the registry', () => {
    const [, price, rows, weights, version] = assertDefined(row)
    expect(Number(price)).toBe(DIVINE_GAMBA_BASE_BALL_PRICE)
    expect(Number(rows)).toBe(DIVINE_GAMBA_ROWS)
    expect(JSON.parse(unquote(assertDefined(weights)))).toEqual(DIVINE_GAMBA_BOX_RARITY_WEIGHTS)
    expect(Number(version)).toBe(SIM_VERSION)
  })

  it('weights every rarity the roll walks, names a box for each, and keeps legendary to one in a thousand', () => {
    expect(Object.keys(DIVINE_GAMBA_BOX_RARITY_WEIGHTS).sort()).toEqual([...BOX_RARITIES].sort())
    for (const rarity of BOX_RARITIES) {
      expect(getInventoryItemDefinition(`loot-box-${rarity}`), rarity).toBeDefined()
    }
    const total = Object.values(DIVINE_GAMBA_BOX_RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
    expect((DIVINE_GAMBA_BOX_RARITY_WEIGHTS.legendary ?? 0) / total).toBeCloseTo(0.001, 6)
  })

  it('offers the stakes in ascending order from one', () => {
    expect(DIVINE_GAMBA_STAKES[0]).toBe(1)
    expect([...DIVINE_GAMBA_STAKES]).toEqual([...DIVINE_GAMBA_STAKES].sort((a, b) => a - b))
  })
})

describe('the Divine Gamba pocket table', () => {
  const rows = latestByKey(
    seedRows(
      'divine_gamba_pocket_tables',
      'row_count,\\s*pocket_index,\\s*multiplier_percent,\\s*box_chance_basis_points',
    )
      .map(fields)
      .map(([rowCount, pocketIndex, multiplier, boxChance]) => ({
        rowCount: Number(rowCount),
        pocketIndex: Number(pocketIndex),
        multiplierPercent: Number(multiplier),
        boxChanceBasisPoints: Number(boxChance),
      })),
    (row) => `${row.rowCount}:${row.pocketIndex}`,
  )

  it('seeds the board the machine plays at the same multipliers and box chances', () => {
    const registry = DIVINE_GAMBA_POCKETS.map((pocket, pocketIndex) => ({
      rowCount: DIVINE_GAMBA_ROWS,
      pocketIndex,
      multiplierPercent: pocket.multiplierPercent,
      boxChanceBasisPoints: pocket.boxChanceBasisPoints,
    }))
    const seeded = rows.filter((row) => row.rowCount === DIVINE_GAMBA_ROWS).sort((a, b) => a.pocketIndex - b.pocketIndex)
    expect(seeded).toEqual(registry)
  })

  it('gives the board one pocket per gap, symmetric, paying above the ball only at the edges', () => {
    expect(DIVINE_GAMBA_POCKETS).toHaveLength(DIVINE_GAMBA_ROWS + 1)
    for (const [index, pocket] of DIVINE_GAMBA_POCKETS.entries()) {
      const mirror = assertDefined(DIVINE_GAMBA_POCKETS[DIVINE_GAMBA_POCKETS.length - 1 - index])
      expect(pocket, `${index}`).toEqual(mirror)
      if (pocket.boxChanceBasisPoints > 0) {
        expect(index === 0 || index === DIVINE_GAMBA_POCKETS.length - 1, `${index} carries a box`).toBe(true)
      }
    }
    const centre = assertDefined(DIVINE_GAMBA_POCKETS[Math.floor(DIVINE_GAMBA_POCKETS.length / 2)])
    expect(centre.multiplierPercent).toBeLessThan(100)
    // A jackpot always carries a box.
    expect(assertDefined(DIVINE_GAMBA_POCKETS[0]).boxChanceBasisPoints).toBe(10000)
  })

  it('is the machine the screen runs', () => {
    expect(DIVINE_GAMBA_MACHINE).toEqual({
      rows: DIVINE_GAMBA_ROWS,
      pockets: DIVINE_GAMBA_POCKETS,
      boxRarityWeights: DIVINE_GAMBA_BOX_RARITY_WEIGHTS,
    })
  })
})
