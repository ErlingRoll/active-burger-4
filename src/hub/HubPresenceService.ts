import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getPlayerDisplayName } from '../auth'
import { getSupabaseClient, type AuthEnvironment } from '../auth'

export interface HubVisitorPresence {
  playerId: string
}

export interface HubVisitor {
  playerId: string
  playerName: string
}

export interface HubPresenceService {
  trackVisitor(visitor: HubVisitorPresence): Promise<void>
  subscribeToVisitors(
    onVisitors: (visitors: HubVisitor[]) => void,
    onError: (error: Error) => void,
  ): () => void
}

interface RpcPlayerNameRow {
  player_id: string
  player_name: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isHubVisitorPresence(value: unknown): value is HubVisitorPresence {
  return isRecord(value) && isNonEmptyString(value.playerId)
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
      if (!isHubVisitorPresence(visitor)) {
        throw new Error('Hub visitor presence is invalid.')
      }
      await waitForSubscription()
      const status = await getChannel().track(visitor)
      if (status !== 'ok') {
        throw new Error(`Hub visitor presence update failed: ${status}.`)
      }
    },

    subscribeToVisitors(onVisitors, onError): () => void {
      const client = getClient()
      const realtimeChannel = getChannel()
      let active = true
      realtimeChannel.on('presence', { event: 'sync' }, () => {
        if (!active) {
          return
        }
        const presences = Object.values(realtimeChannel.presenceState<HubVisitorPresence>())
          .flat()
          .filter(isHubVisitorPresence)
        const uniquePlayerIds = [...new Set(presences.map((presence) => presence.playerId))]
        void loadVisitorNames(uniquePlayerIds)
          .then((names) => {
            if (!active) {
              return
            }
            onVisitors(uniquePlayerIds.map((playerId) => ({
              playerId,
              playerName: getPlayerDisplayName({ providerDisplayName: names.get(playerId) }),
            })))
          })
          .catch((error: unknown) => {
            if (active) {
              onError(error instanceof Error
                ? error
                : new Error('Unable to resolve hub visitor names.'))
            }
          })
      })
      realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true
          resolveSubscription?.()
          resolveSubscription = null
          rejectSubscription = null
          return
        }
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          const error = new Error(`Adventure hub presence is unavailable (${status}).`)
          subscribed = false
          rejectSubscription?.(error)
          subscriptionReady = null
          resolveSubscription = null
          rejectSubscription = null
          onError(error)
        }
      })
      return () => {
        active = false
        subscribed = false
        subscriptionReady = null
        resolveSubscription = null
        rejectSubscription = null
        void client.removeChannel(realtimeChannel)
        channel = null
      }
    },
  }
}
