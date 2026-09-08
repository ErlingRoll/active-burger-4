/**
 * Run mode identity, shared by the simulation and its content.
 *
 * Content such as the Abyss modifier registry must know which mode a run is in
 * without importing `src/game/`, so the identifier lives here. The run
 * preparation schema that surrounds it stays in `src/game/RunModes.ts`.
 */
export const DEFAULT_RUN_MODE_ID = 'dungeon' as const

export type RunModeId = 'dungeon' | 'infinite-abyss'

export function isRunModeId(value: unknown): value is RunModeId {
  return value === 'dungeon' || value === 'infinite-abyss'
}
