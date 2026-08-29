import type {
  EnemyDefinitionId,
  EntityId,
  ProjectileDefinitionId,
} from '../ids'
import type { StatModifier, StatValues } from '../../content/stats/Stats'
import type {
  SkillId,
  SkillTag,
} from '../../content/skills/Skills'
import type {
  CriticalStrikeStats,
  DamageType,
  DamageResistanceValues,
  DamageValues,
} from '../../content/stats/Damage'
import type { EquipmentLoadout } from '../equipment/EquipmentState'
import type { WeaponArchetype } from '../../content/gear/Items'
import type { UpgradeId } from '../../content/upgrades/Upgrades'
import type { RunPhase } from './RunPhase'
import type { DungeonDefinitionId } from '../../content/dungeons/Dungeons'
import type { EliteModifierId } from '../../content/enemies/EliteModifiers'
import type {
  BossDefinitionId,
  BossSkillId,
} from '../../content/bosses/Bosses'
import type { BehaviorProfileId } from '../../content/behaviors/BehaviorProfiles'
import type { WorldModifierId } from '../../content/modifiers/WorldModifiers'
import type { PlaystyleId } from '../../content/playstyles/Playstyles'
import type { Rarity } from '../../content/rarity/Rarity'

export type EncounterStatus = 'inactive' | 'active' | 'complete'
export type EncounterOutcome = 'victory' | 'defeat' | undefined

export interface EncounterState {
  status: EncounterStatus
  encounterId?: string
  bossDefinitionId?: BossDefinitionId
  bossEntityId?: EntityId
  bossEntityIds?: EntityId[]
  startedAt?: number
  durationSeconds?: number
  floorNumber?: number
  isFinal?: boolean
  completedAt?: number
  outcome?: EncounterOutcome
  /** Normal spawns are suspended only while the encounter is active. */
  normalSpawnsSuspended: boolean
}

export interface TelegraphState {
  id: EntityId
  sourceId: EntityId
  skillId: BossSkillId
  kind: 'ground-slam' | 'charge' | 'fire-nova' | 'flame-line' | 'meteor-zone'
  x: number
  y: number
  radius: number
  remainingDuration: number
  duration: number
  points: readonly SkillEffectPoint[]
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  poisonApplication?: PoisonApplication
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
  | 'stairs'
  | 'dodge'
  | 'gear'
  | 'xp'
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
  /** Initial behavior policy for this run. */
  behaviorProfileId?: BehaviorProfileId
  /** Defaults to the first dungeon; maximum floors are selected by unlock state. */
  dungeonId?: DungeonDefinitionId
  /** Optional maximum-floor contract; omitted runs use the default maximum floor. */
  dungeonMaxFloorContractId?: string
  /** Dungeon unlock IDs supplied by local progression state. */
  unlockedDungeonMaxFloorIds?: readonly string[]
  /** Purchased permanent XP multiplier level, from 0 through 10. */
  xpMultiplierLevel?: number
  /** Purchased permanent starting-level result, from level 1 through 4. */
  startingLevel?: number
  /** Optional deterministic challenge modifiers selected before the run starts. */
  worldModifierIds?: readonly WorldModifierId[]
  playstyleId?: PlaystyleId
}

export interface RunState {
  phase: RunPhase
  seed: number
  dungeonId?: DungeonDefinitionId
  dungeonMaxFloorContractId?: string
  dungeonMaxFloor?: number
  floor?: number
  /** Simulation time at which the current floor began. */
  floorStartedAt?: number
  completedEncounterIds?: string[]
  killCount: number
  selectedUpgradeIds: UpgradeId[]
  /** Cumulative post-mitigation damage dealt by each skill during this run. */
  skillDamageDealt?: Partial<Record<SkillId, number>>
  /** Remains true after the first gear orb is generated, even after collection. */
  gearDropGenerated?: boolean
  worldModifierIds?: readonly WorldModifierId[]
  /** Recent player damage and healing, retained to explain a defeat. */
  playerCombatLog?: PlayerCombatLogEntry[]
}

export interface PlayerCombatLogEntry {
  time: number
  kind: 'damage' | 'healing'
  amount: number
  source: string
  resultingHp: number
  damageType?: DamageType
}

/**
 * The initial player only needs enough fields to exist in the simulation;
 * see PLAN.md section 17. Movement/AI/combat systems that use these fields
 * are introduced in later milestones.
 */
export interface PlayerState {
  id: EntityId
  playstyleId?: PlaystyleId

  x: number
  y: number

  radius: number

  /** Current smoothed autonomous movement velocity. */
  movementVelocityX?: number
  movementVelocityY?: number

  /** Number of skill slots available; future meta progression can increase it. */
  skillSlotCount?: number

  hp: number
  maxHp: number

  level: number
  xp: number

  movementSpeed: number

  attackDamage: number
  attackSpeed: number
  attackRange: number
  attackCooldownRemaining: number
  /** Additive fraction of actual gear-based melee damage restored as health. */
  meleeLeech?: number
  /** Additive fraction of actual Whirlwind damage restored as health. */
  whirlwindLeech?: number
  /** Additive percentage applied to all healing received. */
  increasedHealing?: number
  /** Global percentage multiplier applied to damage-over-time effects. */
  dotMultiplier?: number
  /** Repeatable Raise Skeleton upgrade count. */
  skeletonMaxCountBonus?: number
  skeletonMaxHpBonus?: number
  /** Whirlwind leech earned from level-up upgrades. */
  upgradeWhirlwindLeech?: number
  vitalityMaxHpHealingPercent?: number
  vitalityLowHpHealingMultiplier?: number
  vitalityLowHpDamageReductionPercent?: number
  whirlwindGuardRemaining?: number
  whirlwindGuardDamageReductionPercent?: number
  fieryTouchDamageIncreasePercent?: number
  /** Multiplicative per-enemy gear drop chance from future progression. */
  gearDropChanceMultiplier?: number
  /** Minimum rarity for future gear drops, raised by one-time gear blessings. */
  gearRarityFloor?: Rarity
  /** Additive multiplier for the range that attracts all collectible pickups. */
  pickupCollectionRangeMultiplier?: number
  resistances?: Partial<DamageResistanceValues>
  poisonStacks?: PoisonStackState[]
  critChance?: number
  critMultiplier?: number

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
  /** Incremented after each successful cast so UI feedback does not rely on timing. */
  castCount?: number
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
  /** Simulation time of the most recent contact attack, for rendering feedback. */
  lastMeleeAttackTime?: number

  xpReward: number

  /** False for spawned children that should not generate gear or potion loot. */
  canDropLoot?: boolean

  /** Assigned once at spawn and never inferred by the renderer. */
  eliteModifier?: EliteModifierId
  resistances?: Partial<DamageResistanceValues>
  poisonStacks?: PoisonStackState[]
  chillStacks?: number
  chillRemainingDuration?: number
  frozenRemainingDuration?: number
  controlResistance?: number
  shockStacks?: number
  shockRemainingDuration?: number
  critChance?: number
  critMultiplier?: number

  targetId: EntityId
}

export interface BossSkillState {
  skillId: BossSkillId
  cooldownRemaining: number
}

export interface BossState extends EnemyState {
  bossDefinitionId: BossDefinitionId
  /** Absolute simulation time at which this boss was spawned. */
  spawnTime?: number
  skills: BossSkillState[]
  nextSkillIndex: number
}

export interface DamageEvent {
  sourceId?: EntityId
  sourceSkillId?: SkillId
  sourceTags?: readonly SkillTag[]
  sourceLabel?: string
  targetId: EntityId
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  /** Marks periodic damage so it cannot trigger hit-only effects such as leech. */
  damageOverTime?: boolean
  /** Creates one independent poison stack after this hit is resolved. */
  poisonApplication?: PoisonApplication
  /** Applies capped Chill/Freeze progress after this hit is resolved. */
  frostApplication?: FrostApplication
  /** Applies Shock stacks and optionally detonates them at a threshold. */
  shockApplication?: ShockApplication
}

export interface ProjectileState {
  id: EntityId
  ownerId: EntityId
  definitionId: ProjectileDefinitionId
  /** Optional for backwards-compatible projectile fixtures; skill spawns set it. */
  skillId?: SkillId
  targetId?: EntityId
  sourceTags?: readonly SkillTag[]
  basicAttackWeaponArchetype?: WeaponArchetype
  remainingChains?: number
  chainRange?: number
  lastHitTargetId?: EntityId

  x: number
  y: number

  velocityX: number
  velocityY: number

  radius: number
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
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

export interface HealingPotionPickupState extends PickupStateBase {
  kind: 'healing-potion'
  xpAmount?: never
}

export type PickupState = XpPickupState | GearPickupState | HealingPotionPickupState

export interface StairsState {
  id: EntityId
  x: number
  y: number
  radius: number
  spawnedAt: number
  floorNumber: number
  isFinal: boolean
  rewardsCollected: boolean
}

export interface FloorTransitionState {
  remainingSeconds: number
  fromFloor: number
  toFloor: number
  isFinal: boolean
}

export interface SummonState {
  id: EntityId
  ownerId: EntityId
  x: number
  y: number
  /** Persistent deterministic movement state for the summon swarm. */
  swarmAngle?: number
  swarmRadius?: number
  swarmAngularSpeed?: number
  swarmPhase?: number
  /** Elapsed idle-swarm time used to schedule deterministic pauses. */
  swarmMotionTime?: number
  /** Remaining time in the current intentional standstill. */
  swarmPauseRemaining?: number
  /** Next elapsed swarm time at which this summon pauses. */
  swarmNextPauseTime?: number
  /** Duration used for each deterministic standstill. */
  swarmPauseDuration?: number
  hp: number
  maxHp: number
  contactCooldownRemaining: number
  attackCooldownRemaining: number
}

export interface PoisonStackState {
  remainingDuration: number
  damagePerSecond: number
  /** Skill that applied the poison, when it came from player-owned damage. */
  sourceSkillId?: SkillId
}

export interface PoisonApplication {
  durationSeconds: number
  physicalChaosRatio: number
}

export interface FrostApplication {
  stacks: number
  durationSeconds: number
  freezeThreshold?: number
  freezeDurationSeconds?: number
}

export interface ShockApplication {
  stacks: number
  durationSeconds: number
  threshold?: number
  burstMultiplier?: number
}

export interface SkillEffectState {
  id: EntityId
  skillId: SkillId
  shape?: 'arc' | 'line'
  basicAttackWeaponArchetype?: WeaponArchetype
  x: number
  y: number
  radius: number
  lifetime: number
  remainingLifetime: number
  /** Deterministic world-space path or polygon, with the first point at x/y. */
  points: readonly SkillEffectPoint[]
}

export interface GameState {
  run: RunState
  player: PlayerState

  enemies: EnemyState[]
  /** Bosses live separately from normal enemies but share targeting geometry. */
  bosses?: BossState[]
  encounter?: EncounterState
  stairs?: StairsState
  floorTransition?: FloorTransitionState
  telegraphs?: TelegraphState[]
  projectiles: ProjectileState[]
  pickups: PickupState[]
  summons: SummonState[]
  effects: SkillEffectState[]

  time: number
  tick: number

  paused: boolean
}
