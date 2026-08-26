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

export interface AuthenticationService {
  getSession(): Promise<AuthAccount | null>
  signInWithPassword(email: string, password: string): Promise<AuthAccount>
  signOut(): Promise<void>
  subscribe(onAccountChange: (account: AuthAccount | null) => void): () => void
}

let browserClient: SupabaseClient | null = null
let browserClientConfiguration: string | null = null

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
  return createAuthenticationServiceFromClient(getSupabaseClient(environment))
}

export function getSupabaseClient(environment: AuthEnvironment): SupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = resolveAuthEnvironment(environment)
  const configuration = `${supabaseUrl}\u0000${supabasePublishableKey}`
  const client = browserClientConfiguration === configuration && browserClient
    ? browserClient
    : createClient(supabaseUrl, supabasePublishableKey)
  browserClient = client
  browserClientConfiguration = configuration
  return client
}

export function createAuthenticationServiceFromClient(
  client: SupabaseClient,
): AuthenticationService {
  return {
    async getSession(): Promise<AuthAccount | null> {
      const { data, error } = await client.auth.getSession()
      if (error) {
        throw error
      }
      return toAuthAccount(data.session)
    },

    async signInWithPassword(email: string, password: string): Promise<AuthAccount> {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error) {
        throw error
      }
      const account = toAuthAccount(data.session)
      if (!account) {
        throw new Error('Authentication completed without an active session.')
      }
      await ensureProfile(client, account.id)
      return account
    },

    async signOut(): Promise<void> {
      const { error } = await client.auth.signOut()
      if (error) {
        throw error
      }
    },

    subscribe(onAccountChange: (account: AuthAccount | null) => void): () => void {
      const { data } = client.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          onAccountChange(toAuthAccount(session))
        },
      )
      return () => {
        data.subscription.unsubscribe()
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
