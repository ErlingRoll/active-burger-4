import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  hasDismissedNicknamePrompt,
  rememberNicknamePromptDismissed,
  shouldPromptForNickname,
  type AuthenticationState,
  type NicknameService,
  type NicknameState,
} from '../../auth'
import type { ServiceHandle } from '../../services'
import type { ToastKind } from '../../ui/ToasterContext'
import { errorMessage } from '../runFormatting'

/**
 * The signed-in account's nickname, plus what the app does about it.
 *
 * `loadedForAccountId` names the account the nickname was fetched for, so a
 * stale answer from the previous account is never mistaken for the current
 * one. `promptOpen` is decided once per load: a new account (see
 * `shouldPromptForNickname`) is asked to pick a nickname right after signing
 * in, on every sign-in method alike, unless it skipped the prompt on this
 * browser before.
 */
export interface AccountNickname extends NicknameState {
  loadedForAccountId: string | null
  promptOpen: boolean
}

const EMPTY_ACCOUNT_NICKNAME: AccountNickname = {
  displayName: null,
  pendingNickname: null,
  hasRequestedNickname: false,
  loadedForAccountId: null,
  promptOpen: false,
}

export function useAccountNickname(
  nicknameService: ServiceHandle<NicknameService>,
  account: AuthenticationState['account'],
  setAuthentication: Dispatch<SetStateAction<AuthenticationState>>,
  showToast: (message: string, kind?: ToastKind) => void,
) {
  const [nickname, setNickname] = useState<AccountNickname>(EMPTY_ACCOUNT_NICKNAME)

  useEffect(() => {
    const accountId = account?.id
    const service = nicknameService.service
    if (!accountId) {
      // Signing out clears the cached nickname before any request is made, so the
      // stale name is never shown against the new (signed-out) account.
      // oxlint-disable-next-line react/set-state-in-effect
      setNickname(EMPTY_ACCOUNT_NICKNAME)
      return
    }
    if (!service) {
      setAuthentication((current) => ({
        ...current,
        error: nicknameService.configurationError ?? 'Nickname settings are unavailable.',
      }))
      return
    }

    let cancelled = false
    void service.loadOwnNickname(accountId)
      .then((loadedNickname) => {
        if (!cancelled) {
          setNickname({
            ...loadedNickname,
            loadedForAccountId: accountId,
            promptOpen: shouldPromptForNickname(loadedNickname) &&
              !hasDismissedNicknamePrompt(accountId),
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          // The load has settled, just without an answer: nothing to prompt for.
          setNickname({ ...EMPTY_ACCOUNT_NICKNAME, loadedForAccountId: accountId })
          setAuthentication((current) => ({
            ...current,
            error: `Unable to load nickname settings: ${errorMessage(error)}`,
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    account?.id,
    nicknameService.configurationError,
    nicknameService.service,
    setAuthentication,
  ])

  const requestNicknameChange = useCallback(async (requestedNickname: string): Promise<void> => {
    if (!account) {
      throw new Error('Sign in before changing your nickname.')
    }
    if (!nicknameService.service) {
      throw new Error(nicknameService.configurationError ?? 'Nickname settings are unavailable.')
    }
    await nicknameService.service.requestChange(requestedNickname)
    setNickname((current) => ({
      ...current,
      pendingNickname: requestedNickname,
      hasRequestedNickname: true,
      promptOpen: false,
    }))
    showToast('Nickname submitted for moderator review.', 'info')
  }, [
    account,
    nicknameService.configurationError,
    nicknameService.service,
    showToast,
  ])

  const dismissNicknamePrompt = useCallback((): void => {
    if (account) {
      rememberNicknamePromptDismissed(account.id)
    }
    setNickname((current) => ({ ...current, promptOpen: false }))
  }, [account])

  /*
   * Exposed on the shell for the tooling that signs in as the test account: it
   * can tell a prompt that is still to come from one that will not come.
   */
  const nicknamePromptStatus = !account
    ? 'closed'
    : nickname.loadedForAccountId !== account.id
      ? 'loading'
      : nickname.promptOpen
        ? 'open'
        : 'closed'

  return { nickname, requestNicknameChange, dismissNicknamePrompt, nicknamePromptStatus }
}
