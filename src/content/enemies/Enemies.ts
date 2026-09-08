import { ENEMY_DEFINITIONS } from './EnemyConfig'
import type { EnemyDefinition, EnemyDefinitionId } from './EnemyTypes'

export {
  ARCHER_SHOT_ABILITY_ID,
  BRUTE_SHOCKWAVE_ABILITY_ID,
  ENEMY_ABILITY_DEFINITIONS,
  getEnemyAbilityDefinition,
  getEnemyAbilityForDefinition,
} from './EnemyAbilities'
export type { EnemyAbilityDefinition, EnemyAbilityId } from './EnemyAbilities'

export {
  ELITE_MODIFIER_DEFINITIONS,
  getEliteModifierDefinition,
} from './EliteModifiers'
export type {
  EliteModifierDefinition,
  EliteModifierId,
} from './EliteModifiers'

export type {
  EnemyBehaviorDefinition,
  EnemyBehaviorKind,
  EnemyDefinition,
  EnemyDefinitionId,
  EnemyRenderDefinition,
  EnemyRenderShape,
  EnemySplitDefinition,
} from './EnemyTypes'

export {
  ARCHER_DEFINITION_ID,
  BRUTE_DEFINITION_ID,
  ENEMY_DEFINITIONS,
  FLANKER_DEFINITION_ID,
  RUNNER_DEFINITION_ID,
  SLIME_DEFINITION_ID,
  SPLITTER_DEFINITION_ID,
} from './EnemyConfig'

export function getEnemyDefinition(
  definitionId: EnemyDefinitionId,
): EnemyDefinition {
  const definition = ENEMY_DEFINITIONS[definitionId]

  if (!definition) {
    throw new Error(`Unknown enemy definition: ${definitionId}`)
  }

  return definition
}
