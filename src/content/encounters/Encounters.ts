import {
  STONE_GOLEM_BOSS_ID,
  INFERNO_WARDEN_BOSS_ID,
  type BossDefinitionId,
} from '../bosses/Bosses'

export type EncounterEventType = 'boss'

export interface EncounterDefinition {
  id: string
  timeSeconds: number
  type: EncounterEventType
  bossDefinitionId: BossDefinitionId
  /** Optional multi-boss composition; bossDefinitionId remains the primary boss. */
  bossDefinitionIds?: readonly BossDefinitionId[]
  /** The amount of the floor timeline reserved for this boss event. */
  durationSeconds: number
  /** One-based floor on which the event begins. */
  floorNumber?: number
  /** Final encounters end the run when their stairs are touched. */
  isFinal?: boolean
}
export type EncounterEvent = EncounterDefinition

export const STONE_GOLEM_ENCOUNTER_ID = 'stone-golem-encounter'
export const STONE_GOLEM_ENCOUNTER_DURATION_SECONDS = 120
export const INFERNO_WARDEN_ENCOUNTER_ID = 'inferno-warden-final'

export function createInfernoWardenEncounter(
  finalLengthSeconds: number,
  floorDurationSeconds = STONE_GOLEM_ENCOUNTER_DURATION_SECONDS,
): EncounterDefinition {
  return {
    id: INFERNO_WARDEN_ENCOUNTER_ID,
    timeSeconds: finalLengthSeconds,
    type: 'boss',
    bossDefinitionId: INFERNO_WARDEN_BOSS_ID,
    durationSeconds: STONE_GOLEM_ENCOUNTER_DURATION_SECONDS,
    floorNumber: Math.floor(finalLengthSeconds / floorDurationSeconds) + 1,
    isFinal: true,
  }
}

/**
 * Creates the intermediate Stone Golem events for a dungeon length.
 * The final timer is reserved for the distinct final boss, so no event is
 * created at that boundary.
 */
export function createStoneGolemEncounterTimeline(
  finalLengthSeconds: number,
  floorDurationSeconds = STONE_GOLEM_ENCOUNTER_DURATION_SECONDS,
): readonly EncounterDefinition[] {
  const timeline: EncounterDefinition[] = []
  for (
    let timeSeconds = floorDurationSeconds;
    timeSeconds < finalLengthSeconds;
    timeSeconds += floorDurationSeconds
  ) {
    const floorNumber = Math.floor(timeSeconds / floorDurationSeconds) + 1
    timeline.push({
      id:
        floorNumber === 2
          ? STONE_GOLEM_ENCOUNTER_ID
          : `${STONE_GOLEM_ENCOUNTER_ID}-floor-${floorNumber}`,
      timeSeconds,
      type: 'boss',
      bossDefinitionId: STONE_GOLEM_BOSS_ID,
      durationSeconds: STONE_GOLEM_ENCOUNTER_DURATION_SECONDS,
      floorNumber,
    })
  }
  return timeline
}

export const ENCOUNTER_DEFINITIONS: readonly EncounterDefinition[] = [
  ...createStoneGolemEncounterTimeline(10 * 60),
  createInfernoWardenEncounter(10 * 60),
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
