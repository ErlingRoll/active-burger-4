export type EnemyDefinitionId = string

export interface EnemyDefinition {
  id: EnemyDefinitionId
  radius: number
  maxHp: number
  speed: number
  contactDamage: number
  xpReward: number
}

export const SLIME_DEFINITION_ID: EnemyDefinitionId = 'slime'

export const ENEMY_DEFINITIONS = {
  [SLIME_DEFINITION_ID]: {
    id: SLIME_DEFINITION_ID,
    radius: 18,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 5,
  },
} as const satisfies Record<EnemyDefinitionId, EnemyDefinition>

export function getEnemyDefinition(
  definitionId: EnemyDefinitionId,
): EnemyDefinition {
  const definition = ENEMY_DEFINITIONS[definitionId]

  if (!definition) {
    throw new Error(`Unknown enemy definition: ${definitionId}`)
  }

  return definition
}
