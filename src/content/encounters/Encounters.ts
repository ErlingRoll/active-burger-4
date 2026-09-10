import {
  INFERNO_WARDEN_BOSS_ID,
  selectFloorBossId,
  type BossDefinitionId,
} from '../bosses/Bosses'

export type EncounterEventType = 'boss'

export interface EncounterDefinition {
  id: string
  type: EncounterEventType
  bossDefinitionId: BossDefinitionId
  /** Optional multi-boss composition; bossDefinitionId remains the primary boss. */
  bossDefinitionIds?: readonly BossDefinitionId[]
  /** The amount of time reserved for this boss event. */
  durationSeconds: number
  /** One-based normal floor that must reach full progress before this starts. */
  floorNumber: number
  /** Final encounters end the run when their stairs are touched. */
  isFinal?: boolean
}
export type EncounterEvent = EncounterDefinition

export const FLOOR_ENCOUNTER_DURATION_SECONDS = 120
export const INFERNO_WARDEN_ENCOUNTER_ID = 'inferno-warden-final'

/**
 * Encounter ids are keyed on the floor, not on the boss that floor draws.
 *
 * A run records which encounters it has finished, and the floor is the part that
 * is fixed: which boss arrives is a draw from the run seed, so naming the id
 * after the boss would have made the same floor two different events depending
 * on the roll.
 */
export function getFloorEncounterId(floorNumber: number): string {
  return `floor-boss-${Math.max(1, Math.floor(floorNumber))}`
}

/** Kept for the Stone Golem's original floor-one id in older saves. */
export const STONE_GOLEM_ENCOUNTER_ID = getFloorEncounterId(1)
export const STONE_GOLEM_ENCOUNTER_DURATION_SECONDS =
  FLOOR_ENCOUNTER_DURATION_SECONDS

export function createInfernoWardenEncounter(
  maximumFloor: number,
): EncounterDefinition {
  return {
    id: INFERNO_WARDEN_ENCOUNTER_ID,
    type: 'boss',
    bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
    durationSeconds: FLOOR_ENCOUNTER_DURATION_SECONDS,
    floorNumber: maximumFloor,
    isFinal: true,
  }
}

/** The boss event for one ordinary floor, drawn from the run seed. */
export function createFloorEncounter(
  floorNumber: number,
  seed: number,
): EncounterDefinition {
  return {
    id: getFloorEncounterId(floorNumber),
    type: 'boss',
    bossDefinitionId: selectFloorBossId(seed, floorNumber),
    durationSeconds: FLOOR_ENCOUNTER_DURATION_SECONDS,
    floorNumber,
  }
}

/** One boss event per normal floor below `maximumFloor`. */
export function createFloorEncounterTimeline(
  maximumFloor: number,
  seed: number,
): readonly EncounterDefinition[] {
  const timeline: EncounterDefinition[] = []
  for (let floorNumber = 1; floorNumber < maximumFloor; floorNumber += 1) {
    timeline.push(createFloorEncounter(floorNumber, seed))
  }
  return timeline
}

/** Legacy name retained while callers migrate to the seeded timeline. */
export const createStoneGolemEncounterTimeline = createFloorEncounterTimeline

/**
 * The catalogue the content validator checks.
 *
 * A run's real timeline is drawn from its own seed, so this is one
 * representative draw: it exists to prove the shape of an encounter is valid,
 * not to say which boss any particular run meets.
 */
export const ENCOUNTER_CATALOGUE_SEED = 1
export const ENCOUNTER_DEFINITIONS: readonly EncounterDefinition[] = [
  ...createFloorEncounterTimeline(100, ENCOUNTER_CATALOGUE_SEED),
  createInfernoWardenEncounter(100),
]

export function getEncounterDefinition(id: string): EncounterDefinition {
  const definition = ENCOUNTER_DEFINITIONS.find(
    (candidate) => candidate.id === id,
  )
  if (!definition) {
    throw new Error(`Unknown encounter definition: ${id}`)
  }
  return definition
}
