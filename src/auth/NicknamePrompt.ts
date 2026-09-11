import type { NicknameState } from './NicknameService'

/*
 * The nickname prompt a new account meets right after signing in.
 *
 * "New" is decided server-side: an account that has never requested a
 * nickname, and has none approved, is asked to pick one, whichever way it
 * signed in (email, Discord, or a provider added later). Requesting one, even
 * a request that is later rejected, settles the question for every device.
 * Skipping the prompt is only remembered on this browser, so a player who
 * skipped it still meets it once on the next device they sign in from.
 */

const STORAGE_KEY_PREFIX = 'active-burger-4:nickname-prompt-dismissed:'

function storageKey(accountId: string): string {
  return `${STORAGE_KEY_PREFIX}${accountId}`
}

export function shouldPromptForNickname(nickname: NicknameState): boolean {
  return nickname.displayName === null &&
    nickname.pendingNickname === null &&
    !nickname.hasRequestedNickname
}

export function hasDismissedNicknamePrompt(accountId: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(storageKey(accountId)) !== null
  } catch (error: unknown) {
    console.warn('Unable to read the nickname prompt state from local storage.', error)
    return false
  }
}

export function rememberNicknamePromptDismissed(accountId: string): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(storageKey(accountId), new Date().toISOString())
  } catch (error: unknown) {
    console.warn('Unable to remember the nickname prompt in local storage.', error)
  }
}
