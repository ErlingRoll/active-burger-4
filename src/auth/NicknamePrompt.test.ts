// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  hasDismissedNicknamePrompt,
  rememberNicknamePromptDismissed,
  shouldPromptForNickname,
} from './NicknamePrompt'

describe('shouldPromptForNickname', () => {
  it('prompts an account that has never asked for a nickname', () => {
    expect(shouldPromptForNickname({
      displayName: null,
      pendingNickname: null,
      hasRequestedNickname: false,
    })).toBe(true)
  })

  it('leaves an account alone once it has a nickname, a pending one, or a past request', () => {
    expect(shouldPromptForNickname({
      displayName: 'Mira',
      pendingNickname: null,
      hasRequestedNickname: true,
    })).toBe(false)
    expect(shouldPromptForNickname({
      displayName: null,
      pendingNickname: 'Mira',
      hasRequestedNickname: true,
    })).toBe(false)
    expect(shouldPromptForNickname({
      displayName: null,
      pendingNickname: null,
      hasRequestedNickname: true,
    })).toBe(false)
  })
})

describe('nickname prompt dismissal', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('remembers a skip for that account only', () => {
    expect(hasDismissedNicknamePrompt('account-1')).toBe(false)

    rememberNicknamePromptDismissed('account-1')

    expect(hasDismissedNicknamePrompt('account-1')).toBe(true)
    expect(hasDismissedNicknamePrompt('account-2')).toBe(false)
  })
})
