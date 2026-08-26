import type { PendingCompletedRunResultDto } from '../persistence'
import type { RunSyncResult } from './MetaProgressionService'

export interface PendingRunSyncCoordinator {
  request(additionalResults?: readonly PendingCompletedRunResultDto[]): Promise<void>
}

export interface PendingRunSyncCoordinatorOptions {
  canSync: () => boolean
  getPendingResults: () => readonly PendingCompletedRunResultDto[]
  syncPendingResults: (
    results: readonly PendingCompletedRunResultDto[],
  ) => Promise<RunSyncResult>
  removePendingResult: (id: string) => Promise<void>
  onSyncStart: () => void
  onSyncSuccess: (
    results: readonly PendingCompletedRunResultDto[],
    syncResult: RunSyncResult,
  ) => void
  onNoPendingResults: () => void
  onSyncError: (error: unknown) => void
}

function mergePendingResults(
  current: readonly PendingCompletedRunResultDto[],
  additional: readonly PendingCompletedRunResultDto[],
): PendingCompletedRunResultDto[] {
  const byId = new Map<string, PendingCompletedRunResultDto>()
  for (const result of [...current, ...additional]) {
    byId.set(result.id, result)
  }
  return [...byId.values()]
}

export function createPendingRunSyncCoordinator(
  options: PendingRunSyncCoordinatorOptions,
): PendingRunSyncCoordinator {
  let inFlight: Promise<void> | null = null
  let rerunRequested = false

  const request = async (
    additionalResults: readonly PendingCompletedRunResultDto[] = [],
  ): Promise<void> => {
    if (!options.canSync()) {
      return
    }
    if (inFlight) {
      rerunRequested = true
      await inFlight
      return
    }

    const results = mergePendingResults(options.getPendingResults(), additionalResults)
    if (results.length === 0) {
      options.onNoPendingResults()
      return
    }

    const sync = async (): Promise<void> => {
      options.onSyncStart()
      try {
        const syncResult = await options.syncPendingResults(results)
        for (const result of results) {
          await options.removePendingResult(result.id)
        }
        options.onSyncSuccess(results, syncResult)
      } catch (error: unknown) {
        options.onSyncError(error)
      } finally {
        inFlight = null
        if (rerunRequested) {
          rerunRequested = false
          void request()
        }
      }
    }

    inFlight = sync()
    await inFlight
  }

  return { request }
}
