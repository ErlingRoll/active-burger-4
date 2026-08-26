import { describe, expect, it, vi } from 'vitest'
import type { PendingCompletedRunResultDto } from '../persistence'
import type { MetaProgressionSnapshot } from './MetaProgressionService'
import { createPendingRunSyncCoordinator } from './PendingRunSyncCoordinator'

const snapshot: MetaProgressionSnapshot = {
  wallet: { essenceBalance: 10, essenceEarned: 10, essenceSpent: 0 },
  definitions: [],
  unlockedIds: [],
}

function pending(id: string): PendingCompletedRunResultDto {
  return {
    id,
    schemaVersion: 1,
    runId: `run-${id}`,
    completedAt: 1,
    payload: {
      phase: 'results',
      elapsedTime: 1,
      level: 1,
      xp: 0,
      killCount: 0,
    },
  }
}

describe('pending run sync coordination', () => {
  it('syncs an authenticated queued completion and removes it after success', async () => {
    const queued = pending('queued-1')
    const pendingResults = [queued]
    const syncPendingResults = vi.fn().mockResolvedValue({
      processedCount: 1,
      snapshot,
    })
    const removePendingResult = vi.fn().mockResolvedValue(undefined)
    const onSyncSuccess = vi.fn()
    const coordinator = createPendingRunSyncCoordinator({
      canSync: () => true,
      getPendingResults: () => pendingResults,
      syncPendingResults,
      removePendingResult,
      onSyncStart: vi.fn(),
      onSyncSuccess,
      onNoPendingResults: vi.fn(),
      onSyncError: vi.fn(),
    })

    await coordinator.request([queued])

    expect(syncPendingResults).toHaveBeenCalledWith([queued])
    expect(removePendingResult).toHaveBeenCalledWith('queued-1')
    expect(onSyncSuccess).toHaveBeenCalledWith([queued], { processedCount: 1, snapshot })
  })

  it('does not submit an unauthenticated queued completion', async () => {
    const syncPendingResults = vi.fn()
    const coordinator = createPendingRunSyncCoordinator({
      canSync: () => false,
      getPendingResults: () => [pending('queued-1')],
      syncPendingResults,
      removePendingResult: vi.fn(),
      onSyncStart: vi.fn(),
      onSyncSuccess: vi.fn(),
      onNoPendingResults: vi.fn(),
      onSyncError: vi.fn(),
    })

    await coordinator.request()

    expect(syncPendingResults).not.toHaveBeenCalled()
  })

  it('retains queued results and exposes sync failures', async () => {
    const syncError = new Error('sync failed')
    const onSyncError = vi.fn()
    const removePendingResult = vi.fn()
    const coordinator = createPendingRunSyncCoordinator({
      canSync: () => true,
      getPendingResults: () => [pending('queued-1')],
      syncPendingResults: vi.fn().mockRejectedValue(syncError),
      removePendingResult,
      onSyncStart: vi.fn(),
      onSyncSuccess: vi.fn(),
      onNoPendingResults: vi.fn(),
      onSyncError,
    })

    await coordinator.request()

    expect(removePendingResult).not.toHaveBeenCalled()
    expect(onSyncError).toHaveBeenCalledWith(syncError)
  })

  it('serializes overlapping requests and retries newly queued results', async () => {
    const first = pending('queued-1')
    const second = pending('queued-2')
    let resolveFirst: ((value: { processedCount: number; snapshot: MetaProgressionSnapshot }) => void) | undefined
    const syncPendingResults = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve
      }))
      .mockResolvedValueOnce({ processedCount: 1, snapshot })
    const pendingResults = [first]
    const coordinator = createPendingRunSyncCoordinator({
      canSync: () => true,
      getPendingResults: () => pendingResults,
      syncPendingResults,
      removePendingResult: vi.fn().mockResolvedValue(undefined),
      onSyncStart: vi.fn(),
      onSyncSuccess: vi.fn((results) => {
        for (const result of results) {
          const index = pendingResults.findIndex((pendingResult) => pendingResult.id === result.id)
          if (index >= 0) {
            pendingResults.splice(index, 1)
          }
        }
      }),
      onNoPendingResults: vi.fn(),
      onSyncError: vi.fn(),
    })

    const firstRequest = coordinator.request()
    pendingResults.push(second)
    const overlappingRequest = coordinator.request([second])
    resolveFirst?.({ processedCount: 1, snapshot })
    await Promise.all([firstRequest, overlappingRequest])
    await vi.waitFor(() => expect(syncPendingResults).toHaveBeenCalledTimes(2))

    expect(syncPendingResults).toHaveBeenNthCalledWith(1, [first])
    expect(syncPendingResults).toHaveBeenNthCalledWith(2, [second])
  })
})
