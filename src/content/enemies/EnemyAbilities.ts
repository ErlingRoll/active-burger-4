import type { DamageType } from '../stats/Damage'
import type { ProjectileDefinitionId } from '../projectiles/Projectiles'

export type EnemyAbilityId = 'archer-shot' | 'brute-shockwave'

export interface EnemyAbilityDefinition {
  id: EnemyAbilityId
  enemyDefinitionId: string
  name: string
  kind: 'projectile' | 'area'
  cooldown: number
  telegraphDuration: number
  damage: number
  damageType: DamageType
  radius: number
  range: number
  projectileDefinitionId?: ProjectileDefinitionId
}

export const ARCHER_SHOT_ABILITY_ID: EnemyAbilityId = 'archer-shot'
export const BRUTE_SHOCKWAVE_ABILITY_ID: EnemyAbilityId = 'brute-shockwave'

export const ENEMY_ABILITY_DEFINITIONS = {
  [ARCHER_SHOT_ABILITY_ID]: {
    id: ARCHER_SHOT_ABILITY_ID,
    enemyDefinitionId: 'archer',
    name: 'Aimed Shot',
    kind: 'projectile',
    cooldown: 6,
    telegraphDuration: 0.8,
    damage: 9,
    damageType: 'physical',
    radius: 16,
    range: 560,
    projectileDefinitionId: 'enemy-archer-arrow',
  },
  [BRUTE_SHOCKWAVE_ABILITY_ID]: {
    id: BRUTE_SHOCKWAVE_ABILITY_ID,
    enemyDefinitionId: 'brute',
    name: 'Shockwave',
    kind: 'area',
    cooldown: 7,
    telegraphDuration: 0.7,
    damage: 14,
    damageType: 'physical',
    radius: 120,
    range: 170,
  },
} as const satisfies Record<EnemyAbilityId, EnemyAbilityDefinition>

export function getEnemyAbilityDefinition(
  abilityId: EnemyAbilityId,
): EnemyAbilityDefinition {
  const definition = ENEMY_ABILITY_DEFINITIONS[abilityId]
  if (!definition) {
    throw new Error(`Unknown enemy ability definition: ${abilityId}`)
  }
  return definition
}

export function getEnemyAbilityForDefinition(
  enemyDefinitionId: string,
): EnemyAbilityDefinition | undefined {
  return Object.values(ENEMY_ABILITY_DEFINITIONS).find(
    (ability) => ability.enemyDefinitionId === enemyDefinitionId,
  )
}
