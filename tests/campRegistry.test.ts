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

describe('camp buildings', () => {
  const rows = seedRows('camp_building_definitions', 'id,\\s*name,\\s*sort_order')
    .map(fields)
    .map(([id, name, sortOrder]) => ({
      id: unquote(assertDefined(id)),
      name: unquote(assertDefined(name)),
      sortOrder: Number(sortOrder),
    }))

  it('finds the seed rows in the migrations', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('lists exactly the buildings the server seeds, named and ordered the same', () => {
    expect(
      ALL_CAMP_BUILDING_DEFINITIONS.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
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

  it('starts every building at a free level one', () => {
    for (const building of ALL_CAMP_BUILDING_DEFINITIONS) {
      const first = rows.find((row) => row.buildingId === building.id && row.level === 1)
      expect(first?.cost, building.id).toEqual({})
    }
  })
})

describe('camp jobs', () => {
  const rows = seedRows(
    'camp_job_definitions',
    'id,\\s*building_id,\\s*output_definition_id,\\s*base_rate_per_hour,\\s*fit_set_id,\\s*fit_tags',
  )
    .map(fields)
    .map(([id, buildingId, output, rate, setId, tags]) => ({
      id: unquote(assertDefined(id)),
      buildingId: unquote(assertDefined(buildingId)),
      outputDefinitionId: unquote(assertDefined(output)),
      baseRatePerHour: Number(rate),
      fitSetId: unquote(assertDefined(setId)),
      fitTags: unquote(assertDefined(tags)).replace(/^\{|\}$/g, '').split(',').map((tag) => tag.trim()).sort(),
    }))

  it('lists exactly the jobs the server seeds, at the same rates and fits', () => {
    expect(
      ALL_CAMP_JOB_DEFINITIONS
        .map(({ id, buildingId, outputDefinitionId, baseRatePerHour, fitSetId, fitTags }) => ({
          id, buildingId, outputDefinitionId, baseRatePerHour, fitSetId, fitTags: [...fitTags].sort(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...rows].sort((a, b) => a.id.localeCompare(b.id)))
  })

  it('produces items the client can name', () => {
    for (const row of rows) {
      expect(getInventoryItemDefinition(row.outputDefinitionId), row.outputDefinitionId).toBeDefined()
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
