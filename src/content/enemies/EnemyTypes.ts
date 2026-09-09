import type { DamageResistanceValues } from '../stats/Damage'

/**
 * Enemy schema types.
 *
 * These live apart from `Enemies.ts` so that `game-config/enemies.ts` can be
 * typed by them without importing a module that re-exports its own tuning data
 * back. Keeping the schema in a leaf module is what makes the dependency
 * between `content/` and `game-config/` one-directional.
 */

export type EnemyDefinitionId = string
export type EnemyBehaviorKind = 'chase' | 'standoff' | 'split' | 'intercept'
/**
 * The silhouette an enemy is drawn as.
 *
 * The first six are authored per enemy so the roster is told apart by shape
 * rather than only by colour; the four primitives are kept for anything that
 * has no identity of its own yet. Drawn by
 * `src/rendering/pixi/enemySilhouettes.ts`.
 */
export type EnemyRenderShape =
  | 'slime'
  | 'dart'
  | 'bulwark'
  | 'bow'
  | 'cluster'
  | 'hook'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'hexagon'

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
