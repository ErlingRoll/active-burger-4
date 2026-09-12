import {
  createAuthenticationService,
  createNicknameService,
  type AuthenticationService,
  type NicknameService,
} from '../auth'
import {
  createDexiePersistenceStore,
  createPersistenceRepository,
  createDungeonRunPersistenceService,
  type PersistenceRepository,
  type DungeonRunPersistenceService,
} from '../persistence'
import {
  createMetaProgressionService,
  type MetaProgressionService,
} from '../meta'
import {
  createAbyssLeaderboardService,
  type AbyssLeaderboardService,
} from '../leaderboard/AbyssLeaderboardService'
import { createHubPresenceService, type HubPresenceService } from '../hub/HubPresenceService'
import { createBugReportService, type BugReportService } from '../bug-report'
import { createCharacterService } from '../characters/CharacterService'
import type { CharacterService } from '../characters/CharacterTypes'
import { createInventoryService } from '../inventory/InventoryService'
import type { InventoryService } from '../inventory/InventoryTypes'
import { createShopService } from '../shop/ShopService'
import type { ShopService } from '../shop/ShopTypes'
import { createLootBoxService, type LootBoxService } from '../loot'
import { createFishingService, type FishingService } from '../fishing/FishingService'
import { createCampService } from '../camp/CampService'
import type { CampService } from '../camp/CampTypes'
import { createContractService } from '../contracts/ContractService'
import type { ContractService } from '../contracts/ContractTypes'
import { createCollectionService, type CollectionService } from '../collections/CollectionService'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Constructs every service the application depends on, once.
 *
 * Each service used to be built by its own near-identical `useMemo` in
 * `App.tsx`: eleven copies of the same try/catch that re-read the same two
 * environment variables and re-derived the same client accessor, producing
 * eleven `{ service, configurationError }` pairs that were then prop-drilled
 * through the screen tree. Building them here means a misconfigured
 * environment is reported the same way everywhere, and a new service is one
 * entry rather than a fresh copy of the boilerplate.
 */

/**
 * A service that could not be constructed is `null` with the reason attached,
 * rather than a throw. A missing Supabase configuration must still render a
 * usable page that explains the problem.
 */
export interface ServiceHandle<TService> {
  service: TService | null
  configurationError: string | null
}

export interface SupabaseEnvironment {
  supabaseUrl?: string
  supabasePublishableKey?: string
  redirectUrl?: string
}

export interface AppServices {
  /** Local IndexedDB-backed settings and profile storage. */
  repository: PersistenceRepository
  authentication: ServiceHandle<AuthenticationService>
  nickname: ServiceHandle<NicknameService>
  meta: ServiceHandle<MetaProgressionService>
  characters: ServiceHandle<CharacterService>
  abyssLeaderboard: ServiceHandle<AbyssLeaderboardService>
  dungeonRunPersistence: ServiceHandle<DungeonRunPersistenceService>
  inventory: ServiceHandle<InventoryService>
  shop: ServiceHandle<ShopService>
  lootBoxes: ServiceHandle<LootBoxService>
  fishing: ServiceHandle<FishingService>
  camp: ServiceHandle<CampService>
  contracts: ServiceHandle<ContractService>
  collections: ServiceHandle<CollectionService>
  hubPresence: ServiceHandle<HubPresenceService>
  bugReport: ServiceHandle<BugReportService>
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : 'An unexpected error occurred.'
}

function handle<TService>(create: () => TService): ServiceHandle<TService> {
  try {
    return { service: create(), configurationError: null }
  } catch (error: unknown) {
    return { service: null, configurationError: errorMessage(error) }
  }
}

/** Reads the Supabase configuration Vite inlined at build time. */
export function readSupabaseEnvironment(): SupabaseEnvironment {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    redirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL,
  }
}

export function createAppServices(
  environment: SupabaseEnvironment = readSupabaseEnvironment(),
): AppServices {
  const { supabaseUrl, supabasePublishableKey, redirectUrl } = environment
  const connection = { supabaseUrl, supabasePublishableKey }

  const authentication = handle(() =>
    createAuthenticationService({ supabaseUrl, supabasePublishableKey, redirectUrl }),
  )
  // Every other Supabase-backed service borrows the authenticated client so a
  // single sign-in session is shared rather than duplicated per service.
  const getClient = (): SupabaseClient | undefined =>
    authentication.service?.getClient()

  return {
    repository: createPersistenceRepository(createDexiePersistenceStore()),
    authentication,
    nickname: handle(() => createNicknameService(connection, getClient)),
    meta: handle(() => createMetaProgressionService(connection, getClient)),
    characters: handle(() => createCharacterService(connection, getClient)),
    abyssLeaderboard: handle(() =>
      createAbyssLeaderboardService(connection, getClient),
    ),
    dungeonRunPersistence: handle(() =>
      createDungeonRunPersistenceService(connection, getClient),
    ),
    inventory: handle(() => createInventoryService(connection, getClient)),
    shop: handle(() => createShopService(connection, getClient)),
    lootBoxes: handle(() => createLootBoxService(connection, getClient)),
    fishing: handle(() => createFishingService(connection, getClient)),
    camp: handle(() => createCampService(connection, getClient)),
    contracts: handle(() => createContractService(connection, getClient)),
    collections: handle(() => createCollectionService(connection, getClient)),
    hubPresence: handle(() => createHubPresenceService(connection, getClient)),
    bugReport: handle(() => createBugReportService(connection, getClient)),
  }
}
