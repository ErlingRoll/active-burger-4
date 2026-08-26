import type { EntityId } from '../ids'
import type { RunPhase } from './RunPhase'

/** Configuration required to start a new deterministic run. */
export interface RunConfig {
  seed: number
}

export interface RunState {
  phase: RunPhase
  seed: number
}

/**
 * The initial player only needs enough fields to exist in the simulation;
 * see PLAN.md section 17. Movement/AI/combat systems that use these fields
 * are introduced in later milestones.
 */
export interface PlayerState {
  id: EntityId

  x: number
  y: number

  radius: number

  hp: number
  maxHp: number

  level: number
  xp: number

  movementSpeed: number

  attackDamage: number
  attackSpeed: number
  attackRange: number

  targetId?: EntityId
}

/**
 * Placeholder entity shapes for collections introduced by PLAN.md section 11.
 * Only identity is defined for now; fields are added when milestones 3-6
 * introduce enemies, projectiles, pickups, and summons so `GameState` keeps a
 * stable shape for the renderer to project without inventing unspecified
 * gameplay data ahead of time.
 */
export interface EnemyState {
  id: EntityId
}

export interface ProjectileState {
  id: EntityId
}

export interface PickupState {
  id: EntityId
}

export interface SummonState {
  id: EntityId
}

export interface GameState {
  run: RunState
  player: PlayerState

  enemies: EnemyState[]
  projectiles: ProjectileState[]
  pickups: PickupState[]
  summons: SummonState[]

  time: number
  tick: number

  paused: boolean
}
