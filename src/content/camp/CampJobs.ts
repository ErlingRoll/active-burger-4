import type { CampBuildingId, CampJobDefinition, CampJobId } from './CampTypes'

/**
 * The jobs a Champion can be sent to.
 *
 * Each consumes one thing and produces one thing: the Woodline and the quarry
 * take only labour and give the two materials the Storehouse spends. A job's
 * fit set and fit tags are what make a varied roster slightly better than a
 * stack of clones, and they are a modest multiplier rather than a gate; any
 * Champion can work any job.
 *
 * Splintering gear goes to the Woodline and Giant's to the quarry, so that
 * the two sets the Abyss values least have a place of their own. Summons fit
 * both, as extra hands.
 *
 * Mirrored in `camp_job_definitions`; the registry test keeps the mirror true.
 */
export const CAMP_JOB_DEFINITIONS = {
  'woodline-timber': {
    id: 'woodline-timber',
    buildingId: 'woodline',
    name: 'Fell timber',
    outputDefinitionId: 'timber',
    baseRatePerHour: 4,
    fitSetId: 'splintering',
    fitTags: ['melee', 'physical', 'summon'],
  },
  'quarry-stone': {
    id: 'quarry-stone',
    buildingId: 'quarry',
    name: 'Cut stone',
    outputDefinitionId: 'stone',
    baseRatePerHour: 4,
    fitSetId: 'giant',
    fitTags: ['area', 'defensive', 'summon'],
  },
} as const satisfies Record<CampJobId, CampJobDefinition>

export const ALL_CAMP_JOB_DEFINITIONS: readonly CampJobDefinition[] =
  Object.values(CAMP_JOB_DEFINITIONS)

export function isCampJobId(value: unknown): value is CampJobId {
  return typeof value === 'string' && value in CAMP_JOB_DEFINITIONS
}

export function getCampJobDefinition(jobId: string): CampJobDefinition | undefined {
  return isCampJobId(jobId) ? CAMP_JOB_DEFINITIONS[jobId] : undefined
}

export function getCampJobsForBuilding(
  buildingId: CampBuildingId,
): readonly CampJobDefinition[] {
  return ALL_CAMP_JOB_DEFINITIONS.filter((job) => job.buildingId === buildingId)
}
