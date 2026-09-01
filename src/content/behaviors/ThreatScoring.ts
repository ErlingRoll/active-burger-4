import type { EnemyDefinitionId } from '../enemies/Enemies'
import { getEliteModifierIds } from '../enemies/EliteModifiers'
import type { EnemyState, BossState } from '../../game/state/GameState'

/**
 * Threat values are content data rather than a property of the movement
 * system. Pack pressure is applied by the evaluator for nearby entities.
 */
export interface ThreatScoreDefinition {
  base: number
  packBonus: number
  eliteMultiplier: number
}

export const THREAT_SCORE_DEFINITIONS: Readonly<
  Partial<Record<EnemyDefinitionId, ThreatScoreDefinition>>
> = {
  slime: { base: 1, packBonus: 0.35, eliteMultiplier: 1.5 },
  runner: { base: 1.5, packBonus: 0.3, eliteMultiplier: 1.5 },
  archer: { base: 2.5, packBonus: 0.2, eliteMultiplier: 1.5 },
  splitter: { base: 2.5, packBonus: 0.3, eliteMultiplier: 1.5 },
  brute: { base: 4, packBonus: 0.25, eliteMultiplier: 1.75 },
  flanker: { base: 2.5, packBonus: 0.25, eliteMultiplier: 1.5 },
}

export const DEFAULT_THREAT_SCORE_DEFINITION: ThreatScoreDefinition = {
  base: 1,
  packBonus: 0.25,
  eliteMultiplier: 1.5,
}

export const BOSS_THREAT_SCORE = 10

export function getThreatScoreDefinition(
  definitionId: EnemyDefinitionId,
): ThreatScoreDefinition {
  return THREAT_SCORE_DEFINITIONS[definitionId] ??
    DEFAULT_THREAT_SCORE_DEFINITION
}

export function getEntityThreatScore(
  entity: EnemyState | BossState,
  nearbyPackSize = 0,
): number {
  const definition = 'bossDefinitionId' in entity
    ? undefined
    : getThreatScoreDefinition(entity.definitionId)
  const base = definition?.base ?? BOSS_THREAT_SCORE
  const packBonus = definition?.packBonus ?? 0
  const eliteMultiplier = Math.pow(
    definition?.eliteMultiplier ?? 1.5,
    getEliteModifierIds(entity).length,
  )
  const healthRatio = entity.maxHp > 0
    ? Math.max(0, Math.min(1, entity.hp / entity.maxHp))
    : 0

  return (base + packBonus * Math.max(0, nearbyPackSize)) *
    eliteMultiplier * (0.5 + healthRatio * 0.5)
}

export function getEntityPackThreatScore(
  entity: EnemyState | BossState,
  entities: readonly (EnemyState | BossState)[],
  packRadius: number,
): number {
  const radiusSquared = Math.max(0, packRadius) ** 2
  const nearbyPackSize = entities.filter((candidate) => {
    if (candidate.id === entity.id || candidate.hp <= 0) {
      return false
    }
    const dx = candidate.x - entity.x
    const dy = candidate.y - entity.y
    return dx * dx + dy * dy <= radiusSquared
  }).length
  return getEntityThreatScore(entity, nearbyPackSize)
}
