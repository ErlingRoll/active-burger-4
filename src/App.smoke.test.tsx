// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderComponent, screen, waitFor } from './testing/render'
import App from './App'

/**
 * A whole-app smoke test.
 *
 * The screens below are large and were extracted from a single component; this
 * spec is the regression net for that work. It asserts only what must remain
 * true regardless of layout: the app mounts without throwing, and an
 * unauthenticated visitor is offered the sign-in gateway rather than the
 * dashboard.
 *
 * Supabase is stubbed rather than configured so the test never reaches the
 * network and never depends on a project being provisioned.
 */
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
      track: () => Promise.resolve(),
      untrack: () => Promise.resolve(),
    }),
    removeChannel: () => Promise.resolve(),
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
}))

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('mounts and offers the sign-in gateway to an unauthenticated visitor', async () => {
    renderComponent(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Sign in to continue' }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'Current dungeon' })).toBeNull()
  })
})
