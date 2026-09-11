import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, type AuthEnvironment } from './AuthService'

export interface NicknameState {
  displayName: string | null
  pendingNickname: string | null
  /**
   * Whether the account has ever asked for a nickname, whatever the outcome.
   * An account that never has is met with the nickname prompt after signing
   * in; one whose request was rejected is not asked again and again.
   */
  hasRequestedNickname: boolean
}

export interface NicknameChangeRequest {
  id: number
  userId: string
  requestedNickname: string
  requestedAt: string
}

export interface NicknameService {
  loadOwnNickname(accountId: string): Promise<NicknameState>
  requestChange(nickname: string): Promise<void>
  loadPendingChanges(): Promise<NicknameChangeRequest[]>
  reviewChange(requestId: number, approve: boolean): Promise<void>
}

interface ProfileRow {
  display_name: string | null
}

interface NicknameRequestRow {
  id: number
  user_id: string
  requested_nickname: string
  requested_at: string
}

interface LatestNicknameRequestRow {
  requested_nickname: string
  status: string
}

const NICKNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9 _-]{1,22}[A-Za-z0-9])$/

export function validateNickname(value: string): string | null {
  const nickname = value.trim()
  if (!NICKNAME_PATTERN.test(nickname)) {
    return 'Use 3-24 letters, numbers, spaces, hyphens, or underscores; it must start and end with a letter or number.'
  }
  return null
}

function isProfileRow(value: unknown): value is ProfileRow {
  return typeof value === 'object' && value !== null &&
    'display_name' in value &&
    (value.display_name === null || typeof value.display_name === 'string')
}

function isLatestNicknameRequestRow(value: unknown): value is LatestNicknameRequestRow {
  return typeof value === 'object' && value !== null &&
    'requested_nickname' in value && typeof value.requested_nickname === 'string' &&
    'status' in value && typeof value.status === 'string'
}

function isNicknameRequestRow(value: unknown): value is NicknameRequestRow {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'number' && Number.isSafeInteger(value.id) &&
    'user_id' in value && typeof value.user_id === 'string' &&
    'requested_nickname' in value && typeof value.requested_nickname === 'string' &&
    'requested_at' in value && typeof value.requested_at === 'string'
}

export function createNicknameService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): NicknameService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async loadOwnNickname(accountId): Promise<NicknameState> {
      /*
       * The newest request of any status answers both questions at once. A
       * pending request is always the newest one there is, because requesting
       * a nickname replaces any pending request rather than queueing behind
       * it, while reviewed requests keep their original timestamp.
       */
      const [profileResponse, latestRequestResponse] = await Promise.all([
        getClient()
          .from('profiles')
          .select('display_name')
          .eq('id', accountId)
          .maybeSingle(),
        getClient()
          .from('nickname_change_requests')
          .select('requested_nickname, status')
          .eq('user_id', accountId)
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (profileResponse.error) {
        throw profileResponse.error
      }
      if (latestRequestResponse.error) {
        throw latestRequestResponse.error
      }
      if (profileResponse.data !== null && !isProfileRow(profileResponse.data)) {
        throw new Error('Profile returned an invalid nickname response.')
      }
      const latestRequest: unknown = latestRequestResponse.data
      if (latestRequest !== null && !isLatestNicknameRequestRow(latestRequest)) {
        throw new Error('Nickname request returned an invalid response.')
      }
      return {
        displayName: profileResponse.data?.display_name ?? null,
        pendingNickname: latestRequest?.status === 'pending'
          ? latestRequest.requested_nickname
          : null,
        hasRequestedNickname: latestRequest !== null,
      }
    },

    async requestChange(nickname): Promise<void> {
      const validationError = validateNickname(nickname)
      if (validationError) {
        throw new Error(validationError)
      }
      const response = await getClient().rpc('request_nickname_change', {
        requested_nickname: nickname.trim(),
      })
      if (response.error) {
        throw response.error
      }
    },

    async loadPendingChanges(): Promise<NicknameChangeRequest[]> {
      const response = await getClient()
        .from('nickname_change_requests')
        .select('id, user_id, requested_nickname, requested_at')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })
      if (response.error) {
        throw response.error
      }
      if (!Array.isArray(response.data) || !response.data.every(isNicknameRequestRow)) {
        throw new Error('Nickname requests returned an invalid response.')
      }
      return response.data.map((request) => ({
        id: request.id,
        userId: request.user_id,
        requestedNickname: request.requested_nickname,
        requestedAt: request.requested_at,
      }))
    },

    async reviewChange(requestId, approve): Promise<void> {
      const response = await getClient().rpc('review_nickname_change', {
        nickname_request_id: requestId,
        approve,
      })
      if (response.error) {
        throw response.error
      }
    },
  }
}
