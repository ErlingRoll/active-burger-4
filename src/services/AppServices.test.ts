import { describe, expect, it } from 'vitest'
import { createAppServices } from './AppServices'

/**
 * A missing or malformed Supabase configuration must not throw during startup:
 * the app still has to render and explain the problem. These tests pin that
 * every remote service reports its failure through the same handle shape.
 */
const REMOTE_SERVICE_KEYS = [
  'authentication',
  'nickname',
  'meta',
  'characters',
  'abyssLeaderboard',
  'dungeonRunPersistence',
  'inventory',
  'lootBoxes',
  'fishing',
  'camp',
  'contracts',
  'collections',
  'hubPresence',
  'bugReport',
] as const

describe('createAppServices', () => {
  it('constructs every service when the environment is configured', () => {
    const services = createAppServices({
      supabaseUrl: 'https://project.supabase.co',
      supabasePublishableKey: 'publishable-key',
    })

    for (const key of REMOTE_SERVICE_KEYS) {
      expect(services[key].service, key).not.toBeNull()
      expect(services[key].configurationError, key).toBeNull()
    }
  })

  it('reports a configuration error per service instead of throwing', () => {
    const services = createAppServices({
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    })

    for (const key of REMOTE_SERVICE_KEYS) {
      expect(services[key].service, key).toBeNull()
      expect(services[key].configurationError, key).toEqual(expect.any(String))
    }
  })

  it('always provides local persistence, which needs no remote configuration', () => {
    const services = createAppServices({})

    expect(services.repository).toBeDefined()
  })
})
