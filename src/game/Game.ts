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
import { resolveWorldModifierEffects } from '../content/modifiers/WorldModifiers'
import {
  DEFAULT_PLAYSTYLE_ID,
  isPlaystyleId,
} from '../content/playstyles/Playstyles'
import { spawnStarterSkeleton, updateSummons } from './systems/summons/SummonSystem'
import type { WorldModifierEffects } from '../content/modifiers/WorldModifiers'
import {
  generateUpgradeChoices,
  UPGRADE_CHOICES_PER_LEVEL,
} from './upgrades/UpgradeChoices'
import type {
  UpgradeChoice,
  UpgradeId,
} from '../content/upgrades/Upgrades'
import {
  generateGearChoices,
  GEAR_CHOICES_PER_PICKUP,
  type GearChoice,
} from './equipment/GearChoices'
import {
  equipItem,
  upgradeEquippedItem,
} from './equipment/EquipmentState'
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
  removeDeadEntities,
  resolvePlayerTarget,
  spawnBasicBoltIfReady,
  updateAttackCooldown,
  updateEnemyChase,
  updateProjectiles,
} from './systems/combat/CombatSystem'
import { createEnemySpatialHash } from './combat/Targeting'
import {
  grantExperience,
  updatePickups,
} from './systems/experience/ExperienceSystem'
import {
  createInitialPlayerState,
  spawnEnemy,
  spawnBoss,
  spawnGearPickup,
  spawnSlime,
  spawnXpPickup,
  updateEnemySpawns,
} from './systems/spawning/SpawningSystem'
import { SLIME_DEFINITION_ID } from '../content/enemies/Enemies'
import type { EliteModifierId } from '../content/enemies/EliteModifiers'
import { applyUpgrade } from './systems/upgrades/UpgradeSystem'
import {
  collectSkillDamage,
  updateSkillCooldowns,
  updateSkillEffects,
} from './systems/skills/SkillSystem'
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
  completeBossEncounter,
  startBossEncounter,
  updateEncounter,
} from './systems/encounter/EncounterSystem'
import {
  FLOOR_TRANSITION_SECONDS,
  spawnStairs,
  updateStairs,
} from './systems/stairs/StairsSystem'
import {
  cancelBossTelegraphs,
  resolveBossTelegraphs,
  updateBosses,
} from './systems/boss/BossSystem'
import { updatePlayerBehavior } from './systems/behavior/BehaviorController'
import type { BossDefinitionId } from '../content/bosses/Bosses'
import {
  DEFAULT_DUNGEON_ID,
  createDungeonEncounterTimeline,
  getDungeonDefinition,
  getDungeonFloor,
  resolveDungeonLengthSeconds,
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
  DEFAULT_DUNGEON_LENGTH_SECONDS,
  DUNGEON_FLOOR_DURATION_SECONDS,
  DUNGEON_DEFINITIONS,
  ORDINARY_ENEMY_FLOOR_STAT_SCALING,
  getDungeonDefinition,
  getDungeonFloor,
  getFloorStatMultiplier,
  isDungeonLengthUnlocked,
  scaleOrdinaryEnemyStats,
} from '../content/dungeons/Dungeons'
export type {
  DungeonDefinition,
  DungeonDefinitionId,
  DungeonLengthContract,
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

/**
 * Renderer-independent game simulation facade. The run owns its state, seeded
 * random source, entity IDs, and system update order; domain responsibilities
 * are implemented by the focused modules under `game/systems`.
 */
export class Game {
  readonly random: RandomSource

  private readonly idAllocator: EntityIdAllocator
  private readonly gearRandom: RandomSource
  private readonly gameState: GameState
  readonly spawnDirector: SpawnDirector
  private readonly worldModifierEffects: WorldModifierEffects
  readonly dungeon: DungeonDefinition
  private readonly clock = new FixedTimestepClock()
  private currentTimeScale = DEFAULT_TIME_SCALE
  private resumePhase: RunPhase | undefined
  private choiceFlows: PendingChoiceFlow[] = []
  private readonly collectedGearPickups: GearPickupState[] = []
  private readonly listeners = new Set<GameStateListener>()

  constructor(config: RunConfig) {
    assertValidContent()
    this.idAllocator = createEntityIdAllocator()
    this.random = new Random(config.seed)
    this.gearRandom = new Random(config.seed ^ 0x9e3779b9)
    this.worldModifierEffects = resolveWorldModifierEffects(
      config.worldModifierIds,
      SPAWN_BALANCE,
    )
    this.spawnDirector = new SpawnDirector(
      this.random,
      this.worldModifierEffects.spawnBalance,
      this.worldModifierEffects.fastStartThreatMultiplier,
      this.worldModifierEffects.fastStartDurationSeconds,
    )
    const dungeon = getDungeonDefinition(config.dungeonId ?? DEFAULT_DUNGEON_ID)
    const dungeonLengthSeconds = resolveDungeonLengthSeconds(
      dungeon,
      config.dungeonLengthContractId,
      new Set(config.unlockedDungeonLengthIds ?? []),
    )
    this.dungeon = dungeonLengthSeconds === dungeon.defaultLengthSeconds
      ? dungeon
      : {
        ...dungeon,
        encounterTimeline: createDungeonEncounterTimeline(
          dungeonLengthSeconds,
          dungeon.floorDurationSeconds,
        ),
      }

    this.gameState = {
      run: {
        phase: 'loading',
        seed: config.seed,
        dungeonId: this.dungeon.id,
        ...(config.dungeonLengthContractId
          ? { dungeonLengthContractId: config.dungeonLengthContractId }
          : {}),
        dungeonLengthSeconds,
        floor: 1,
        completedEncounterIds: [],
        killCount: 0,
        selectedUpgradeIds: [],
        gearDropGenerated: false,
        ...(this.worldModifierEffects.ids.length > 0
          ? { worldModifierIds: this.worldModifierEffects.ids }
          : {}),
      },
      player: createInitialPlayerState(
        this.idAllocator.createEntityId(),
        this.worldModifierEffects,
        isPlaystyleId(config.playstyleId) ? config.playstyleId : DEFAULT_PLAYSTYLE_ID,
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
    if (isBehaviorProfileId(config.behaviorProfileId)) {
      this.gameState.player.behaviorController!.profileId = config.behaviorProfileId
    }
    if (this.gameState.player.playstyleId === 'necromancer') {
      spawnStarterSkeleton(this.gameState, this.idAllocator)
    }

    // A freshly created run has nothing left to load, so it moves straight
    // into playing through the same validated transition used by all phases.
    this.transitionTo('playing')
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
  getPendingUpgradeChoices(): readonly UpgradeChoice[] {
    const flow = this.choiceFlows[0]
    if (!flow || flow.type !== 'level-up') {
      return []
    }
    return flow.choices.map((choice) => ({ ...choice }))
  }

  get upgradeChoices(): readonly UpgradeChoice[] {
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

  getPendingChoices(): readonly (UpgradeChoice | GearChoice)[] {
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
    choice: UpgradeChoice | { upgradeId: UpgradeId } | UpgradeId,
  ): boolean {
    const flow = this.choiceFlows[0]
    if (this.gameState.run.phase !== 'level-up' || !flow || flow.type !== 'level-up') {
      return false
    }

    const upgradeId = typeof choice === 'string' ? choice : choice.upgradeId
    if (
      !flow.choices.some(
        (candidate) => candidate.upgradeId === upgradeId,
      )
    ) {
      return false
    }

    applyUpgrade(this.gameState, upgradeId)
    this.gameState.run.selectedUpgradeIds.push(upgradeId)

    this.completeActiveChoiceFlow()
    return true
  }

  selectGearChoice(choice: GearChoice): boolean {
    const flow = this.choiceFlows[0]
    if (this.gameState.run.phase !== 'level-up' || !flow || flow.type !== 'gear-pickup') {
      return false
    }

    const offered = flow.choices.find((candidate) =>
      candidate.type === choice.type &&
      candidate.itemId === choice.itemId &&
      candidate.slot === choice.slot,
    )
    if (!offered) {
      return false
    }
    if (offered.type === 'gear') {
      equipItem(this.gameState.player, offered.itemId)
    } else {
      const upgraded = upgradeEquippedItem(
        this.gameState.player,
        offered.slot,
        offered.upgradedModifiers,
      )
      if (!upgraded) {
        return false
      }
    }
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

  selectChoice(choice: UpgradeChoice | GearChoice | UpgradeId): boolean {
    if (typeof choice === 'string') {
      return this.selectUpgrade(choice)
    }
    return choice && 'upgradeId' in choice
      ? this.selectUpgrade(choice)
      : this.selectGearChoice(choice)
  }

  /**
   * Advances the simulation with a fixed-timestep accumulator. Choice and
   * paused phases do not advance; floor transitions run only their timer.
   */
  update(rawDeltaSeconds: number): void {
    this.clock.advance(
      rawDeltaSeconds,
      this.currentTimeScale,
      () =>
        this.gameState.run.phase === 'playing' ||
        this.gameState.run.phase === 'floor-transition',
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

  /** Adds a Slime at an explicit world position. */
  spawnSlime(position: WorldPosition): EntityId {
    return spawnSlime(this.gameState, this.idAllocator, position)
  }

  spawnEnemy(
    definitionId: EnemyDefinitionId,
    position: WorldPosition,
    xpRewardOverride?: number,
    eliteModifier?: EliteModifierId,
  ): EntityId {
    return spawnEnemy(
      this.gameState,
      this.idAllocator,
      definitionId,
      position,
      xpRewardOverride,
      eliteModifier,
      this.worldModifierEffects,
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
    this.gameState.run.floor = Math.max(
      this.gameState.run.floor ?? 1,
      getDungeonFloor(this.gameState.time, this.dungeon),
    )

    // Start due boss events before normal spawning so the final timer never
    // produces an ordinary enemy alongside the final boss.
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
    updateEnemyChase(this.gameState, FIXED_STEP_SECONDS)
    updateBosses(this.gameState, this.idAllocator, FIXED_STEP_SECONDS)
    updatePlayerBehavior(this.gameState, FIXED_STEP_SECONDS)
    const enemySpatialHash = createEnemySpatialHash(this.gameState)
    resolvePlayerTarget(this.gameState, enemySpatialHash)
    spawnBasicBoltIfReady(this.gameState, this.idAllocator)
    updateProjectiles(this.gameState, FIXED_STEP_SECONDS)
    const damageEvents = [
      ...collectEnemyContactDamage(this.gameState, FIXED_STEP_SECONDS),
      ...collectProjectileDamage(this.gameState, enemySpatialHash),
      ...collectSkillDamage(this.gameState, this.idAllocator),
      ...updateSummons(this.gameState, FIXED_STEP_SECONDS),
      ...resolveBossTelegraphs(this.gameState),
    ]
    applyDamageEvents(this.gameState, damageEvents)
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
    }, (definitionId, position, xpRewardOverride) => {
      // Splitter children intentionally use the ordinary spawn path without
      // an elite modifier; only director requests assign elites.
      this.spawnEnemy(definitionId, position, xpRewardOverride)
    }, (position, sourceEnemyDefinitionId) => {
      this.spawnGearPickup(position, sourceEnemyDefinitionId)
    }, this.gearRandom)
    updateStairs(this.gameState, (stairs) => {
      stairs.rewardsCollected = true
      this.collectFloorPickupsAt(stairs.x, stairs.y)
      if (this.choiceFlows.length === 0) {
        this.beginFloorTransition(stairs)
      }
    })
    updatePickups(this.gameState, FIXED_STEP_SECONDS, (amount) => {
      const levelsGained = grantExperience(this.gameState, amount)
      if (this.gameState.run.phase === 'playing' && levelsGained > 0) {
        this.enqueueLevelUpFlows(levelsGained)
      }
    }, (pickup) => {
      this.collectedGearPickups.push({ ...pickup })
      this.enqueueGearPickupFlow(pickup)
    })
    updateSkillEffects(this.gameState, FIXED_STEP_SECONDS)
  }

  private collectFloorPickupsAt(x: number, y: number): void {
    const pickups = this.gameState.pickups
    this.gameState.pickups = []
    for (const pickup of pickups) {
      pickup.x = x
      pickup.y = y
      if (pickup.kind === 'xp') {
        const levelsGained = grantExperience(this.gameState, pickup.xpAmount)
        if (levelsGained > 0) {
          this.enqueueLevelUpFlows(levelsGained)
        }
      } else {
        this.collectedGearPickups.push({ ...pickup })
        this.enqueueGearPickupFlow(pickup)
      }
    }
  }

  private beginFloorTransition(
    stairs: NonNullable<GameState['stairs']>,
  ): void {
    if (this.gameState.floorTransition || this.gameState.run.phase !== 'playing') {
      return
    }
    this.gameState.floorTransition = {
      remainingSeconds: FLOOR_TRANSITION_SECONDS,
      fromFloor: this.gameState.run.floor ?? stairs.floorNumber,
      toFloor: (this.gameState.run.floor ?? stairs.floorNumber) + 1,
      isFinal: stairs.isFinal,
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
    this.gameState.run.floor = transition.toFloor
    this.transitionTo('playing')
  }

  private transitionTo(nextPhase: RunPhase): void {
    transitionRunPhase(this.gameState, nextPhase, () => {
      this.notifyStateChanged()
    })
  }

  private enqueueLevelUpFlows(levelsGained: number): void {
    for (let index = 0; index < levelsGained; index += 1) {
      this.choiceFlows.push({
        type: 'level-up',
        level: this.gameState.player.level - levelsGained + index + 1,
        choices: generateUpgradeChoices(
          this.gameState,
          UPGRADE_CHOICES_PER_LEVEL,
          this.random,
        ),
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
    if (
      this.choiceFlows.length > 0 &&
      this.gameState.run.phase === 'playing'
    ) {
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

  private notifyStateChanged(): void {
    for (const listener of this.listeners) {
      listener(this.gameState)
    }
  }
}

export function createGame(config: RunConfig): Game {
  return new Game(config)
}
