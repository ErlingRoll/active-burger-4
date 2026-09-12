import { describe, expect, it } from 'vitest'
import {
  ALL_CONTRACT_DEFINITIONS,
  CONTRACT_DEFINITIONS,
  describeContractObjective,
  describeContractPlace,
  formatContractReward,
  getContractDefinition,
  isContractCadence,
  isContractDefinitionId,
} from './Contracts'

describe('the contract registry', () => {
  it('orders the pool by sort order with the dailies first', () => {
    const orders = ALL_CONTRACT_DEFINITIONS.map((definition) => definition.sortOrder)
    expect(orders).toEqual([...orders].sort((left, right) => left - right))
    const firstWeekly = ALL_CONTRACT_DEFINITIONS.findIndex((definition) => definition.cadence === 'weekly')
    expect(ALL_CONTRACT_DEFINITIONS.slice(0, firstWeekly).every((definition) => definition.cadence === 'daily')).toBe(true)
  })

  it('looks a contract up by id and refuses an unknown one', () => {
    expect(getContractDefinition('daily-cull')).toBe(CONTRACT_DEFINITIONS['daily-cull'])
    expect(getContractDefinition('daily-nothing')).toBeUndefined()
    expect(isContractDefinitionId('weekly-angler')).toBe(true)
    expect(isContractDefinitionId(42)).toBe(false)
    expect(isContractCadence('daily')).toBe(true)
    expect(isContractCadence('hourly')).toBe(false)
  })

  it('gives every contract a different id, name and sort order', () => {
    const ids = new Set(ALL_CONTRACT_DEFINITIONS.map((definition) => definition.id))
    const names = new Set(ALL_CONTRACT_DEFINITIONS.map((definition) => definition.name))
    const orders = new Set(ALL_CONTRACT_DEFINITIONS.map((definition) => definition.sortOrder))
    expect(ids.size).toBe(ALL_CONTRACT_DEFINITIONS.length)
    expect(names.size).toBe(ALL_CONTRACT_DEFINITIONS.length)
    expect(orders.size).toBe(ALL_CONTRACT_DEFINITIONS.length)
  })
})

describe('describeContractObjective', () => {
  it('reads each objective as a sentence with its numbers in it', () => {
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-descend'])).toBe('Descend 8 floors of the dungeon')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['weekly-victory'])).toBe('Win a dungeon run')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-cull'])).toBe('Slay 300 monsters')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['weekly-depth'])).toBe('Reach floor 10 of the Abyss in one descent')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-rift'])).toBe('Complete 5 floors of the Abyss')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-catch'])).toBe('Catch 5 fish')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-rare-catch'])).toBe('Catch a rare fish or better')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-pike'])).toBe('Catch a Lantern Pike')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-unboxing'])).toBe('Open 2 loot boxes')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-bench'])).toBe('Craft 2 batches at a bench')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-clear-out'])).toBe('Salvage 5 items')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-gather'])).toBe('Gather 30 timber and stone at the Camp')
    expect(describeContractObjective(CONTRACT_DEFINITIONS['daily-smokehouse'])).toBe('Gut 2 fish at the Smokehouse')
  })

  it('names a place for every objective', () => {
    for (const definition of ALL_CONTRACT_DEFINITIONS) {
      expect(describeContractPlace(definition.objective).length).toBeGreaterThan(0)
    }
    expect(describeContractPlace('catch-species')).toBe('Moonwater Pond')
    expect(describeContractPlace('gather-materials')).toBe('The Camp')
  })

  it('formats a reward with the item names the bag uses', () => {
    expect(formatContractReward(CONTRACT_DEFINITIONS['daily-descend'].reward)).toBe('12 Timber, 12 Stone')
    expect(formatContractReward(CONTRACT_DEFINITIONS['weekly-victory'].reward)).toBe('1 Rare Loot Box, 20 Scrap')
  })
})
