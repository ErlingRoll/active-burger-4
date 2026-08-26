import { describe, expect, it } from 'vitest'
import { resolveAuthEnvironment } from './AuthService'

describe('Supabase authentication configuration', () => {
  it('requires both public browser configuration values', () => {
    expect(() => resolveAuthEnvironment({})).toThrow(
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY',
    )
    expect(() => resolveAuthEnvironment({
      supabaseUrl: 'https://example.supabase.co',
    })).toThrow('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY')
  })

  it('trims valid public browser configuration values', () => {
    expect(resolveAuthEnvironment({
      supabaseUrl: ' https://example.supabase.co ',
      supabasePublishableKey: ' public-key ',
    })).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'public-key',
    })
  })
})
