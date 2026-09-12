import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  AuthenticationService,
  AuthenticationState,
  SignInOptions,
  SignUpResult,
} from '../../auth'
import type { ServiceHandle } from '../../services'
import { errorMessage } from '../runFormatting'

function createInitialAuthenticationState(
  service: AuthenticationService | null,
  configurationError: string | null,
): AuthenticationState {
  return service
    ? { status: 'loading', account: null, error: null }
    : {
        status: 'unavailable',
        account: null,
        error: configurationError ?? 'Authentication is unavailable.',
      }
}

/**
 * Who is signed in.
 *
 * The state and the subscription that keeps it current. The sign-in and
 * sign-out actions live in `useAuthenticationActions` below, because signing
 * out resets every other domain and those domains need the account this
 * hook provides: the state comes first, the actions after the rest.
 */
export function useAuthenticationState(authenticationService: ServiceHandle<AuthenticationService>) {
  const [authentication, setAuthentication] = useState<AuthenticationState>(() =>
    createInitialAuthenticationState(
      authenticationService.service,
      authenticationService.configurationError,
    ),
  )

  useEffect(() => {
    const service = authenticationService.service
    if (!service) {
      return
    }

    let cancelled = false
    const unsubscribe = service.subscribe((account) => {
      if (!cancelled) {
        setAuthentication({ status: 'ready', account, error: null })
      }
    })
    void service
      .getSession()
      .then((account) => {
        if (!cancelled) {
          setAuthentication({ status: 'ready', account, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        }
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [authenticationService])

  return { authentication, setAuthentication }
}

interface AuthenticationActionsOptions {
  /** Runs after a password sign-in or sign-up lands an account. */
  onSignedIn: () => void
  /** Runs after a sign-out lands, to clear what the account owned. */
  onSignedOut: () => void
}

export function useAuthenticationActions(
  authenticationService: ServiceHandle<AuthenticationService>,
  setAuthentication: Dispatch<SetStateAction<AuthenticationState>>,
  { onSignedIn, onSignedOut }: AuthenticationActionsOptions,
) {
  const signIn = useCallback(
    async (
      email: string,
      password: string,
      options?: SignInOptions,
    ): Promise<boolean> => {
      const service = authenticationService.service
      if (!service) {
        setAuthentication({
          status: 'unavailable',
          account: null,
          error: authenticationService.configurationError ?? 'Authentication unavailable.',
        })
        return false
      }
      try {
        const account = await service.signInWithPassword(email, password, options)
        setAuthentication({ status: 'ready', account, error: null })
        onSignedIn()
        return true
      } catch (error: unknown) {
        setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        return false
      }
    },
    [authenticationService, onSignedIn, setAuthentication],
  )

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      options?: SignInOptions,
    ): Promise<SignUpResult | null> => {
      const service = authenticationService.service
      if (!service) {
        setAuthentication({
          status: 'unavailable',
          account: null,
          error: authenticationService.configurationError ?? 'Authentication unavailable.',
        })
        return null
      }
      try {
        const result = await service.signUpWithPassword(email, password, options)
        if (result.account) {
          setAuthentication({ status: 'ready', account: result.account, error: null })
          onSignedIn()
        } else {
          setAuthentication({ status: 'ready', account: null, error: null })
        }
        return result
      } catch (error: unknown) {
        setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        return null
      }
    },
    [authenticationService, onSignedIn, setAuthentication],
  )

  const signInWithDiscord = useCallback(
    async (options?: SignInOptions): Promise<boolean> => {
      const service = authenticationService.service
      if (!service) {
        setAuthentication({
          status: 'unavailable',
          account: null,
          error: authenticationService.configurationError ?? 'Authentication unavailable.',
        })
        return false
      }
      try {
        await service.signInWithDiscord(options)
        return true
      } catch (error: unknown) {
        setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        return false
      }
    },
    [authenticationService, setAuthentication],
  )

  const signOut = useCallback(async (): Promise<boolean> => {
    const service = authenticationService.service
    if (!service) {
      setAuthentication({
        status: 'unavailable',
        account: null,
        error: authenticationService.configurationError ?? 'Authentication unavailable.',
      })
      return false
    }
    try {
      await service.signOut()
      setAuthentication({ status: 'ready', account: null, error: null })
      onSignedOut()
      return true
    } catch (error: unknown) {
      setAuthentication((current) => ({
        ...current,
        status: 'error',
        error: errorMessage(error),
      }))
      return false
    }
  }, [authenticationService, onSignedOut, setAuthentication])

  return { signIn, signUp, signInWithDiscord, signOut }
}
