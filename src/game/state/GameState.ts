import type {
  EnemyDefinitionId,
  EntityId,
  ProjectileDefinitionId,
} from '../ids'
import type { RunPhase } from './RunPhase'

/** Configuration required to start a new deterministic run. */
export interface RunConfig {
  seed: number
}

export interface RunState {
  phase: RunPhase
  seed: number
  killCount: number
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
  attackCooldownRemaining: number

  targetId?: EntityId
}

export interface EnemyState {
  id: EntityId

  definitionId: EnemyDefinitionId

  x: number
  y: number

  radius: number

  hp: number
  maxHp: number

  speed: number

  contactDamage: number

  xpReward: number

  targetId: EntityId
}

export type DamageType = 'physical'

export interface DamageEvent {
  sourceId?: EntityId
  targetId: EntityId
  amount: number
  damageType: DamageType
}

export interface ProjectileState {
  id: EntityId
  ownerId: EntityId
  definitionId: ProjectileDefinitionId

  x: number
  y: number

  velocityX: number
  velocityY: number

  radius: number
  damage: number
  remainingLifetime: number
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
