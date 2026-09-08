import type { Game } from '../../game/Game'
import type { SkillEffectState, TelegraphState } from '../../game/state/GameState'
import { getBossSkillDefinition } from '../../content/bosses/Bosses'
import {
  getEnemyAbilityDefinition,
  type EnemyAbilityId,
} from '../../content/enemies/EnemyAbilities'

/**
 * Pure queries over simulation state used while drawing a frame.
 *
 * These decide *what* to draw from the state alone, without touching Pixi, so
 * they can be tested without a canvas. The renderer keeps the drawing.
 */

export function hasWorldSpaceEffectGeometry(
  effect: Pick<SkillEffectState, 'points' | 'impactPoint' | 'impactPoints'>,
): boolean {
  return effect.points.length > 1 ||
    effect.impactPoint !== undefined ||
    (effect.impactPoints?.length ?? 0) > 0
}

export interface StatusEffectBadge {
  id: string
}

/** The badges shown above an enemy, in a fixed order so they do not shuffle. */
export function getEnemyStatusEffects(
  poisonStackCount: number,
  chillStacks = 0,
  frozenRemainingDuration = 0,
  shockStacks = 0,
  burningStackCount = 0,
): StatusEffectBadge[] {
  const statuses: StatusEffectBadge[] = []
  if (poisonStackCount > 0) {
    statuses.push({ id: 'poison' })
  }
  if (chillStacks > 0) {
    statuses.push({ id: 'chill' })
  }
  if (frozenRemainingDuration > 0) {
    statuses.push({ id: 'freeze' })
  }
  if (shockStacks > 0) {
    statuses.push({ id: 'shock' })
  }
  if (burningStackCount > 0) {
    statuses.push({ id: 'burning' })
  }
  return statuses
}

/** Identifies a badge set so the renderer can skip redrawing an unchanged one. */
export function getStatusEffectSignature(
  statuses: readonly StatusEffectBadge[],
): string {
  return statuses.map((status) => status.id).join('|')
}

export function isEnemyAbilityId(
  skillId: TelegraphState['skillId'],
): skillId is EnemyAbilityId {
  return skillId === 'archer-shot' || skillId === 'brute-shockwave'
}

export function getTelegraphName(telegraph: TelegraphState): string {
  if (telegraph.skillId === 'elite-volatile') {
    return 'Volatile Explosion'
  }
  if (isEnemyAbilityId(telegraph.skillId)) {
    return getEnemyAbilityDefinition(telegraph.skillId).name
  }
  if (
    telegraph.skillId === 'ground-slam' ||
    telegraph.skillId === 'charge' ||
    telegraph.skillId === 'fire-nova' ||
    telegraph.skillId === 'flame-line' ||
    telegraph.skillId === 'meteor-zone'
  ) {
    return getBossSkillDefinition(telegraph.skillId).name
  }
  return 'Enemy attack'
}

export function isLineTelegraphKind(telegraph: TelegraphState): boolean {
  return telegraph.kind === 'charge' ||
    telegraph.kind === 'flame-line' ||
    telegraph.kind === 'enemy-projectile'
}

/**
 * Re-anchors a projectile telegraph to its live source and target.
 *
 * A telegraph is created with the positions held at cast time. For an enemy
 * projectile both ends keep moving, so the warning line would drift away from
 * the attack it describes if it were drawn from the stored points.
 */
export function getTelegraphRenderState(
  state: Game['state'],
  telegraph: TelegraphState,
): TelegraphState {
  if (telegraph.kind !== 'enemy-projectile' || telegraph.sourceKind !== 'enemy') {
    return telegraph
  }
  const source = state.enemies.find(
    (enemy) => enemy.id === telegraph.sourceId && enemy.hp > 0,
  )
  const target = telegraph.targetId === state.player.id
    ? state.player
    : state.summons.find(
        (summon) => summon.id === telegraph.targetId && summon.hp > 0,
      )
  if (!source || !target) {
    return telegraph
  }
  return {
    ...telegraph,
    x: source.x,
    y: source.y,
    points: [
      { x: source.x, y: source.y },
      { x: target.x, y: target.y },
    ],
  }
}
