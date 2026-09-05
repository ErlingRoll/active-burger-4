import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAYER_DISPLAY_NAME,
  getPlayerDisplayName,
} from './PlayerName'

describe('player display names', () => {
  it('prioritizes an approved nickname over provider and fallback names', () => {
    expect(getPlayerDisplayName({
      approvedNickname: '  Pond Knight  ',
      providerDisplayName: 'Discord Name',
      fallback: 'Anonymous player',
    })).toBe('Pond Knight')
  })

  it('uses the provider name when no approved nickname exists', () => {
    expect(getPlayerDisplayName({
      approvedNickname: null,
      providerDisplayName: 'Discord Name',
    })).toBe('Discord Name')
  })

  it('uses the configured fallback and then the default name', () => {
    expect(getPlayerDisplayName({
      approvedNickname: ' ',
      providerDisplayName: null,
      fallback: 'Unknown angler',
    })).toBe('Unknown angler')
    expect(getPlayerDisplayName({})).toBe(DEFAULT_PLAYER_DISPLAY_NAME)
  })
})
