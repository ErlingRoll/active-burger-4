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
import type { EliteModifierId } from '../../content/enemies/EliteModifiers'
import type {
  BossDefinitionId,
  BossSkillId,
} from '../../content/bosses/Bosses'
import type { BehaviorProfileId } from '../../content/behaviors/BehaviorProfiles'

export type EncounterStatus = 'inactive' | 'active' | 'complete'
export type EncounterOutcome = 'victory' | 'defeat' | undefined

export interface EncounterState {
  status: EncounterStatus
  encounterId?: string
  bossDefinitionId?: BossDefinitionId
  bossEntityId?: EntityId
  startedAt?: number
  completedAt?: number
  outcome?: EncounterOutcome
  /** Normal spawns are suspended only while the encounter is active. */
  normalSpawnsSuspended: boolean
}

export interface TelegraphState {
  id: EntityId
  sourceId: EntityId
  skillId: BossSkillId
  kind: 'ground-slam' | 'charge'
  x: number
  y: number
  radius: number
  remainingDuration: number
  duration: number
  points: readonly SkillEffectPoint[]
  damage: number
}
export type Telegraph = TelegraphState

export interface DodgeState {
  mode: 'autonomous'
  level: number
  /** Seconds of telegraph visibility required before Dodge reacts. */
  reactionTime: number
  lastDirectionX: number
  lastDirectionY: number
}

/** A movement request produced by a behavior and consumed by its controller. */
export type PlayerMovementSource =
  | 'dodge'
  | 'gear'
  | 'kite'
  | 'combat-range'
  | 'hold'

export interface PlayerMovementCandidate {
  source: PlayerMovementSource
  directionX: number
  directionY: number
  speed: number
  priority: number
  /** The entity that caused this intent, when applicable. */
  targetId?: EntityId
  /** The pickup that caused this intent, when applicable. */
  pickupId?: EntityId
}

export type DodgeMovementCandidate = PlayerMovementCandidate
export type DodgeCandidate = DodgeMovementCandidate
export type MovementCandidate = PlayerMovementCandidate

export interface BehaviorControllerState {
  profileId: BehaviorProfileId
  lastCandidate?: PlayerMovementCandidate
  /** Remaining time for which the current intent is committed. */
  commitmentRemaining?: number
  committedSource?: PlayerMovementSource
  committedTargetId?: EntityId
  committedPickupId?: EntityId
}

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
  dodge?: DodgeState
  /** Optional for backwards-compatible state fixtures; new runs initialize it. */
  behaviorController?: BehaviorControllerState
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
  /** Seconds until this enemy can deal contact damage again. */
  contactCooldownRemaining?: number

  xpReward: number

  /** Assigned once at spawn and never inferred by the renderer. */
  eliteModifier?: EliteModifierId

  targetId: EntityId
}

export interface BossSkillState {
  skillId: BossSkillId
  cooldownRemaining: number
}

export interface BossState extends EnemyState {
  bossDefinitionId: BossDefinitionId
  skills: BossSkillState[]
  nextSkillIndex: number
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
  /** Bosses live separately from normal enemies but share targeting geometry. */
  bosses?: BossState[]
  encounter?: EncounterState
  telegraphs?: TelegraphState[]
  projectiles: ProjectileState[]
  pickups: PickupState[]
  summons: SummonState[]
  effects: SkillEffectState[]

  time: number
  tick: number

  paused: boolean
}
