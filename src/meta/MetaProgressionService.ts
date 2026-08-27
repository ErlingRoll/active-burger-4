import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LEGACY_DUNGEON_MAX_FLOOR_CONTRACT_ID_MAP } from '../game-config/meta-progression'

export interface MetaWallet {
  essenceBalance: number
  essenceEarned: number
  essenceSpent: number
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
}

export interface MetaProgressionService {
  load(): Promise<MetaProgressionSnapshot>
  submitRunResult(input: MetaRunResultInput): Promise<MetaRunReward>
  purchaseUnlock(unlockId: string): Promise<MetaProgressionSnapshot>
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
    'essence_spent' in value && typeof value.essence_spent === 'number'
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
  return { essenceBalance: 0, essenceEarned: 0, essenceSpent: 0 }
}

export function getDungeonMaxFloorContractId(
  definition: MetaUnlockDefinition,
): string | null {
  const contractId = definition.payload.maxFloorContractId
  if (typeof contractId === 'string' && contractId.length > 0) {
    return contractId
  }
  const legacyContractId = definition.payload.contractId
  return typeof legacyContractId === 'string' &&
    legacyContractId in LEGACY_DUNGEON_MAX_FLOOR_CONTRACT_ID_MAP
    ? LEGACY_DUNGEON_MAX_FLOOR_CONTRACT_ID_MAP[
        legacyContractId as keyof typeof LEGACY_DUNGEON_MAX_FLOOR_CONTRACT_ID_MAP
      ]
    : null
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
      }
    : defaultWallet()
  if (!Array.isArray(definitionRows) || !definitionRows.every(isUnlockDefinitionRow)) {
    throw new Error('Meta unlock definitions returned an invalid response.')
  }
  if (!Array.isArray(unlockRows) || !unlockRows.every(isUnlockRow)) {
    throw new Error('Meta unlocks returned an invalid response.')
  }
  return {
    wallet,
    definitions: definitionRows.map((definition) => ({
      id: definition.id,
      category: definition.category,
      cost: definition.cost,
      requiresUnlockId: definition.requires_unlock_id,
      isStarter: definition.is_starter,
      payload: definition.payload,
    })),
    unlockedIds: unlockRows.map((unlock) => unlock.unlock_id).sort(),
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
      client.from('meta_wallets').select('essence_balance, essence_earned, essence_spent').maybeSingle(),
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
  }
}
