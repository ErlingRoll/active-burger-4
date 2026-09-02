import type {
  EnemyDefinitionId,
  EntityId,
  ProjectileDefinitionId,
} from '../ids'
import type {
  CharacterStatValues,
  StatModifier,
} from '../../content/stats/Stats'
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
import type { CharacterClassId } from '../../content/classes/CharacterClasses'
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
  skillId: BossSkillId | EnemyAbilityId | 'elite-volatile'
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
  | 'healing'
  | 'gear'
  | 'xp'
  | 'zone'
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
  /** Whether direct player movement starts enabled; defaults to true. */
  freeMovementEnabled?: boolean
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
  /** Purchased permanent maximum-floor bonus, in floors. */
  dungeonMaxFloorBonus?: number
  /** Permanent reroll level, granting this many rerolls for the run. */
  rerollCount?: number
  /** Permanent Banish allowance, granting this many Banishes for the run. */
  banishCount?: number
  /** Optional deterministic challenge modifiers selected before the run starts. */
  worldModifierIds?: readonly WorldModifierId[]
  characterClassId?: CharacterClassId
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
  /** Effective normal-floor duration after world modifier adjustments. */
  floorDurationSeconds?: number
  completedEncounterIds?: string[]
  killCount: number
  selectedUpgradeIds: UpgradeId[]
  /** Purchased rerolls that have not yet been used during this run. */
  rerollsRemaining?: number
  /** Banishes that have not yet been used during this run. */
  banishesRemaining?: number
  /** Skill IDs that cannot be offered again during this run. */
  banishedSkillIds?: SkillId[]
  /** Cumulative post-mitigation damage dealt by each skill during this run. */
  skillDamageDealt?: Partial<Record<SkillId, number>>
  /** Cumulative effective player healing provided by each skill during this run. */
  skillHealingDone?: Partial<Record<SkillId, number>>
  /** Remains true after the first gear orb is generated, even after collection. */
  gearDropGenerated?: boolean
  /** True after the one-time blessing converts future gear drops to XP. */
  gearXpBlessingActive?: boolean
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
  characterClassId?: CharacterClassId

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
  /** Remaining protection after resolving a gear or skill choice. */
  choiceRecoveryInvulnerabilityRemaining?: number
  /** Remaining duration of the post-choice movement speed boost. */
  choiceRecoveryMovementSpeedBoostRemaining?: number

  attackDamage: number
  attackSpeed: number
  attackCooldownRemaining: number
  /** Successful Basic Attacks required to empower each skill's next cast. */
  resonance?: number
  /** Percentage of final Basic Attack damage converted into skill damage. */
  attunement?: number
  /** Latest resolved hit presentation for renderer feedback. */
  lastHitVisual?: HitVisualState
  /** Bounded hit counter used by Basic Attack Synergy interactions. */
  basicAttackSynergyHitCount?: number
  /** Internal cooldown shared by the currently active Basic Attack Synergy. */
  basicAttackSynergyTriggerCooldownRemaining?: number
  /** Additive Attunement adjustment that can change during a run. */
  attunementBonusPercent?: number
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
  /** More Fiery Touch damage applied after increases. */
  fieryTouchMoreDamagePercent?: number
  /** Repeatable Chain Lightning upgrade count. */
  chainLightningChainBonus?: number
  /** Extra Chain Lightning targets primed by a Gravity Well synergy. */
  chainLightningBonusTargets?: number
  /** True when Gravity Well has primed the next Fiery Touch trigger. */
  fieryTouchGravityPrimed?: boolean
  /** Current Lancer's Charge Momentum stacks (capped, decays after inactivity). */
  lancerMomentumStacks?: number
  /** Seconds remaining before Lancer's Charge Momentum stacks decay to zero. */
  lancerMomentumDecayRemaining?: number
  /** Maximum remaining duration of a Rallying Banner affecting the player. */
  rallyingBannerRemaining?: number
  /** Damage reduction percent granted inside at least one active banner. */
  rallyingBannerDamageReductionPercent?: number
  /** Skill cooldown reduction percent granted inside at least one active banner. */
  rallyingBannerCooldownReductionPercent?: number
  /** Remaining absorb-shield amount granted by Aegis Pulse. */
  aegisPulseShieldAmount?: number
  /** Maximum absorb-shield amount for the current Aegis Pulse. */
  aegisPulseShieldMaxAmount?: number
  /** Seconds remaining before the Aegis Pulse shield expires. */
  aegisPulseShieldRemaining?: number
  /** Total duration for the current Aegis Pulse shield. */
  aegisPulseShieldDuration?: number
  /** Independent Soul Tether links currently active. */
  soulTethers?: SoulTetherState[]
  /** Healing stored by Lifebound Pact for the next Vitality cast. */
  soulTetherVitalityCharge?: number
  /** Vitality has prepared the next Rift Javelin return for Mending Return. */
  vitalityRiftPrimed?: boolean
  /** Remaining unique return targets eligible for Mending Return healing. */
  mendingReturnHealingRemaining?: number
  /** Gravity Well has prepared one Phantom Arsenal Echo Bolt. */
  gravityWellEchoPrimed?: boolean
  /** Blood Rite shield restoration accumulated during its current pulse. */
  bloodRiteShieldRestored?: number
  /** Bonus return-leg damage primed by Phantom Arsenal. */
  riftJavelinReturnBonusPercent?: number
  /** Active Ruin Sigils branded on enemies by Sigil of Ruin. */
  ruinSigils?: RuinSigilState[]
  /** Pending Mirrorcast Echo that copies the next non-Basic skill cast. */
  mirrorcast?: MirrorcastState
  /** Optional skill selected for Mirrorcast to capture instead of any eligible skill. */
  mirrorcastTargetSkillId?: SkillId
  /** Optional Triggerable skill replayed when a Basic Attack critically strikes. */
  criticalSpellstrikeTargetSkillId?: SkillId
  /** Optional skill selected for Blood Rite to empower instead of any eligible skill. */
  bloodRiteTargetSkillId?: SkillId
  /** Stored Blood Debt waiting to empower the next skill cast. */
  bloodDebt?: BloodDebtState
  /** Active Prism Halo firing rotating elemental shards. */
  prismHalo?: PrismHaloState
  /** Chromatic Convergence element tracking per enemy for Prism Halo. */
  prismConvergence?: PrismConvergenceState[]
  /** Repeatable Phantom Arsenal upgrade count. */
  phantomMaxCountBonus?: number
  phantomMaxHpBonus?: number
  /** Multiplicative per-enemy gear drop chance from future progression. */
  gearDropChanceMultiplier?: number
  /** Minimum rarity for future gear drops, raised by one-time gear blessings. */
  gearRarityFloor?: Rarity
  /** Additive multiplier for the range that attracts all collectible pickups. */
  pickupCollectionRangeMultiplier?: number
  /** Seconds remaining for the temporary boss-death Magnet effect. */
  bossMagnetRemaining?: number
  resistances?: Partial<DamageResistanceValues>
  poisonStacks?: PoisonStackState[]
  critChance?: number
  critMultiplier?: number

  /** Base values and modifiers are optional for backwards-compatible fixtures. */
  baseStats?: CharacterStatValues
  statModifiers?: StatModifier[]
  equipment?: EquipmentLoadout

  targetId?: EntityId
  skills: SkillState[]
  dodge?: DodgeState
  /** Optional for backwards-compatible state fixtures; new runs initialize it. */
  behaviorController?: BehaviorControllerState
}

export type HitVisualElement = 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos' | 'poison'

export interface HitVisualState {
  element: HitVisualElement
  critical: boolean
}

export interface SkillState {
  skillId: SkillId
  level: number
  cooldownRemaining: number
  /** Successful Basic Attacks banked toward this skill's next resonant cast. */
  resonanceAttackCount?: number
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
  /** Seconds before an intercept behavior may attempt another flank. */
  interceptCooldownRemaining?: number
  /** Simulation time of the most recent contact attack, for rendering feedback. */
  lastMeleeAttackTime?: number
  /** Latest resolved hit presentation for renderer feedback. */
  lastHitVisual?: HitVisualState

  xpReward: number

  /** False for spawned children that should not generate gear or potion loot. */
  canDropLoot?: boolean

  /** Assigned once at spawn and never inferred by the renderer. */
  eliteModifier?: EliteModifierId
  /** All distinct modifiers assigned once at spawn, in weighted selection order. */
  eliteModifiers?: readonly EliteModifierId[]
  /** Wardbound's one-time, non-regenerating damage shield. */
  wardHp?: number
  wardMaxHp?: number
  /** Absolute time at which Spiteful may retaliate again. */
  spitefulNextRetaliationTime?: number
  /** Tracks a Volatile death telegraph until its delayed explosion resolves. */
  volatileExplosionTelegraphId?: EntityId
  volatileExplosionResolved?: boolean
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
  /** Identifies the independent effect instance that produced this event. */
  sourceInstanceId?: EntityId
  /** Optional healing fraction associated with the source instance. */
  sourceHealingRatio?: number
  sourceTags?: readonly SkillTag[]
  sourceLabel?: string
  targetId: EntityId
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  /** Marks periodic damage for DoT scaling and excludes hit-only effects such as leech. */
  damageOverTime?: boolean
  /** Identifies an ordinary enemy contact hit for contact-only elite effects. */
  enemyContact?: boolean
  /** Creates one independent poison stack after this hit is resolved. */
  poisonApplication?: PoisonApplication
  /** Applies capped Chill/Freeze progress after this hit is resolved. */
  frostApplication?: FrostApplication
  /** Applies Shock stacks and optionally detonates them at a threshold. */
  shockApplication?: ShockApplication
  /** Creates one independent Burning stack after this hit is resolved. */
  burningApplication?: BurningApplication
}

export interface SoulTetherState {
  id: EntityId
  targetId: EntityId
  /** Total duration for this link, including any synergy extensions. */
  duration: number
  /** Seconds remaining before this independent link expires. */
  remainingDuration: number
  /** Raw Chaos damage per second; DoT multiplier is applied when it ticks. */
  damagePerSecond: number
  healingRatio: number
  hasRetargeted: boolean
  /** Scorching Lifeline cooldown for this tether's next flare. */
  scorchingLifelineCooldownRemaining?: number
}

/** A distinct damage source category that can charge a Ruin Sigil once. */
export type RuinSigilSourceCategory = 'basic-attack' | 'skill' | 'summon' | 'dot'

/** A Ruin Sigil brand placed by Sigil of Ruin. */
export interface RuinSigilState {
  id: EntityId
  targetId: EntityId
  remainingDuration: number
  charges: number
  /** Source categories that have already contributed a charge. */
  chargedCategories: RuinSigilSourceCategory[]
  /** Capped cumulative damage dealt to the target while marked. */
  storedDamage: number
  storedDamageCap: number
  /** Precomputed (1 + level damage increase) applied to the detonation burst. */
  detonationDamageMultiplier: number
  /** True once fully charged while Execution Protocol waits for the HP threshold. */
  armed: boolean
  /** True when detonation should spread 1-charge sigils (from Resonance). */
  spreadOnDetonate: boolean
  /** Spread sigils cannot spread again, which bounds the chain reaction. */
  canSpread: boolean
  /** Fractured Circuit has already added its one bonus charge. */
  conductiveChargeAdded?: boolean
}

/** A scheduled Mirrorcast copy of a captured skill cast. */
export interface MirrorcastCopyState {
  skillId: SkillId
  level: number
  delayRemaining: number
  effectiveness: number
  targetId?: EntityId
  retargetOnKill: boolean
  preserveSecondary: boolean
}

/** The pending Mirrorcast Echo state. */
export interface MirrorcastState {
  status: 'armed' | 'pending'
  captureRemaining: number
  echoCount: number
  effectiveness: number
  preserveSecondary: boolean
  deferred: boolean
  copies: MirrorcastCopyState[]
}

/** Blood Debt stored by Blood Rite, consumed by the next skill cast. */
export interface BloodDebtState {
  charges: number
  potency: number
  sacrificedHealth: number
  remainingDuration: number
  sanguinePact: boolean
}

/** A persistent Razorwire strung between two anchors. */
export interface WireState {
  id: EntityId
  ownerId: EntityId
  skillId: SkillId
  ax: number
  ay: number
  bx: number
  by: number
  remainingDuration: number
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  slowChillStacks: number
  slowDurationSeconds: number
  crossingCooldownSeconds: number
  crossingMargin: number
  /** Remaining time during which the next crossing releases a Frostline shard. */
  frostedRemainingDuration?: number
  /** Prevents Frostline from triggering repeatedly on one crossing window. */
  frostedCrossingCooldownRemaining?: number
  /** Per-enemy remaining crossing cooldowns so crossings do not deal per-tick damage. */
  crossingCooldowns: Array<{ enemyId: EntityId; remaining: number }>
  /** Last known signed side of each enemy relative to the wire, to detect crossings. */
  enemySides: Array<{ enemyId: EntityId; side: number }>
  guillotine: boolean
  tensionCap: number
  snapDamageMultiplier: number
  /** Per-enemy Guillotine Line Tension that snaps at the cap. */
  tension: Array<{ enemyId: EntityId; value: number }>
}

/** An active Prism Halo firing rotating elemental shards. */
export interface PrismHaloState {
  ownerId: EntityId
  remainingDuration: number
  fireCooldownRemaining: number
  nextElementIndex: number
  firesAllElements: boolean
  rotation: number
  /** Mirrorcast Echoes retain the Halo behavior at reduced damage. */
  effectiveness?: number
}

/** Chromatic Convergence element tracking for a single enemy. */
export interface PrismConvergenceState {
  enemyId: EntityId
  fire: boolean
  cold: boolean
  lightning: boolean
  remaining: number
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
  /** Original target selected when a weapon Basic Attack volley was fired. */
  primaryTargetId?: EntityId
  /** Basic Attack damage increase against the original target only. */
  primaryTargetDamageIncreasePercent?: number
  /** True after the bow Precision bonus has been applied once. */
  primaryTargetDamageApplied?: boolean
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
  /** Per-projectile deterministic state for Chain Lightning's varied relaunch targets. */
  chainTargetSelectionState?: number
  /** Starting position of the current chain flight for impact presentation. */
  chainOriginX?: number
  chainOriginY?: number
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
  /** Vitality-prepared return that grants Mending Return healing on hit. */
  mendingReturn?: boolean
  /** Reduced Phantom Arsenal projectile created by Echo Well. */
  echoWell?: boolean

  x: number
  y: number

  velocityX: number
  velocityY: number

  radius: number
  damage: DamageValues
  criticalStrike?: CriticalStrikeStats
  /** Remaining time before a homing projectile begins tracking its target. */
  homingDelayRemaining?: number
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
  /** True while the next-floor checkpoint is being persisted. */
  savePending?: boolean
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
  /** Retained for compatibility; enemy contact cooldowns are owned by EnemyState. */
  contactCooldownRemaining: number
  attackCooldownRemaining: number
  /** Seconds remaining before a temporary summon automatically expires. */
  expiryRemaining?: number
  /** Temporary Ashen Legion charges consumed by the next Skeleton hits. */
  emberGuardCharges?: number
  emberGuardRemaining?: number
}

export interface PoisonStackState {
  remainingDuration: number
  /** Raw Chaos damage per second before the DoT multiplier is resolved. */
  damagePerSecond: number
  /** Skill that applied the poison, when it came from player-owned damage. */
  sourceSkillId?: SkillId
  /** Non-player source entity, such as a player-owned summon. */
  sourceId?: EntityId
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
  /** Raw Fire damage per second before the DoT multiplier is resolved. */
  damagePerSecond: number
  /** Skill that applied the Burning stack, when it came from player-owned damage. */
  sourceSkillId?: SkillId
  /** Non-player source entity, such as a player-owned summon. */
  sourceId?: EntityId
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
  /** Optional pre-strike pull centered on the relay. */
  pullRadius?: number
  pullDistance?: number
  /** Aurora Relay has prepared one additional fork on the next strike. */
  spectrumForkPrimed?: boolean
}

export interface SkillEffectState {
  id: EntityId
  skillId: SkillId
  shape?: 'arc' | 'line'
  /** Elemental identity for Prism Halo's player-to-target beam effects. */
  prismBeamElement?: 'fire' | 'cold' | 'lightning' | 'all'
  basicAttackWeaponArchetype?: WeaponArchetype
  /** Actual selected target position for directional arc impact visuals. */
  impactPoint?: SkillEffectPoint
  /** All enemy positions hit by a directional arc visual. */
  impactPoints?: readonly SkillEffectPoint[]
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
  /** Persistent Razorwires strung between anchors. */
  wires?: WireState[]

  time: number
  tick: number

  paused: boolean
}
