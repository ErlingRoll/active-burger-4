import type { CollectionState } from '../content/collections/Collections'
import type { AppServices } from '../services/AppServices'

/**
 * What the collections need before they can paint: the server's reading of
 * its own records. Fetched by the navigator while the previous screen is
 * still showing, so the cases open filled.
 *
 * This module ships in the entry chunk and must stay small: it imports
 * service types only and never the screen, or the route split collapses. An
 * architecture test holds that line.
 */
export interface CollectionsScreenData {
  state: CollectionState
}

export async function loadCollectionsScreen(
  services: AppServices,
): Promise<CollectionsScreenData | null> {
  const collections = services.collections.service
  if (!collections) {
    return null
  }
  return { state: await collections.loadState() }
}
