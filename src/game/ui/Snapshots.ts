import {
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from '../../content/progression/XpBalance'
import type { GameState } from '../state/GameState'
import type { RunPhase } from '../state/RunPhase'

/** Narrow, immutable run data intended for screen-space UI consumers. */
export interface RunHudSnapshot {
  readonly phase: RunPhase
  readonly hp: number
  readonly maxHp: number
  readonly level: number
  readonly xp: number
  readonly xpRequired: number
  readonly xpProgress: number
  readonly elapsedTime: number
  readonly killCount: number
}

export type GameUiSnapshot = RunHudSnapshot

/** Immutable data retained by the results screen after a run ends. */
export interface RunResultSnapshot {
  readonly phase: RunPhase
  readonly elapsedTime: number
  readonly level: number
  readonly xp: number
  readonly killCount: number
}

export function createUiSnapshot(state: GameState): GameUiSnapshot {
  const currentThreshold = xpRequiredForLevel(state.player.level)
  const xpRequired = xpRequiredForNextLevel(state.player.level)
  const thresholdSpan = Math.max(1, xpRequired - currentThreshold)
  const xpProgress = Math.min(
    1,
    Math.max(
      0,
      (state.player.xp - currentThreshold) / thresholdSpan,
    ),
  )

  return Object.freeze({
    phase: state.run.phase,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    level: state.player.level,
    xp: state.player.xp,
    xpRequired,
    xpProgress,
    elapsedTime: state.time,
    killCount: state.run.killCount,
  })
}

export function createRunResultSnapshot(
  state: GameState,
): RunResultSnapshot {
  return Object.freeze({
    phase: state.run.phase,
    elapsedTime: state.time,
    level: state.player.level,
    xp: state.player.xp,
    killCount: state.run.killCount,
  })
}
