// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MUSIC_PLAYLISTS } from './AudioSystem'

/**
 * A browser refuses play() until the player has interacted with the page, and
 * a touch grants that on `pointerup`, not on the `pointerdown` before it. These
 * tests stand in for the browser: play() is refused until the fake activation
 * is granted, and the activation arrives with the event the browser would
 * grant it on. The module is re-imported per test because the audio system is
 * a module-level singleton that binds its listeners in its constructor. The
 * earlier instances keep listening, so each test's instance is stopped when
 * it is done with it, which leaves those listeners with nothing to resume.
 */
type AudioModule = typeof import('./AudioSystem')

let activated = false
let system: AudioModule['audioSystem'] | null = null
const playCalls = new Map<HTMLMediaElement, number>()
const playingElements = new Set<HTMLMediaElement>()

beforeEach(() => {
  activated = false
  playCalls.clear()
  playingElements.clear()
  vi.resetModules()
  window.localStorage.clear()
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value() {},
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value(this: HTMLMediaElement) {
      playingElements.delete(this)
    },
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement) {
      return !playingElements.has(this)
    },
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value(this: HTMLMediaElement) {
      playCalls.set(this, (playCalls.get(this) ?? 0) + 1)
      if (!activated) {
        return Promise.reject(new DOMException('play() failed', 'NotAllowedError'))
      }
      playingElements.add(this)
      return Promise.resolve()
    },
  })
})

afterEach(() => {
  system?.setMusicPlaylist(null)
  system = null
  window.localStorage.clear()
})

async function loadSystem(): Promise<AudioModule['audioSystem']> {
  const { audioSystem } = await import('./AudioSystem')
  system = audioSystem
  return audioSystem
}

/** A tap as a browser dispatches it, granting activation between its two halves. */
function tap(): void {
  window.dispatchEvent(new Event('pointerdown'))
  activated = true
  window.dispatchEvent(new Event('pointerup'))
}

function playingSources(): string[] {
  return [...playingElements].map((element) => element.src)
}

describe('resuming music on the first interaction', () => {
  it('starts the music on the first tap rather than the second', async () => {
    const audioSystem = await loadSystem()
    audioSystem.setMusicPlaylist('dashboard')
    await Promise.resolve()
    expect(playingSources()).toEqual([])

    tap()
    await Promise.resolve()

    expect(playingSources()).toEqual([
      expect.stringContaining(MUSIC_PLAYLISTS.dashboard[0] ?? ''),
    ])
  })

  it('starts the music on a mouse press, which grants activation at once', async () => {
    const audioSystem = await loadSystem()
    audioSystem.setMusicPlaylist('dashboard')

    activated = true
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()

    expect(playingSources()).toHaveLength(1)
  })

  it('does not call play() again once the music is playing', async () => {
    const audioSystem = await loadSystem()
    audioSystem.setMusicPlaylist('dashboard')
    tap()
    await Promise.resolve()
    const [track] = playingElements
    expect(track).toBeDefined()
    const callsWhenPlaying = playCalls.get(track as HTMLMediaElement)

    tap()
    window.dispatchEvent(new Event('keydown'))

    expect(playCalls.get(track as HTMLMediaElement)).toBe(callsWhenPlaying)
  })
})
