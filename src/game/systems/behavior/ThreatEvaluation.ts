import { getEliteModifierIds } from '../../../content/enemies/EliteModifiers'
import {
  BOSS_THREAT_SCORE,
  getThreatScoreDefinition,
} from '../../../content/behaviors/ThreatScoring'
import type { BossState, EnemyState } from '../../state/GameState'

/**
 * Scores live entities using the threat values declared in content.
 *
 * The tuning table stays in `content/behaviors/ThreatScoring.ts`; the
 * evaluation lives here because it reads simulation state, and `content/` must
 * not depend on `game/`.
 */

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
