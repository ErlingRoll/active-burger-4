import { describe, expect, it } from 'vitest'
import {
  isMissingProfileDisplayNameError,
  resolveAuthEnvironment,
} from './AuthService'

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

  it('recognizes a stale schema cache for the optional display name column', () => {
    expect(isMissingProfileDisplayNameError({
      code: 'PGRST204',
      message: "Could not find the 'display_name' column of 'profiles' in the schema cache",
    })).toBe(true)
    expect(isMissingProfileDisplayNameError({
      code: '42501',
      message: 'new row violates row-level security policy',
    })).toBe(false)
  })
})
