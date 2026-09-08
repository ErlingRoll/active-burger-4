import { MAX_TIME_SCALE, MIN_TIME_SCALE } from '../game'

/**
 * The development-only simulation time scale, remembered across reloads.
 *
 * Shared by `GameCanvas`, which applies the stored value when a run starts, and
 * `DevelopmentMenu`, which writes it. The stored value is validated on read:
 * it comes from localStorage and a hand-edited or stale entry must not put the
 * simulation into an unrunnable time scale.
 */
const DEVELOPMENT_TIME_SCALE_STORAGE_KEY = 'active-burger:development-time-scale'

export function getStoredDevelopmentTimeScale(): number | null {
  const storedValue = window.localStorage.getItem(DEVELOPMENT_TIME_SCALE_STORAGE_KEY)
  if (storedValue === null) {
    return null
  }
  const value = Number(storedValue)
  return Number.isFinite(value) && value >= MIN_TIME_SCALE && value <= MAX_TIME_SCALE
    ? value
    : null
}

export function storeDevelopmentTimeScale(value: number): void {
  window.localStorage.setItem(DEVELOPMENT_TIME_SCALE_STORAGE_KEY, value.toString())
}
