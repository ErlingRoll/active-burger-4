import type {
  EnemyDefinitionId,
  EntityId,
  ProjectileDefinitionId,
  SkillId,
} from '../ids'
import type { StatModifier, StatValues } from '../../content/stats/Stats'
import type { EquipmentLoadout } from '../equipment/EquipmentState'
import type { UpgradeId } from '../../content/upgrades/Upgrades'
import type { RunPhase } from './RunPhase'

/** Configuration required to start a new deterministic run. */
export interface RunConfig {
  seed: number
}

export interface RunState {
  phase: RunPhase
  seed: number
  killCount: number
  selectedUpgradeIds: UpgradeId[]
  /** Remains true after the first gear orb is generated, even after collection. */
  gearDropGenerated?: boolean
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

  /** Base values and modifiers are optional for backwards-compatible fixtures. */
  baseStats?: StatValues
  statModifiers?: StatModifier[]
  equipment?: EquipmentLoadout

  targetId?: EntityId
  skills: SkillState[]
}

export interface SkillState {
  skillId: SkillId
  level: number
  cooldownRemaining: number
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

export type DamageType = 'physical' | 'lightning'

export interface DamageEvent {
  sourceId?: EntityId
  sourceSkillId?: SkillId
  targetId: EntityId
  amount: number
  damageType: DamageType
}

export interface ProjectileState {
  id: EntityId
  ownerId: EntityId
  definitionId: ProjectileDefinitionId
  /** Optional for backwards-compatible projectile fixtures; skill spawns set it. */
  skillId?: SkillId

  x: number
  y: number

  velocityX: number
  velocityY: number

  radius: number
  damage: number
  remainingLifetime: number
}

export interface SkillEffectPoint {
  x: number
  y: number
}

export interface PickupStateBase {
  id: EntityId
  x: number
  y: number
  radius: number
  attractionRadius: number
  attractionSpeed: number
}

export interface XpPickupState extends PickupStateBase {
  kind: 'xp'
  xpAmount: number
}

export interface GearPickupState extends PickupStateBase {
  kind: 'gear'
  /** Gear orbs do not award XP. */
  xpAmount?: never
  sourceEnemyDefinitionId?: EnemyDefinitionId
}

export type PickupState = XpPickupState | GearPickupState

export interface SummonState {
  id: EntityId
}

export interface SkillEffectState {
  id: EntityId
  skillId: SkillId
  x: number
  y: number
  radius: number
  lifetime: number
  remainingLifetime: number
  /** Deterministic world-space path, with the first point at x/y. */
  points: readonly SkillEffectPoint[]
}

export interface GameState {
  run: RunState
  player: PlayerState

  enemies: EnemyState[]
  projectiles: ProjectileState[]
  pickups: PickupState[]
  summons: SummonState[]
  effects: SkillEffectState[]

  time: number
  tick: number

  paused: boolean
}
