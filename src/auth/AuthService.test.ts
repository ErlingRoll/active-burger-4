import { describe, expect, it } from 'vitest'
import {
  isAdminAppMetadata,
  isMissingProfileDisplayNameError,
  resolveProviderDisplayName,
  resolveAuthEnvironment,
  resolveAuthRedirectUrl,
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

  it('recognizes administrators from the auth app metadata role', () => {
    expect(isAdminAppMetadata({ role: 'admin' })).toBe(true)
    expect(isAdminAppMetadata({ role: 'user' })).toBe(false)
    expect(isAdminAppMetadata({ role: 'admin', nested: { role: 'user' } })).toBe(true)
    expect(isAdminAppMetadata(null)).toBe(false)
  })

  it('uses the Discord global name when no approved nickname is available', () => {
    expect(resolveProviderDisplayName({
      custom_claims: { global_name: 'BurgerKnight' },
      preferred_username: 'burger_knight',
    })).toBe('BurgerKnight')
  })

  it('falls back through other identity-provider display name fields', () => {
    expect(resolveProviderDisplayName({ preferred_username: 'burger_knight' }))
      .toBe('burger_knight')
    expect(resolveProviderDisplayName({})).toBeNull()
  })

  it('uses the configured OAuth redirect URL when provided', () => {
    expect(resolveAuthRedirectUrl(
      ' https://activeburger.com ',
      'http://127.0.0.1:3000',
    )).toBe('https://activeburger.com')
  })

  it('falls back to the current origin for local development', () => {
    expect(resolveAuthRedirectUrl(undefined, 'http://127.0.0.1:3000'))
      .toBe('http://127.0.0.1:3000')
  })

  it('ignores a stale localhost redirect when running on production origin', () => {
    expect(resolveAuthRedirectUrl(
      'http://localhost:3000',
      'https://activeburger.com',
    )).toBe('https://activeburger.com')
  })

  it('rejects non-HTTP OAuth redirect URLs', () => {
    expect(() => resolveAuthRedirectUrl('javascript:alert(1)'))
      .toThrow('VITE_AUTH_REDIRECT_URL must be an absolute HTTP(S) URL.')
  })
})
