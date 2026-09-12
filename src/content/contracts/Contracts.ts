import { getInventoryItemDefinition } from '../../inventory/ItemDefinitions'
import { RARITY_VISUALS, isRarity, type Rarity } from '../rarity/Rarity'
import type { CampBuildingId } from '../camp/CampTypes'

/**
 * The contract pool.
 *
 * A contract is a rotating objective completed through normal play, paid in
 * materials and boxes and never in Essence, so that a contract is never a
 * better run than a run. The server rolls three daily and one weekly from
 * this pool per player per period, measures progress over the period's
 * window from what it already recorded, and pays the reward once.
 *
 * Every row here mirrors a row of `contract_definitions` in the migrations;
 * `tests/contractRegistry.test.ts` fails the build when the two drift. The
 * server re-reads its own rows for every decision that moves an item, so
 * this registry is presentation: it names a contract and describes what it
 * asks before the server is consulted.
 */

export type ContractCadence = 'daily' | 'weekly'

export type ContractObjective =
  | 'descend-floors'
  | 'win-dungeon'
  | 'slay-monsters'
  | 'reach-abyss-depth'
  | 'descend-abyss'
  | 'catch-fish'
  | 'catch-species'
  | 'open-loot-boxes'
  | 'craft-items'
  | 'salvage-items'
  | 'gather-materials'
  | 'gut-fish'

export interface ContractParameter {
  /** For `catch-fish`: only catches at or above this rarity count. */
  minRarity?: Rarity
  /** For `catch-species`: the fish that counts. */
  definitionId?: string
}

export interface ContractReward {
  definitionId: string
  quantity: number
}

export interface ContractDefinition {
  id: string
  name: string
  cadence: ContractCadence
  objective: ContractObjective
  target: number
  parameter: ContractParameter
  reward: readonly ContractReward[]
  /** Offered only to a player with a Champion on the roster. */
  requiresChampion: boolean
  /** Offered only once this building stands at the Camp. */
  requiresBuildingId: CampBuildingId | null
  sortOrder: number
}

/** How many contracts of each cadence a board holds. */
export const CONTRACT_SLOTS = { daily: 3, weekly: 1 } as const satisfies Record<ContractCadence, number>

export const CONTRACT_DEFINITIONS = {
  'daily-descend': {
    id: 'daily-descend',
    name: 'Down the stairs',
    cadence: 'daily',
    objective: 'descend-floors',
    target: 8,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 12 }, { definitionId: 'stone', quantity: 12 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 0,
  },
  'daily-cull': {
    id: 'daily-cull',
    name: 'A cull',
    cadence: 'daily',
    objective: 'slay-monsters',
    target: 300,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 6 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 1,
  },
  'daily-catch': {
    id: 'daily-catch',
    name: "A day's catch",
    cadence: 'daily',
    objective: 'catch-fish',
    target: 5,
    parameter: {},
    reward: [{ definitionId: 'roe', quantity: 4 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 2,
  },
  'daily-rare-catch': {
    id: 'daily-rare-catch',
    name: 'Something rare',
    cadence: 'daily',
    objective: 'catch-fish',
    target: 1,
    parameter: { minRarity: 'rare' },
    reward: [{ definitionId: 'loot-box-uncommon', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 3,
  },
  'daily-pike': {
    id: 'daily-pike',
    name: 'The pike',
    cadence: 'daily',
    objective: 'catch-species',
    target: 1,
    parameter: { definitionId: 'lantern-pike' },
    reward: [{ definitionId: 'stone', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 4,
  },
  'daily-trout': {
    id: 'daily-trout',
    name: 'The trout',
    cadence: 'daily',
    objective: 'catch-species',
    target: 1,
    parameter: { definitionId: 'glassfin-trout' },
    reward: [{ definitionId: 'timber', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 5,
  },
  'daily-unboxing': {
    id: 'daily-unboxing',
    name: 'Unboxing',
    cadence: 'daily',
    objective: 'open-loot-boxes',
    target: 2,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 5 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 6,
  },
  'daily-bench': {
    id: 'daily-bench',
    name: 'At the bench',
    cadence: 'daily',
    objective: 'craft-items',
    target: 2,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 8 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 7,
  },
  'daily-clear-out': {
    id: 'daily-clear-out',
    name: 'Clear out',
    cadence: 'daily',
    objective: 'salvage-items',
    target: 5,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 6 }, { definitionId: 'stone', quantity: 6 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 8,
  },
  'daily-gather': {
    id: 'daily-gather',
    name: 'Timber and stone',
    cadence: 'daily',
    objective: 'gather-materials',
    target: 30,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 8 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 9,
  },
  'daily-rift': {
    id: 'daily-rift',
    name: 'Into the rift',
    cadence: 'daily',
    objective: 'descend-abyss',
    target: 5,
    parameter: {},
    reward: [{ definitionId: 'rift-shard', quantity: 2 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 10,
  },
  'daily-smokehouse': {
    id: 'daily-smokehouse',
    name: 'The Smokehouse',
    cadence: 'daily',
    objective: 'gut-fish',
    target: 2,
    parameter: {},
    reward: [{ definitionId: 'stone', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: 'smokehouse',
    sortOrder: 11,
  },
  'weekly-victory': {
    id: 'weekly-victory',
    name: 'The long way down',
    cadence: 'weekly',
    objective: 'win-dungeon',
    target: 1,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'scrap', quantity: 20 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 20,
  },
  'weekly-depth': {
    id: 'weekly-depth',
    name: 'Deep descent',
    cadence: 'weekly',
    objective: 'reach-abyss-depth',
    target: 10,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'rift-shard', quantity: 6 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 21,
  },
  'weekly-angler': {
    id: 'weekly-angler',
    name: 'The angler',
    cadence: 'weekly',
    objective: 'catch-fish',
    target: 25,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'roe', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 22,
  },
  'weekly-cull': {
    id: 'weekly-cull',
    name: 'The great cull',
    cadence: 'weekly',
    objective: 'slay-monsters',
    target: 1500,
    parameter: {},
    reward: [
      { definitionId: 'loot-box-rare', quantity: 1 },
      { definitionId: 'timber', quantity: 30 },
      { definitionId: 'stone', quantity: 30 },
    ],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 23,
  },
  'weekly-stores': {
    id: 'weekly-stores',
    name: 'Camp stores',
    cadence: 'weekly',
    objective: 'gather-materials',
    target: 150,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'scrap', quantity: 20 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 24,
  },
} as const satisfies Record<string, ContractDefinition>

export type ContractDefinitionId = keyof typeof CONTRACT_DEFINITIONS

export const ALL_CONTRACT_DEFINITIONS: readonly ContractDefinition[] =
  Object.values(CONTRACT_DEFINITIONS).sort((left, right) => left.sortOrder - right.sortOrder)

export function isContractDefinitionId(value: unknown): value is ContractDefinitionId {
  return typeof value === 'string' && value in CONTRACT_DEFINITIONS
}

export function getContractDefinition(id: string): ContractDefinition | undefined {
  return isContractDefinitionId(id) ? CONTRACT_DEFINITIONS[id] : undefined
}

export function isContractCadence(value: unknown): value is ContractCadence {
  return value === 'daily' || value === 'weekly'
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function fishName(definitionId: string | undefined): string {
  const item = definitionId === undefined ? undefined : getInventoryItemDefinition(definitionId)
  return item?.category === 'fish' ? item.name : 'a fish nobody has named'
}

/**
 * What a contract asks, in a sentence: "Descend 8 floors of the dungeon".
 * Derived from the objective, the target and the parameter rather than
 * stored, so the sentence cannot disagree with the numbers.
 */
export function describeContractObjective(definition: ContractDefinition): string {
  const { objective, target, parameter } = definition
  switch (objective) {
    case 'descend-floors':
      return `Descend ${plural(target, 'floor')} of the dungeon`
    case 'win-dungeon':
      return target === 1 ? 'Win a dungeon run' : `Win ${plural(target, 'dungeon run')}`
    case 'slay-monsters':
      return `Slay ${plural(target, 'monster')}`
    case 'reach-abyss-depth':
      return `Reach floor ${target} of the Abyss in one descent`
    case 'descend-abyss':
      return `Complete ${plural(target, 'floor')} of the Abyss`
    case 'catch-fish': {
      const rarity = isRarity(parameter.minRarity) ? parameter.minRarity : null
      if (rarity && rarity !== 'common') {
        const label = RARITY_VISUALS[rarity].label.toLowerCase()
        return target === 1 ? `Catch a ${label} fish or better` : `Catch ${plural(target, `${label} fish`, `${label} fish`)} or better`
      }
      return `Catch ${plural(target, 'fish', 'fish')}`
    }
    case 'catch-species':
      return target === 1
        ? `Catch a ${fishName(parameter.definitionId)}`
        : `Catch ${target} ${fishName(parameter.definitionId)}`
    case 'open-loot-boxes':
      return `Open ${plural(target, 'loot box', 'loot boxes')}`
    case 'craft-items':
      return `Craft ${plural(target, 'batch', 'batches')} at a bench`
    case 'salvage-items':
      return `Salvage ${plural(target, 'item')}`
    case 'gather-materials':
      return `Gather ${target} timber and stone at the Camp`
    case 'gut-fish':
      return `Gut ${plural(target, 'fish', 'fish')} at the Smokehouse`
  }
}

/** Where a contract is completed, for the card's kicker. */
export function describeContractPlace(objective: ContractObjective): string {
  switch (objective) {
    case 'descend-floors':
    case 'win-dungeon':
    case 'slay-monsters':
      return 'The dungeon'
    case 'reach-abyss-depth':
    case 'descend-abyss':
      return 'The Abyss'
    case 'catch-fish':
    case 'catch-species':
      return 'Moonwater Pond'
    case 'open-loot-boxes':
    case 'salvage-items':
    case 'craft-items':
      return 'The bag'
    case 'gather-materials':
    case 'gut-fish':
      return 'The Camp'
  }
}

/** "12 Timber, 12 Stone". */
export function formatContractReward(reward: readonly ContractReward[]): string {
  return reward
    .map((line) => `${line.quantity} ${getInventoryItemDefinition(line.definitionId)?.name ?? line.definitionId}`)
    .join(', ')
}
