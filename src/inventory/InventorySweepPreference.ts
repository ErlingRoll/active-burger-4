import { Rarity } from '../content/rarity/Rarity'

/**
 * The rarity ceiling a salvage sweep stops at.
 *
 * Common, uncommon or rare. Epic and legendary are deliberately not on offer:
 * a sweep is for the catch a player accumulates faster than they can look at,
 * and an epic is worth a decision of its own.
 */
export type SalvageSweepRarity =
  | typeof Rarity.Common
  | typeof Rarity.Uncommon
  | typeof Rarity.Rare

export const SALVAGE_SWEEP_RARITIES = [
  Rarity.Common,
  Rarity.Uncommon,
  Rarity.Rare,
] as const satisfies readonly SalvageSweepRarity[]

export const DEFAULT_SALVAGE_SWEEP_RARITY: SalvageSweepRarity = Rarity.Common

export function isSalvageSweepRarity(value: unknown): value is SalvageSweepRarity {
  return SALVAGE_SWEEP_RARITIES.some((rarity) => rarity === value)
}

const STORAGE_KEY = 'active-burger-4:salvage-sweep-rarity'

/**
 * The ceiling the player last chose, so it does not have to be chosen again
 * next session. A per-device convenience rather than a server setting: it
 * changes what the next sweep offers, never what the player owns.
 */
export function readSalvageSweepRarity(): SalvageSweepRarity {
  if (typeof window === 'undefined') {
    return DEFAULT_SALVAGE_SWEEP_RARITY
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isSalvageSweepRarity(stored) ? stored : DEFAULT_SALVAGE_SWEEP_RARITY
  } catch (error: unknown) {
    console.warn('Unable to read the salvage sweep rarity from local storage.', error)
    return DEFAULT_SALVAGE_SWEEP_RARITY
  }
}

export function persistSalvageSweepRarity(rarity: SalvageSweepRarity): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, rarity)
  } catch (error: unknown) {
    console.warn('Unable to persist the salvage sweep rarity to local storage.', error)
  }
}
