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
import {
  generateUpgradeChoices,
  UPGRADE_CHOICES_PER_LEVEL,
} from './upgrades/UpgradeChoices'
import type {
  UpgradeChoice,
  UpgradeId,
} from '../content/upgrades/Upgrades'
import {
  FixedTimestepClock,
  FIXED_STEP_SECONDS,
} from './engine/GameClock'
import { transitionRunPhase } from './engine/RunLifecycle'
import { assertValidContent } from '../content/validation'
import {
  applyDamageEvents,
  collectProjectileDamage,
  removeDeadEntities,
  resolvePlayerTarget,
  spawnBasicBoltIfReady,
  updateAttackCooldown,
  updateEnemyChase,
  updateProjectiles,
} from './systems/combat/CombatSystem'
import {
  grantExperience,
  updatePickups,
} from './systems/experience/ExperienceSystem'
import {
  createInitialPlayerState,
  spawnEnemy,
  spawnSlime,
  spawnXpPickup,
  updateEnemySpawns,
} from './systems/spawning/SpawningSystem'
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

export { FIXED_STEP_SECONDS } from './engine/GameClock'
export type { WorldPosition } from './systems/spawning/SpawningSystem'
export type {
  GameUiSnapshot,
  RunHudSnapshot,
  RunResultSnapshot,
} from './ui/Snapshots'

export type { RunConfig } from './state/GameState'

export type GameStateListener = (state: Readonly<GameState>) => void

/**
 * Renderer-independent game simulation facade. The run owns its state, seeded
 * random source, entity IDs, and system update order; domain responsibilities
 * are implemented by the focused modules under `game/systems`.
 */
export class Game {
  readonly random: RandomSource

  private readonly idAllocator: EntityIdAllocator
  private readonly gameState: GameState
  readonly spawnDirector: SpawnDirector
  private readonly clock = new FixedTimestepClock()
  private resumePhase: RunPhase | undefined
  private pendingChoices: UpgradeChoice[] = []
  private pendingLevelUps = 0
  private readonly listeners = new Set<GameStateListener>()

  constructor(config: RunConfig) {
    assertValidContent()
    this.idAllocator = createEntityIdAllocator()
    this.random = new Random(config.seed)
    this.spawnDirector = new SpawnDirector(this.random)

    this.gameState = {
      run: {
        phase: 'loading',
        seed: config.seed,
        killCount: 0,
        selectedUpgradeIds: [],
      },
      player: createInitialPlayerState(this.idAllocator.createEntityId()),
      enemies: [],
      projectiles: [],
      pickups: [],
      summons: [],
      effects: [],
      time: 0,
      tick: 0,
      paused: false,
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

  getUiSnapshot(): GameUiSnapshot {
    return createUiSnapshot(this.gameState)
  }

  getRunResultSnapshot(): RunResultSnapshot {
    return createRunResultSnapshot(this.gameState)
  }

  /**
   * Returns a snapshot of the choices awaiting selection. An empty array means
   * the run is not currently waiting for an upgrade.
   */
  getPendingUpgradeChoices(): readonly UpgradeChoice[] {
    return this.pendingChoices.map((choice) => ({ ...choice }))
  }

  get upgradeChoices(): readonly UpgradeChoice[] {
    return this.getPendingUpgradeChoices()
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  selectUpgrade(choice: UpgradeChoice | UpgradeId): boolean {
    if (this.gameState.run.phase !== 'level-up') {
      return false
    }

    const upgradeId = typeof choice === 'string' ? choice : choice.upgradeId
    if (
      !this.pendingChoices.some(
        (candidate) => candidate.upgradeId === upgradeId,
      )
    ) {
      return false
    }

    applyUpgrade(this.gameState, upgradeId)
    this.gameState.run.selectedUpgradeIds.push(upgradeId)

    this.pendingChoices = []
    this.pendingLevelUps -= 1
    if (this.pendingLevelUps > 0) {
      this.pendingChoices = generateUpgradeChoices(
        this.gameState,
        UPGRADE_CHOICES_PER_LEVEL,
        this.random,
      )
      this.notifyStateChanged()
    } else {
      this.transitionTo('playing')
    }
    return true
  }

  /**
   * Advances the simulation with a fixed-timestep accumulator. Suspended
   * phases do not consume wall-clock time or run any active systems.
   */
  update(rawDeltaSeconds: number): void {
    this.clock.advance(
      rawDeltaSeconds,
      () => this.gameState.run.phase === 'playing',
      () => this.step(),
    )
  }

  /** Pauses the run, remembering the phase to return to on resume(). */
  pause(): void {
    if (this.gameState.run.phase !== 'playing') {
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
  ): EntityId {
    return spawnEnemy(
      this.gameState,
      this.idAllocator,
      definitionId,
      position,
    )
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

  private step(): void {
    this.gameState.tick += 1
    this.gameState.time += FIXED_STEP_SECONDS

    // Keep this order explicit: decisions happen before projectile movement,
    // collision produces queued damage, and cleanup is last.
    updateEnemySpawns(
      this.gameState,
      this.spawnDirector,
      this.idAllocator,
      FIXED_STEP_SECONDS,
    )
    updateAttackCooldown(this.gameState, FIXED_STEP_SECONDS)
    updateSkillCooldowns(this.gameState, FIXED_STEP_SECONDS)
    updateEnemyChase(this.gameState, FIXED_STEP_SECONDS)
    resolvePlayerTarget(this.gameState)
    spawnBasicBoltIfReady(this.gameState, this.idAllocator)
    updateProjectiles(this.gameState, FIXED_STEP_SECONDS)
    const damageEvents = [
      ...collectProjectileDamage(this.gameState),
      ...collectSkillDamage(this.gameState, this.idAllocator),
    ]
    applyDamageEvents(this.gameState, damageEvents)
    removeDeadEntities(this.gameState, (position, xpAmount) => {
      this.spawnXpPickup(position, xpAmount)
    })
    updatePickups(this.gameState, FIXED_STEP_SECONDS, (amount) => {
      const levelsGained = grantExperience(this.gameState, amount)
      if (this.gameState.run.phase === 'playing' && levelsGained > 0) {
        this.pendingLevelUps = levelsGained
        this.pendingChoices = generateUpgradeChoices(
          this.gameState,
          UPGRADE_CHOICES_PER_LEVEL,
          this.random,
        )
        this.transitionTo('level-up')
      }
    })
    updateSkillEffects(this.gameState, FIXED_STEP_SECONDS)
  }

  private transitionTo(nextPhase: RunPhase): void {
    transitionRunPhase(this.gameState, nextPhase, () => {
      this.notifyStateChanged()
    })
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
