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
}

export interface AuthAccount {
  id: string
  email: string | null
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
  signOut(): Promise<void>
  subscribe(onAccountChange: (account: AuthAccount | null) => void): () => void
}

const browserClients = new Map<string, SupabaseClient>()

export function resolveAuthEnvironment(
  environment: AuthEnvironment,
): Required<AuthEnvironment> {
  const supabaseUrl = environment.supabaseUrl?.trim()
  const supabasePublishableKey = environment.supabasePublishableKey?.trim()

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Authentication requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  return { supabaseUrl, supabasePublishableKey }
}

export function createAuthenticationService(
  environment: AuthEnvironment,
): AuthenticationService {
  const persistentClient = getSupabaseClient(environment, { persistSession: true })
  const sessionClient = getSupabaseClient(environment, { persistSession: false })
  return createAuthenticationServiceFromClient(
    persistentClient,
    (persistSession) => persistSession ? persistentClient : sessionClient,
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
      (_event: AuthChangeEvent, session: Session | null) => {
        onAccountChange(toAuthAccount(session))
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
      await ensureProfile(activeClient, account.id)
      return account
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
  }
}

async function ensureProfile(client: SupabaseClient, accountId: string): Promise<void> {
  const { error } = await client
    .from('profiles')
    .upsert({ id: accountId }, { onConflict: 'id' })
  if (error) {
    throw error
  }
}
