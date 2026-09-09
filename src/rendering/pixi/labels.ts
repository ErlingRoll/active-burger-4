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

/**
 * The name drawn over an enemy, or nothing.
 *
 * A name over every enemy is a wall of text once a dozen of them are on
 * screen: the labels collide with each other and with the player, and they
 * say what the silhouette already says. Only an elite gets one, because an
 * elite's modifiers change how it must be fought and no silhouette carries
 * that. The name is still on the enemy's own definition for anything that
 * needs to read it.
 */
export function getEnemyDisplayLabel(
  definitionId: string,
  eliteModifiers?: EliteModifierInput,
): string {
  const definition = getEnemyDefinition(definitionId)
  const modifierIds = normalizeEliteModifierIds(eliteModifiers)
  if (modifierIds.length === 0) {
    return ''
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
