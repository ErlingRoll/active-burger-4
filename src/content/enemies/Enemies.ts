import { ENEMY_DEFINITIONS } from './EnemyConfig'
import type { DamageResistanceValues } from '../stats/Damage'

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

export type EnemyDefinitionId = string
export type EnemyBehaviorKind = 'chase' | 'standoff' | 'split' | 'intercept'
export type EnemyRenderShape = 'circle' | 'diamond' | 'triangle' | 'hexagon'

export interface EnemyRenderDefinition {
  color: string
  outlineColor: string
  scale: number
  shape: EnemyRenderShape
}

export interface EnemySplitDefinition {
  childDefinitionId: EnemyDefinitionId
  childCount: number
  childrenAwardXp: boolean
  spreadRadius: number
}

export type EnemyBehaviorDefinition =
  | { kind: 'chase' }
  | { kind: 'standoff'; desiredDistance: number; retreatDistance: number }
  | { kind: 'split'; split: EnemySplitDefinition }
  | {
      kind: 'intercept'
      predictionSeconds: number
      lateralOffset: number
      engagementDistance: number
    }

export interface EnemyDefinition {
  id: EnemyDefinitionId
  name: string
  radius: number
  maxHp: number
  speed: number
  contactDamage: number
  xpReward: number
  gearDropChance: number
  /** Percentage resistance to Chill/Freeze duration and stack application. */
  controlResistance?: number
  resistances?: Partial<DamageResistanceValues>
  behavior: EnemyBehaviorDefinition
  render: EnemyRenderDefinition
}
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
