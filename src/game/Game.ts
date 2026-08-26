import { createEntityIdAllocator } from './ids'
import type {
  EnemyDefinitionId,
  EntityId,
  EntityIdAllocator,
} from './ids'
import { getEnemyDefinition, SLIME_DEFINITION_ID } from '../content/enemies/Enemies'
import {
  BASIC_BOLT_DEFINITION_ID,
  getProjectileDefinition,
} from '../content/projectiles/Projectiles'
import { Random } from './random/Random'
import type { RandomSource } from './random/Random'
import { isValidRunPhaseTransition } from './state/RunPhase'
import type { RunPhase } from './state/RunPhase'
import { findNearestEnemy } from './combat/Targeting'
import { SpawnDirector } from './spawning/SpawnDirector'
import {
  XP_BALANCE,
  xpRequiredForNextLevel,
} from '../content/progression/XpBalance'
import type {
  DamageEvent,
  EnemyState,
  GameState,
  PickupState,
  PlayerState,
  ProjectileState,
  RunConfig,
} from './state/GameState'

/** Simulation ticks run at a fixed rate, independent of render FPS. */
export const FIXED_STEP_SECONDS = 1 / 60

export interface WorldPosition {
  x: number
  y: number
}

/**
 * Upper bound on the elapsed time consumed from a single `update()` call.
 * Without this cap, a backgrounded/inactive browser tab resuming after a
 * long pause would attempt to run thousands of catch-up ticks at once (see
 * PLAN.md section 13).
 */
const MAX_FRAME_SECONDS = 0.25

function createInitialPlayerState(id: EntityId): PlayerState {
  return {
    id,
    x: 0,
    y: 0,
    radius: 16,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    movementSpeed: 200,
    attackDamage: 10,
    attackSpeed: 1,
    attackRange: 50,
    attackCooldownRemaining: 0,
    targetId: undefined,
  }
}

/**
 * Renderer-independent game simulation. `Game` owns the run's state, its
 * deterministic RNG, and its entity ID allocator, and advances on a fixed
 * timestep regardless of how irregular the caller's frame deltas are. It has
 * no dependency on React, PixiJS, the DOM, storage, or the network, so it can
 * run headlessly (for example in unit tests or future balance tooling).
 */
export class Game {
  readonly random: RandomSource

  private readonly idAllocator: EntityIdAllocator
  private readonly gameState: GameState
  readonly spawnDirector: SpawnDirector
  private accumulatedSeconds = 0
  private resumePhase: RunPhase | undefined

  constructor(config: RunConfig) {
    this.idAllocator = createEntityIdAllocator()
    this.random = new Random(config.seed)
    this.spawnDirector = new SpawnDirector(this.random)

    this.gameState = {
      run: { phase: 'loading', seed: config.seed, killCount: 0 },
      player: createInitialPlayerState(this.idAllocator.createEntityId()),
      enemies: [],
      projectiles: [],
      pickups: [],
      summons: [],
      time: 0,
      tick: 0,
      paused: false,
    }

    // A freshly created run has nothing left to load yet, so it moves
    // straight into "playing" through the same validated transition used by
    // every other phase change.
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

  /**
   * Advances the simulation by `rawDeltaSeconds` of wall-clock time using a
   * fixed-timestep accumulator: any number of `FIXED_STEP_SECONDS` ticks are
   * run to consume the accumulated time, and the remainder carries over to
   * the next call. This keeps simulation results independent of the
   * caller's actual frame rate.
   */
  update(rawDeltaSeconds: number): void {
    // Explicit pause and level-up are distinct phases, but both suspend all
    // active simulation systems while they await a caller action.
    if (this.gameState.run.phase !== 'playing') {
      return
    }

    const clampedDelta = Math.min(Math.max(rawDeltaSeconds, 0), MAX_FRAME_SECONDS)
    this.accumulatedSeconds += clampedDelta

    while (
      this.accumulatedSeconds >= FIXED_STEP_SECONDS &&
      this.gameState.run.phase === 'playing'
    ) {
      this.step()
      this.accumulatedSeconds -= FIXED_STEP_SECONDS
    }

    // Wall-clock time accumulated in the frame that triggered level-up must
    // not become catch-up time after the future choice resumes the run.
    if (this.gameState.run.phase !== 'playing') {
      this.accumulatedSeconds = 0
    }
  }

  /** Pauses the run, remembering the phase to return to on `resume()`. */
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

  /** Runs a single fixed-size simulation tick. */
  private step(): void {
    this.gameState.tick += 1
    this.gameState.time += FIXED_STEP_SECONDS

    // Keep this order explicit: all decisions happen before projectile
    // movement, collision produces queued damage, and cleanup is last.
    this.spawnEnemies()
    this.updateAttackCooldown()
    this.updateEnemyChase()
    this.resolvePlayerTarget()
    this.spawnBasicBoltIfReady()
    this.updateProjectiles()
    const damageEvents = this.collectProjectileDamage()
    this.applyDamageEvents(damageEvents)
    this.removeDeadEntities()
    this.updatePickups()
  }

  /**
   * Adds a Slime at an explicit world position. Spawns are commands owned by
   * the simulation, so callers do not need to construct or mutate state
   * objects directly.
   */
  spawnSlime(position: WorldPosition): EntityId {
    const definition = getEnemyDefinition(SLIME_DEFINITION_ID)
    return this.spawnEnemy(definition.id, position)
  }

  spawnEnemy(
    definitionId: EnemyDefinitionId,
    position: WorldPosition,
  ): EntityId {
    const definition = getEnemyDefinition(definitionId)
    const enemy: EnemyState = {
      id: this.idAllocator.createEntityId(),
      definitionId: definition.id,
      x: position.x,
      y: position.y,
      radius: definition.radius,
      hp: definition.maxHp,
      maxHp: definition.maxHp,
      speed: definition.speed,
      contactDamage: definition.contactDamage,
      xpReward: definition.xpReward,
      targetId: this.gameState.player.id,
    }

    this.gameState.enemies.push(enemy)
    return enemy.id
  }

  /** Adds a pickup through the same entity allocator used by enemy drops. */
  spawnXpPickup(position: WorldPosition, xpAmount: number): EntityId {
    const pickup: PickupState = {
      id: this.idAllocator.createEntityId(),
      x: position.x,
      y: position.y,
      xpAmount,
      radius: XP_BALANCE.pickupRadius,
      attractionRadius: XP_BALANCE.pickupAttractionRadius,
      attractionSpeed: XP_BALANCE.pickupAttractionSpeed,
    }

    this.gameState.pickups.push(pickup)
    return pickup.id
  }

  private spawnEnemies(): void {
    const requests = this.spawnDirector.update(
      this.gameState,
      FIXED_STEP_SECONDS,
    )
    for (const request of requests) {
      this.spawnEnemy(request.definitionId, request)
    }
  }

  private updateEnemyChase(): void {
    const player = this.gameState.player

    for (const enemy of this.gameState.enemies) {
      const offsetX = player.x - enemy.x
      const offsetY = player.y - enemy.y
      const distance = Math.hypot(offsetX, offsetY)
      const contactRange = player.radius + enemy.radius
      const travelDistance = enemy.speed * FIXED_STEP_SECONDS

      if (distance <= contactRange || distance === 0) {
        continue
      }

      const distanceToContact = distance - contactRange
      const movementDistance = Math.min(travelDistance, distanceToContact)
      const movementRatio = movementDistance / distance

      enemy.x += offsetX * movementRatio
      enemy.y += offsetY * movementRatio
    }
  }

  private updateAttackCooldown(): void {
    const player = this.gameState.player
    player.attackCooldownRemaining = Math.max(
      0,
      player.attackCooldownRemaining - FIXED_STEP_SECONDS,
    )
  }

  private resolvePlayerTarget(): void {
    const player = this.gameState.player
    const target = findNearestEnemy(
      {
        originX: player.x,
        originY: player.y,
        maxRange: player.attackRange,
      },
      this.gameState,
    )

    player.targetId = target?.id
  }

  private spawnBasicBoltIfReady(): void {
    const player = this.gameState.player
    const targetId = player.targetId

    if (targetId === undefined || player.attackCooldownRemaining > 0) {
      return
    }

    const target = this.gameState.enemies.find(
      (enemy) => enemy.id === targetId && enemy.hp > 0,
    )
    if (!target) {
      player.targetId = undefined
      return
    }

    const definition = getProjectileDefinition(BASIC_BOLT_DEFINITION_ID)
    const offsetX = target.x - player.x
    const offsetY = target.y - player.y
    const distance = Math.hypot(offsetX, offsetY)
    const directionX = distance === 0 ? 0 : offsetX / distance
    const directionY = distance === 0 ? 0 : offsetY / distance

    const projectile: ProjectileState = {
      id: this.idAllocator.createEntityId(),
      ownerId: player.id,
      definitionId: definition.id,
      x: player.x,
      y: player.y,
      velocityX: directionX * definition.speed,
      velocityY: directionY * definition.speed,
      radius: definition.radius,
      damage: player.attackDamage,
      remainingLifetime: definition.lifetime,
    }

    this.gameState.projectiles.push(projectile)
    player.attackCooldownRemaining =
      player.attackSpeed > 0 ? 1 / player.attackSpeed : Number.POSITIVE_INFINITY
  }

  private updateProjectiles(): void {
    for (const projectile of this.gameState.projectiles) {
      projectile.x += projectile.velocityX * FIXED_STEP_SECONDS
      projectile.y += projectile.velocityY * FIXED_STEP_SECONDS
      projectile.remainingLifetime -= FIXED_STEP_SECONDS
    }
  }

  private collectProjectileDamage(): DamageEvent[] {
    const damageEvents: DamageEvent[] = []
    const projectiles = [...this.gameState.projectiles].sort(
      (left, right) => left.id - right.id,
    )
    const enemies = [...this.gameState.enemies]
      .filter((enemy) => enemy.hp > 0)
      .sort((left, right) => left.id - right.id)

    for (const projectile of projectiles) {
      if (projectile.remainingLifetime <= 0) {
        continue
      }

      let hitEnemy: EnemyState | undefined
      let hitDistanceSquared = Number.POSITIVE_INFINITY

      for (const enemy of enemies) {
        const offsetX = enemy.x - projectile.x
        const offsetY = enemy.y - projectile.y
        const collisionDistance = enemy.radius + projectile.radius
        const distanceSquared = offsetX * offsetX + offsetY * offsetY

        if (distanceSquared > collisionDistance * collisionDistance) {
          continue
        }

        if (
          distanceSquared < hitDistanceSquared ||
          (distanceSquared === hitDistanceSquared &&
            (hitEnemy === undefined || enemy.id < hitEnemy.id))
        ) {
          hitEnemy = enemy
          hitDistanceSquared = distanceSquared
        }
      }

      if (hitEnemy) {
        damageEvents.push({
          sourceId: projectile.ownerId,
          targetId: hitEnemy.id,
          amount: projectile.damage,
          damageType: 'physical',
        })
        projectile.remainingLifetime = 0
      }
    }

    return damageEvents.sort((left, right) => {
      const targetOrder = left.targetId - right.targetId
      if (targetOrder !== 0) {
        return targetOrder
      }

      const leftSourceId = left.sourceId ?? Number.MAX_SAFE_INTEGER
      const rightSourceId = right.sourceId ?? Number.MAX_SAFE_INTEGER
      return leftSourceId - rightSourceId
    })
  }

  private applyDamageEvents(events: readonly DamageEvent[]): void {
    for (const event of events) {
      const enemy = this.gameState.enemies.find(
        (candidate) => candidate.id === event.targetId && candidate.hp > 0,
      )
      if (!enemy) {
        continue
      }

      enemy.hp = Math.max(0, enemy.hp - Math.max(0, event.amount))
    }
  }

  private removeDeadEntities(): void {
    const livingEnemies: EnemyState[] = []
    let killCount = 0
    for (const enemy of this.gameState.enemies) {
      if (enemy.hp > 0) {
        livingEnemies.push(enemy)
      } else {
        killCount += 1
        // Create the drop before removing the enemy so every observed death
        // produces exactly one pickup during this cleanup pass.
        this.spawnXpPickup({ x: enemy.x, y: enemy.y }, enemy.xpReward)
      }
    }
    this.gameState.enemies = livingEnemies
    this.gameState.run.killCount += killCount
    this.gameState.projectiles = this.gameState.projectiles.filter(
      (projectile) => projectile.remainingLifetime > 0,
    )
  }

  private updatePickups(): void {
    const player = this.gameState.player
    const pickups = [...this.gameState.pickups].sort(
      (left, right) => left.id - right.id,
    )
    const collectedIds = new Set<EntityId>()

    for (const pickup of pickups) {
      const offsetX = player.x - pickup.x
      const offsetY = player.y - pickup.y
      const distance = Math.hypot(offsetX, offsetY)
      const contactRange = player.radius + pickup.radius

      if (distance <= contactRange || distance === 0) {
        this.grantExperience(pickup.xpAmount)
        collectedIds.add(pickup.id)
        continue
      }

      if (distance > pickup.attractionRadius) {
        continue
      }

      const movementDistance = Math.min(
        pickup.attractionSpeed * FIXED_STEP_SECONDS,
        distance - contactRange,
      )
      const movementRatio = movementDistance / distance
      pickup.x += offsetX * movementRatio
      pickup.y += offsetY * movementRatio

      if (
        Math.hypot(player.x - pickup.x, player.y - pickup.y) <= contactRange
      ) {
        this.grantExperience(pickup.xpAmount)
        collectedIds.add(pickup.id)
      }

      // Once level-up is reached, leave remaining pickups in state. They will
      // be collected after the future upgrade flow resumes the run.
      if (this.gameState.run.phase !== 'playing') {
        break
      }
    }

    this.gameState.pickups = this.gameState.pickups.filter(
      (pickup) => !collectedIds.has(pickup.id),
    )
  }

  private grantExperience(amount: number): void {
    const experience = Number.isFinite(amount) ? Math.max(0, amount) : 0
    this.gameState.player.xp += experience

    while (
      this.gameState.player.xp >=
      xpRequiredForNextLevel(this.gameState.player.level)
    ) {
      this.gameState.player.level += 1
    }

    if (
      this.gameState.player.level > 1 &&
      this.gameState.run.phase === 'playing'
    ) {
      this.transitionTo('level-up')
    }
  }

  private transitionTo(nextPhase: RunPhase): void {
    const currentPhase = this.gameState.run.phase

    if (!isValidRunPhaseTransition(currentPhase, nextPhase)) {
      throw new Error(`Invalid run phase transition: ${currentPhase} -> ${nextPhase}`)
    }

    this.gameState.run.phase = nextPhase
    this.gameState.paused = nextPhase === 'paused'
  }
}

export function createGame(config: RunConfig): Game {
  return new Game(config)
}
