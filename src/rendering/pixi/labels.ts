import { getEnemyDefinition } from '../../content/enemies/Enemies'
import {
  getEliteModifierDefinition,
  normalizeEliteModifierIds,
  type EliteModifierInput,
} from '../../content/enemies/EliteModifiers'
import { getBossDefinition } from '../../content/bosses/Bosses'
import type { BossState } from '../../game/state/GameState'
import { ENEMY_MELEE_ATTACK_ANIMATION_SECONDS } from './constants'

/**
 * Player-facing names and attack timing shown beside an entity.
 *
 * These read content definitions only, so they are tested directly rather than
 * through the renderer.
 */

export function getEnemyDisplayLabel(
  definitionId: string,
  eliteModifiers?: EliteModifierInput,
): string {
  const definition = getEnemyDefinition(definitionId)
  const modifierIds = normalizeEliteModifierIds(eliteModifiers)
  if (modifierIds.length === 0) {
    return definition.name
  }
  return `${definition.name} · ${modifierIds.map(
    (modifierId) => getEliteModifierDefinition(modifierId).name,
  ).join(' / ')}`
}

export function getEnemyMeleeAttackAnimationProgress(
  currentTime: number,
  lastMeleeAttackTime?: number,
): number {
  if (lastMeleeAttackTime === undefined) {
    return 0
  }
  const elapsed = currentTime - lastMeleeAttackTime
  if (elapsed < 0 || elapsed >= ENEMY_MELEE_ATTACK_ANIMATION_SECONDS) {
    return 0
  }
  return elapsed / ENEMY_MELEE_ATTACK_ANIMATION_SECONDS
}

export function getBossDisplayLabel(definitionId: BossState['bossDefinitionId']): string {
  return `BOSS · ${getBossDefinition(definitionId).name}`
}
