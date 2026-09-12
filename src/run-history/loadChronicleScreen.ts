import type { FinishedDungeonRun } from '../persistence'
import type { AppServices } from '../services/AppServices'

/** How many finished runs the chronicle keeps in view. */
export const CHRONICLE_LIMIT = 25

/**
 * What the chronicle needs before it can paint: the list of finished runs.
 * Each run's report stays lazy, loaded when its row is opened. Service types
 * only; never the screen.
 */
export interface ChronicleScreenData {
  runs: FinishedDungeonRun[]
}

export async function loadChronicleScreen(
  services: AppServices,
): Promise<ChronicleScreenData | null> {
  const persistence = services.dungeonRunPersistence.service
  if (!persistence) {
    return null
  }
  return { runs: await persistence.listFinishedRuns(CHRONICLE_LIMIT) }
}
