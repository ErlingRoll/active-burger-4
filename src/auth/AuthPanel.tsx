import { useState, type FormEvent } from 'react'
import type { AuthAccount } from './AuthService'

export type AuthenticationStatus = 'unavailable' | 'loading' | 'ready' | 'error'

export interface AuthenticationState {
  status: AuthenticationStatus
  account: AuthAccount | null
  error: string | null
}

interface AuthPanelProps {
  authentication: AuthenticationState
  onSignIn: (email: string, password: string) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

export function AuthPanel({
  authentication,
  onSignIn,
  onSignOut,
}: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitSignIn = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSignIn(email, password)
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  if (authentication.account) {
    return (
      <section className="account-panel" aria-labelledby="account-title">
        <p className="screen-kicker">Account</p>
        <h3 id="account-title">Signed in</h3>
        <p className="account-email">{authentication.account.email ?? 'Email unavailable'}</p>
        {authentication.error ? (
          <p className="persistence-error" role="alert">{authentication.error}</p>
        ) : null}
        <button
          className="secondary-action"
          type="button"
          disabled={submitting}
          onClick={() => {
            setSubmitting(true)
            void onSignOut().finally(() => {
              setSubmitting(false)
            })
          }}
        >
          {submitting ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    )
  }

  if (authentication.status === 'unavailable') {
    return (
      <section className="account-panel" aria-labelledby="account-title">
        <p className="screen-kicker">Account</p>
        <h3 id="account-title">Authentication unavailable</h3>
        <p className="persistence-error" role="alert">
          {authentication.error}
        </p>
      </section>
    )
  }

  return (
    <section className="account-panel" aria-labelledby="account-title">
      <p className="screen-kicker">Account</p>
      <h3 id="account-title">Sign in</h3>
      <p>Sign in to prepare this device for account-backed progression.</p>
      <form className="sign-in-form" onSubmit={submitSignIn}>
        <label>
          Email
          <input
            autoComplete="email"
            disabled={authentication.status === 'loading' || submitting}
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            disabled={authentication.status === 'loading' || submitting}
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {authentication.error ? (
          <p className="persistence-error" role="alert">{authentication.error}</p>
        ) : null}
        <button
          className="secondary-action"
          disabled={authentication.status === 'loading' || submitting}
          type="submit"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}
