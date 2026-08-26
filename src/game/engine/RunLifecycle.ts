import { isValidRunPhaseTransition } from '../state/RunPhase'
import type { RunPhase } from '../state/RunPhase'
import type { GameState } from '../state/GameState'

export function transitionRunPhase(
  state: GameState,
  nextPhase: RunPhase,
  notify: () => void,
): void {
  const currentPhase = state.run.phase

  if (!isValidRunPhaseTransition(currentPhase, nextPhase)) {
    throw new Error(`Invalid run phase transition: ${currentPhase} -> ${nextPhase}`)
  }

  state.run.phase = nextPhase
  state.paused = nextPhase === 'paused'
  notify()
}
