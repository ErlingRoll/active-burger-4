import { createEntityIdAllocator } from './ids'
import type { EntityId, EntityIdAllocator } from './ids'
import { Random } from './random/Random'
import type { RandomSource } from './random/Random'
import { isValidRunPhaseTransition } from './state/RunPhase'
import type { RunPhase } from './state/RunPhase'
import type { GameState, PlayerState, RunConfig } from './state/GameState'

/** Simulation ticks run at a fixed rate, independent of render FPS. */
export const FIXED_STEP_SECONDS = 1 / 60

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
  private accumulatedSeconds = 0
  private resumePhase: RunPhase | undefined

  constructor(config: RunConfig) {
    this.idAllocator = createEntityIdAllocator()
    this.random = new Random(config.seed)

    this.gameState = {
      run: { phase: 'loading', seed: config.seed },
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
    if (this.gameState.paused) {
      return
    }

    const clampedDelta = Math.min(Math.max(rawDeltaSeconds, 0), MAX_FRAME_SECONDS)
    this.accumulatedSeconds += clampedDelta

    while (this.accumulatedSeconds >= FIXED_STEP_SECONDS) {
      this.step()
      this.accumulatedSeconds -= FIXED_STEP_SECONDS
    }
  }

  /** Pauses the run, remembering the phase to return to on `resume()`. */
  pause(): void {
    if (this.gameState.paused) {
      return
    }

    this.resumePhase = this.gameState.run.phase
    this.transitionTo('paused')
  }

  /** Resumes a paused run, returning to the phase active before pausing. */
  resume(): void {
    if (!this.gameState.paused) {
      return
    }

    this.transitionTo(this.resumePhase ?? 'playing')
    this.resumePhase = undefined
  }

  /** Runs a single fixed-size simulation tick. */
  private step(): void {
    this.gameState.tick += 1
    this.gameState.time += FIXED_STEP_SECONDS

    // Gameplay systems (see PLAN.md section 14 for the intended update
    // order) are introduced starting with Milestone 3 and layer in here.
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
