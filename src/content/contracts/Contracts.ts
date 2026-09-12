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
  | 'reach-dungeon-floor'
  | 'sell-items'
  | 'upgrade-buildings'
  | 'cure-fish'
  | 'reforge-artifacts'

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

/**
 * A contract claimed this many times in a period pays half from then on.
 * The rotation deals the least-dealt contract first, so a repeat comes only
 * after the whole reachable pool has been seen, and it is never worth more
 * than the first time. Mirrored in `contract_scaled_quantity`.
 */
export const CONTRACT_REPEAT_CLAIMS_BEFORE_HALVING = 2

/** The pay a claim makes for one reward line, never less than one. */
export function scaleContractReward(quantity: number, repeatClaims: number): number {
  return repeatClaims >= CONTRACT_REPEAT_CLAIMS_BEFORE_HALVING
    ? Math.max(1, Math.ceil(quantity / 2))
    : quantity
}

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
  'daily-descend-2': {
    id: 'daily-descend-2',
    name: 'Deeper stairs',
    cadence: 'daily',
    objective: 'descend-floors',
    target: 15,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 24 }, { definitionId: 'stone', quantity: 24 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 1,
  },
  'daily-descend-3': {
    id: 'daily-descend-3',
    name: 'The long stair',
    cadence: 'daily',
    objective: 'descend-floors',
    target: 25,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 40 }, { definitionId: 'stone', quantity: 40 }, { definitionId: 'loot-box-uncommon', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 2,
  },
  'daily-floor-10': {
    id: 'daily-floor-10',
    name: 'Tenth floor',
    cadence: 'daily',
    objective: 'reach-dungeon-floor',
    target: 10,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 3,
  },
  'daily-floor-20': {
    id: 'daily-floor-20',
    name: 'Twentieth floor',
    cadence: 'daily',
    objective: 'reach-dungeon-floor',
    target: 20,
    parameter: {},
    reward: [{ definitionId: 'stone', quantity: 24 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 4,
  },
  'daily-floor-30': {
    id: 'daily-floor-30',
    name: 'The last stair',
    cadence: 'daily',
    objective: 'reach-dungeon-floor',
    target: 30,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 5,
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
    sortOrder: 6,
  },
  'daily-cull-2': {
    id: 'daily-cull-2',
    name: 'A reaping',
    cadence: 'daily',
    objective: 'slay-monsters',
    target: 800,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 14 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 7,
  },
  'daily-cull-3': {
    id: 'daily-cull-3',
    name: 'A slaughter',
    cadence: 'daily',
    objective: 'slay-monsters',
    target: 2000,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 30 }, { definitionId: 'loot-box-uncommon', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 8,
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
    sortOrder: 9,
  },
  'daily-catch-2': {
    id: 'daily-catch-2',
    name: 'A full creel',
    cadence: 'daily',
    objective: 'catch-fish',
    target: 12,
    parameter: {},
    reward: [{ definitionId: 'roe', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 10,
  },
  'daily-catch-3': {
    id: 'daily-catch-3',
    name: 'The pond emptied',
    cadence: 'daily',
    objective: 'catch-fish',
    target: 25,
    parameter: {},
    reward: [{ definitionId: 'roe', quantity: 20 }, { definitionId: 'loot-box-uncommon', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 11,
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
    sortOrder: 12,
  },
  'daily-epic-catch': {
    id: 'daily-epic-catch',
    name: 'Something stranger',
    cadence: 'daily',
    objective: 'catch-fish',
    target: 1,
    parameter: { minRarity: 'epic' },
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 13,
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
    sortOrder: 14,
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
    sortOrder: 15,
  },
  'daily-perch': {
    id: 'daily-perch',
    name: 'The perch',
    cadence: 'daily',
    objective: 'catch-species',
    target: 1,
    parameter: { definitionId: 'silver-perch' },
    reward: [{ definitionId: 'roe', quantity: 8 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 16,
  },
  'daily-carp': {
    id: 'daily-carp',
    name: 'The carp',
    cadence: 'daily',
    objective: 'catch-species',
    target: 1,
    parameter: { definitionId: 'moon-carp' },
    reward: [{ definitionId: 'timber', quantity: 12 }, { definitionId: 'stone', quantity: 12 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 17,
  },
  'daily-catfish': {
    id: 'daily-catfish',
    name: 'The catfish',
    cadence: 'daily',
    objective: 'catch-species',
    target: 1,
    parameter: { definitionId: 'tideback-catfish' },
    reward: [{ definitionId: 'loot-box-uncommon', quantity: 1 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 18,
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
    sortOrder: 19,
  },
  'daily-unboxing-2': {
    id: 'daily-unboxing-2',
    name: 'A crate of boxes',
    cadence: 'daily',
    objective: 'open-loot-boxes',
    target: 6,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 14 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 20,
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
    sortOrder: 21,
  },
  'daily-bench-2': {
    id: 'daily-bench-2',
    name: 'A long shift',
    cadence: 'daily',
    objective: 'craft-items',
    target: 6,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 20 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 22,
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
    sortOrder: 23,
  },
  'daily-clear-out-2': {
    id: 'daily-clear-out-2',
    name: 'Spring cleaning',
    cadence: 'daily',
    objective: 'salvage-items',
    target: 15,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 16 }, { definitionId: 'stone', quantity: 16 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 24,
  },
  'daily-sell': {
    id: 'daily-sell',
    name: 'To market',
    cadence: 'daily',
    objective: 'sell-items',
    target: 5,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 6 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 25,
  },
  'daily-sell-2': {
    id: 'daily-sell-2',
    name: 'A cart to market',
    cadence: 'daily',
    objective: 'sell-items',
    target: 20,
    parameter: {},
    reward: [{ definitionId: 'stone', quantity: 20 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 26,
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
    sortOrder: 27,
  },
  'daily-gather-2': {
    id: 'daily-gather-2',
    name: 'A full store',
    cadence: 'daily',
    objective: 'gather-materials',
    target: 90,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 20 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 28,
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
    sortOrder: 29,
  },
  'daily-rift-2': {
    id: 'daily-rift-2',
    name: 'Deeper into the rift',
    cadence: 'daily',
    objective: 'descend-abyss',
    target: 12,
    parameter: {},
    reward: [{ definitionId: 'rift-shard', quantity: 5 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 30,
  },
  'daily-build': {
    id: 'daily-build',
    name: 'Raise a wall',
    cadence: 'daily',
    objective: 'upgrade-buildings',
    target: 1,
    parameter: {},
    reward: [{ definitionId: 'scrap', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 31,
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
    sortOrder: 32,
  },
  'daily-smokehouse-2': {
    id: 'daily-smokehouse-2',
    name: 'A day of gutting',
    cadence: 'daily',
    objective: 'gut-fish',
    target: 6,
    parameter: {},
    reward: [{ definitionId: 'stone', quantity: 20 }],
    requiresChampion: false,
    requiresBuildingId: 'smokehouse',
    sortOrder: 33,
  },
  'daily-cure': {
    id: 'daily-cure',
    name: 'Cured and hung',
    cadence: 'daily',
    objective: 'cure-fish',
    target: 1,
    parameter: {},
    reward: [{ definitionId: 'timber', quantity: 12 }],
    requiresChampion: false,
    requiresBuildingId: 'smokehouse',
    sortOrder: 34,
  },
  'daily-forge': {
    id: 'daily-forge',
    name: 'At the anvil',
    cadence: 'daily',
    objective: 'reforge-artifacts',
    target: 1,
    parameter: {},
    reward: [{ definitionId: 'rift-shard', quantity: 4 }],
    requiresChampion: false,
    requiresBuildingId: 'forge',
    sortOrder: 35,
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
    sortOrder: 100,
  },
  'weekly-descend': {
    id: 'weekly-descend',
    name: 'Sixty floors',
    cadence: 'weekly',
    objective: 'descend-floors',
    target: 60,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'timber', quantity: 40 }, { definitionId: 'stone', quantity: 40 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 101,
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
    sortOrder: 102,
  },
  'weekly-depth-2': {
    id: 'weekly-depth-2',
    name: 'Deeper descent',
    cadence: 'weekly',
    objective: 'reach-abyss-depth',
    target: 20,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'rift-shard', quantity: 12 }],
    requiresChampion: true,
    requiresBuildingId: null,
    sortOrder: 103,
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
    sortOrder: 104,
  },
  'weekly-rare-angler': {
    id: 'weekly-rare-angler',
    name: 'The collector',
    cadence: 'weekly',
    objective: 'catch-fish',
    target: 3,
    parameter: { minRarity: 'rare' },
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'roe', quantity: 15 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 105,
  },
  'weekly-cull': {
    id: 'weekly-cull',
    name: 'The great cull',
    cadence: 'weekly',
    objective: 'slay-monsters',
    target: 1500,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'timber', quantity: 30 }, { definitionId: 'stone', quantity: 30 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 106,
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
    sortOrder: 107,
  },
  'weekly-boxes': {
    id: 'weekly-boxes',
    name: 'A dozen boxes',
    cadence: 'weekly',
    objective: 'open-loot-boxes',
    target: 12,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'scrap', quantity: 20 }],
    requiresChampion: false,
    requiresBuildingId: null,
    sortOrder: 108,
  },
  'weekly-forge': {
    id: 'weekly-forge',
    name: 'A week at the anvil',
    cadence: 'weekly',
    objective: 'reforge-artifacts',
    target: 3,
    parameter: {},
    reward: [{ definitionId: 'loot-box-rare', quantity: 1 }, { definitionId: 'rift-shard', quantity: 10 }],
    requiresChampion: false,
    requiresBuildingId: 'forge',
    sortOrder: 109,
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
        const article = /^[aeiou]/.test(label) ? 'an' : 'a'
        return target === 1 ? `Catch ${article} ${label} fish or better` : `Catch ${plural(target, `${label} fish`, `${label} fish`)} or better`
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
    case 'reach-dungeon-floor':
      return `Reach floor ${target} of the dungeon in one run`
    case 'sell-items':
      return `Sell ${plural(target, 'item')} to the quartermaster`
    case 'upgrade-buildings':
      return target === 1 ? 'Raise a building at the Camp' : `Raise ${plural(target, 'building')} at the Camp`
    case 'cure-fish':
      return target === 1 ? 'Cure a fish at the Smokehouse' : `Cure ${plural(target, 'fish', 'fish')} at the Smokehouse`
    case 'reforge-artifacts':
      return target === 1 ? 'Reforge an artifact at the Forge' : `Reforge ${plural(target, 'artifact')} at the Forge`
  }
}

/** Where a contract is completed, for the card's kicker. */
export function describeContractPlace(objective: ContractObjective): string {
  switch (objective) {
    case 'descend-floors':
    case 'reach-dungeon-floor':
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
    case 'sell-items':
      return 'The quartermaster'
    case 'gather-materials':
    case 'gut-fish':
    case 'cure-fish':
    case 'reforge-artifacts':
    case 'upgrade-buildings':
      return 'The Camp'
  }
}

/** "12 Timber, 12 Stone". */
export function formatContractReward(reward: readonly ContractReward[]): string {
  return reward
    .map((line) => `${line.quantity} ${getInventoryItemDefinition(line.definitionId)?.name ?? line.definitionId}`)
    .join(', ')
}
