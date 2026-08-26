import {
  STONE_GOLEM_BOSS_ID,
  type BossDefinitionId,
} from '../bosses/Bosses'

export type EncounterEventType = 'boss'

export interface EncounterDefinition {
  id: string
  timeSeconds: number
  type: EncounterEventType
  bossDefinitionId: BossDefinitionId
}
export type EncounterEvent = EncounterDefinition

export const STONE_GOLEM_ENCOUNTER_ID = 'stone-golem-encounter'

/** The first milestone is deliberately a single, easy-to-test 3:00 event. */
export const ENCOUNTER_DEFINITIONS: readonly EncounterDefinition[] = [
  {
    id: STONE_GOLEM_ENCOUNTER_ID,
    timeSeconds: 180,
    type: 'boss',
    bossDefinitionId: STONE_GOLEM_BOSS_ID,
  },
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
