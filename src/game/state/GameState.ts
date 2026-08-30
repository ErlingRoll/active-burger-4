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
import type { EnemyAbilityId } from '../../content/enemies/EnemyAbilities'
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
  targetId?: EntityId
  sourceKind?: 'boss' | 'enemy'
  skillId: BossSkillId | EnemyAbilityId
  kind:
    | 'ground-slam'
    | 'charge'
    | 'fire-nova'
    | 'flame-line'
    | 'meteor-zone'
    | 'enemy-projectile'
    | 'enemy-shockwave'
  x: number
  y: number
  radius: number
  remainingDuration: number
  duration: number
  points: readonly SkillEffectPoint[]
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  poisonApplication?: PoisonApplication
  projectileDefinitionId?: ProjectileDefinitionId
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
  | 'free'
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
  /** True when ordinary movement is controlled directly by the player. */
  freeMode?: boolean
  /** Raw WASD direction, normalized when the movement candidate is applied. */
  freeMovementDirectionX?: number
  freeMovementDirectionY?: number
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
  /** Purchased permanent maximum skill capacity. */
  skillSlotCount?: number
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
  /** True when the player chose to leave the dungeon without dying. */
  forfeited?: boolean
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

  /** Number of skill slots available, including permanent progression. */
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
  /** Extra Chain Lightning targets primed by a Gravity Well synergy. */
  chainLightningBonusTargets?: number
  /** True when Gravity Well has primed the next Fiery Touch trigger. */
  fieryTouchGravityPrimed?: boolean
  /** Current Lancer's Charge Momentum stacks (capped, decays after inactivity). */
  lancerMomentumStacks?: number
  /** Seconds remaining before Lancer's Charge Momentum stacks decay to zero. */
  lancerMomentumDecayRemaining?: number
  /** Seconds remaining on the active Rallying Banner. */
  rallyingStandardRemaining?: number
  /** Damage reduction percent granted while the Rallying Banner is active. */
  rallyingStandardDamageReductionPercent?: number
  /** Skill cooldown reduction percent granted while the Rallying Banner is active. */
  rallyingStandardCooldownReductionPercent?: number
  /** Remaining absorb-shield amount granted by Aegis Pulse. */
  aegisPulseShieldAmount?: number
  /** Maximum absorb-shield amount for the current Aegis Pulse. */
  aegisPulseShieldMaxAmount?: number
  /** Seconds remaining before the Aegis Pulse shield expires. */
  aegisPulseShieldRemaining?: number
  /** Total duration for the current Aegis Pulse shield. */
  aegisPulseShieldDuration?: number
  /** Entity ID of the enemy currently linked by Soul Tether. */
  soulTetherTargetId?: EntityId
  /** Seconds remaining before the active Soul Tether link expires. */
  soulTetherRemaining?: number
  /** Chaos damage per second currently dealt through the Soul Tether link. */
  soulTetherDamagePerSecond?: number
  /** Fraction of Soul Tether damage restored to the player as health. */
  soulTetherHealingRatio?: number
  /** True once the current Soul Tether has used its single weaker retarget. */
  soulTetherHasRetargeted?: boolean
  /** Healing stored by Lifebound Pact for the next Vitality cast. */
  soulTetherVitalityCharge?: number
  /** Bonus return-leg damage primed by Phantom Arsenal. */
  riftJavelinReturnBonusPercent?: number
  /** Repeatable Phantom Arsenal upgrade count. */
  phantomMaxCountBonus?: number
  phantomMaxHpBonus?: number
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

  /** Absolute simulation time at which this enemy was spawned. */
  spawnTime?: number

  speed: number

  contactDamage: number
  /** Seconds until this enemy can deal contact damage again. */
  contactCooldownRemaining?: number
  /** Seconds until this enemy can begin its next special attack. */
  abilityCooldownRemaining?: number
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
  burningStacks?: BurningStackState[]
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
  /** Creates one independent Burning stack after this hit is resolved. */
  burningApplication?: BurningApplication
}

export interface ProjectileState {
  id: EntityId
  ownerId: EntityId
  definitionId: ProjectileDefinitionId
  /** Hostile projectiles resolve against the player rather than enemies. */
  hostile?: boolean
  /** Optional for backwards-compatible projectile fixtures; skill spawns set it. */
  skillId?: SkillId
  /** Special attack that owns a hostile projectile, when applicable. */
  sourceAbilityId?: EnemyAbilityId
  targetId?: EntityId
  sourceTags?: readonly SkillTag[]
  basicAttackWeaponArchetype?: WeaponArchetype
  /** Presentation-only projectile used by skills whose impact is resolved immediately. */
  visualOnly?: boolean
  /** Optional area radius to resolve around the projectile's collision point. */
  impactRadius?: number
  /** Optional radius for the impact effect, independent of its damage area. */
  impactEffectRadius?: number
  /** Optional status application to attach to each impact damage event. */
  impactFrostApplication?: FrostApplication
  /** Optional Shock application to attach to each impact damage event. */
  impactShockApplication?: ShockApplication
  /** Optional poison application to attach to each impact damage event. */
  impactPoisonApplication?: PoisonApplication
  remainingChains?: number
  chainRange?: number
  lastHitTargetId?: EntityId
  /** Marks a projectile that does not despawn on hit and keeps traveling. */
  piercing?: boolean
  /** Enemy IDs already struck during the current outbound or inbound pass. */
  pierceHitTargetIds?: EntityId[]
  /** One-way travel distance before a piercing projectile reverses course. */
  pierceReturnRange?: number
  /** Distance traveled during the current outbound or inbound leg. */
  pierceTraveledDistance?: number
  /** True once a piercing projectile has reversed and is traveling back along its path. */
  returning?: boolean
  /** Multiplies damage dealt while this projectile is on its return leg. */
  returnDamageMultiplier?: number

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
  /** Optional for backwards-compatible summon fixtures; defaults to Raise Skeleton. */
  skillId?: SkillId
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
  /** Seconds remaining before a temporary summon automatically expires. */
  expiryRemaining?: number
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

export interface BurningStackState {
  remainingDuration: number
  damagePerSecond: number
  /** Skill that applied the Burning stack, when it came from player-owned damage. */
  sourceSkillId?: SkillId
}

export interface BurningApplication {
  durationSeconds: number
  /** Fraction of the applying hit's pre-mitigation fire damage dealt per second. */
  fireDamageRatio: number
}

/** A delayed-fuse trap placed by a player skill (e.g. Cinder Mine). */
export interface TrapState {
  id: EntityId
  ownerId: EntityId
  skillId: SkillId
  x: number
  y: number
  radius: number
  fuseRemaining: number
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  burningApplication?: BurningApplication
}

/** A persistent, periodically striking structure placed by a player skill (e.g. Storm Relay). */
export interface RelayState {
  id: EntityId
  ownerId: EntityId
  skillId: SkillId
  x: number
  y: number
  /** True when the relay ignores remainingDuration and persists until removed. */
  permanent?: boolean
  remainingDuration: number
  strikeIntervalSeconds: number
  strikeCooldownRemaining: number
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  maxRange: number
  jumpRange: number
  maxTargets: number
  shockStacks: number
  shockDurationSeconds: number
  shockThreshold: number
  shockBurstMultiplier: number
  /** Optional radius for an additional burst around the relay on each strike. */
  burstRadius?: number
  burstDamageRatio?: number
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
  /** Optional periodic healing payload for persistent area effects. */
  periodicHealingAmount?: number
  periodicHealingRemaining?: number
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
  /** Delayed-fuse traps placed by player skills (e.g. Cinder Mine). */
  traps?: TrapState[]
  /** Persistent, periodically striking structures (e.g. Storm Relay). */
  relays?: RelayState[]

  time: number
  tick: number

  paused: boolean
}
