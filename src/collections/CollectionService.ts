import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRarity } from '../content/rarity/Rarity'
import type {
  ArtifactCollectionEntry,
  ClassCollectionEntry,
  CollectionState,
  FishCollectionEntry,
} from '../content/collections/Collections'

/**
 * The collections, as the browser sees them.
 *
 * One read, three pages, all derived by the server from what it recorded.
 * There is nothing to write: a milestone is reached, never claimed.
 */
export interface CollectionService {
  loadState(): Promise<CollectionState>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function invalidResponse(message: string): Error {
  return new Error(`The collections returned an invalid response: ${message}`)
}

/** A rarity the content knows, or null for a record the content cannot place. */
function readRarity(value: unknown): FishCollectionEntry['bestRarity'] {
  return isRarity(value) ? value : null
}

function readFish(value: unknown): FishCollectionEntry {
  if (!isRecord(value) || !isNonEmptyString(value.definition_id) || !isCount(value.catches)) {
    throw invalidResponse('expected a fish row')
  }
  const size = typeof value.record_size_percentile === 'number' && Number.isFinite(value.record_size_percentile)
    ? value.record_size_percentile
    : typeof value.record_size_percentile === 'string' && Number.isFinite(Number(value.record_size_percentile))
      ? Number(value.record_size_percentile)
      : null
  return {
    definitionId: value.definition_id,
    catches: value.catches,
    bestRarity: readRarity(value.best_rarity),
    recordSizePercentile: size,
  }
}

function readArtifact(value: unknown): ArtifactCollectionEntry {
  if (!isRecord(value) || !isNonEmptyString(value.definition_id) || !isCount(value.found)) {
    throw invalidResponse('expected an artifact row')
  }
  return {
    definitionId: value.definition_id,
    found: value.found,
    bestRarity: readRarity(value.best_rarity),
  }
}

function readClass(value: unknown): ClassCollectionEntry {
  if (!isRecord(value) || !isNonEmptyString(value.class_id) ||
    !isCount(value.victories) || !isCount(value.deepest_abyss_floor)) {
    throw invalidResponse('expected a class row')
  }
  return {
    classId: value.class_id,
    victories: value.victories,
    deepestAbyssFloor: value.deepest_abyss_floor,
  }
}

export function createCollectionService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): CollectionService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async loadState(): Promise<CollectionState> {
      const response = await getClient().rpc('get_collection_state', {})
      if (response.error) {
        throw response.error
      }
      const data: unknown = response.data
      if (!isRecord(data) || !Array.isArray(data.fish) || !Array.isArray(data.artifacts) || !Array.isArray(data.classes)) {
        throw invalidResponse('expected three pages')
      }
      return {
        fish: data.fish.map(readFish),
        artifacts: data.artifacts.map(readArtifact),
        classes: data.classes.map(readClass),
      }
    },
  }
}
