import { useState, type FormEvent } from 'react'
import type { AuthAccount, SignInOptions, SignUpResult } from './AuthService'
import { getPlayerDisplayName } from './PlayerName'

export type AuthenticationStatus = 'unavailable' | 'loading' | 'ready' | 'error'

export interface AuthenticationState {
  status: AuthenticationStatus
  account: AuthAccount | null
  error: string | null
}

interface AuthPanelProps {
  authentication: AuthenticationState
  onSignIn: (
    email: string,
    password: string,
    options?: SignInOptions,
  ) => Promise<boolean>
  onSignUp: (
    email: string,
    password: string,
    options?: SignInOptions,
  ) => Promise<SignUpResult | null>
  onSignInWithDiscord: (options?: SignInOptions) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

export function AuthPanel({
  authentication,
  onSignIn,
  onSignUp,
  onSignInWithDiscord,
  onSignOut,
}: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [persistSession, setPersistSession] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [discordSubmitting, setDiscordSubmitting] = useState(false)

  const submitCredentials = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setFormError(null)
    setConfirmationMessage(null)
    if (mode === 'sign-up' && password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password, { persistSession })
      } else {
        const result = await onSignUp(email, password, { persistSession })
        if (result?.needsEmailConfirmation) {
          setConfirmationMessage(
            `Check ${email} for a confirmation email, then sign in to continue.`,
          )
          setMode('sign-in')
        }
      }
      setPassword('')
      setConfirmPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const submitDiscordSignIn = async (): Promise<void> => {
    setDiscordSubmitting(true)
    try {
      await onSignInWithDiscord({ persistSession })
    } finally {
      setDiscordSubmitting(false)
    }
  }

  if (authentication.account) {
    return (
      <section className="account-panel" aria-labelledby="account-title">
        <p className="screen-kicker">Account</p>
        <h3 id="account-title">Signed in</h3>
        <p className="account-email">
          {getPlayerDisplayName({
            providerDisplayName: authentication.account.displayName,
            fallback: authentication.account.email,
          })}
        </p>
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
      <h3 id="account-title">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h3>
      <p>
        {mode === 'sign-in'
          ? 'Sign in to prepare this device for account-backed progression.'
          : 'Create an account with your email address and password.'}
      </p>
      <button
        className="primary-action discord-sign-in"
        type="button"
        disabled={authentication.status === 'loading' || discordSubmitting}
        onClick={() => {
          void submitDiscordSignIn()
        }}
      >
        <DiscordIcon />
        {discordSubmitting ? 'Redirecting to Discord…' : 'Continue with Discord'}
      </button>
      <div className="sign-in-divider" role="separator" aria-label="or">
        <span>or</span>
      </div>
      <form className="sign-in-form" onSubmit={submitCredentials}>
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
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            disabled={authentication.status === 'loading' || submitting}
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === 'sign-up' ? (
          <label>
            Confirm password
            <input
              autoComplete="new-password"
              disabled={authentication.status === 'loading' || submitting}
              name="confirm-password"
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        ) : null}
        <label className="remember-session">
          <input
            checked={persistSession}
            disabled={authentication.status === 'loading' || submitting}
            name="persist-session"
            type="checkbox"
            onChange={(event) => setPersistSession(event.target.checked)}
          />
          Keep me signed in on this browser
        </label>
        {formError ? (
          <p className="persistence-error" role="alert">{formError}</p>
        ) : null}
        {authentication.error ? (
          <p className="persistence-error" role="alert">{authentication.error}</p>
        ) : null}
        {confirmationMessage ? (
          <p className="auth-success" role="status">{confirmationMessage}</p>
        ) : null}
        <button
          className="secondary-action"
          disabled={authentication.status === 'loading' || submitting}
          type="submit"
        >
          {submitting
            ? mode === 'sign-in' ? 'Signing in…' : 'Creating account…'
            : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
        <button
          className="text-action"
          disabled={authentication.status === 'loading' || submitting}
          type="button"
          onClick={() => {
            setMode((currentMode) => currentMode === 'sign-in' ? 'sign-up' : 'sign-in')
            setPassword('')
            setConfirmPassword('')
            setFormError(null)
            setConfirmationMessage(null)
          }}
        >
          {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
        </button>
      </form>
    </section>
  )
}

function DiscordIcon() {
  return (
    <svg
      aria-hidden="true"
      className="discord-icon"
      focusable="false"
      height="20"
      viewBox="0 0 127.14 96.36"
      width="20"
    >
      <path
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
        fill="currentColor"
      />
    </svg>
  )
}
