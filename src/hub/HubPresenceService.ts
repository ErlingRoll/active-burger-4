import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getPlayerDisplayName } from '../auth'
import { getSupabaseClient, type AuthEnvironment } from '../auth'

export interface HubPosition {
  x: number
  y: number
}

/**
 * Where the clearing's floor begins, as a percentage down the scene.
 *
 * The stylesheet reads this through the `--scene-horizon` custom property the
 * scene sets from it, so the ground that is drawn and the ground that can be
 * walked on cannot drift apart.
 */
export const HUB_SCENE_HORIZON_PERCENT = 63

/**
 * The walkable floor. Visitors used to be allowed up to `minY: 28`, which is
 * well above the horizon: a player holding W walked into the night sky.
 */
export const HUB_VISITOR_BOUNDS = {
  minX: 10,
  maxX: 90,
  minY: HUB_SCENE_HORIZON_PERCENT + 4,
  maxY: 88,
} as const

/**
 * Pulls a position onto the walkable floor.
 *
 * Used on the way in as well as the way out: a visitor's position arrives over
 * presence from whatever client sent it, and a stale or older client can claim
 * a spot in the night sky. Clamping on render means the drawn scene obeys the
 * floor even when the wire does not.
 */
export function clampToHubFloor(position: HubPosition): HubPosition {
  return {
    x: Math.min(HUB_VISITOR_BOUNDS.maxX, Math.max(HUB_VISITOR_BOUNDS.minX, position.x)),
    y: Math.min(HUB_VISITOR_BOUNDS.maxY, Math.max(HUB_VISITOR_BOUNDS.minY, position.y)),
  }
}

export interface HubVisitorPresence {
  playerId: string
  position?: HubPosition
}

export interface HubVisitor {
  playerId: string
  playerName: string
  position: HubPosition
}

export interface HubMovement {
  playerId: string
  position: HubPosition
}

export interface HubPositionRequest {
  playerId: string
}

export const HUB_SIGNAL_IDS = [
  'wave',
  'praise-the-sun',
  'good-luck-below',
  'ready-to-descend',
] as const

export type HubSignalId = (typeof HUB_SIGNAL_IDS)[number]

export interface HubSignal {
  playerId: string
  signalId: HubSignalId
}

export interface HubPresenceService {
  trackVisitor(visitor: HubVisitorPresence): Promise<void>
  subscribeToVisitors(
    onVisitors: (visitors: HubVisitor[]) => void,
    onError: (error: Error) => void,
  ): () => void
  sendMovement(movement: HubMovement): Promise<void>
  subscribeToMovements(
    onMovement: (movement: HubMovement) => void,
    onError: (error: Error) => void,
  ): () => void
  requestPositions(request: HubPositionRequest): Promise<void>
  subscribeToPositionRequests(
    onRequest: (request: HubPositionRequest) => void,
    onError: (error: Error) => void,
  ): () => void
  sendSignal(signal: HubSignal): Promise<void>
  subscribeToSignals(
    onSignal: (signal: HubSignal) => void,
    onError: (error: Error) => void,
  ): () => void
}

interface RpcPlayerNameRow {
  player_id: string
  player_name: string
}

const HUB_SIGNAL_EVENT = 'campfire-signal'
const HUB_MOVEMENT_EVENT = 'hub-movement'
const HUB_POSITION_REQUEST_EVENT = 'hub-position-request'
const hubSignalIds = new Set<string>(HUB_SIGNAL_IDS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isHubPosition(value: unknown): value is HubPosition {
  return isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    value.x >= HUB_VISITOR_BOUNDS.minX &&
    value.x <= HUB_VISITOR_BOUNDS.maxX &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    value.y >= HUB_VISITOR_BOUNDS.minY &&
    value.y <= HUB_VISITOR_BOUNDS.maxY
}

function isHubVisitorPresence(value: unknown): value is HubVisitorPresence {
  return isRecord(value) &&
    isNonEmptyString(value.playerId)
}

function isTrackableHubVisitorPresence(value: unknown): value is Required<HubVisitorPresence> {
  return isHubVisitorPresence(value) && isHubPosition(value.position)
}

function isHubMovement(value: unknown): value is HubMovement {
  return isRecord(value) &&
    isNonEmptyString(value.playerId) &&
    isHubPosition(value.position)
}

function isHubPositionRequest(value: unknown): value is HubPositionRequest {
  return isRecord(value) && isNonEmptyString(value.playerId)
}

function getLegacyVisitorPosition(playerId: string): HubPosition {
  let hash = 0
  for (let index = 0; index < playerId.length; index += 1) {
    hash = ((hash * 31) + playerId.charCodeAt(index)) >>> 0
  }
  return {
    x: 44 + (hash % 13),
    y: 68 + (Math.floor(hash / 13) % 7),
  }
}

function isHubSignalId(value: unknown): value is HubSignalId {
  return typeof value === 'string' && hubSignalIds.has(value)
}

function isHubSignal(value: unknown): value is HubSignal {
  return isRecord(value) &&
    isNonEmptyString(value.playerId) &&
    isHubSignalId(value.signalId)
}

function isRpcPlayerNameRow(value: unknown): value is RpcPlayerNameRow {
  return isRecord(value) &&
    isNonEmptyString(value.player_id) &&
    isNonEmptyString(value.player_name)
}

export function createHubPresenceService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): HubPresenceService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient
  let channel: RealtimeChannel | null = null
  let subscriptionReady: Promise<void> | null = null
  let resolveSubscription: (() => void) | null = null
  let rejectSubscription: ((error: Error) => void) | null = null
  let subscribed = false
  let subscriptionStarted = false
  const channelErrorHandlers: ((error: Error) => void)[] = []

  const getChannel = (): RealtimeChannel => {
    if (!channel) {
      channel = getClient().channel('adventure-hub', {
        config: {
          broadcast: { self: false },
          presence: { enabled: true },
        },
      })
    }
    return channel
  }

  const waitForSubscription = (): Promise<void> => {
    if (subscribed) {
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

  const clearSubscription = (): void => {
    subscribed = false
    subscriptionStarted = false
    subscriptionReady = null
    resolveSubscription = null
    rejectSubscription = null
  }

  const startSubscription = (realtimeChannel: RealtimeChannel): void => {
    if (subscriptionStarted) {
      return
    }
    subscriptionStarted = true
    realtimeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true
        resolveSubscription?.()
        resolveSubscription = null
        rejectSubscription = null
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const error = new Error(`Adventure hub presence is unavailable (${status}).`)
        subscribed = false
        rejectSubscription?.(error)
        subscriptionReady = null
        resolveSubscription = null
        rejectSubscription = null
        channelErrorHandlers.forEach((onError) => onError(error))
      }
    })
  }

  const subscribeToChannel = (onError: (error: Error) => void): (() => void) => {
    const realtimeChannel = getChannel()
    channelErrorHandlers.push(onError)
    startSubscription(realtimeChannel)
    return () => {
      const handlerIndex = channelErrorHandlers.indexOf(onError)
      if (handlerIndex !== -1) {
        channelErrorHandlers.splice(handlerIndex, 1)
      }
      if (channelErrorHandlers.length !== 0 || channel !== realtimeChannel) {
        return
      }
      rejectSubscription?.(new Error('Adventure hub presence subscription ended.'))
      clearSubscription()
      channel = null
      void getClient().removeChannel(realtimeChannel)
    }
  }

  const loadVisitorNames = async (playerIds: readonly string[]): Promise<Map<string, string>> => {
    const uniquePlayerIds = [...new Set(playerIds.filter(isNonEmptyString))]
    if (uniquePlayerIds.length === 0) {
      return new Map()
    }
    const response = await getClient().rpc('get_player_display_names', {
      p_player_ids: uniquePlayerIds,
    })
    if (response.error) {
      throw response.error
    }
    if (!Array.isArray(response.data) || !response.data.every(isRpcPlayerNameRow)) {
      throw new Error('Hub presence returned invalid player names.')
    }
    return new Map(response.data.map((row) => [row.player_id, row.player_name]))
  }

  return {
    async trackVisitor(visitor): Promise<void> {
      if (!isTrackableHubVisitorPresence(visitor)) {
        throw new Error('Hub visitor presence is invalid.')
      }
      await waitForSubscription()
      const status = await getChannel().track(visitor)
      if (status !== 'ok') {
        throw new Error(`Hub visitor presence update failed: ${status}.`)
      }
    },

    subscribeToVisitors(onVisitors, onError): () => void {
      const realtimeChannel = getChannel()
      let active = true
      realtimeChannel.on('presence', { event: 'sync' }, () => {
        if (!active) {
          return
        }
        const presences = Object.values(realtimeChannel.presenceState<HubVisitorPresence>())
          .flat()
          .filter(isHubVisitorPresence)
        const visitorsByPlayerId = new Map<string, HubVisitorPresence>()
        presences.forEach((presence) => visitorsByPlayerId.set(presence.playerId, presence))
        const uniquePlayerIds = [...visitorsByPlayerId.keys()]
        void loadVisitorNames(uniquePlayerIds)
          .then((names) => {
            if (!active) {
              return
            }
            onVisitors(uniquePlayerIds.map((playerId) => {
              const visitor = visitorsByPlayerId.get(playerId)
              if (!visitor) {
                throw new Error('Hub presence visitor is unavailable.')
              }
              return {
                playerId,
                playerName: getPlayerDisplayName({ providerDisplayName: names.get(playerId) }),
                position: visitor.position ?? getLegacyVisitorPosition(playerId),
              }
            }))
          })
          .catch((error: unknown) => {
            if (active) {
              onError(error instanceof Error
                ? error
                : new Error('Unable to resolve hub visitor names.'))
            }
          })
      })
      const unsubscribeFromChannel = subscribeToChannel(onError)
      return () => {
        active = false
        unsubscribeFromChannel()
      }
    },

    async sendMovement(movement): Promise<void> {
      if (!isHubMovement(movement)) {
        throw new Error('Hub movement is invalid.')
      }
      await waitForSubscription()
      const status = await getChannel().send({
        type: 'broadcast',
        event: HUB_MOVEMENT_EVENT,
        payload: movement,
      })
      if (status !== 'ok') {
        throw new Error(`Hub movement update failed: ${status}.`)
      }
    },

    subscribeToMovements(onMovement, onError): () => void {
      const realtimeChannel = getChannel()
      let active = true
      realtimeChannel.on('broadcast', { event: HUB_MOVEMENT_EVENT }, ({ payload }) => {
        if (active && isHubMovement(payload)) {
          onMovement(payload)
        }
      })
      const unsubscribeFromChannel = subscribeToChannel(onError)
      return () => {
        active = false
        unsubscribeFromChannel()
      }
    },

    async requestPositions(request): Promise<void> {
      if (!isHubPositionRequest(request)) {
        throw new Error('Hub position request is invalid.')
      }
      await waitForSubscription()
      const status = await getChannel().send({
        type: 'broadcast',
        event: HUB_POSITION_REQUEST_EVENT,
        payload: request,
      })
      if (status !== 'ok') {
        throw new Error(`Hub position request failed: ${status}.`)
      }
    },

    subscribeToPositionRequests(onRequest, onError): () => void {
      const realtimeChannel = getChannel()
      let active = true
      realtimeChannel.on('broadcast', { event: HUB_POSITION_REQUEST_EVENT }, ({ payload }) => {
        if (active && isHubPositionRequest(payload)) {
          onRequest(payload)
        }
      })
      const unsubscribeFromChannel = subscribeToChannel(onError)
      return () => {
        active = false
        unsubscribeFromChannel()
      }
    },

    async sendSignal(signal): Promise<void> {
      if (!isHubSignal(signal)) {
        throw new Error('Hub campfire signal is invalid.')
      }
      await waitForSubscription()
      const status = await getChannel().send({
        type: 'broadcast',
        event: HUB_SIGNAL_EVENT,
        payload: signal,
      })
      if (status !== 'ok') {
        throw new Error(`Hub campfire signal failed: ${status}.`)
      }
    },

    subscribeToSignals(onSignal, onError): () => void {
      const realtimeChannel = getChannel()
      let active = true
      realtimeChannel.on('broadcast', { event: HUB_SIGNAL_EVENT }, ({ payload }) => {
        if (active && isHubSignal(payload)) {
          onSignal(payload)
        }
      })
      const unsubscribeFromChannel = subscribeToChannel(onError)
      return () => {
        active = false
        unsubscribeFromChannel()
      }
    },
  }
}
