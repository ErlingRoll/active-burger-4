// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUDIO_SETTINGS_STORAGE_KEY, type AudioSettings } from './AudioSystem'

/**
 * The music playlist holds multi-megabyte files. Preloading them is only worth
 * the bandwidth when the player will actually hear them, so these tests pin the
 * gate: a muted or silent visitor must not trigger a download on page load.
 *
 * The module is re-imported per test because the audio system is a module-level
 * singleton whose constructor performs the preload.
 */
function loadedSources(): string[] {
  return loadCalls
}

let loadCalls: string[] = []

beforeEach(() => {
  loadCalls = []
  vi.resetModules()
  window.localStorage.clear()
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value(this: HTMLMediaElement) {
      loadCalls.push(this.src)
    },
  })
})

afterEach(() => {
  window.localStorage.clear()
})

function storeSettings(settings: Partial<AudioSettings>): void {
  window.localStorage.setItem(
    AUDIO_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      masterVolume: 1,
      musicVolume: 1,
      effectsVolume: 1,
      muted: false,
      ...settings,
    }),
  )
}

describe('music preloading', () => {
  it('preloads the dashboard playlist for a player who can hear it', async () => {
    storeSettings({ muted: false, musicVolume: 1 })

    await import('./AudioSystem')

    expect(loadedSources().length).toBeGreaterThan(0)
  })

  it('downloads nothing on load for a muted player', async () => {
    storeSettings({ muted: true })

    await import('./AudioSystem')

    expect(loadedSources()).toEqual([])
  })

  it('downloads nothing on load when the music volume is zero', async () => {
    storeSettings({ muted: false, musicVolume: 0 })

    await import('./AudioSystem')

    expect(loadedSources()).toEqual([])
  })

  it('downloads nothing on load when the master volume is zero', async () => {
    storeSettings({ muted: false, masterVolume: 0 })

    await import('./AudioSystem')

    expect(loadedSources()).toEqual([])
  })

  it('does not start a playlist selected while muted', async () => {
    storeSettings({ muted: true })
    const { audioSystem } = await import('./AudioSystem')

    audioSystem.setMusicPlaylist('dashboard')

    expect(loadedSources()).toEqual([])
  })

  it('starts and downloads the pending playlist once the player unmutes', async () => {
    storeSettings({ muted: true })
    const { audioSystem } = await import('./AudioSystem')
    audioSystem.setMusicPlaylist('dashboard')
    expect(loadedSources()).toEqual([])

    audioSystem.updateSettings({ muted: false })

    expect(loadedSources().length).toBeGreaterThan(0)
  })
})
