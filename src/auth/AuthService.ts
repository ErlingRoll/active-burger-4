import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'

export interface AuthEnvironment {
  supabaseUrl?: string
  supabasePublishableKey?: string
  redirectUrl?: string
}

export interface AuthAccount {
  id: string
  email: string | null
  displayName: string | null
}

export interface SignInOptions {
  persistSession?: boolean
}

export interface AuthenticationService {
  getSession(): Promise<AuthAccount | null>
  getClient(): SupabaseClient
  signInWithPassword(
    email: string,
    password: string,
    options?: SignInOptions,
  ): Promise<AuthAccount>
  signInWithDiscord(options?: SignInOptions): Promise<void>
  signOut(): Promise<void>
  subscribe(onAccountChange: (account: AuthAccount | null) => void): () => void
}

const browserClients = new Map<string, SupabaseClient>()

export function resolveAuthEnvironment(
  environment: AuthEnvironment,
): { supabaseUrl: string; supabasePublishableKey: string } {
  const supabaseUrl = environment.supabaseUrl?.trim()
  const supabasePublishableKey = environment.supabasePublishableKey?.trim()

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Authentication requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  return { supabaseUrl, supabasePublishableKey }
}

export function resolveAuthRedirectUrl(
  configuredRedirectUrl?: string,
  currentOrigin?: string,
): string | undefined {
  const redirectUrl = configuredRedirectUrl?.trim()
  if (redirectUrl) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(redirectUrl)
    } catch {
      throw new Error('VITE_AUTH_REDIRECT_URL must be an absolute HTTP(S) URL.')
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('VITE_AUTH_REDIRECT_URL must be an absolute HTTP(S) URL.')
    }
    return redirectUrl
  }
  return currentOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined)
}

export function isMissingProfileDisplayNameError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const candidate = error as { code?: unknown; message?: unknown }
  return candidate.code === 'PGRST204' &&
    typeof candidate.message === 'string' &&
    candidate.message.includes("Could not find the 'display_name' column of 'profiles'")
}

export function createAuthenticationService(
  environment: AuthEnvironment,
): AuthenticationService {
  const { supabaseUrl, supabasePublishableKey } = resolveAuthEnvironment(environment)
  const redirectTo = resolveAuthRedirectUrl(environment.redirectUrl)
  const resolvedEnvironment = { supabaseUrl, supabasePublishableKey }
  const persistentClient = getSupabaseClient(resolvedEnvironment, { persistSession: true })
  const sessionClient = getSupabaseClient(resolvedEnvironment, { persistSession: false })
  return createAuthenticationServiceFromClient(
    persistentClient,
    (persistSession) => persistSession ? persistentClient : sessionClient,
    redirectTo,
  )
}

export function getSupabaseClient(
  environment: AuthEnvironment,
  options: SignInOptions = {},
): SupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = resolveAuthEnvironment(environment)
  const persistSession = options.persistSession ?? true
  const configuration = `${supabaseUrl}\u0000${supabasePublishableKey}\u0000${persistSession}`
  const existingClient = browserClients.get(configuration)
  if (existingClient) {
    return existingClient
  }
  const authOptions = persistSession
    ? { persistSession }
    : {
        persistSession,
        storageKey: `active-burger-4-session-${encodeURIComponent(supabaseUrl)}`,
      }
  const client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: authOptions,
  })
  browserClients.set(configuration, client)
  return client
}

export function createAuthenticationServiceFromClient(
  client: SupabaseClient,
  resolveClient: (persistSession: boolean) => SupabaseClient = () => client,
  redirectTo: string | undefined = resolveAuthRedirectUrl(),
): AuthenticationService {
  let activeClient = client
  const listeners = new Set<(account: AuthAccount | null) => void>()
  const subscriptions = new Map<
    (account: AuthAccount | null) => void,
    { unsubscribe: () => void }
  >()

  const subscribeToActiveClient = (
    onAccountChange: (account: AuthAccount | null) => void,
  ): void => {
    const { data } = activeClient.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        const account = toAuthAccount(session)
        if (account && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          void ensureProfile(activeClient, account.id, account.displayName)
        }
        onAccountChange(account)
      },
    )
    subscriptions.set(onAccountChange, data.subscription)
  }

  const switchClient = (persistSession: boolean): void => {
    const nextClient = resolveClient(persistSession)
    if (nextClient === activeClient) {
      return
    }
    for (const subscription of subscriptions.values()) {
      subscription.unsubscribe()
    }
    subscriptions.clear()
    activeClient = nextClient
    for (const onAccountChange of listeners) {
      subscribeToActiveClient(onAccountChange)
    }
  }

  return {
    getClient(): SupabaseClient {
      return activeClient
    },

    async getSession(): Promise<AuthAccount | null> {
      const { data, error } = await activeClient.auth.getSession()
      if (error) {
        throw error
      }
      return toAuthAccount(data.session)
    },

    async signInWithPassword(
      email: string,
      password: string,
      options: SignInOptions = {},
    ): Promise<AuthAccount> {
      switchClient(options.persistSession ?? true)
      const { data, error } = await activeClient.auth.signInWithPassword({ email, password })
      if (error) {
        throw error
      }
      const account = toAuthAccount(data.session)
      if (!account) {
        throw new Error('Authentication completed without an active session.')
      }
      await ensureProfile(activeClient, account.id, account.displayName)
      return account
    },

    async signInWithDiscord(options: SignInOptions = {}): Promise<void> {
      switchClient(options.persistSession ?? true)
      const { error } = await activeClient.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo,
        },
      })
      if (error) {
        throw error
      }
    },

    async signOut(): Promise<void> {
      const { error } = await activeClient.auth.signOut()
      if (error) {
        throw error
      }
    },

    subscribe(onAccountChange: (account: AuthAccount | null) => void): () => void {
      listeners.add(onAccountChange)
      subscribeToActiveClient(onAccountChange)
      return () => {
        listeners.delete(onAccountChange)
        subscriptions.get(onAccountChange)?.unsubscribe()
        subscriptions.delete(onAccountChange)
      }
    },
  }
}

function toAuthAccount(session: Session | null): AuthAccount | null {
  return session ? toAuthAccountFromUser(session.user) : null
}

function toAuthAccountFromUser(user: User): AuthAccount {
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: resolveDisplayName(user),
  }
}

function resolveDisplayName(user: User): string | null {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const candidates = [
    metadata?.full_name,
    metadata?.name,
    metadata?.custom_claims && typeof metadata.custom_claims === 'object'
      ? (metadata.custom_claims as Record<string, unknown>).global_name
      : undefined,
    metadata?.preferred_username,
    metadata?.user_name,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

async function ensureProfile(
  client: SupabaseClient,
  accountId: string,
  displayName: string | null,
): Promise<void> {
  const response = await client
    .from('profiles')
    .upsert({ id: accountId, display_name: displayName }, { onConflict: 'id' })
  if (!response.error) {
    return
  }
  if (!isMissingProfileDisplayNameError(response.error)) {
    throw response.error
  }

  const fallbackResponse = await client
    .from('profiles')
    .upsert({ id: accountId }, { onConflict: 'id' })
  if (fallbackResponse.error) {
    throw fallbackResponse.error
  }
}
