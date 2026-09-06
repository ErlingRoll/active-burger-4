/**
 * Versioned checkpoint DTO for exact game simulation serialization and
 * restoration. Every mutable field required for deterministic replay is
 * captured; the format is JSON-safe (no Infinity, NaN, undefined at
 * top-level values, or circular references).
 */
import type { GameState, GearPickupState } from '../state/GameState'
import type { PendingChoiceFlow } from '../choices/ChoiceFlows'
import type { RunPhase } from '../state/RunPhase'
import type { RunConfig } from '../state/GameState'
import {
  isRunModeId,
  isRunPreparationSnapshot,
} from '../RunModes'
import { isCharacterBuildSnapshot } from '../../characters/CharacterSnapshots'

/** Current checkpoint format version. Bump on breaking schema changes. */
export const CHECKPOINT_VERSION = 1
const RUN_PHASES = new Set([
  'loading',
  'playing',
  'level-up',
  'floor-transition',
  'paused',
  'victory',
  'defeat',
  'results',
])

export interface SpawnDirectorSnapshot {
  threatBudget: number
  pendingEntryIndex: number | null
  introducedEntryIndices: number[]
  reinforcementMode?: boolean
  reinforcementCooldownRemaining?: number
}

export interface GameCheckpoint {
  /** Schema version for forward-compatibility rejection. */
  version: typeof CHECKPOINT_VERSION

  /** The RunConfig used to create the Game (needed to reconstruct derived state). */
  runConfig: RunConfig

  /** Complete mutable GameState. */
  gameState: GameState

  /** Three deterministic RNG internal states (mulberry32 uint32). */
  rngState: number
  gearRngState: number
  synergyRngState: number

  /** SpawnDirector private mutable state. */
  spawnDirector: SpawnDirectorSnapshot

  /** Entity ID allocator cursor. */
  nextEntityId: number

  /** FixedTimestepClock accumulator. */
  clockAccumulatedSeconds: number

  /** Game-level private fields. */
  currentTimeScale: number
  resumePhase: RunPhase | null
  choiceFlows: PendingChoiceFlow[]
  collectedGearPickups: GearPickupState[]
}

/**
 * Type guard that validates the checkpoint envelope. Returns true only when
 * the value looks like a checkpoint object with a known version number.
 */
export function isValidCheckpoint(value: unknown): value is GameCheckpoint {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }
  const record = value as Record<string, unknown>
  if (
    record.version !== CHECKPOINT_VERSION ||
    !isFiniteInteger(record.rngState, 0, 0xffffffff) ||
    !isFiniteInteger(record.gearRngState, 0, 0xffffffff) ||
    !isFiniteInteger(record.synergyRngState, 0, 0xffffffff) ||
    !isFiniteInteger(record.nextEntityId, 1) ||
    !isFiniteNumber(record.clockAccumulatedSeconds, 0) ||
    !isFiniteNumber(record.currentTimeScale, 0.1) ||
    (record.resumePhase !== null &&
      (typeof record.resumePhase !== 'string' || !RUN_PHASES.has(record.resumePhase))) ||
    !isRecord(record.runConfig) ||
    !isFiniteNumberValue(record.runConfig.seed) ||
    (record.runConfig.modeId !== undefined && !isRunModeId(record.runConfig.modeId)) ||
    (record.runConfig.selectedDungeonMaxFloor !== undefined &&
      !isFiniteInteger(record.runConfig.selectedDungeonMaxFloor, 1)) ||
    (record.runConfig.preparation !== undefined &&
      !isRunPreparationSnapshot(record.runConfig.preparation)) ||
    (record.runConfig.champion !== undefined &&
      !isCharacterBuildSnapshot(record.runConfig.champion)) ||
    !isRecord(record.gameState) ||
    !isRecord(record.spawnDirector) ||
    !Array.isArray(record.choiceFlows) ||
    !Array.isArray(record.collectedGearPickups)
  ) {
    return false
  }
  const gameState = record.gameState
  const run = gameState.run
  const player = gameState.player
  const spawnDirector = record.spawnDirector
  return isRecord(run) &&
    typeof run.phase === 'string' &&
    RUN_PHASES.has(run.phase) &&
    (run.modeId === undefined || isRunModeId(run.modeId)) &&
    isRecord(player) &&
    Array.isArray(gameState.enemies) &&
    Array.isArray(gameState.projectiles) &&
    Array.isArray(gameState.pickups) &&
    Array.isArray(gameState.summons) &&
    Array.isArray(gameState.effects) &&
    isFiniteNumber(gameState.time, 0) &&
    isFiniteInteger(gameState.tick, 0) &&
    typeof gameState.paused === 'boolean' &&
    isFiniteNumber(spawnDirector.threatBudget, 0) &&
    (spawnDirector.pendingEntryIndex === null ||
      isFiniteInteger(spawnDirector.pendingEntryIndex, 0)) &&
    Array.isArray(spawnDirector.introducedEntryIndices) &&
    spawnDirector.introducedEntryIndices.every((index) => isFiniteInteger(index, 0)) &&
    (spawnDirector.reinforcementMode === undefined ||
      typeof spawnDirector.reinforcementMode === 'boolean') &&
    (spawnDirector.reinforcementCooldownRemaining === undefined ||
      isFiniteNumber(spawnDirector.reinforcementCooldownRemaining, 0))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum
}

function isFiniteNumberValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFiniteInteger(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
}
