import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_CAMP_BUILDING_DEFINITIONS,
  CAMP_BUILDING_LEVELS,
} from '../src/content/camp/CampBuildings'
import { ALL_CAMP_JOB_DEFINITIONS } from '../src/content/camp/CampJobs'
import {
  deriveCampLabourSheet,
  type CampLabourBuild,
  type CampLabourSheet,
} from '../src/content/camp/CampLabour'
import { accrueCampProduction } from '../src/content/camp/CampAccrual'
import { getCampJobDefinition } from '../src/content/camp/CampJobs'
import { SKILL_DEFINITIONS } from '../src/content/skills/SkillConfigs'
import { getInventoryItemDefinition } from '../src/inventory/ItemDefinitions'
import { assertDefined } from '../src/testing'

/**
 * The Camp the client describes is the Camp the server runs.
 *
 * The buildings, their levels, the jobs and the skill tags are reference rows
 * in the migrations with a TypeScript mirror for the hub to read before it
 * asks the server anything, and the labour sheet and accrual arithmetic are
 * a SQL function with a TypeScript twin. Each pair is held together here the
 * way tests/craftingRecipes.test.ts holds the recipes: the seed rows are
 * parsed out of the migrations and compared with the registries, and the
 * fixture set the migration asserts against its own functions is compared
 * with the file the TypeScript twin is asserted against, so that a change to
 * either side without the other fails the build.
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

function number(field: string): number | null {
  return field === 'null' ? null : Number(field)
}

/**
 * The building seeds come in two shapes: the foundations named three columns,
 * and the construction migration added `starting_level` for the bench. Each
 * statement is read by its own column list, and a later row replaces an
 * earlier one the way the upsert does.
 */
function seededBuildings(): { id: string, name: string, sortOrder: number, startingLevel: number }[] {
  const byId = new Map<string, { id: string, name: string, sortOrder: number, startingLevel: number }>()
  for (const sql of migrationSources()) {
    for (const [, columns, tuples] of sql.matchAll(
      /insert into public\.camp_building_definitions\s*\(([^)]*)\)\s*values([\s\S]*?)(?:on conflict|;)/g,
    )) {
      const names = (columns ?? '').split(',').map((column) => column.trim())
      for (const [, row] of (tuples ?? '').matchAll(/\(((?:[^()']|'[^']*')*)\)/g)) {
        const values = fields(row ?? '')
        const read = (column: string): string | undefined => {
          const index = names.indexOf(column)
          return index === -1 ? undefined : values[index]
        }
        byId.set(unquote(assertDefined(read('id'))), {
          id: unquote(assertDefined(read('id'))),
          name: unquote(assertDefined(read('name'))),
          sortOrder: Number(read('sort_order')),
          startingLevel: read('starting_level') === undefined ? 1 : Number(read('starting_level')),
        })
      }
    }
  }
  return [...byId.values()]
}

describe('camp buildings', () => {
  const rows = seededBuildings()

  it('finds the seed rows in the migrations', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('lists exactly the buildings the server seeds, named, ordered and started the same', () => {
    expect(
      ALL_CAMP_BUILDING_DEFINITIONS.map(({ id, name, sortOrder, startingLevel }) => ({ id, name, sortOrder, startingLevel })),
    ).toEqual([...rows].sort((left, right) => left.sortOrder - right.sortOrder))
  })
})

describe('camp building levels', () => {
  const rows = seedRows(
    'camp_building_levels',
    'building_id,\\s*level,\\s*cost,\\s*accrual_cap_hours,\\s*rate_multiplier,\\s*job_slots',
  )
    .map(fields)
    .map(([buildingId, level, cost, cap, rate, slots]) => ({
      buildingId: unquote(assertDefined(buildingId)),
      level: Number(level),
      cost: JSON.parse(unquote(assertDefined(cost))) as Record<string, number>,
      accrualCapHours: number(assertDefined(cap)),
      rateMultiplier: Number(rate),
      jobSlots: Number(slots),
    }))

  it('lists exactly the levels the server seeds, at the same prices', () => {
    const byKey = (entry: { buildingId: string, level: number }): string =>
      `${entry.buildingId}:${entry.level}`
    expect([...CAMP_BUILDING_LEVELS].sort((a, b) => byKey(a).localeCompare(byKey(b))))
      .toEqual([...rows].sort((a, b) => byKey(a).localeCompare(byKey(b))))
  })

  it('prices every level in items the client can name', () => {
    for (const row of rows) {
      for (const definitionId of Object.keys(row.cost)) {
        expect(getInventoryItemDefinition(definitionId), definitionId).toBeDefined()
      }
    }
  })

  it('makes the starting level of every building free, and the level after it priced', () => {
    for (const building of ALL_CAMP_BUILDING_DEFINITIONS) {
      const starting = rows.find((row) => row.buildingId === building.id && row.level === building.startingLevel)
      if (building.startingLevel > 0) {
        expect(starting?.cost, building.id).toEqual({})
      }
      const next = rows.find((row) => row.buildingId === building.id && row.level === building.startingLevel + 1)
      expect(Object.keys(next?.cost ?? {}).length, `${building.id} level ${building.startingLevel + 1}`).toBeGreaterThan(0)
    }
  })
})

/**
 * The job seeds come in two shapes as well: the foundations named an item
 * output only, and the anchor migration added `effect` and let the output
 * be null. Read by column list, later rows replacing earlier ones.
 */
interface SeededJob {
  id: string
  buildingId: string
  effect: string
  outputDefinitionId: string | null
  baseRatePerHour: number
  fitSetId: string
  fitTags: string[]
}

function seededJobs(): SeededJob[] {
  const byId = new Map<string, SeededJob>()
  for (const sql of migrationSources()) {
    for (const [, columns, tuples] of sql.matchAll(
      /insert into public\.camp_job_definitions\s*\(([^)]*)\)\s*values([\s\S]*?)(?:on conflict|;)/g,
    )) {
      const names = (columns ?? '').split(',').map((column) => column.trim())
      for (const [, row] of (tuples ?? '').matchAll(/\(((?:[^()']|'[^']*')*)\)/g)) {
        const values = fields(row ?? '')
        const read = (column: string): string | undefined => {
          const index = names.indexOf(column)
          return index === -1 ? undefined : values[index]
        }
        const output = assertDefined(read('output_definition_id'))
        byId.set(unquote(assertDefined(read('id'))), {
          id: unquote(assertDefined(read('id'))),
          buildingId: unquote(assertDefined(read('building_id'))),
          effect: read('effect') === undefined ? 'item' : unquote(assertDefined(read('effect'))),
          outputDefinitionId: output === 'null' ? null : unquote(output),
          baseRatePerHour: Number(read('base_rate_per_hour')),
          fitSetId: unquote(assertDefined(read('fit_set_id'))),
          fitTags: unquote(assertDefined(read('fit_tags'))).replace(/^\{|\}$/g, '').split(',').map((tag) => tag.trim()).sort(),
        })
      }
    }
  }
  return [...byId.values()]
}

describe('camp jobs', () => {
  const rows = seededJobs()

  it('lists exactly the jobs the server seeds, at the same rates, effects and fits', () => {
    expect(
      ALL_CAMP_JOB_DEFINITIONS
        .map(({ id, buildingId, effect, outputDefinitionId, baseRatePerHour, fitSetId, fitTags }) => ({
          id, buildingId, effect, outputDefinitionId, baseRatePerHour, fitSetId, fitTags: [...fitTags].sort(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...rows].sort((a, b) => a.id.localeCompare(b.id)))
  })

  it('produces items the client can name, and names none for a relief job', () => {
    for (const row of rows) {
      if (row.effect === 'item') {
        expect(getInventoryItemDefinition(assertDefined(row.outputDefinitionId)), row.id).toBeDefined()
      } else {
        expect(row.outputDefinitionId, row.id).toBeNull()
      }
    }
  })
})

describe('camp skill tags', () => {
  const seeded = new Set(
    seedRows('camp_skill_tags', 'skill_id,\\s*tag')
      .map(fields)
      .map(([skillId, tag]) => `${unquote(assertDefined(skillId))}:${unquote(assertDefined(tag))}`),
  )

  it('carries every tag of every skill in the registry, and no other', () => {
    const registry = new Set(
      Object.values(SKILL_DEFINITIONS).flatMap((skill) => skill.tags.map((tag) => `${skill.id}:${tag}`)),
    )
    expect([...seeded].sort()).toEqual([...registry].sort())
  })
})

interface LabourFixture {
  name: string
  jobId: string
  sourceFloor: number | null
  build: CampLabourBuild
  expected: CampLabourSheet
}

interface AccrualFixture {
  name: string
  ratePerHour: number
  capHours: number
  accruedFrom: string
  now: string
  expected: { units: number, countedSeconds: number, accruedFrom: string }
}

function readFixtures<TFixture>(file: string): TFixture[] {
  return JSON.parse(readFileSync(path.join(fixturesDirectory, file), 'utf8')) as TFixture[]
}

/** The newest migration that checks the sheet fixtures is the one whose function is in force. */
function currentTwinMigration(marker: string): string {
  const newest = migrationSources().filter((source) => source.includes(marker)).at(-1)
  expect(newest, `a migration calling ${marker}`).toBeDefined()
  return newest ?? ''
}

describe('the labour sheet twins', () => {
  const fixtures = readFixtures<LabourFixture>('campLabourSheets.json')

  it('has fixtures to agree on', () => {
    expect(fixtures.length).toBeGreaterThan(2)
  })

  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
    'derives the fixture sheet for %s in TypeScript',
    (_name, fixture) => {
      const job = assertDefined(getCampJobDefinition(fixture.jobId), fixture.jobId)
      expect(deriveCampLabourSheet({ build: fixture.build, sourceFloor: fixture.sourceFloor }, job))
        .toEqual(fixture.expected)
    },
  )

  it('asserts the same fixtures in the migration that defines the SQL twin', () => {
    const migration = currentTwinMigration('perform public.camp_check_labour_sheet(')
    const checked = [...migration.matchAll(
      /perform public\.camp_check_labour_sheet\(\s*'([^']+)',\s*'([^']+)'::jsonb,\s*(null|\d+),\s*'([^']+)',\s*'([^']+)'::jsonb\s*\)/g,
    )].map(([, name, build, floor, jobId, expected]) => ({
      name,
      jobId,
      sourceFloor: floor === 'null' ? null : Number(floor),
      build: JSON.parse(assertDefined(build)) as unknown,
      expected: JSON.parse(assertDefined(expected)) as unknown,
    }))

    expect(checked).toEqual(fixtures.map(({ name, jobId, sourceFloor, build, expected }) => ({
      name, jobId, sourceFloor, build, expected,
    })))
  })
})

describe('the accrual twins', () => {
  const fixtures = readFixtures<AccrualFixture>('campAccrual.json')

  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
    'accrues the fixture %s in TypeScript',
    (_name, fixture) => {
      const result = accrueCampProduction({
        ratePerHour: fixture.ratePerHour,
        capHours: fixture.capHours,
        accruedFromMs: Date.parse(fixture.accruedFrom),
        nowMs: Date.parse(fixture.now),
      })
      expect({
        units: result.units,
        countedSeconds: result.countedSeconds,
        accruedFrom: new Date(result.accruedFromMs).toISOString(),
      }).toEqual(fixture.expected)
    },
  )

  it('asserts the same fixtures in the migration that defines the SQL twin', () => {
    const migration = currentTwinMigration('perform public.camp_check_accrual(')
    const checked = [...migration.matchAll(
      /perform public\.camp_check_accrual\(\s*'([^']+)',\s*([\d.]+),\s*([\d.]+),\s*'([^']+)'::timestamptz,\s*'([^']+)'::timestamptz,\s*(\d+),\s*([\d.]+),\s*'([^']+)'::timestamptz\s*\)/g,
    )].map(([, name, rate, cap, from, now, units, counted, accruedFrom]) => ({
      name,
      ratePerHour: Number(rate),
      capHours: Number(cap),
      accruedFrom: from,
      now,
      expected: { units: Number(units), countedSeconds: Number(counted), accruedFrom },
    }))

    expect(checked).toEqual(fixtures)
  })
})
