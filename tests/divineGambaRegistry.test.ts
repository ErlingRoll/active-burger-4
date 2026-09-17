import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_DIVINE_GAMBA_PART_DEFINITIONS,
  DIVINE_GAMBA_BASE_BALL_PRICE,
  DIVINE_GAMBA_BOX_RARITY_WEIGHTS,
  DIVINE_GAMBA_POCKET_TABLES,
  resolveDivineGambaMachine,
} from '../src/divine-gamba/DivineGambaRegistry'
import { BOX_RARITIES, SIM_VERSION } from '../src/divine-gamba/sim'
import { getInventoryItemDefinition } from '../src/inventory/ItemDefinitions'
import { assertDefined } from '../src/testing'

/**
 * The Divine Gamba the client describes is the Divine Gamba the server runs.
 *
 * The pocket tables, the parts on the Shardwright's shelf and the machine's
 * constants are reference rows in the migration with a TypeScript mirror
 * the screen reads before it asks the server anything, and the fold from
 * installed parts to a machine is a SQL function with a TypeScript twin.
 * Each pair is held together here the way tests/campRegistry.test.ts holds
 * the Camp: the seed rows are parsed out of the migration and compared with
 * the registry, and the fixture set the migration asserts against its own
 * fold is compared with the file the TypeScript fold is asserted against.
 */

const migrationsDirectory = path.resolve(import.meta.dirname, '../supabase/migrations')
const fixturesDirectory = path.resolve(import.meta.dirname, 'fixtures')

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

function nullable(field: string): string | null {
  return field === 'null' ? null : unquote(field)
}

describe('the Divine Gamba settings', () => {
  const [row] = seedRows(
    'divine_gamba_settings',
    'id,\\s*base_ball_price,\\s*box_rarity_weights,\\s*sim_version',
  ).map(fields)

  it('prices a ball, weights the boxes and names the simulation the same as the registry', () => {
    const [, price, weights, version] = assertDefined(row)
    expect(Number(price)).toBe(DIVINE_GAMBA_BASE_BALL_PRICE)
    expect(JSON.parse(unquote(assertDefined(weights)))).toEqual(DIVINE_GAMBA_BOX_RARITY_WEIGHTS)
    expect(Number(version)).toBe(SIM_VERSION)
  })

  it('never names a rarity above epic, and names a box definition for every rarity it does', () => {
    expect(Object.keys(DIVINE_GAMBA_BOX_RARITY_WEIGHTS).sort()).toEqual([...BOX_RARITIES].sort())
    for (const rarity of BOX_RARITIES) {
      expect(getInventoryItemDefinition(`loot-box-${rarity}`), rarity).toBeDefined()
    }
  })
})

describe('the Divine Gamba pocket tables', () => {
  const rows = seedRows(
    'divine_gamba_pocket_tables',
    'row_count,\\s*pocket_index,\\s*multiplier_percent,\\s*box_chance_basis_points',
  )
    .map(fields)
    .map(([rowCount, pocketIndex, multiplier, boxChance]) => ({
      rowCount: Number(rowCount),
      pocketIndex: Number(pocketIndex),
      multiplierPercent: Number(multiplier),
      boxChanceBasisPoints: Number(boxChance),
    }))

  it('lists exactly the pockets the server seeds, at the same multipliers and box chances', () => {
    const registry = Object.entries(DIVINE_GAMBA_POCKET_TABLES).flatMap(([rowCount, pockets]) =>
      pockets.map((pocket, pocketIndex) => ({
        rowCount: Number(rowCount),
        pocketIndex,
        multiplierPercent: pocket.multiplierPercent,
        boxChanceBasisPoints: pocket.boxChanceBasisPoints,
      })),
    )
    const byKey = (entry: { rowCount: number, pocketIndex: number }): number => entry.rowCount * 100 + entry.pocketIndex
    expect([...rows].sort((a, b) => byKey(a) - byKey(b))).toEqual(registry.sort((a, b) => byKey(a) - byKey(b)))
  })

  it('gives every board one pocket per gap, symmetric, paying above the ball only at the edges', () => {
    for (const [rowCount, pockets] of Object.entries(DIVINE_GAMBA_POCKET_TABLES)) {
      expect(pockets, rowCount).toHaveLength(Number(rowCount) + 1)
      for (const [index, pocket] of pockets.entries()) {
        const mirror = assertDefined(pockets[pockets.length - 1 - index])
        expect(pocket, `${rowCount}:${index}`).toEqual(mirror)
        if (pocket.boxChanceBasisPoints > 0) {
          expect(index === 0 || index === pockets.length - 1, `${rowCount}:${index} carries a box`).toBe(true)
        }
      }
      const centre = assertDefined(pockets[Math.floor(pockets.length / 2)])
      expect(centre.multiplierPercent).toBeLessThan(100)
    }
  })
})

interface SeededPart {
  id: string
  kind: string
  name: string
  description: string
  essenceCost: number
  shardCost: number
  pricePercent: number
  requiresPartId: string | null
  sortOrder: number
  effect: unknown
}

describe('the Shardwright\'s shelf', () => {
  const rows: SeededPart[] = seedRows(
    'divine_gamba_part_definitions',
    'id,\\s*kind,\\s*name,\\s*description,\\s*essence_cost,\\s*shard_cost,\\s*price_percent,\\s*requires_part_id,\\s*sort_order,\\s*effect',
  )
    .map(fields)
    .map(([id, kind, name, description, essence, shards, price, requires, sortOrder, effect]) => ({
      id: unquote(assertDefined(id)),
      kind: unquote(assertDefined(kind)),
      name: unquote(assertDefined(name)),
      description: unquote(assertDefined(description)),
      essenceCost: Number(essence),
      shardCost: Number(shards),
      pricePercent: Number(price),
      requiresPartId: nullable(assertDefined(requires)),
      sortOrder: Number(sortOrder),
      effect: JSON.parse(unquote(assertDefined(effect))) as unknown,
    }))

  it('finds the seed rows in the migrations', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('lists exactly the parts the server seeds, at the same prices, prerequisites and effects', () => {
    expect(ALL_DIVINE_GAMBA_PART_DEFINITIONS.map((definition) => ({ ...definition })))
      .toEqual([...rows].sort((a, b) => a.sortOrder - b.sortOrder))
  })

  it('prices every part in rift shards the client can name, and requires only parts that exist', () => {
    expect(getInventoryItemDefinition('rift-shard')).toBeDefined()
    for (const row of rows) {
      expect(row.shardCost, row.id).toBeGreaterThan(0)
      expect(row.essenceCost, row.id).toBeGreaterThan(0)
      if (row.requiresPartId !== null) {
        expect(rows.some((other) => other.id === row.requiresPartId), `${row.id} requires ${row.requiresPartId}`).toBe(true)
      }
      if (row.kind === 'part') {
        expect(row.pricePercent, `${row.id} is a part, and a part carries no surcharge`).toBe(0)
      }
    }
  })
})

interface MachineFixture {
  name: string
  ownedPartIds: string[]
  enabledModifierIds: string[]
  expected: unknown
}

/** The newest migration that checks the machine fixtures is the one whose fold is in force. */
function currentTwinMigration(marker: string): string {
  const newest = migrationSources().filter((source) => source.includes(marker)).at(-1)
  expect(newest, `a migration calling ${marker}`).toBeDefined()
  return newest ?? ''
}

describe('the machine fold twins', () => {
  const fixtures = JSON.parse(
    readFileSync(path.join(fixturesDirectory, 'divineGambaMachines.json'), 'utf8'),
  ) as MachineFixture[]

  it('has fixtures to agree on', () => {
    expect(fixtures.length).toBeGreaterThan(3)
  })

  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
    'resolves the fixture machine for %s in TypeScript',
    (_name, fixture) => {
      expect(resolveDivineGambaMachine(fixture.ownedPartIds, fixture.enabledModifierIds))
        .toEqual(fixture.expected)
    },
  )

  it('asserts the same fixtures in the migration that defines the SQL twin', () => {
    const migration = currentTwinMigration('perform public.divine_gamba_check_machine(')
    const checked = [...migration.matchAll(
      /perform public\.divine_gamba_check_machine\(\s*'([^']+)',\s*'([^']+)'::jsonb,\s*'([^']+)'::jsonb,\s*'([^']+)'::jsonb\s*\)/g,
    )].map(([, name, owned, enabled, expected]) => ({
      name,
      ownedPartIds: JSON.parse(assertDefined(owned)) as unknown,
      enabledModifierIds: JSON.parse(assertDefined(enabled)) as unknown,
      expected: JSON.parse(assertDefined(expected)) as unknown,
    }))
    expect(checked).toEqual(fixtures)
  })
})
