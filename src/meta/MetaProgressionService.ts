import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  XP_MULTIPLIER_MAX_LEVEL,
  getXpMultiplierForLevel,
} from '../content/progression/XpMultiplier'
import {
  STARTING_LEVEL_MAX_RANK,
  getStartingLevelForRank,
} from '../content/progression/StartingLevel'
import { DEFAULT_DUNGEON_MAX_FLOOR } from '../content/dungeons/Dungeons'
import { DEFAULT_SKILL_SLOT_COUNT } from '../game-config/skills'

export const SKILL_SLOT_UNLOCK_CATEGORY = 'skill-slot'
export const DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY = 'dungeon-max-floor'
export const DUNGEON_MAX_FLOOR_BONUS_PER_RANK = 5
export const DUNGEON_MAX_FLOOR_MAX_RANK = 4
export const REROLL_BASE_COST = 500
export const REROLL_COST_MULTIPLIER = 2
export const MAX_REROLL_LEVEL = 10

export interface MetaWallet {
  essenceBalance: number
  essenceEarned: number
  essenceSpent: number
  rerollLevel: number
}

export interface MetaUnlockDefinition {
  id: string
  category: string
  cost: number
  requiresUnlockId: string | null
  isStarter: boolean
  payload: Record<string, unknown>
}

export interface MetaProgressionSnapshot {
  wallet: MetaWallet
  definitions: MetaUnlockDefinition[]
  unlockedIds: string[]
  xpMultiplierLevel: number
  xpMultiplier: number
  startingLevelRank: number
  startingLevel: number
  skillSlotCount: number
  dungeonMaxFloorRank: number
  dungeonMaxFloorBonus: number
  dungeonMaxFloor: number
}

export interface MetaProgressionService {
  load(): Promise<MetaProgressionSnapshot>
  submitRunResult(input: MetaRunResultInput): Promise<MetaRunReward>
  purchaseUnlock(unlockId: string): Promise<MetaProgressionSnapshot>
  purchaseReroll(): Promise<MetaProgressionSnapshot>
}

export interface MetaRunResultInput {
  runId: string
  pendingResultId: string
  completedAt: string
  level: number
  killCount: number
  outcome: 'victory' | 'defeat'
  worldModifierIds: readonly string[]
}

export interface MetaRunReward {
  essenceAwarded: number
  essenceBalance: number
  wasProcessed: boolean
}

interface WalletRow {
  essence_balance: number
  essence_earned: number
  essence_spent: number
  reroll_balance: number
  rerolls_purchased: number
}

interface UnlockDefinitionRow {
  id: string
  category: string
  cost: number
  requires_unlock_id: string | null
  is_starter: boolean
  payload: Record<string, unknown>
}

interface UnlockRow {
  unlock_id: string
}

interface RunRewardRow {
  essence_awarded: number
  essence_balance: number
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWalletRow(value: unknown): value is WalletRow {
  return isRecord(value) &&
    'essence_balance' in value && typeof value.essence_balance === 'number' &&
    'essence_earned' in value && typeof value.essence_earned === 'number' &&
    'essence_spent' in value && typeof value.essence_spent === 'number' &&
    'reroll_balance' in value && typeof value.reroll_balance === 'number' &&
    'rerolls_purchased' in value && typeof value.rerolls_purchased === 'number'
}

function isUnlockDefinitionRow(value: unknown): value is UnlockDefinitionRow {
  return isRecord(value) &&
    'id' in value && typeof value.id === 'string' &&
    'category' in value && typeof value.category === 'string' &&
    'cost' in value && typeof value.cost === 'number' &&
    'requires_unlock_id' in value &&
    (value.requires_unlock_id === null || typeof value.requires_unlock_id === 'string') &&
    'is_starter' in value && typeof value.is_starter === 'boolean' &&
    'payload' in value && isRecord(value.payload)
}

function isUnlockRow(value: unknown): value is UnlockRow {
  return isRecord(value) &&
    'unlock_id' in value && typeof value.unlock_id === 'string'
}

function isRunRewardRow(value: unknown): value is RunRewardRow {
  return isRecord(value) &&
    'essence_awarded' in value && typeof value.essence_awarded === 'number' &&
    'essence_balance' in value && typeof value.essence_balance === 'number' &&
    'was_processed' in value && typeof value.was_processed === 'boolean'
}

function defaultWallet(): MetaWallet {
  return {
    essenceBalance: 0,
    essenceEarned: 0,
    essenceSpent: 0,
    rerollLevel: 0,
  }
}

export function getRerollPurchaseCost(rerollLevel: number): number {
  const purchaseCount = Number.isFinite(rerollLevel)
    ? Math.max(0, Math.floor(rerollLevel))
    : 0
  return Math.ceil(REROLL_BASE_COST * REROLL_COST_MULTIPLIER ** purchaseCount)
}

export function getXpMultiplierLevel(
  definitions: readonly MetaUnlockDefinition[],
  unlockedIds: readonly string[],
): number {
  const unlocked = new Set(unlockedIds)
  return Math.min(
    XP_MULTIPLIER_MAX_LEVEL,
    definitions.reduce((highestLevel, definition) => {
      if (definition.category !== 'xp-multiplier' || !unlocked.has(definition.id)) {
        return highestLevel
      }
      const level = definition.payload.level
      return typeof level === 'number' && Number.isInteger(level)
        ? Math.max(highestLevel, level)
        : highestLevel
    }, 0),
  )
}

export function getStartingLevelRank(
  definitions: readonly MetaUnlockDefinition[],
  unlockedIds: readonly string[],
): number {
  const unlocked = new Set(unlockedIds)
  return Math.min(
    STARTING_LEVEL_MAX_RANK,
    definitions.reduce((highestRank, definition) => {
      if (definition.category !== 'starting-level' || !unlocked.has(definition.id)) {
        return highestRank
      }
      const rank = definition.payload.rank
      return typeof rank === 'number' && Number.isInteger(rank)
        ? Math.max(highestRank, rank)
        : highestRank
    }, 0),
  )
}

export function getSkillSlotCount(
  definitions: readonly MetaUnlockDefinition[],
  unlockedIds: readonly string[],
): number {
  const unlocked = new Set(unlockedIds)
  return definitions.reduce((highestCount, definition) => {
    if (
      definition.category !== SKILL_SLOT_UNLOCK_CATEGORY ||
      !unlocked.has(definition.id)
    ) {
      return highestCount
    }
    const skillSlotCount = definition.payload.skillSlotCount
    return typeof skillSlotCount === 'number' && Number.isInteger(skillSlotCount)
      ? Math.max(highestCount, skillSlotCount)
      : highestCount
  }, DEFAULT_SKILL_SLOT_COUNT)
}

export function getDungeonMaxFloorRank(
  definitions: readonly MetaUnlockDefinition[],
  unlockedIds: readonly string[],
): number {
  const unlocked = new Set(unlockedIds)
  return Math.min(
    DUNGEON_MAX_FLOOR_MAX_RANK,
    definitions.reduce((highestRank, definition) => {
      if (
        definition.category !== DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY ||
        !unlocked.has(definition.id)
      ) {
        return highestRank
      }
      const rank = definition.payload.rank
      return typeof rank === 'number' && Number.isInteger(rank)
        ? Math.max(highestRank, rank)
        : highestRank
    }, 0),
  )
}

export function getDungeonMaxFloorBonus(
  definitions: readonly MetaUnlockDefinition[],
  unlockedIds: readonly string[],
): number {
  const unlocked = new Set(unlockedIds)
  const bonus = definitions.reduce((totalBonus, definition) => {
    if (
      definition.category !== DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY ||
      !unlocked.has(definition.id)
    ) {
      return totalBonus
    }
    const maxFloorBonus = definition.payload.maxFloorBonus
    return typeof maxFloorBonus === 'number' &&
      Number.isInteger(maxFloorBonus) &&
      maxFloorBonus > 0
      ? totalBonus + maxFloorBonus
      : totalBonus
  }, 0)
  return Math.min(
    bonus,
    DUNGEON_MAX_FLOOR_MAX_RANK * DUNGEON_MAX_FLOOR_BONUS_PER_RANK,
  )
}

function toSnapshot(
  walletRow: unknown,
  definitionRows: unknown,
  unlockRows: unknown,
): MetaProgressionSnapshot {
  const wallet = isWalletRow(walletRow)
    ? {
        essenceBalance: walletRow.essence_balance,
        essenceEarned: walletRow.essence_earned,
        essenceSpent: walletRow.essence_spent,
        rerollLevel: Math.min(MAX_REROLL_LEVEL, walletRow.rerolls_purchased),
      }
    : defaultWallet()
  if (!Array.isArray(definitionRows) || !definitionRows.every(isUnlockDefinitionRow)) {
    throw new Error('Meta unlock definitions returned an invalid response.')
  }
  if (!Array.isArray(unlockRows) || !unlockRows.every(isUnlockRow)) {
    throw new Error('Meta unlocks returned an invalid response.')
  }
  const definitions = definitionRows.map((definition) => ({
    id: definition.id,
    category: definition.category,
    cost: definition.cost,
    requiresUnlockId: definition.requires_unlock_id,
    isStarter: definition.is_starter,
    payload: definition.payload,
  }))
  const unlockedIds = unlockRows.map((unlock) => unlock.unlock_id).sort()
  const xpMultiplierLevel = getXpMultiplierLevel(definitions, unlockedIds)
  const startingLevelRank = getStartingLevelRank(definitions, unlockedIds)
  const skillSlotCount = getSkillSlotCount(definitions, unlockedIds)
  const dungeonMaxFloorRank = getDungeonMaxFloorRank(definitions, unlockedIds)
  const dungeonMaxFloorBonus = getDungeonMaxFloorBonus(definitions, unlockedIds)
  return {
    wallet,
    definitions,
    unlockedIds,
    xpMultiplierLevel,
    xpMultiplier: getXpMultiplierForLevel(xpMultiplierLevel),
    startingLevelRank,
    startingLevel: getStartingLevelForRank(startingLevelRank),
    skillSlotCount,
    dungeonMaxFloorRank,
    dungeonMaxFloorBonus,
    dungeonMaxFloor: DEFAULT_DUNGEON_MAX_FLOOR + dungeonMaxFloorBonus,
  }
}

export function createMetaProgressionService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): MetaProgressionService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  const load = async (): Promise<MetaProgressionSnapshot> => {
    const client = getClient()
    const [walletResponse, definitionsResponse, unlocksResponse] = await Promise.all([
      client.from('meta_wallets').select(
        'essence_balance, essence_earned, essence_spent, reroll_balance, rerolls_purchased',
      ).maybeSingle(),
      client.from('meta_unlock_definitions').select(
        'id, category, cost, requires_unlock_id, is_starter, payload',
      ).order('id'),
      client.from('meta_unlocks').select('unlock_id').order('unlock_id'),
    ])
    if (walletResponse.error) {
      throw walletResponse.error
    }
    if (definitionsResponse.error) {
      throw definitionsResponse.error
    }
    if (unlocksResponse.error) {
      throw unlocksResponse.error
    }
    return toSnapshot(walletResponse.data, definitionsResponse.data, unlocksResponse.data)
  }

  return {
    load,

    async submitRunResult(input): Promise<MetaRunReward> {
      const client = getClient()
      const response = await client.rpc('submit_meta_run_result', {
        p_run_id: input.runId,
        p_pending_result_id: input.pendingResultId,
        p_completed_at: input.completedAt,
        p_payload: {
          level: input.level,
          killCount: input.killCount,
          outcome: input.outcome,
          worldModifierIds: input.worldModifierIds,
        },
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRunRewardRow(response.data[0])) {
        throw new Error('Run reward returned an invalid response.')
      }
      const reward = response.data[0]
      return {
        essenceAwarded: reward.essence_awarded,
        essenceBalance: reward.essence_balance,
        wasProcessed: reward.was_processed,
      }
    },

    async purchaseUnlock(unlockId): Promise<MetaProgressionSnapshot> {
      const client = getClient()
      const response = await client.rpc('purchase_meta_unlock', {
        p_unlock_id: unlockId,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1) {
        throw new Error('Unlock purchase returned an invalid response.')
      }
      return load()
    },

    async purchaseReroll(): Promise<MetaProgressionSnapshot> {
      const response = await getClient().rpc('purchase_meta_reroll')
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1) {
        throw new Error('Reroll purchase returned an invalid response.')
      }
      return load()
    },
  }
}
