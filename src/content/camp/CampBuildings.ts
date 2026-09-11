import type {
  CampBuildingDefinition,
  CampBuildingId,
  CampBuildingLevel,
} from './CampTypes'

/**
 * The buildings, and what each level of them costs and does.
 *
 * The Storehouse is the first sink for timber and stone, because it is the one
 * every player wants: it raises the cap on what accrues while they are away.
 * The Woodline and the quarry are the only faucets, and each starts at level
 * one for nothing so a new Camp has work to offer on the day it opens.
 *
 * Numbers are proposals to tune against play, not decisions. The target is
 * that one Champion on one job fills a Storehouse upgrade in about two days of
 * check-ins. Mirrored in `camp_building_definitions` and
 * `camp_building_levels`; the registry test keeps the mirror true.
 */
export const CAMP_BUILDING_DEFINITIONS = {
  storehouse: {
    id: 'storehouse',
    name: 'Storehouse',
    description: 'Holds what the Camp makes while you are away. A bigger store waits longer before the work stops.',
    sortOrder: 0,
  },
  woodline: {
    id: 'woodline',
    name: 'Woodline',
    description: 'A stand of timber at the edge of the firelight, felled and stacked by whoever you send.',
    sortOrder: 1,
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    description: 'A cut in the hillside where stone comes loose for anyone with the arms to carry it.',
    sortOrder: 2,
  },
} as const satisfies Record<CampBuildingId, CampBuildingDefinition>

export const ALL_CAMP_BUILDING_DEFINITIONS: readonly CampBuildingDefinition[] =
  Object.values(CAMP_BUILDING_DEFINITIONS)
    .sort((left, right) => left.sortOrder - right.sortOrder)

export const CAMP_BUILDING_LEVELS: readonly CampBuildingLevel[] = [
  { buildingId: 'storehouse', level: 1, cost: {}, accrualCapHours: 8, rateMultiplier: 1, jobSlots: 0 },
  { buildingId: 'storehouse', level: 2, cost: { timber: 48, stone: 48 }, accrualCapHours: 10, rateMultiplier: 1, jobSlots: 0 },
  { buildingId: 'storehouse', level: 3, cost: { timber: 120, stone: 120, scrap: 40 }, accrualCapHours: 12, rateMultiplier: 1, jobSlots: 0 },
  { buildingId: 'woodline', level: 1, cost: {}, accrualCapHours: null, rateMultiplier: 1, jobSlots: 1 },
  { buildingId: 'woodline', level: 2, cost: { timber: 40, stone: 40 }, accrualCapHours: null, rateMultiplier: 1.5, jobSlots: 2 },
  { buildingId: 'quarry', level: 1, cost: {}, accrualCapHours: null, rateMultiplier: 1, jobSlots: 1 },
  { buildingId: 'quarry', level: 2, cost: { timber: 40, stone: 40 }, accrualCapHours: null, rateMultiplier: 1.5, jobSlots: 2 },
]

export function isCampBuildingId(value: unknown): value is CampBuildingId {
  return typeof value === 'string' && value in CAMP_BUILDING_DEFINITIONS
}

export function getCampBuildingDefinition(
  buildingId: string,
): CampBuildingDefinition | undefined {
  return isCampBuildingId(buildingId) ? CAMP_BUILDING_DEFINITIONS[buildingId] : undefined
}

export function getCampBuildingLevel(
  buildingId: CampBuildingId,
  level: number,
): CampBuildingLevel | undefined {
  return CAMP_BUILDING_LEVELS.find(
    (entry) => entry.buildingId === buildingId && entry.level === level,
  )
}

/** The level a player could buy next, or undefined at the top of the table. */
export function getNextCampBuildingLevel(
  buildingId: CampBuildingId,
  currentLevel: number,
): CampBuildingLevel | undefined {
  return getCampBuildingLevel(buildingId, currentLevel + 1)
}

export function getCampBuildingMaxLevel(buildingId: CampBuildingId): number {
  return CAMP_BUILDING_LEVELS
    .filter((entry) => entry.buildingId === buildingId)
    .reduce((highest, entry) => Math.max(highest, entry.level), 0)
}

/**
 * The offline accrual cap a Storehouse level sets. The cap is the whole
 * design: short enough that the Camp is a check-in, never a second job.
 */
export function getStorehouseAccrualCapHours(storehouseLevel: number): number {
  const level = getCampBuildingLevel('storehouse', storehouseLevel)
  return level?.accrualCapHours ?? CAMP_BUILDING_LEVELS[0]?.accrualCapHours ?? 8
}
