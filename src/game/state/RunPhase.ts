/**
 * Explicit run state machine (PLAN.md section 16). The run is represented as
 * a single named phase instead of a collection of independent booleans, and
 * every transition is validated centrally so invalid combinations (for
 * example "paused" and "defeat" at once) cannot occur.
 */
export type RunPhase =
  | 'loading'
  | 'playing'
  | 'level-up'
  | 'paused'
  | 'victory'
  | 'defeat'
  | 'results'

const ALLOWED_RUN_PHASE_TRANSITIONS: Record<RunPhase, readonly RunPhase[]> = {
  loading: ['playing'],
  playing: ['paused', 'level-up', 'victory', 'defeat'],
  'level-up': ['playing', 'paused'],
  paused: ['playing', 'level-up'],
  victory: ['results'],
  defeat: ['results'],
  results: [],
}

export function isValidRunPhaseTransition(from: RunPhase, to: RunPhase): boolean {
  return ALLOWED_RUN_PHASE_TRANSITIONS[from].includes(to)
}
