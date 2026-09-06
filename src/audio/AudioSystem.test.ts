import { describe, expect, it } from 'vitest'
import {
  clampAudioVolume,
  DEFAULT_AUDIO_SETTINGS,
  MUSIC_PLAYLISTS,
  normalizeAudioSettings,
} from './AudioSystem'

describe('audio volume', () => {
  it('keeps values within the range accepted by HTMLAudioElement.volume', () => {
    expect(clampAudioVolume(-1)).toBe(0)
    expect(clampAudioVolume(0.5)).toBe(0.5)
    expect(clampAudioVolume(2)).toBe(1)
    expect(clampAudioVolume(Number.NaN)).toBe(0)
    expect(clampAudioVolume(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('audio settings', () => {
  it('normalizes invalid and out-of-range persisted values', () => {
    expect(normalizeAudioSettings({
      masterVolume: 2,
      musicVolume: -1,
      effectsVolume: Number.NaN,
      muted: true,
    })).toEqual({
      masterVolume: 1,
      musicVolume: 0,
      effectsVolume: 1,
      muted: true,
    })
    expect(normalizeAudioSettings(undefined)).toEqual(DEFAULT_AUDIO_SETTINGS)
  })

  it('defines an independently selectable playlist for every supported context', () => {
    expect(Object.keys(MUSIC_PLAYLISTS)).toEqual([
      'dashboard',
      'fishing',
      'dungeon',
      'abyss',
    ])
    expect(MUSIC_PLAYLISTS.dashboard).toBeDefined()
    expect(MUSIC_PLAYLISTS.fishing).toBeDefined()
    expect(MUSIC_PLAYLISTS.dungeon).toBeDefined()
    expect(MUSIC_PLAYLISTS.abyss).toBeDefined()
  })
})
