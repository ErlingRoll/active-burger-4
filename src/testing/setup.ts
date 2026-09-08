import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'

/**
 * Global Vitest setup.
 *
 * Component specs opt into jsdom per file with `// @vitest-environment jsdom`;
 * the simulation suite stays environment-free so it keeps proving that
 * `src/game/` runs without a DOM. Everything below is guarded on a DOM being
 * present so this file is inert for the environment-free files.
 */
if (typeof window !== 'undefined') {
  // `fake-indexeddb/auto` above installs an in-memory IndexedDB. Without it
  // Dexie fails to open and the app renders its "Saved settings unavailable"
  // fallback, so component specs would exercise the degraded path instead of
  // the real one.

  // jsdom implements no media pipeline: `play()` returns undefined instead of a
  // promise and `load()` is unimplemented, which throws inside AudioSystem.
  // Stubbing them keeps component specs focused on the component under test.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: () => undefined,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: () => undefined,
  })

  // jsdom has no layout engine, so elements report zero-sized rects and
  // ResizeObserver is absent. Components that measure themselves need both.
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverStub,
    })
  }

  if (!('matchMedia' in window)) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
}

afterEach(() => {
  cleanup()
})
