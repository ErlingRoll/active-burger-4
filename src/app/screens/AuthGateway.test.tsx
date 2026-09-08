// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen } from '../../testing/render'
import { AuthGateway } from './AuthGateway'
import type { AuthenticationState } from '../../auth'

function renderGateway(authentication: AuthenticationState) {
  const handlers = {
    onSignIn: vi.fn(() => Promise.resolve(true)),
    onSignUp: vi.fn(() => Promise.resolve(null)),
    onSignInWithDiscord: vi.fn(() => Promise.resolve(true)),
    onSignOut: vi.fn(() => Promise.resolve(true)),
  }
  const result = renderComponent(
    <AuthGateway authentication={authentication} {...handlers} />,
  )
  return { ...result, ...handlers }
}

describe('AuthGateway', () => {
  it('asks an unauthenticated visitor to sign in', () => {
    renderGateway({ status: 'ready', account: null, error: null })

    expect(
      screen.getByRole('heading', { name: 'Sign in to continue' }),
    ).toBeInTheDocument()
  })

  it('surfaces a configuration error rather than failing silently', () => {
    renderGateway({
      status: 'unavailable',
      account: null,
      error: 'Authentication is unavailable.',
    })

    expect(screen.getByText('Authentication is unavailable.')).toBeInTheDocument()
  })

  it('submits the credentials the visitor entered', async () => {
    const { user, onSignIn } = renderGateway({
      status: 'ready',
      account: null,
      error: null,
    })

    await user.type(screen.getByLabelText('Email'), 'player@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onSignIn).toHaveBeenCalledWith(
      'player@example.com',
      'correct horse',
      expect.anything(),
    )
  })
})
