import {
  STONE_GOLEM_BOSS_ID,
  INFERNO_WARDEN_BOSS_ID,
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

export const STONE_GOLEM_ENCOUNTER_ID = 'stone-golem-encounter'
export const STONE_GOLEM_ENCOUNTER_DURATION_SECONDS = 120
export const INFERNO_WARDEN_ENCOUNTER_ID = 'inferno-warden-final'

export function createInfernoWardenEncounter(
  maximumFloor: number,
): EncounterDefinition {
  return {
    id: INFERNO_WARDEN_ENCOUNTER_ID,
    type: 'boss',
    bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
    durationSeconds: STONE_GOLEM_ENCOUNTER_DURATION_SECONDS,
    floorNumber: maximumFloor,
    isFinal: true,
  }
}

/** Creates an intermediate Stone Golem event for each normal floor. */
export function createStoneGolemEncounterTimeline(
  maximumFloor: number,
): readonly EncounterDefinition[] {
  const timeline: EncounterDefinition[] = []
  for (let floorNumber = 1; floorNumber < maximumFloor; floorNumber += 1) {
    timeline.push({
      id:
        floorNumber === 1
          ? STONE_GOLEM_ENCOUNTER_ID
          : `${STONE_GOLEM_ENCOUNTER_ID}-floor-${floorNumber}`,
      type: 'boss',
      bossDefinitionId: STONE_GOLEM_BOSS_ID,
      durationSeconds: STONE_GOLEM_ENCOUNTER_DURATION_SECONDS,
      floorNumber,
    })
  }
  return timeline
}

export const ENCOUNTER_DEFINITIONS: readonly EncounterDefinition[] = [
  ...createStoneGolemEncounterTimeline(100),
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
