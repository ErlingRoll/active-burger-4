import type {
  GameCheckpoint,
} from './checkpoint/GameCheckpoint'
import {
  CHECKPOINT_VERSION,
  isValidCheckpoint,
} from './checkpoint/GameCheckpoint'
import { createEntityIdAllocator } from './ids'
import type {
  EnemyDefinitionId,
  EntityId,
  EntityIdAllocator,
} from './ids'
import { Random } from './random/Random'
import type { RandomSource } from './random/Random'
import type { RunPhase } from './state/RunPhase'
import type {
  GameState,
  RunConfig,
} from './state/GameState'
import { SpawnDirector } from './spawning/SpawnDirector'
import { SPAWN_BALANCE } from '../content/spawning/SpawnBalance'
import { HEALING_POTION_MAX_HP_FRACTION } from '../content/progression/HealingPotions'
import { resolveWorldModifierEffects } from '../content/modifiers/WorldModifiers'
import {
  DEFAULT_CHARACTER_CLASS_ID,
  isCharacterClassId,
} from '../content/classes/CharacterClasses'
import {
  removeDeadSummons,
  updateSummons,
} from './systems/summons/SummonSystem'
import type { WorldModifierEffects } from '../content/modifiers/WorldModifiers'
import {
  generateUpgradeChoices,
  generateBanishReplacement,
  getEligibleSynergyDefinitions,
  UPGRADE_CHOICES_PER_LEVEL,
} from './upgrades/UpgradeChoices'
import type {
  LevelUpUpgradeChoice,
  UpgradeId,
} from '../content/upgrades/Upgrades'
import {
  getUpgradeDefinition,
  isSynergyUpgradeDefinition,
  REMOVE_SKILL_UPGRADE_ID,
  REMOVE_SYNERGY_UPGRADE_ID,
} from '../content/upgrades/Upgrades'
import {
  generateGearChoices,
  GEAR_CHOICES_PER_PICKUP,
  gearChoiceSignature,
  type GearChoice,
} from './equipment/GearChoices'
import {
  equipRolledItem,
  upgradeEquippedItem,
} from './equipment/EquipmentState'
import {
  getItemDefinition,
  type ItemId,
} from '../content/gear/Items'
import {
  isGearSetId,
  type GearSetId,
} from '../game-config/gear-sets'
import type {
  PendingChoiceFlow,
} from './choices/ChoiceFlows'
import { cloneChoiceFlow } from './choices/ChoiceFlows'
import {
  FixedTimestepClock,
  FIXED_STEP_SECONDS,
} from './engine/GameClock'
import { transitionRunPhase } from './engine/RunLifecycle'
import { assertValidContent } from '../content/validation'
import {
  applyDamageEvents,
  collectEnemyContactDamage,
  collectProjectileDamage,
  performBasicAttackIfReady,
  removeDeadEntities,
  resolveDeadSoulTetherSnaps,
  resolvePlayerTarget,
  updateAttackCooldown,
  updateEnemyChase,
  updateFrost,
  updateProjectiles,
  updatePoison,
  updateBurning,
} from './systems/combat/CombatSystem'
import { createEnemySpatialHash } from './combat/Targeting'
import {
  activateBossDeathMagnet,
  grantExperience,
  updateBossDeathMagnet,
  updatePickups,
} from './systems/experience/ExperienceSystem'
import {
  createInitialPlayerState,
  spawnEnemy,
  spawnBoss,
  spawnGearPickup,
  spawnHealingPotion,
  spawnSlime,
  spawnXpPickup,
  updateEnemySpawns,
} from './systems/spawning/SpawningSystem'
import { SLIME_DEFINITION_ID } from '../content/enemies/EnemyConfig'
import type { EliteModifierInput } from '../content/enemies/EliteModifiers'
import { applyUpgrade } from './systems/upgrades/UpgradeSystem'
import { refreshPlayerDerivedStats } from './stats/DerivedStats'
import {
  collectSkillDamage,
  updateSkillCooldowns,
  updateSkillEffects,
  updateCinderMineTraps,
  updateStormRelay,
  updateSoulTether,
  updateRuinSigils,
  updateRazorwires,
  updatePrismHalo,
  updateMirrorcast,
  updateBloodDebt,
} from './systems/skills/SkillSystem'
import { healPlayer } from './combat/PlayerCombatLog'
import { getXpMultiplierForLevel } from '../content/progression/XpMultiplier'
import {
  createRunResultSnapshot,
  createUiSnapshot,
} from './ui/Snapshots'
import type {
  GameUiSnapshot,
  RunResultSnapshot,
} from './ui/Snapshots'
import type { WorldPosition } from './systems/spawning/SpawningSystem'
import type { GearPickupState } from './state/GameState'
import {
  BASIC_ATTACK_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  getSkillDefinition,
  MIRRORCAST_SKILL_ID,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  type SkillId,
} from '../content/skills/Skills'
import { DEFAULT_SKILL_SLOT_COUNT } from '../game-config/skills'
import {
  completeBossEncounter,
  startBossEncounter,
  updateEncounter,
} from './systems/encounter/EncounterSystem'
import {
  spawnStairs,
  updateStairs,
} from './systems/stairs/StairsSystem'
import { resetFloorCombatState } from './systems/stairs/FloorTransitionReset'
import {
  cancelBossTelegraphs,
  resolveBossTelegraphs,
  updateBosses,
} from './systems/boss/BossSystem'
import {
  resolveEnemyTelegraphs,
  updateEnemyTelegraphPositions,
  updateEnemyAbilities,
} from './systems/combat/EnemyAbilitySystem'
import { updatePlayerBehavior } from './systems/behavior/BehaviorController'
import {
  CHOICE_RECOVERY_INVULNERABILITY_SECONDS,
  CHOICE_RECOVERY_MOVEMENT_SPEED_BOOST_SECONDS,
} from '../game-config/movement'
import type { BossDefinitionId } from '../content/bosses/Bosses'
import {
  DEFAULT_DUNGEON_ID,
  createDungeonEncounterTimeline,
  getDungeonDefinition,
  resolveDungeonMaxFloor,
  type DungeonDefinition,
} from '../content/dungeons/Dungeons'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfileDefinition,
  isBehaviorProfileId,
  type BehaviorProfileDefinition,
  type BehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'

export { FIXED_STEP_SECONDS } from './engine/GameClock'
export { MAX_FRAME_SECONDS } from './engine/GameClock'
export type { WorldPosition } from './systems/spawning/SpawningSystem'
export type {
  GameUiSnapshot,
  RunHudSnapshot,
  RunResultSnapshot,
  EquippedItemSnapshot,
  GearModifierSnapshot,
  SkillHudSnapshot,
  SkillUpgradeSnapshot,
  SkillUpgradeStatus,
  CharacterStatsHudSnapshot,
  CharacterStatGroupSnapshot,
  CharacterStatSnapshot,
  BossHudSnapshot,
  BossEnrageHudSnapshot,
  EncounterTimelineHudSnapshot,
  StairsHudSnapshot,
  FloorTransitionHudSnapshot,
  PickupHudSnapshot,
  TelegraphHudSnapshot,
  DodgeHudSnapshot,
  BehaviorHudSnapshot,
  BehaviorIntentHudSnapshot,
} from './ui/Snapshots'
export type {
  GearChoice,
  GearItemChoice,
  UpgradeEquippedItemChoice,
} from './equipment/GearChoices'
export type {
  PendingChoiceFlow,
  LevelUpChoiceFlow,
  GearPickupChoiceFlow,
} from './choices/ChoiceFlows'

export type { RunConfig } from './state/GameState'
export {
  BOSS_FLOOR_EVENT_DURATION_SECONDS,
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_ID,
  DEFAULT_DUNGEON_MAX_FLOOR,
  DUNGEON_FLOOR_DURATION_SECONDS,
  DUNGEON_DEFINITIONS,
  ORDINARY_ENEMY_FLOOR_STAT_SCALING,
  getFloorContactDamageMultiplier,
  getFloorDifficultyProfile,
  getDungeonDefinition,
  getFloorStatMultiplier,
  isDungeonMaxFloorUnlocked,
  resolveDungeonMaxFloor,
  scaleOrdinaryEnemyStats,
} from '../content/dungeons/Dungeons'
export type {
  DungeonDefinition,
  DungeonDefinitionId,
  DungeonMaxFloorContract,
  FloorDifficultyProfile,
} from '../content/dungeons/Dungeons'
export {
  BEHAVIOR_PROFILE_DEFINITIONS,
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfileDefinition,
  isBehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'
export type {
  BehaviorProfileDefinition,
  BehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'

export type GameStateListener = (state: Readonly<GameState>) => void

export const MIN_TIME_SCALE = 0.1
export const MAX_TIME_SCALE = 10
export const DEFAULT_TIME_SCALE = 1
export const DEBUG_SPAWN_COUNTS = [100, 500, 1000] as const
export type DebugSpawnCount = (typeof DEBUG_SPAWN_COUNTS)[number]

export type TimeScaleUpdateResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

export type DevelopmentGrantResult =
  | { ok: true; changed: boolean }
  | { ok: false; error: string }

type LegacyClassRunConfig = RunConfig & { playstyleId?: unknown }
type LegacyClassPlayerState = GameState['player'] & { playstyleId?: unknown }

function normalizeRunConfig(config: RunConfig): RunConfig {
  const { playstyleId: legacyCharacterClassId, ...currentConfig } =
    config as LegacyClassRunConfig
  const characterClassId = currentConfig.characterClassId ?? legacyCharacterClassId
  return {
    ...currentConfig,
    characterClassId: isCharacterClassId(characterClassId)
      ? characterClassId
      : DEFAULT_CHARACTER_CLASS_ID,
  }
}

function normalizeCheckpointState(state: GameState): GameState {
  const normalizedState = JSON.parse(JSON.stringify(state)) as GameState
  const player = normalizedState.player as LegacyClassPlayerState
  if (!isCharacterClassId(player.characterClassId)) {
    player.characterClassId = isCharacterClassId(player.playstyleId)
      ? player.playstyleId
      : DEFAULT_CHARACTER_CLASS_ID
  }
  delete player.playstyleId
  return normalizedState
}

/**
 * Renderer-independent game simulation facade. The run owns its state, seeded
 * random source, entity IDs, and system update order; domain responsibilities
 * are implemented by the focused modules under `game/systems`.
 */
export class Game {
  readonly random: RandomSource

  private readonly runConfig: RunConfig
  private readonly idAllocator: EntityIdAllocator
  private readonly gearRandom: RandomSource
  private readonly synergyRandom: RandomSource
  private readonly gameState: GameState
  readonly spawnDirector: SpawnDirector
  private readonly worldModifierEffects: WorldModifierEffects
  private readonly xpMultiplier: number
  readonly dungeon: DungeonDefinition
  private readonly clock = new FixedTimestepClock()
  private currentTimeScale = DEFAULT_TIME_SCALE
  private resumePhase: RunPhase | undefined
  private choiceFlows: PendingChoiceFlow[] = []
  private readonly collectedGearPickups: GearPickupState[] = []
  private readonly listeners = new Set<GameStateListener>()

  constructor(config: RunConfig) {
    assertValidContent()
    const runConfig = normalizeRunConfig(config)
    this.runConfig = runConfig
    this.idAllocator = createEntityIdAllocator()
    this.random = new Random(runConfig.seed)
    this.gearRandom = new Random(runConfig.seed ^ 0x9e3779b9)
    this.synergyRandom = new Random(runConfig.seed ^ 0x85ebca6b)
    this.worldModifierEffects = resolveWorldModifierEffects(
      runConfig.worldModifierIds,
      SPAWN_BALANCE,
    )
    this.xpMultiplier = getXpMultiplierForLevel(runConfig.xpMultiplierLevel ?? 0)
    this.spawnDirector = new SpawnDirector(
      this.random,
      this.worldModifierEffects.spawnBalance,
      this.worldModifierEffects.fastStartThreatMultiplier,
      this.worldModifierEffects.fastStartDurationSeconds,
    )
    const baseDungeon = getDungeonDefinition(runConfig.dungeonId ?? DEFAULT_DUNGEON_ID)
    const dungeon = this.worldModifierEffects.floorDurationMultiplier === 1
      ? baseDungeon
      : {
          ...baseDungeon,
          floorDurationSeconds:
            baseDungeon.floorDurationSeconds *
            this.worldModifierEffects.floorDurationMultiplier,
        }
    const contractMaxFloor = resolveDungeonMaxFloor(
      dungeon,
      runConfig.dungeonMaxFloorContractId,
      new Set(runConfig.unlockedDungeonMaxFloorIds ?? []),
    )
    const dungeonMaxFloorBonus = typeof runConfig.dungeonMaxFloorBonus === 'number' &&
      Number.isFinite(runConfig.dungeonMaxFloorBonus)
      ? Math.max(0, Math.floor(runConfig.dungeonMaxFloorBonus))
      : 0
    const dungeonMaxFloor = contractMaxFloor + dungeonMaxFloorBonus
    this.dungeon = dungeonMaxFloor === dungeon.defaultMaxFloor
      ? dungeon
      : {
        ...dungeon,
        encounterTimeline: createDungeonEncounterTimeline(
          dungeonMaxFloor,
        ),
      }

    this.gameState = {
      run: {
        phase: 'loading',
        seed: runConfig.seed,
        dungeonId: this.dungeon.id,
        ...(runConfig.dungeonMaxFloorContractId
          ? { dungeonMaxFloorContractId: runConfig.dungeonMaxFloorContractId }
          : {}),
        dungeonMaxFloor,
        floor: 1,
        floorStartedAt: 0,
        floorDurationSeconds: this.dungeon.floorDurationSeconds,
        completedEncounterIds: [],
        killCount: 0,
        selectedUpgradeIds: [],
        rerollsRemaining: getConfiguredRerollCount(runConfig.rerollCount),
        banishesRemaining: getConfiguredBanishCount(runConfig.banishCount),
        banishedSkillIds: [],
        skillDamageDealt: {},
        skillHealingDone: {},
        playerCombatLog: [],
        gearDropGenerated: false,
        gearXpBlessingActive: false,
        ...(this.worldModifierEffects.ids.length > 0
          ? { worldModifierIds: this.worldModifierEffects.ids }
          : {}),
      },
      player: createInitialPlayerState(
        this.idAllocator.createEntityId(),
        this.worldModifierEffects,
        runConfig.characterClassId,
        runConfig.startingLevel,
        runConfig.skillSlotCount,
      ),
      enemies: [],
      bosses: [],
      encounter: {
        status: 'inactive',
        normalSpawnsSuspended: false,
      },
      telegraphs: [],
      projectiles: [],
      pickups: [],
      summons: [],
      effects: [],
      time: 0,
      tick: 0,
      paused: false,
    }
    refreshPlayerDerivedStats(this.gameState.player)
    this.gameState.player.hp = this.gameState.player.maxHp
    this.gameState.player.behaviorController!.freeMode =
      runConfig.freeMovementEnabled ?? true
    if (isBehaviorProfileId(runConfig.behaviorProfileId)) {
      this.gameState.player.behaviorController!.profileId = runConfig.behaviorProfileId
    }
    // A freshly created run has nothing left to load, so it moves straight
    // into playing through the same validated transition used by all phases.
    this.transitionTo('playing')
    const startingLevel = this.gameState.player.level
    if (startingLevel > 1) {
      this.enqueueLevelUpFlows(startingLevel - 1)
    }
  }

  /** Read-only projection of the current simulation state. */
  get state(): Readonly<GameState> {
    return this.gameState
  }

  get phase(): RunPhase {
    return this.gameState.run.phase
  }

  get paused(): boolean {
    return this.gameState.paused
  }

  get timeScale(): number {
    return this.currentTimeScale
  }

  get behaviorProfileId(): BehaviorProfileId {
    return this.gameState.player.behaviorController?.profileId ??
      DEFAULT_BEHAVIOR_PROFILE_ID
  }

  get behaviorProfile(): BehaviorProfileDefinition {
    return getBehaviorProfileDefinition(this.behaviorProfileId)
  }

  get freeMovementEnabled(): boolean {
    return this.gameState.player.behaviorController?.freeMode ?? false
  }

  /**
   * Switches the active behavior profile without consuming RNG. The profile is
   * state, so the same input sequence always produces the same simulation.
   */
  setBehaviorProfile(profileId: BehaviorProfileId | string): boolean {
    if (!isBehaviorProfileId(profileId)) {
      return false
    }
    const controller = this.gameState.player.behaviorController ??= {
      profileId: DEFAULT_BEHAVIOR_PROFILE_ID,
    }
    controller.profileId = profileId
    controller.lastCandidate = undefined
    controller.commitmentRemaining = 0
    controller.committedSource = undefined
    controller.committedTargetId = undefined
    controller.committedPickupId = undefined
    this.notifyStateChanged()
    return true
  }

  switchBehaviorProfile(profileId: BehaviorProfileId | string): boolean {
    return this.setBehaviorProfile(profileId)
  }

  setFreeMovementEnabled(enabled: boolean): boolean {
    const controller = this.gameState.player.behaviorController ??= {
      profileId: DEFAULT_BEHAVIOR_PROFILE_ID,
    }
    if (controller.freeMode === enabled) {
      return enabled
    }
    controller.freeMode = enabled
    if (!enabled) {
      controller.freeMovementDirectionX = 0
      controller.freeMovementDirectionY = 0
    }
    controller.lastCandidate = undefined
    controller.commitmentRemaining = 0
    controller.committedSource = undefined
    controller.committedTargetId = undefined
    controller.committedPickupId = undefined
    this.notifyStateChanged()
    return enabled
  }

  toggleFreeMovement(): boolean {
    return this.setFreeMovementEnabled(!this.freeMovementEnabled)
  }

  /**
   * Sets or clears the skill that an armed Mirrorcast should wait for.
   * Targeting is deliberately persistent for the current run.
   */
  setMirrorcastTargetSkill(skillId: SkillId | null): boolean {
    if (skillId === null) {
      if (this.gameState.player.mirrorcastTargetSkillId === undefined) {
        return true
      }

      this.gameState.player.mirrorcastTargetSkillId = undefined
      this.notifyStateChanged()
      return true
    }

    if (
      !this.gameState.player.skills.some((skill) => skill.skillId === MIRRORCAST_SKILL_ID) ||
      !this.gameState.player.skills.some((skill) => skill.skillId === skillId) ||
      !getSkillDefinition(skillId).tags.includes('triggerable')
    ) {
      return false
    }
    if (this.gameState.player.mirrorcastTargetSkillId === skillId) {
      return true
    }
    this.gameState.player.mirrorcastTargetSkillId = skillId
    this.notifyStateChanged()
    return true
  }

  /** Sets or clears the one Triggerable skill replayed by Critical Spellstrike. */
  setCriticalSpellstrikeTargetSkill(skillId: SkillId | null): boolean {
    if (skillId === null) {
      if (this.gameState.player.criticalSpellstrikeTargetSkillId === undefined) {
        return true
      }
      this.gameState.player.criticalSpellstrikeTargetSkillId = undefined
      this.notifyStateChanged()
      return true
    }
    if (
      !this.gameState.player.skills.some(
        (skill) => skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID,
      ) ||
      !this.gameState.player.skills.some((skill) => skill.skillId === skillId) ||
      !getSkillDefinition(skillId).tags.includes('triggerable')
    ) {
      return false
    }
    if (this.gameState.player.criticalSpellstrikeTargetSkillId === skillId) {
      return true
    }
    this.gameState.player.criticalSpellstrikeTargetSkillId = skillId
    this.notifyStateChanged()
    return true
  }

  /**
   * Sets or clears the skill that Blood Debt should wait to empower.
   * Targeting is deliberately persistent for the current run.
   */
  setBloodRiteTargetSkill(skillId: SkillId | null): boolean {
    if (skillId === null) {
      if (this.gameState.player.bloodRiteTargetSkillId === undefined) {
        return true
      }
      this.gameState.player.bloodRiteTargetSkillId = undefined
      this.notifyStateChanged()
      return true
    }
    if (
      !this.gameState.player.skills.some((skill) => skill.skillId === BLOOD_RITE_SKILL_ID) ||
      !this.gameState.player.skills.some((skill) => skill.skillId === skillId) ||
      skillId === BASIC_ATTACK_SKILL_ID ||
      skillId === BLOOD_RITE_SKILL_ID
    ) {
      return false
    }
    if (this.gameState.player.bloodRiteTargetSkillId === skillId) {
      return true
    }
    this.gameState.player.bloodRiteTargetSkillId = skillId
    this.notifyStateChanged()
    return true
  }

  setFreeMovementDirection(directionX: number, directionY: number): void {
    const controller = this.gameState.player.behaviorController ??= {
      profileId: DEFAULT_BEHAVIOR_PROFILE_ID,
    }
    controller.freeMovementDirectionX = Number.isFinite(directionX) ? directionX : 0
    controller.freeMovementDirectionY = Number.isFinite(directionY) ? directionY : 0
  }

  /**
   * Sets the simulation speed multiplier. Invalid values leave the current
   * scale unchanged and return an actionable validation error.
   */
  setTimeScale(value: number): TimeScaleUpdateResult {
    if (!Number.isFinite(value)) {
      return {
        ok: false,
        error: 'Simulation speed must be a finite number.',
      }
    }

    if (value < MIN_TIME_SCALE || value > MAX_TIME_SCALE) {
      return {
        ok: false,
        error: `Simulation speed must be between ${MIN_TIME_SCALE}x and ${MAX_TIME_SCALE}x.`,
      }
    }

    this.currentTimeScale = value
    return { ok: true, value }
  }

  /** Equips a catalog item immediately for development testing. */
  grantDebugGear(
    itemId: ItemId,
    setId?: GearSetId,
  ): DevelopmentGrantResult {
    const phaseError = this.getDevelopmentGrantPhaseError()
    if (phaseError) {
      return { ok: false, error: phaseError }
    }

    const definition = getItemDefinition(itemId)
    if (definition.starterOnly) {
      return {
        ok: false,
        error: 'Training weapons are not available as development grants.',
      }
    }
    if (setId !== undefined && !isGearSetId(setId)) {
      return { ok: false, error: `Unknown gear set: ${setId}.` }
    }

    equipRolledItem(
      this.gameState.player,
      itemId,
      definition.rarity,
      definition.modifiers,
      undefined,
      setId,
    )
    this.notifyStateChanged()
    return { ok: true, changed: true }
  }

  /** Adds a catalog skill at level one for development testing. */
  grantDebugSkill(skillId: SkillId): DevelopmentGrantResult {
    const phaseError = this.getDevelopmentGrantPhaseError()
    if (phaseError) {
      return { ok: false, error: phaseError }
    }

    if (this.gameState.player.skills.some((skill) => skill.skillId === skillId)) {
      return { ok: true, changed: false }
    }

    if (
      this.gameState.player.skills.length >=
      getConfiguredSkillSlotCount(this.gameState.player)
    ) {
      return {
        ok: false,
        error: 'No skill slots are available. Remove a skill before granting another.',
      }
    }

    this.gameState.player.skills.push({
      skillId,
      level: 1,
      cooldownRemaining: 0,
      resonanceAttackCount: 0,
    })
    this.notifyStateChanged()
    return { ok: true, changed: true }
  }

  /** Applies an eligible synergy for development testing. */
  grantDebugSynergy(upgradeId: UpgradeId): DevelopmentGrantResult {
    const phaseError = this.getDevelopmentGrantPhaseError()
    if (phaseError) {
      return { ok: false, error: phaseError }
    }

    const definition = getUpgradeDefinition(upgradeId)
    if (!isSynergyUpgradeDefinition(definition)) {
      return {
        ok: false,
        error: 'The selected development upgrade is not a synergy.',
      }
    }
    if (!getEligibleSynergyDefinitions(this.gameState).some(
      (synergy) => synergy.id === upgradeId,
    )) {
      return {
        ok: false,
        error: 'That synergy is not currently eligible.',
      }
    }

    applyUpgrade(this.gameState, upgradeId)
    this.gameState.run.selectedUpgradeIds.push(upgradeId)
    this.notifyStateChanged()
    return { ok: true, changed: true }
  }

  /** Applies a catalog upgrade without normal eligibility checks. */
  grantDebugUpgrade(upgradeId: UpgradeId): DevelopmentGrantResult {
    const phaseError = this.getDevelopmentGrantPhaseError()
    if (phaseError) {
      return { ok: false, error: phaseError }
    }
    if (
      upgradeId === REMOVE_SKILL_UPGRADE_ID ||
      upgradeId === REMOVE_SYNERGY_UPGRADE_ID
    ) {
      return {
        ok: false,
        error: 'Release cards are not available as development grants.',
      }
    }

    const definition = getUpgradeDefinition(upgradeId)
    if (
      definition.skillAction === 'unlock' &&
      definition.skillId &&
      !this.gameState.player.skills.some(
        (skill) => skill.skillId === definition.skillId,
      ) &&
      this.gameState.player.skills.length >=
        getConfiguredSkillSlotCount(this.gameState.player)
    ) {
      return {
        ok: false,
        error: 'No skill slots are available for this skill unlock.',
      }
    }

    applyUpgrade(this.gameState, upgradeId)
    this.gameState.run.selectedUpgradeIds.push(upgradeId)
    this.notifyStateChanged()
    return { ok: true, changed: true }
  }

  getUiSnapshot(): GameUiSnapshot {
    return createUiSnapshot(this.gameState, this.choiceFlows)
  }

  getRunResultSnapshot(): RunResultSnapshot {
    return createRunResultSnapshot(this.gameState)
  }

  /**
   * Compatibility projection of the active level-up flow. Gear flows are
   * available through getPendingChoiceFlow().
   */
  getPendingUpgradeChoices(): readonly LevelUpUpgradeChoice[] {
    const flow = this.choiceFlows[0]
    if (!flow || flow.type !== 'level-up') {
      return []
    }
    return flow.choices.map((choice) => ({ ...choice }))
  }

  get upgradeChoices(): readonly LevelUpUpgradeChoice[] {
    return this.getPendingUpgradeChoices()
  }

  /** Gear pickups collected by the simulation, awaiting a future gear flow. */
  getPendingGearPickups(): readonly GearPickupState[] {
    return this.collectedGearPickups.map((pickup) => ({ ...pickup }))
  }

  get pendingGearPickups(): readonly GearPickupState[] {
    return this.getPendingGearPickups()
  }

  /** Returns the active flow, preserving its discriminated choice type. */
  getPendingChoiceFlow(): PendingChoiceFlow | undefined {
    const flow = this.choiceFlows[0]
    return flow ? cloneChoiceFlow(flow) : undefined
  }

  /** Returns active and queued flows in the order they will be resolved. */
  getPendingChoiceFlows(): readonly PendingChoiceFlow[] {
    return this.choiceFlows.map((flow) => cloneChoiceFlow(flow))
  }

  get pendingChoiceFlow(): PendingChoiceFlow | undefined {
    return this.getPendingChoiceFlow()
  }

  get pendingChoiceFlows(): readonly PendingChoiceFlow[] {
    return this.getPendingChoiceFlows()
  }

  get canRerollActiveChoice(): boolean {
    const flow = this.choiceFlows[0]
    return this.gameState.run.phase === 'level-up' &&
      flow !== undefined &&
      (this.gameState.run.rerollsRemaining ?? 0) > 0
  }

  /** Replaces the current gear or skill offers without resolving the choice. */
  rerollActiveChoice(): boolean {
    const flow = this.choiceFlows[0]
    if (!this.canRerollActiveChoice || !flow) {
      return false
    }

    if (flow.type === 'level-up') {
      flow.choices = generateUpgradeChoices(
        this.gameState,
        UPGRADE_CHOICES_PER_LEVEL,
        this.random,
        this.synergyRandom,
      )
    } else {
      flow.choices = generateGearChoices(
        this.gameState,
        GEAR_CHOICES_PER_PICKUP,
        this.gearRandom,
      )
    }
    this.gameState.run.rerollsRemaining =
      (this.gameState.run.rerollsRemaining ?? 0) - 1
    this.notifyStateChanged()
    return true
  }

  canBanishChoice(choice: LevelUpUpgradeChoice): boolean {
    const flow = this.choiceFlows[0]
    if (
      this.gameState.run.phase !== 'level-up' ||
      flow?.type !== 'level-up' ||
      (this.gameState.run.banishesRemaining ?? 0) <= 0
    ) {
      return false
    }
    return flow.choices.some((candidate) =>
      candidate.upgradeId === choice.upgradeId &&
      ('skillId' in candidate
        ? 'skillId' in choice && candidate.skillId === choice.skillId
        : 'synergyId' in candidate
          ? 'synergyId' in choice && candidate.synergyId === choice.synergyId
          : !('skillId' in choice) && !('synergyId' in choice)) &&
      getUpgradeDefinition(candidate.upgradeId).skillAction === 'unlock',
    )
  }

  /** Replaces one skill unlock offer and permanently excludes its skill. */
  banishActiveChoice(choice: LevelUpUpgradeChoice): boolean {
    const flow = this.choiceFlows[0]
    if (!this.canBanishChoice(choice) || flow?.type !== 'level-up') {
      return false
    }
    const choiceIndex = flow.choices.findIndex((candidate) =>
      candidate.upgradeId === choice.upgradeId &&
      ('skillId' in candidate
        ? 'skillId' in choice && candidate.skillId === choice.skillId
        : 'synergyId' in candidate
          ? 'synergyId' in choice && candidate.synergyId === choice.synergyId
          : !('skillId' in choice) && !('synergyId' in choice)),
    )
    const skillId = choiceIndex >= 0
      ? getUpgradeDefinition(flow.choices[choiceIndex]!.upgradeId).skillId
      : undefined
    if (choiceIndex < 0 || !skillId) {
      return false
    }
    if (!this.gameState.run.banishedSkillIds?.includes(skillId)) {
      this.gameState.run.banishedSkillIds ??= []
      this.gameState.run.banishedSkillIds.push(skillId)
    }
    this.gameState.run.banishesRemaining =
      (this.gameState.run.banishesRemaining ?? 0) - 1
    const replacement = generateBanishReplacement(
      this.gameState,
      flow.choices,
      this.random,
    )
    if (replacement) {
      flow.choices[choiceIndex] = replacement
    } else {
      flow.choices.splice(choiceIndex, 1)
    }
    this.notifyStateChanged()
    return true
  }

  getPendingChoices(): readonly (LevelUpUpgradeChoice | GearChoice)[] {
    return this.pendingChoiceFlows[0]?.choices.map((choice) => ({ ...choice })) ?? []
  }

  /** Hands collected gear pickups to a future choice flow and clears the bridge. */
  consumePendingGearPickups(): readonly GearPickupState[] {
    const pickups = this.getPendingGearPickups()
    this.collectedGearPickups.length = 0
    return pickups
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  selectUpgrade(
    choice: LevelUpUpgradeChoice | { upgradeId: UpgradeId } | UpgradeId,
  ): boolean {
    const flow = this.choiceFlows[0]
    if (this.gameState.run.phase !== 'level-up' || !flow || flow.type !== 'level-up') {
      return false
    }

    const upgradeId = typeof choice === 'string' ? choice : choice.upgradeId
    const skillId = typeof choice === 'object' && 'skillId' in choice
      ? choice.skillId
      : undefined
    const synergyId = typeof choice === 'object' && 'synergyId' in choice
      ? choice.synergyId
      : undefined
    if (
      !flow.choices.some((candidate) => {
        if (candidate.upgradeId !== upgradeId) {
          return false
        }
        if ('skillId' in candidate) {
          return candidate.skillId === skillId
        }
        if ('synergyId' in candidate) {
          return candidate.synergyId === synergyId
        }
        return skillId === undefined && synergyId === undefined
      })
    ) {
      return false
    }

    applyUpgrade(this.gameState, upgradeId, skillId, synergyId)
    this.grantChoiceRecovery()
    if (
      upgradeId !== REMOVE_SKILL_UPGRADE_ID &&
      upgradeId !== REMOVE_SYNERGY_UPGRADE_ID
    ) {
      this.gameState.run.selectedUpgradeIds.push(upgradeId)
    }

    this.completeActiveChoiceFlow()
    return true
  }

  selectGearChoice(choice: GearChoice): boolean {
    const flow = this.choiceFlows[0]
    if (this.gameState.run.phase !== 'level-up' || !flow || flow.type !== 'gear-pickup') {
      return false
    }

    const offered = flow.choices.find((candidate) =>
      gearChoiceSignature(candidate) === gearChoiceSignature(choice),
    )
    if (!offered) {
      return false
    }
    if (offered.type === 'gear') {
      equipRolledItem(
        this.gameState.player,
        offered.itemId,
        offered.rarity,
        offered.modifiers,
        undefined,
        offered.setId,
      )
    } else if (offered.type === 'upgrade-equipped-item') {
      const upgraded = upgradeEquippedItem(
        this.gameState.player,
        offered.slot,
        offered.upgradedModifiers,
      )
      if (!upgraded) {
        return false
      }
    } else if (offered.type === 'gear-xp-blessing') {
      this.gameState.run.gearXpBlessingActive = true
    } else {
      this.gameState.player.gearRarityFloor = offered.minimumRarity
    }
    this.grantChoiceRecovery()
    this.completeActiveChoiceFlow()
    return true
  }

  selectGear(choice: GearChoice | string): boolean {
    if (typeof choice === 'string') {
      const flow = this.choiceFlows[0]
      const offered = flow?.type === 'gear-pickup'
        ? flow.choices.find(
          (candidate) => candidate.type === 'gear' && candidate.itemId === choice,
        )
        : undefined
      return offered ? this.selectGearChoice(offered) : false
    }
    return this.selectGearChoice(choice)
  }

  selectChoice(choice: LevelUpUpgradeChoice | GearChoice | UpgradeId): boolean {
    if (typeof choice === 'string') {
      return this.selectUpgrade(choice)
    }
    return choice && 'upgradeId' in choice
      ? this.selectUpgrade(choice)
      : this.selectGearChoice(choice)
  }

  skipChoice(): boolean {
    if (
      this.gameState.run.phase !== 'level-up' ||
      this.choiceFlows.length === 0
    ) {
      return false
    }

    this.completeActiveChoiceFlow()
    return true
  }

  /**
   * Advances the simulation with a fixed-timestep accumulator. Choice and
   * paused phases do not advance; floor transitions wait for checkpoint
   * acknowledgement before their completion tick.
   */
  update(rawDeltaSeconds: number): void {
    const canAdvance = (): boolean =>
      this.gameState.run.phase === 'playing' ||
      (this.gameState.run.phase === 'floor-transition' &&
        this.gameState.floorTransition?.savePending !== true)
    this.clock.advance(
      rawDeltaSeconds,
      this.currentTimeScale,
      canAdvance,
      () => this.step(),
    )
  }

  /** Pauses the run, remembering the playable phase to return to on resume(). */
  pause(): void {
    if (
      this.gameState.run.phase !== 'playing' &&
      this.gameState.run.phase !== 'level-up'
    ) {
      return
    }

    this.resumePhase = this.gameState.run.phase
    this.transitionTo('paused')
  }

  /** Resumes a paused run, returning to the phase active before pausing. */
  resume(): void {
    if (this.gameState.run.phase !== 'paused') {
      return
    }

    this.transitionTo(this.resumePhase ?? 'playing')
    this.resumePhase = undefined
  }

  /** Ends the active run through the normal defeat transition. */
  endRun(): boolean {
    if (this.gameState.run.phase !== 'playing') {
      return false
    }

    this.gameState.player.hp = 0
    this.transitionTo('defeat')
    return true
  }

  /** Forfeits a paused run while retaining its damage and healing history. */
  forfeit(): boolean {
    if (this.gameState.run.phase !== 'paused') {
      return false
    }

    this.gameState.run.forfeited = true
    this.gameState.run.playerCombatLog = []
    this.gameState.player.hp = 0
    this.transitionTo('defeat')
    return true
  }

  /** Adds a Slime at an explicit world position. */
  spawnSlime(position: WorldPosition): EntityId {
    return spawnSlime(
      this.gameState,
      this.idAllocator,
      position,
      this.worldModifierEffects,
    )
  }

  spawnEnemy(
    definitionId: EnemyDefinitionId,
    position: WorldPosition,
    xpRewardOverride?: number,
    eliteModifiers?: EliteModifierInput,
    canDropLoot?: boolean,
  ): EntityId {
    return spawnEnemy(
      this.gameState,
      this.idAllocator,
      definitionId,
      position,
      xpRewardOverride,
      eliteModifiers,
      this.worldModifierEffects,
      canDropLoot,
    )
  }

  /** Starts the first boss encounter immediately, for deterministic testing. */
  startBossEncounter(): boolean {
    return startBossEncounter(this.gameState, this.idAllocator)
  }

  spawnBoss(
    definitionId: BossDefinitionId = 'stone-golem',
    position: WorldPosition = {
      x: this.gameState.player.x + 320,
      y: this.gameState.player.y,
    },
  ): EntityId {
    return spawnBoss(this.gameState, this.idAllocator, definitionId, position)
  }

  /** Starts a named boss encounter immediately, for development harnesses. */
  startEncounter(definitionId?: BossDefinitionId): boolean {
    if (!definitionId) {
      return this.startBossEncounter()
    }
    const definition = this.dungeon.encounterTimeline.find(
      (candidate) => candidate.bossDefinitionId === definitionId,
    )
    return definition
      ? startBossEncounter(this.gameState, this.idAllocator, definition, true)
      : false
  }

  /** Adds a pickup through the game's entity allocator. */
  spawnXpPickup(position: WorldPosition, xpAmount: number): EntityId {
    return spawnXpPickup(
      this.gameState,
      this.idAllocator,
      position,
      xpAmount,
    )
  }

  spawnGearPickup(
    position: WorldPosition,
    sourceEnemyDefinitionId?: EnemyDefinitionId,
  ): EntityId {
    return spawnGearPickup(
      this.gameState,
      this.idAllocator,
      position,
      sourceEnemyDefinitionId,
    )
  }

  spawnHealingPotion(position: WorldPosition): EntityId {
    return spawnHealingPotion(this.gameState, this.idAllocator, position)
  }

  spawnStairs(position: WorldPosition, isFinal = false): EntityId {
    return spawnStairs(
      this.gameState,
      this.idAllocator,
      position,
      isFinal,
    ).id
  }

  /**
   * Development-only stress helper. It intentionally bypasses the normal
   * director cap and never consumes seeded RNG, so regular run decisions stay
   * reproducible around a debug spawn.
   */
  spawnDebugEnemies(count: DebugSpawnCount): number {
    if (
      this.gameState.run.phase !== 'playing' ||
      !DEBUG_SPAWN_COUNTS.includes(count)
    ) {
      return 0
    }

    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963229728653
      const radius = 500 + (index % 16) * 10
      this.spawnEnemy(SLIME_DEFINITION_ID, {
        x: this.gameState.player.x + Math.cos(angle) * radius,
        y: this.gameState.player.y + Math.sin(angle) * radius,
      })
    }

    return count
  }

  private step(): void {
    this.gameState.tick += 1
    this.gameState.time += FIXED_STEP_SECONDS
    if (this.gameState.run.phase === 'floor-transition') {
      this.advanceFloorTransition()
      return
    }
    this.updateChoiceRecoveryEffects()
    updateBossDeathMagnet(this.gameState, FIXED_STEP_SECONDS)
    // Start due boss events before normal spawning so a completed normal floor
    // never produces an ordinary enemy alongside its boss.
    updateEncounter(this.gameState, this.idAllocator)

    // Keep this order explicit: decisions happen before projectile movement,
    // collision produces queued damage, and cleanup is last.
    updateEnemySpawns(
      this.gameState,
      this.spawnDirector,
      this.idAllocator,
      FIXED_STEP_SECONDS,
      this.worldModifierEffects,
    )
    updateAttackCooldown(this.gameState, FIXED_STEP_SECONDS)
    updateSkillCooldowns(this.gameState, FIXED_STEP_SECONDS)
    updateRuinSigils(this.gameState, FIXED_STEP_SECONDS)
    updateBloodDebt(this.gameState, FIXED_STEP_SECONDS)
    updateEnemyChase(this.gameState, FIXED_STEP_SECONDS)
    updateBosses(this.gameState, this.idAllocator, FIXED_STEP_SECONDS)
    updateEnemyAbilities(
      this.gameState,
      this.idAllocator,
      FIXED_STEP_SECONDS,
      this.worldModifierEffects,
    )
    const enemySpatialHash = createEnemySpatialHash(this.gameState)
    resolvePlayerTarget(this.gameState)
    updatePlayerBehavior(this.gameState, FIXED_STEP_SECONDS, enemySpatialHash)
    updateEnemyTelegraphPositions(this.gameState)
    resolvePlayerTarget(this.gameState)
    const basicAttackEvents = performBasicAttackIfReady(
      this.gameState,
      this.idAllocator,
    )
    updateProjectiles(this.gameState, FIXED_STEP_SECONDS)
    resolveDeadSoulTetherSnaps(this.gameState, this.random, this.idAllocator)
    const damageEvents = [
      ...collectEnemyContactDamage(this.gameState, FIXED_STEP_SECONDS),
      ...basicAttackEvents,
      ...collectProjectileDamage(this.gameState, enemySpatialHash, this.idAllocator),
      ...collectSkillDamage(this.gameState, this.idAllocator, this.random),
      ...updateSummons(this.gameState, FIXED_STEP_SECONDS, this.idAllocator),
      ...updateCinderMineTraps(this.gameState, FIXED_STEP_SECONDS, this.idAllocator),
      ...updateStormRelay(this.gameState, FIXED_STEP_SECONDS, this.idAllocator),
      ...updateSoulTether(this.gameState, FIXED_STEP_SECONDS, this.idAllocator),
      ...updateRazorwires(this.gameState, FIXED_STEP_SECONDS, this.idAllocator),
      ...updatePrismHalo(this.gameState, FIXED_STEP_SECONDS, this.idAllocator),
      ...updateMirrorcast(this.gameState, FIXED_STEP_SECONDS, this.idAllocator, this.random),
      ...updatePoison(this.gameState, FIXED_STEP_SECONDS),
      ...updateBurning(this.gameState, FIXED_STEP_SECONDS),
      ...resolveBossTelegraphs(this.gameState),
      ...resolveEnemyTelegraphs(this.gameState, this.idAllocator),
    ]
    updateFrost(this.gameState, FIXED_STEP_SECONDS)
    applyDamageEvents(this.gameState, damageEvents, this.random, this.idAllocator)
    removeDeadSummons(this.gameState)
    if (this.gameState.player.hp <= 0 && this.gameState.run.phase === 'playing') {
      this.transitionTo('defeat')
      return
    }
    const defeatedBosses = (this.gameState.bosses ?? []).filter(
      (boss) => boss.hp <= 0,
    )
    if (defeatedBosses.length > 0) {
      cancelBossTelegraphs(
        this.gameState,
        new Set(defeatedBosses.map((boss) => boss.id)),
      )
      for (const boss of defeatedBosses) {
        activateBossDeathMagnet(this.gameState)
        if (boss.xpReward > 0) {
          this.spawnXpPickup({ x: boss.x, y: boss.y }, boss.xpReward)
        }
      }
      this.gameState.bosses = (this.gameState.bosses ?? []).filter(
        (boss) => boss.hp > 0,
      )
      if (
        (this.gameState.bosses ?? []).length === 0 &&
        completeBossEncounter(this.gameState)
      ) {
        const lastBoss = [...defeatedBosses].sort(
          (left, right) => left.id - right.id,
        )[defeatedBosses.length - 1]
        if (lastBoss) {
          spawnStairs(
            this.gameState,
            this.idAllocator,
            { x: lastBoss.x, y: lastBoss.y },
            this.gameState.encounter?.isFinal === true,
          )
        }
      }
    }
    removeDeadEntities(this.gameState, (position, xpAmount) => {
      this.spawnXpPickup(position, xpAmount)
    }, (definitionId, position, xpRewardOverride, canDropLoot) => {
      // Splitter children intentionally use the ordinary spawn path without
      // an elite modifier; only director requests assign elites. They also do
      // not generate additional gear or potion loot.
      this.spawnEnemy(
        definitionId,
        position,
        xpRewardOverride,
        undefined,
        canDropLoot,
      )
    }, (position, sourceEnemyDefinitionId) => {
      this.spawnGearPickup(position, sourceEnemyDefinitionId)
    }, this.gearRandom, (position) => {
      spawnHealingPotion(this.gameState, this.idAllocator, position)
    }, this.idAllocator)
    updateStairs(this.gameState, (stairs) => {
      stairs.rewardsCollected = true
      if (this.choiceFlows.length === 0) {
        this.beginFloorTransition(stairs)
      }
    })
    if (this.gameState.run.phase === 'playing') {
      updatePickups(this.gameState, FIXED_STEP_SECONDS, (amount) => {
        const levelsGained = grantExperience(this.gameState, amount * this.xpMultiplier)
        if (this.gameState.run.phase === 'playing' && levelsGained > 0) {
          this.enqueueLevelUpFlows(levelsGained)
        }
      }, (pickup: GearPickupState) => {
        this.collectedGearPickups.push({ ...pickup })
        this.enqueueGearPickupFlow(pickup)
      }, () => {
        healPlayer(
          this.gameState,
          this.gameState.player.maxHp * HEALING_POTION_MAX_HP_FRACTION,
          'Healing potion',
        )
      })
    }
    updateSkillEffects(this.gameState, FIXED_STEP_SECONDS, this.random)
  }

  private beginFloorTransition(
    stairs: NonNullable<GameState['stairs']>,
  ): void {
    if (this.gameState.floorTransition || this.gameState.run.phase !== 'playing') {
      return
    }
    const fromFloor = this.gameState.run.floor ?? stairs.floorNumber
    const toFloor = fromFloor + 1
    if (!stairs.isFinal) {
      this.gameState.run.floor = toFloor
      this.gameState.run.floorStartedAt = this.gameState.time
      healPlayer(this.gameState, this.gameState.player.maxHp, 'Entering new floor')
      resetFloorCombatState(this.gameState)
    }
    this.gameState.floorTransition = {
      remainingSeconds: 0,
      fromFloor,
      toFloor,
      isFinal: stairs.isFinal,
      savePending: !stairs.isFinal,
    }
    this.gameState.stairs = undefined
    this.transitionTo('floor-transition')
  }

  private advanceFloorTransition(): void {
    const transition = this.gameState.floorTransition
    if (!transition) {
      this.transitionTo('playing')
      return
    }
    if (transition.savePending === true) {
      return
    }
    transition.remainingSeconds -= FIXED_STEP_SECONDS
    if (transition.remainingSeconds > 1e-9) {
      return
    }
    this.gameState.floorTransition = undefined
    if (transition.isFinal) {
      this.transitionTo('victory')
      this.transitionTo('results')
      return
    }
    this.transitionTo('playing')
  }

  private transitionTo(nextPhase: RunPhase): void {
    transitionRunPhase(this.gameState, nextPhase, () => {
      this.notifyStateChanged()
    })
  }

  private enqueueLevelUpFlows(
    levelsGained: number,
    firstLevel = this.gameState.player.level - levelsGained + 1,
  ): void {
    for (let index = 0; index < levelsGained; index += 1) {
      this.choiceFlows.push({
        type: 'level-up',
        level: firstLevel + index,
        choices: [],
      })
    }
    this.activateChoiceFlow()
  }

  private enqueueGearPickupFlow(pickup: GearPickupState): void {
    this.choiceFlows.push({
      type: 'gear-pickup',
      pickupId: pickup.id,
      choices: generateGearChoices(
        this.gameState,
        GEAR_CHOICES_PER_PICKUP,
        this.gearRandom,
      ),
    })
    this.activateChoiceFlow()
  }

  private activateChoiceFlow(): void {
    if (this.choiceFlows.length > 0) {
      this.materializeActiveChoiceFlow()
    }
    if (this.choiceFlows.length > 0 && this.gameState.run.phase === 'playing') {
      this.transitionTo('level-up')
    }
  }

  private completeActiveChoiceFlow(): void {
    const completed = this.choiceFlows.shift()
    if (completed?.type === 'gear-pickup') {
      const index = this.collectedGearPickups.findIndex(
        (pickup) => pickup.id === completed.pickupId,
      )
      if (index >= 0) {
        this.collectedGearPickups.splice(index, 1)
      }
    }
    if (this.choiceFlows.length > 0) {
      this.materializeActiveChoiceFlow()
      this.notifyStateChanged()
    } else if (
      this.gameState.stairs?.rewardsCollected &&
      this.gameState.run.phase === 'level-up'
    ) {
      const stairs = this.gameState.stairs
      this.transitionTo('playing')
      this.beginFloorTransition(stairs)
    } else {
      this.transitionTo('playing')
    }
  }

  private materializeActiveChoiceFlow(): void {
    const flow = this.choiceFlows[0]
    if (!flow || flow.type !== 'level-up' || flow.choices.length > 0) {
      return
    }
    flow.choices = generateUpgradeChoices(
      this.gameState,
      UPGRADE_CHOICES_PER_LEVEL,
      this.random,
      this.synergyRandom,
    )
  }

  private updateChoiceRecoveryEffects(): void {
    const player = this.gameState.player
    if (player.choiceRecoveryInvulnerabilityRemaining !== undefined) {
      player.choiceRecoveryInvulnerabilityRemaining =
        this.decrementChoiceRecoveryTimer(
          player.choiceRecoveryInvulnerabilityRemaining,
        )
    }
    if (player.choiceRecoveryMovementSpeedBoostRemaining !== undefined) {
      player.choiceRecoveryMovementSpeedBoostRemaining =
        this.decrementChoiceRecoveryTimer(
          player.choiceRecoveryMovementSpeedBoostRemaining,
        )
    }
  }

  private decrementChoiceRecoveryTimer(timer: number | undefined): number {
    const remaining = Math.max(0, (timer ?? 0) - FIXED_STEP_SECONDS)
    return remaining <= 1e-9 ? 0 : remaining
  }

  private grantChoiceRecovery(): void {
    this.gameState.player.choiceRecoveryInvulnerabilityRemaining =
      CHOICE_RECOVERY_INVULNERABILITY_SECONDS
    this.gameState.player.choiceRecoveryMovementSpeedBoostRemaining =
      CHOICE_RECOVERY_MOVEMENT_SPEED_BOOST_SECONDS
  }

  private notifyStateChanged(): void {
    for (const listener of this.listeners) {
      listener(this.gameState)
    }
  }

  private getDevelopmentGrantPhaseError(): string | undefined {
    return this.gameState.run.phase === 'playing' ||
      this.gameState.run.phase === 'paused' ||
      this.gameState.run.phase === 'level-up'
      ? undefined
      : 'Development grants are only available during an active run.'
  }

  /**
   * Serializes the complete simulation state into a versioned, JSON-safe
   * checkpoint DTO. The checkpoint captures every mutable field needed to
   * restore this exact Game and produce identical future behavior.
   */
  createCheckpoint(): GameCheckpoint {
    return this.buildCheckpoint()
  }

  /**
   * Returns the canonical next-floor checkpoint while the simulation is held
   * in the persistence-gated floor transition.
   */
  getFloorCheckpointSnapshot(): GameCheckpoint | undefined {
    const transition = this.gameState.floorTransition
    if (
      this.gameState.run.phase !== 'floor-transition' ||
      !transition ||
      transition.isFinal ||
      transition.savePending !== true
    ) {
      return undefined
    }
    const checkpoint = this.buildCheckpoint()
    checkpoint.gameState.run.phase = 'playing'
    checkpoint.gameState.floorTransition = undefined
    checkpoint.gameState.paused = false
    return checkpoint
  }

  /** Releases the simulation after the next-floor checkpoint has been saved. */
  completeFloorSave(): boolean {
    const transition = this.gameState.floorTransition
    if (
      this.gameState.run.phase !== 'floor-transition' ||
      !transition ||
      transition.savePending !== true
    ) {
      return false
    }
    transition.savePending = false
    this.gameState.floorTransition = undefined
    this.transitionTo('playing')
    return true
  }

  /**
   * App-integration alias of {@link createCheckpoint}. Returns a JSON-safe
   * snapshot suitable for persistence at any point during an active run.
   */
  getCheckpointSnapshot(): GameCheckpoint {
    return this.buildCheckpoint()
  }

  /**
   * Returns a checkpoint captured at a terminal phase (defeat / victory /
   * results). Callers that only persist final run state can use this to
   * signal intent; the payload is identical to {@link getCheckpointSnapshot}
   * but the method returns `undefined` when the run is still in progress.
   */
  getTerminalCheckpointSnapshot(): GameCheckpoint | undefined {
    const phase = this.gameState.run.phase
    if (phase !== 'defeat' && phase !== 'victory' && phase !== 'results') {
      return undefined
    }
    return this.buildCheckpoint()
  }

  private buildCheckpoint(): GameCheckpoint {
    const random = this.random as Random
    const gearRandom = this.gearRandom as Random
    const synergyRandom = this.synergyRandom as Random

    return {
      version: CHECKPOINT_VERSION,
      runConfig: { ...this.runConfig },
      gameState: JSON.parse(JSON.stringify(this.gameState)),
      rngState: random.getInternalState(),
      gearRngState: gearRandom.getInternalState(),
      synergyRngState: synergyRandom.getInternalState(),
      spawnDirector: this.spawnDirector.getSerializableState(),
      nextEntityId: this.idAllocator.getNextId?.() ??
        getNextEntityIdFromState(this.gameState),
      clockAccumulatedSeconds: this.clock.getAccumulatedSeconds(),
      currentTimeScale: this.currentTimeScale,
      resumePhase: this.resumePhase ?? null,
      choiceFlows: JSON.parse(JSON.stringify(this.choiceFlows)),
      collectedGearPickups: JSON.parse(JSON.stringify(this.collectedGearPickups)),
    }
  }

  /**
   * Creates a new Game from a previously serialized checkpoint, restoring
   * every mutable field so future simulation steps produce identical results.
   *
   * @throws if the checkpoint version is unknown or the envelope is malformed.
   */
  static restoreFromCheckpoint(checkpoint: unknown): Game {
    if (!isValidCheckpoint(checkpoint)) {
      throw new Error(
        'Invalid or unsupported checkpoint' +
          (typeof checkpoint === 'object' && checkpoint !== null &&
            'version' in checkpoint
            ? ` (version ${(checkpoint as Record<string, unknown>).version})`
            : '') +
          '.',
      )
    }

    // Create a fresh Game from the original config to build all readonly
    // derived state (dungeon, world modifier effects, etc.).
    const game = new Game(checkpoint.runConfig)

    // Overwrite all mutable state from the checkpoint.
    Object.assign(game.gameState, normalizeCheckpointState(checkpoint.gameState))
    if (!Array.isArray(game.gameState.run.banishedSkillIds)) {
      game.gameState.run.banishedSkillIds = []
    }
    if (typeof game.gameState.run.banishesRemaining !== 'number') {
      game.gameState.run.banishesRemaining = getConfiguredBanishCount(
        checkpoint.runConfig.banishCount,
      )
    }

    ;(game.random as Random).setInternalState(checkpoint.rngState)
    ;(game.gearRandom as Random).setInternalState(checkpoint.gearRngState)
    ;(game.synergyRandom as Random).setInternalState(checkpoint.synergyRngState)

    game.spawnDirector.restoreSerializableState(checkpoint.spawnDirector)
    if (!game.idAllocator.setNextId) {
      throw new Error('The game entity allocator cannot restore a checkpoint.')
    }
    game.idAllocator.setNextId(checkpoint.nextEntityId)
    game.clock.setAccumulatedSeconds(checkpoint.clockAccumulatedSeconds)
    game.currentTimeScale = checkpoint.currentTimeScale
    game.resumePhase = checkpoint.resumePhase ?? undefined
    game.choiceFlows = JSON.parse(JSON.stringify(checkpoint.choiceFlows))
    game.collectedGearPickups.length = 0
    for (const pickup of checkpoint.collectedGearPickups) {
      game.collectedGearPickups.push(JSON.parse(JSON.stringify(pickup)))
    }

    return game
  }
}

export function createGame(config: RunConfig): Game {
  return new Game(config)
}

/**
 * Convenience wrapper: creates a Game from `config` and immediately returns
 * its initial checkpoint without retaining the Game instance.
 */
export function createInitialGameCheckpoint(config: RunConfig): GameCheckpoint {
  return new Game(config).createCheckpoint()
}

/**
 * Convenience wrapper: restores a Game from a previously serialized
 * checkpoint. Equivalent to `Game.restoreFromCheckpoint(checkpoint)`.
 *
 * @throws if the checkpoint version is unknown or the envelope is malformed.
 */
export function createGameFromCheckpoint(checkpoint: unknown): Game {
  return Game.restoreFromCheckpoint(checkpoint)
}

function getConfiguredSkillSlotCount(player: GameState['player']): number {
  const configuredCount = player.skillSlotCount
  return typeof configuredCount === 'number' && Number.isFinite(configuredCount)
    ? Math.max(1, Math.floor(configuredCount))
    : DEFAULT_SKILL_SLOT_COUNT
}

function getConfiguredRerollCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(10, Math.max(0, Math.floor(value)))
    : 0
}

function getConfiguredBanishCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(5, Math.max(1, Math.floor(value)))
    : 1
}

function getNextEntityIdFromState(state: GameState): number {
  const ids = [
    state.player.id,
    ...state.enemies.map((entity) => entity.id),
    ...(state.bosses ?? []).map((entity) => entity.id),
    ...(state.telegraphs ?? []).map((entity) => entity.id),
    ...state.projectiles.map((entity) => entity.id),
    ...state.pickups.map((entity) => entity.id),
    ...state.summons.map((entity) => entity.id),
    ...state.effects.map((entity) => entity.id),
    ...(state.traps ?? []).map((entity) => entity.id),
    ...(state.relays ?? []).map((entity) => entity.id),
    ...(state.wires ?? []).map((entity) => entity.id),
    ...(state.player.soulTethers ?? []).map((entity) => entity.id),
    ...(state.player.ruinSigils ?? []).map((entity) => entity.id),
    ...(state.stairs ? [state.stairs.id] : []),
  ]
  return Math.max(0, ...ids) + 1
}
