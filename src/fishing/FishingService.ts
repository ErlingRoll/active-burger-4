import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { isRarity, type Rarity } from '../content/rarity/Rarity'
import {
  isFishingMode,
  type FishingMode,
  type FishingCatch,
} from './FishingContent'

export interface BeginFishingInput {
  attemptId: string
  mode: FishingMode
  baitDefinitionId: string
  baitInstanceId: string | null
  rodInstanceId: string | null
}

export interface FishingAttemptPreparation {
  attemptId: string
  mode: FishingMode
  status: 'pending' | 'completed'
  resolveAt: string
  pityAt: string
  resolveAtClientTime: number
  pityAtClientTime: number
  wasProcessed: boolean
}

export interface ResolveFishingInput {
  attemptId: string
  manualSuccess: boolean
}

export interface FishingAttemptResult extends FishingCatch {
  attemptId: string
  itemInstanceId: string
  wasProcessed: boolean
}

export type FishingActivityKind = 'cast' | 'catch'

export interface FishingActivityEvent {
  eventId: string
  attemptId: string
  playerId: string
  playerName: string
  kind: FishingActivityKind
  fishDefinitionId?: string
  rarity?: Rarity
  occurredAt: string
}

export interface FishingAnglerPresence {
  attemptId: string
  playerId: string
  playerName: string
  phase: 'idle' | 'waiting' | 'catching'
  fishDefinitionId?: string
  rarity?: Rarity
}

export interface FishingService {
  beginAttempt(input: BeginFishingInput): Promise<FishingAttemptPreparation>
  resolveAttempt(input: ResolveFishingInput): Promise<FishingAttemptResult>
  publishActivity(event: FishingActivityEvent): Promise<void>
  loadActiveAnglers(): Promise<FishingAnglerPresence[]>
  trackAngler(presence: FishingAnglerPresence): Promise<void>
  subscribeToActivity(
    listener: (event: FishingActivityEvent) => void,
    onError: (error: Error) => void,
    onPresence: (anglers: FishingAnglerPresence[]) => void,
  ): () => void
}

interface RpcFishingPreparationRow {
  attempt_id: string
  mode_id: FishingMode
  status: 'pending' | 'completed'
  resolve_at: string
  pity_at: string
  server_time: string
  was_processed: boolean
}

interface RpcFishingResultRow {
  attempt_id: string
  item_instance_id: string
  fish_definition_id: string
  fish_metadata: {
    speciesId: string
    rarity: Rarity
    sizePercentile: number
  }
  was_processed: boolean
}

interface RpcActiveFishingAnglerRow {
  attempt_id: string
  player_id: string
  player_name: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFishingActivityKind(value: unknown): value is FishingActivityKind {
  return value === 'cast' || value === 'catch'
}

function isFishingActivityEvent(value: unknown): value is FishingActivityEvent {
  if (!isRecord(value) ||
    !isNonEmptyString(value.eventId) ||
    !isNonEmptyString(value.attemptId) ||
    !isNonEmptyString(value.playerId) ||
    !isNonEmptyString(value.playerName) ||
    !isFishingActivityKind(value.kind) ||
    !isNonEmptyString(value.occurredAt) ||
    !Number.isFinite(Date.parse(value.occurredAt))) {
    return false
  }
  if (value.kind === 'catch') {
    return isNonEmptyString(value.fishDefinitionId) && isRarity(value.rarity)
  }
  return value.fishDefinitionId === undefined && value.rarity === undefined
}

function isFishingAnglerPresence(value: unknown): value is FishingAnglerPresence {
  if (!isRecord(value) ||
    !isNonEmptyString(value.attemptId) ||
    !isNonEmptyString(value.playerId) ||
    !isNonEmptyString(value.playerName) ||
    (value.phase !== 'idle' && value.phase !== 'waiting' && value.phase !== 'catching')) {
    return false
  }
  if (value.phase === 'catching') {
    return isNonEmptyString(value.fishDefinitionId) && isRarity(value.rarity)
  }
  return value.fishDefinitionId === undefined && value.rarity === undefined
}

function isRpcActiveFishingAnglerRow(value: unknown): value is RpcActiveFishingAnglerRow {
  return isRecord(value) &&
    isNonEmptyString(value.attempt_id) &&
    isNonEmptyString(value.player_id) &&
    isNonEmptyString(value.player_name)
}

function isAttemptStatus(value: unknown): value is 'pending' | 'completed' {
  return value === 'pending' || value === 'completed'
}

function isRpcFishingPreparationRow(value: unknown): value is RpcFishingPreparationRow {
  return isRecord(value) &&
    isNonEmptyString(value.attempt_id) &&
    isFishingMode(value.mode_id) &&
    isAttemptStatus(value.status) &&
    isNonEmptyString(value.resolve_at) &&
    Number.isFinite(Date.parse(value.resolve_at)) &&
    isNonEmptyString(value.pity_at) &&
    Number.isFinite(Date.parse(value.pity_at)) &&
    isNonEmptyString(value.server_time) &&
    Number.isFinite(Date.parse(value.server_time)) &&
    typeof value.was_processed === 'boolean'
}

function isRpcFishingResultRow(value: unknown): value is RpcFishingResultRow {
  return isRecord(value) &&
    isNonEmptyString(value.attempt_id) &&
    isNonEmptyString(value.item_instance_id) &&
    isNonEmptyString(value.fish_definition_id) &&
    isRecord(value.fish_metadata) &&
    isNonEmptyString(value.fish_metadata.speciesId) &&
    isRarity(value.fish_metadata.rarity) &&
    typeof value.fish_metadata.sizePercentile === 'number' &&
    value.fish_metadata.sizePercentile >= 0 &&
    value.fish_metadata.sizePercentile <= 1 &&
    typeof value.was_processed === 'boolean'
}

function invalidResponse(message: string): Error {
  return new Error(`Fishing persistence returned an invalid response: ${message}`)
}

function assertAttemptId(attemptId: string): void {
  if (!isNonEmptyString(attemptId)) {
    throw new Error('Fishing attempt ID must be non-empty.')
  }
}

function assertOptionalInstanceId(instanceId: string | null, label: string): void {
  if (instanceId !== null && !isNonEmptyString(instanceId)) {
    throw new Error(`${label} must be non-empty when provided.`)
  }
}

export function createFishingService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): FishingService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient
  let activityChannel: RealtimeChannel | null = null
  let isActivityChannelSubscribed = false
  let subscriptionReady: Promise<void> | null = null
  let resolveSubscription: (() => void) | null = null
  let rejectSubscription: ((error: Error) => void) | null = null

  const getActivityChannel = (): RealtimeChannel => {
    if (!activityChannel) {
      activityChannel = getClient().channel('fishing-pond', {
        config: {
          broadcast: { self: false },
          presence: { enabled: true },
        },
      })
    }
    return activityChannel
  }

  const waitForActivityChannel = (): Promise<void> => {
    if (isActivityChannelSubscribed) {
      return Promise.resolve()
    }
    if (!subscriptionReady) {
      subscriptionReady = new Promise<void>((resolve, reject) => {
        resolveSubscription = resolve
        rejectSubscription = reject
      })
    }
    return subscriptionReady
  }

  const assertRealtimeStatus = (status: string, operation: string): void => {
    if (status !== 'ok') {
      throw new Error(`Fishing angler ${operation} failed: ${status}.`)
    }
  }

  return {
    async beginAttempt(input): Promise<FishingAttemptPreparation> {
      assertAttemptId(input.attemptId)
      if (!isFishingMode(input.mode)) {
        throw new Error(`Unknown fishing mode: ${input.mode}`)
      }
      if (!isNonEmptyString(input.baitDefinitionId)) {
        throw new Error('Fishing bait definition ID must be non-empty.')
      }
      assertOptionalInstanceId(input.baitInstanceId, 'Fishing bait instance ID')
      assertOptionalInstanceId(input.rodInstanceId, 'Fishing rod instance ID')

      const response = await getClient().rpc('begin_fishing_attempt', {
        p_attempt_id: input.attemptId,
        p_mode_id: input.mode,
        p_bait_definition_id: input.baitDefinitionId,
        p_bait_instance_id: input.baitInstanceId,
        p_rod_instance_id: input.rodInstanceId,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcFishingPreparationRow(response.data[0])) {
        throw invalidResponse('expected one preparation row')
      }
      const row = response.data[0]
      const receivedAt = Date.now()
      const serverTime = Date.parse(row.server_time)
      const resolveAt = Date.parse(row.resolve_at)
      const pityAt = Date.parse(row.pity_at)
      return {
        attemptId: row.attempt_id,
        mode: row.mode_id,
        status: row.status,
        resolveAt: row.resolve_at,
        pityAt: row.pity_at,
        resolveAtClientTime: receivedAt + Math.max(0, resolveAt - serverTime),
        pityAtClientTime: receivedAt + Math.max(0, pityAt - serverTime),
        wasProcessed: row.was_processed,
      }
    },

    async resolveAttempt(input): Promise<FishingAttemptResult> {
      assertAttemptId(input.attemptId)
      if (typeof input.manualSuccess !== 'boolean') {
        throw new Error('Fishing manual interaction result must be boolean.')
      }

      const response = await getClient().rpc('resolve_fishing_attempt', {
        p_attempt_id: input.attemptId,
        p_manual_success: input.manualSuccess,
      })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRpcFishingResultRow(response.data[0])) {
        throw invalidResponse('expected one resolved catch row')
      }
      const row = response.data[0]
      return {
        attemptId: row.attempt_id,
        itemInstanceId: row.item_instance_id,
        definitionId: row.fish_definition_id,
        metadata: row.fish_metadata,
        wasProcessed: row.was_processed,
      }
    },

    async publishActivity(event): Promise<void> {
      if (!isFishingActivityEvent(event)) {
        throw new Error('Fishing activity event is invalid.')
      }
      await waitForActivityChannel()
      const status = await getActivityChannel().send({
        type: 'broadcast',
        event: 'fishing-activity',
        payload: event,
      })
      if (status !== 'ok') {
        throw new Error(`Fishing activity broadcast failed: ${status}.`)
      }
    },

    async loadActiveAnglers(): Promise<FishingAnglerPresence[]> {
      const response = await getClient().rpc('get_active_fishing_anglers')
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isRpcActiveFishingAnglerRow)) {
        throw invalidResponse('expected active fishing angler rows')
      }
      return response.data.map((row) => ({
        attemptId: row.attempt_id,
        playerId: row.player_id,
        playerName: row.player_name,
        phase: 'waiting',
      }))
    },

    async trackAngler(presence): Promise<void> {
      if (!isFishingAnglerPresence(presence)) {
        throw new Error('Fishing angler presence is invalid.')
      }
      await waitForActivityChannel()
      const status = await getActivityChannel().track(presence)
      assertRealtimeStatus(status, 'presence update')
    },

    subscribeToActivity(listener, onError, onPresence): () => void {
      const client = getClient()
      const channel = getActivityChannel()
      let active = true
      channel.on('broadcast', { event: 'fishing-activity' }, ({ payload }) => {
        if (active && isFishingActivityEvent(payload)) {
          listener(payload)
        }
      })
      channel.on('presence', { event: 'sync' }, () => {
        if (!active) {
          return
        }
        const anglers = Object.values(channel.presenceState<FishingAnglerPresence>())
          .flat()
          .filter(isFishingAnglerPresence)
        onPresence(anglers)
      })
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isActivityChannelSubscribed = true
          resolveSubscription?.()
          resolveSubscription = null
          rejectSubscription = null
          return
        }
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          const error = new Error(`Shared pond activity is unavailable (${status}).`)
          isActivityChannelSubscribed = false
          rejectSubscription?.(error)
          subscriptionReady = null
          resolveSubscription = null
          rejectSubscription = null
          onError(error)
        }
      })
      return () => {
        active = false
        isActivityChannelSubscribed = false
        rejectSubscription?.(new Error('Shared pond activity subscription ended.'))
        subscriptionReady = null
        resolveSubscription = null
        rejectSubscription = null
        if (activityChannel === channel) {
          activityChannel = null
        }
        void client.removeChannel(channel)
      }
    },
  }
}
