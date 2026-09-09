import type { BasicProfileDto, SettingsDto } from '../persistence'
import type { MetaProgressionSnapshot } from '../meta'
import type { CharacterBuildSnapshot } from '../characters'
import type { RunModeId, RunPreparationSnapshot } from '../game'

/**
 * State shapes shared between `App` and the screens it renders.
 *
 * These describe the progress of an asynchronous operation the user can see —
 * whether the profile has loaded, whether a run reward reached the server —
 * so they are named rather than inlined, and shared rather than duplicated
 * per screen.
 */

/** The build identifier stamped onto every run result. */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION
export const RUN_GAME_VERSION = APP_VERSION ?? 'development'
export const DEFAULT_CHAMPION_NAME = 'My Champion'

export type PersistenceLoadState = 'loading' | 'ready' | 'error'

export interface PersistenceState {
  loadState: PersistenceLoadState
  settings: SettingsDto | null
  profile: BasicProfileDto | null
  error: string | null
}

export interface MetaProgressionState {
  loadState: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'
  snapshot: MetaProgressionSnapshot | null
  error: string | null
  purchaseState: 'idle' | 'purchasing'
  activePurchaseUnlockId: string | null
}

export interface RunRewardState {
  status: 'idle' | 'submitting' | 'saved' | 'error' | 'unavailable'
  essenceAwarded: number | null
  /**
   * Scrap the run's final loadout was worth.
   *
   * Written by the run's completion rather than by the Essence submission, and
   * carried through the later updates so the receipt can show both. `null`
   * until the completion answers, and zero for a run that ended in nothing.
   */
  scrapAwarded: number | null
  error: string | null
}

export interface StartRunOptions {
  modeId?: RunModeId
  preparation?: RunPreparationSnapshot
  champion?: CharacterBuildSnapshot
  championId?: string
  selectedDungeonMaxFloor?: number
}

/** Whether an in-progress run could be recovered from the server. */
export type RunLoadState = 'loading' | 'ready' | 'error' | 'unavailable'
/** Whether the latest write of run state reached the server. */
export type RunWriteState = 'idle' | 'saving' | 'saved' | 'error' | 'unavailable'
