import { describe, expect, it } from 'vitest'
import {
  APP_ROUTE_PATHS,
  getCanonicalPath,
  getMusicPlaylistId,
  getRunModeForPath,
  getScreenForPath,
  RUN_SETUP_ABYSS_PATH,
} from './routing'

describe('getScreenForPath', () => {
  it('maps each screen path back to its screen', () => {
    for (const [screen, path] of Object.entries(APP_ROUTE_PATHS)) {
      // Gameplay and results are transient states rendered at the root path,
      // so the root resolves to the dashboard rather than back to them.
      const expected = path === '/' ? 'dashboard' : screen
      expect(getScreenForPath(path), path).toBe(expected)
    }
  })

  it('treats both run setup paths and the legacy path as run setup', () => {
    expect(getScreenForPath('/prepare/dungeon')).toBe('run-setup')
    expect(getScreenForPath(RUN_SETUP_ABYSS_PATH)).toBe('run-setup')
    expect(getScreenForPath('/prepare')).toBe('run-setup')
  })

  it('ignores a trailing slash', () => {
    expect(getScreenForPath('/wiki/')).toBe('wiki')
    expect(getScreenForPath('/admin/nicknames/')).toBe('nickname-moderation')
  })

  it('falls back to the dashboard for an unknown path', () => {
    expect(getScreenForPath('/does-not-exist')).toBe('dashboard')
  })
})

describe('getRunModeForPath', () => {
  it('selects the Abyss only for the Abyss preparation path', () => {
    expect(getRunModeForPath(RUN_SETUP_ABYSS_PATH)).toBe('infinite-abyss')
    expect(getRunModeForPath('/prepare/dungeon')).toBe('dungeon')
    expect(getRunModeForPath('/')).toBe('dungeon')
  })
})

describe('getCanonicalPath', () => {
  it('rewrites the legacy preparation path to the dungeon path', () => {
    expect(getCanonicalPath('/prepare')).toBe('/prepare/dungeon')
  })

  it('preserves the Abyss path, which shares a screen with the dungeon path', () => {
    expect(getCanonicalPath(RUN_SETUP_ABYSS_PATH)).toBe(RUN_SETUP_ABYSS_PATH)
  })

  it('strips a trailing slash', () => {
    expect(getCanonicalPath('/wiki/')).toBe('/wiki')
  })
})

describe('getMusicPlaylistId', () => {
  it('plays the mode-specific playlist during gameplay', () => {
    expect(getMusicPlaylistId('gameplay', 'dungeon')).toBe('dungeon')
    expect(getMusicPlaylistId('gameplay', 'infinite-abyss')).toBe('abyss')
  })

  it('plays the hub and pond playlists on their screens', () => {
    expect(getMusicPlaylistId('dashboard', 'dungeon')).toBe('dashboard')
    expect(getMusicPlaylistId('fishing', 'dungeon')).toBe('fishing')
    expect(getMusicPlaylistId('camp', 'dungeon')).toBe('dashboard')
  })

  it('plays nothing on screens without their own music', () => {
    expect(getMusicPlaylistId('wiki', 'dungeon')).toBeNull()
    expect(getMusicPlaylistId('results', 'dungeon')).toBeNull()
  })
})
