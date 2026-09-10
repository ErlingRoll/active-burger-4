import {
  DEFAULT_DUNGEON_CONFIG,
  isValidCheckpoint,
  type GameCheckpoint,
  type RunResultSnapshot,
} from '../game'
import { DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID } from '../persistence'
import type { BasicProfileDto } from '../persistence'
import type { ChampionSnapshot } from '../characters'
import {
  calculateWorldModifierRewardMultiplier,
  getWorldModifierDefinitions,
  normalizeWorldModifierIds,
} from '../content/modifiers/WorldModifiers'
import {
  calculateEssenceReward,
  type EssenceRewardCalculation,
} from '../content/progression/EssenceRewards'

/**
 * Presentation helpers shared by the application's screens.
 *
 * These are pure and take an explicit `now` where they depend on the clock, so
 * a screen can render deterministically and each rule can be tested without a
 * DOM. They were previously private to `App.tsx`, which meant the screens that
 * used them could not be extracted or tested independently.
 */

export const DEFAULT_CONTRACT = {
  id: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  maxFloor: DEFAULT_DUNGEON_CONFIG.defaultMaxFloor,
  label: `${DEFAULT_DUNGEON_CONFIG.defaultMaxFloor} floors · Default`,
} as const

export const DUNGEON_MAX_FLOOR_CONTRACTS = [
  DEFAULT_CONTRACT,
  ...DEFAULT_DUNGEON_CONFIG.maximumFloorContracts.map((contract) => ({
    ...contract,
    label: `${contract.maxFloor} floors`,
  })),
]

export interface EssenceReceipt extends EssenceRewardCalculation {
  modifiers: ReturnType<typeof getWorldModifierDefinitions>
}

export function createEssenceReceipt(result: RunResultSnapshot): EssenceReceipt {
  const modifiers = getWorldModifierDefinitions(
    normalizeWorldModifierIds(result.worldModifierIds),
  )
  const modifierMultiplier = calculateWorldModifierRewardMultiplier(
    result.worldModifierIds,
  )
  const calculation = calculateEssenceReward(
    result.level,
    result.killCount,
    modifierMultiplier,
    result.outcome === 'victory',
  )
  return {
    ...calculation,
    modifiers,
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null &&
    'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Unable to access local persistence.'
}

export function isChampionExhausted(
  champion: ChampionSnapshot,
  now = Date.now(),
): boolean {
  return champion.exhaustionUntil !== null &&
    Date.parse(champion.exhaustionUntil) > now
}

export function formatChampionExhaustion(
  exhaustionUntil: string | null,
  now = Date.now(),
): string {
  if (!exhaustionUntil) {
    return 'Available'
  }
  const remainingMilliseconds = Date.parse(exhaustionUntil) - now
  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) {
    return 'Available'
  }
  const remainingHours = Math.floor(remainingMilliseconds / 3_600_000)
  const remainingMinutes = Math.ceil((remainingMilliseconds % 3_600_000) / 60_000)
  return `${remainingHours}h ${remainingMinutes}m remaining`
}

export function formatRevivalReduction(seconds: number): string {
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes}m`
}

export function parseGameCheckpoint(value: unknown): GameCheckpoint {
  if (!isValidCheckpoint(value)) {
    throw new Error('The saved dungeon checkpoint is invalid or unsupported.')
  }
  return value
}

export function createRunSeed(): number {
  const [seed] = crypto.getRandomValues(new Uint32Array(1))
  // getRandomValues always fills the buffer; the fallback only satisfies the
  // compiler under noUncheckedIndexedAccess.
  return seed ?? Date.now() >>> 0
}

export function isMaxFloorContractUnlocked(
  profile: BasicProfileDto,
  contractId: string,
  requiredUnlockId?: string,
): boolean {
  return contractId === DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID ||
    profile.unlockedDungeonMaxFloorIds.includes(contractId) ||
    (requiredUnlockId !== undefined &&
      profile.unlockedDungeonMaxFloorIds.includes(requiredUnlockId))
}
