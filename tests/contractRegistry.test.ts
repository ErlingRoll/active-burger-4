import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_CONTRACT_DEFINITIONS,
  CONTRACT_SLOTS,
  type ContractDefinition,
} from '../src/content/contracts/Contracts'
import { getCampBuildingDefinition } from '../src/content/camp/CampBuildings'
import { getInventoryItemDefinition } from '../src/inventory/ItemDefinitions'
import { isRarity } from '../src/content/rarity/Rarity'
import { assertDefined } from '../src/testing'

/**
 * The contracts the board describes are the contracts the server deals.
 *
 * `get_contract_state` rolls from `contract_definitions` and
 * `claim_contract_reward` re-reads that row for the target and the reward,
 * so the TypeScript registry is presentation only, and presentation drifts.
 * The seed rows are parsed out of the migrations here, the way the Camp's
 * registry test parses its buildings, so a contract added, retuned or
 * retired on one side without the other fails the build.
 */

const migrationsDirectory = path.resolve(import.meta.dirname, '../supabase/migrations')

function migrationSources(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => readFileSync(path.join(migrationsDirectory, entry), 'utf8'))
}

/** Splits a tuple's fields on the commas outside quotes, braces and brackets. */
function fields(row: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let current = ''
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index]
    if (character === "'") {
      // A doubled quote inside a literal is an escaped quote, not a close.
      if (quoted && row[index + 1] === "'") {
        current += "''"
        index += 1
        continue
      }
      quoted = !quoted
    } else if (!quoted && (character === '(' || character === '{' || character === '[')) {
      depth += 1
    } else if (!quoted && (character === ')' || character === '}' || character === ']')) {
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
  return field.replace(/^'([\s\S]*)'(?:::\w+)?$/, '$1').replace(/''/g, "'")
}

interface SeededContract {
  id: string
  name: string
  cadence: string
  objective: string
  target: number
  parameter: unknown
  reward: unknown
  requiresChampion: boolean
  requiresBuildingId: string | null
  sortOrder: number
}

/**
 * Replays every `insert into public.contract_definitions ... values`
 * statement in migration order, a later row replacing an earlier one the way
 * the upsert does, and an `update ... set active = false where id = '...'`
 * retiring one.
 */
function seededContracts(): SeededContract[] {
  const byId = new Map<string, SeededContract>()
  for (const sql of migrationSources()) {
    for (const [, columns, tuples] of sql.matchAll(
      /insert into public\.contract_definitions\s*\(([^)]*)\)\s*values([\s\S]*?)(?:on conflict|;)/g,
    )) {
      const names = (columns ?? '').split(',').map((column) => column.trim())
      // A tuple runs from an opening parenthesis to its close, with the JSON
      // literals' own parentheses absent and their quotes balanced.
      for (const [, row] of (tuples ?? '').matchAll(/\(((?:[^()']|'(?:[^']|'')*')*)\)/g)) {
        const values = fields(row ?? '')
        const read = (column: string): string => {
          const index = names.indexOf(column)
          expect(index, `a ${column} column in the contract seed`).toBeGreaterThan(-1)
          return assertDefined(values[index])
        }
        const building = read('requires_building_id')
        const id = unquote(read('id'))
        byId.set(id, {
          id,
          name: unquote(read('name')),
          cadence: unquote(read('cadence')),
          objective: unquote(read('objective')),
          target: Number(read('target')),
          parameter: JSON.parse(unquote(read('parameter'))) as unknown,
          reward: JSON.parse(unquote(read('reward'))) as unknown,
          requiresChampion: read('requires_champion') === 'true',
          requiresBuildingId: building === 'null' ? null : unquote(building),
          sortOrder: Number(read('sort_order')),
        })
      }
    }
    for (const [, id] of sql.matchAll(
      /update public\.contract_definitions\s+set active = false\s+where id = '([^']+)'/g,
    )) {
      byId.delete(assertDefined(id))
    }
  }
  return [...byId.values()]
}

function comparable(definition: ContractDefinition): SeededContract {
  return {
    id: definition.id,
    name: definition.name,
    cadence: definition.cadence,
    objective: definition.objective,
    target: definition.target,
    parameter: definition.parameter,
    reward: definition.reward,
    requiresChampion: definition.requiresChampion,
    requiresBuildingId: definition.requiresBuildingId,
    sortOrder: definition.sortOrder,
  }
}

describe('contract definitions', () => {
  const rows = seededContracts()

  it('finds the seed rows in the migrations', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('lists exactly the contracts the server seeds, asking and paying the same', () => {
    expect(ALL_CONTRACT_DEFINITIONS.map(comparable))
      .toEqual([...rows].sort((left, right) => left.sortOrder - right.sortOrder))
  })

  it('pays in items the client can name, and never in Essence', () => {
    for (const definition of ALL_CONTRACT_DEFINITIONS) {
      expect(definition.reward.length, definition.id).toBeGreaterThan(0)
      for (const line of definition.reward) {
        const item = getInventoryItemDefinition(line.definitionId)
        expect(item, `${definition.id} pays ${line.definitionId}`).toBeDefined()
        expect(['material', 'loot-box']).toContain(item?.category)
        expect(line.quantity).toBeGreaterThan(0)
      }
    }
  })

  it('names fish and rarities the content has', () => {
    for (const definition of ALL_CONTRACT_DEFINITIONS) {
      if (definition.objective === 'catch-species') {
        expect(getInventoryItemDefinition(assertDefined(definition.parameter.definitionId))?.category, definition.id).toBe('fish')
      }
      if (definition.parameter.minRarity !== undefined) {
        expect(isRarity(definition.parameter.minRarity), definition.id).toBe(true)
      }
    }
  })

  it('requires only buildings the Camp has', () => {
    for (const definition of ALL_CONTRACT_DEFINITIONS) {
      if (definition.requiresBuildingId !== null) {
        expect(getCampBuildingDefinition(definition.requiresBuildingId), definition.id).toBeDefined()
      }
    }
  })

  it('holds enough contracts of each cadence to fill a board without a Champion', () => {
    for (const cadence of ['daily', 'weekly'] as const) {
      const reachable = ALL_CONTRACT_DEFINITIONS.filter((definition) =>
        definition.cadence === cadence && !definition.requiresChampion && definition.requiresBuildingId === null,
      )
      expect(reachable.length, cadence).toBeGreaterThanOrEqual(CONTRACT_SLOTS[cadence])
    }
  })

  it('deals the same number of slots the migration deals', () => {
    const migration = migrationSources().find((source) => source.includes('contract_roll_period('))
    expect(migration).toBeDefined()
    const daily = /'daily', v_day_key, [^,]+, [^,]+, (\d+)\s*\)/.exec(migration ?? '')
    const weekly = /'weekly', v_week_key, [^,]+, [^,]+, (\d+)\s*\)/.exec(migration ?? '')
    expect(Number(daily?.[1])).toBe(CONTRACT_SLOTS.daily)
    expect(Number(weekly?.[1])).toBe(CONTRACT_SLOTS.weekly)
  })
})
