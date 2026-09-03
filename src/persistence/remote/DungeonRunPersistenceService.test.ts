import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createDungeonRunPersistenceService,
} from './DungeonRunPersistenceService'

const activeRow = {
  id: 'run-1',
  status: 'active',
  mode_id: 'dungeon',
  preparation: { version: 1, items: [] },
  contract_id: 'default-dungeon-10-floor',
  world_modifier_ids: ['fast-start'],
  seed: 42,
  dungeon_id: 'default-dungeon',
  class_id: 'ranger',
  game_version: 'test',
  max_floor: 30,
  current_floor: 2,
  started_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:01:00.000Z',
}

const checkpointRow = {
  snapshot_kind: 'floor',
  floor_number: 2,
  payload: { version: 1, gameState: { run: { floor: 2 } } },
  saved_at: '2026-09-01T00:01:00.000Z',
}

function query(response: unknown) {
  const builder = {
    select: () => builder,
    in: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: response, error: null }),
    single: async () => ({ data: response, error: null }),
  }
  return builder
}

function fakeClient(options: {
  run?: unknown
  snapshot?: unknown
  rpc?: (name: string, params: Record<string, unknown>) => unknown
} = {}): SupabaseClient {
  return {
    from: vi.fn((table: string) =>
      query(table === 'dungeon_runs' ? options.run ?? null : options.snapshot ?? null)),
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => ({
      data: options.rpc?.(name, params) ?? [],
      error: null,
    })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createDungeonRunPersistenceService(
    {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    },
    () => client,
  )
}

describe('DungeonRunPersistenceService', () => {
  it('loads the owner active run and latest checkpoint', async () => {
    const service = createService(fakeClient({
      run: activeRow,
      snapshot: checkpointRow,
    }))

    await expect(service.loadActiveRun()).resolves.toEqual({
      runId: 'run-1',
      status: 'active',
      modeId: 'dungeon',
      preparation: { version: 1, items: [] },
      seed: 42,
      dungeonId: 'default-dungeon',
      characterClassId: 'ranger',
      currentFloor: 2,
      maxFloor: 30,
      gameVersion: 'test',
      startedAt: activeRow.started_at,
      updatedAt: activeRow.updated_at,
      checkpoint: {
        kind: 'floor',
        floor: 2,
        payload: checkpointRow.payload,
        capturedAt: checkpointRow.saved_at,
      },
    })
  })

  it('sends the initial checkpoint through the atomic start RPC', async () => {
    const rpc = vi.fn((name: string) => name === 'start_dungeon_run'
      ? [{
          run_id: 'run-1',
          status: 'active',
          started_at: activeRow.started_at,
          was_created: true,
        }]
      : [])
    const client = fakeClient({ run: activeRow, snapshot: { ...checkpointRow, snapshot_kind: 'start', floor_number: 1 }, rpc })
    const service = createService(client)
    const checkpoint = { version: 1 }

    await service.createRun({
      runId: 'run-1',
      seed: 42,
      modeId: 'dungeon',
      preparation: { version: 1, items: [] },
      contractId: activeRow.contract_id,
      worldModifierIds: activeRow.world_modifier_ids,
      maxFloor: 30,
      startedAt: activeRow.started_at,
      dungeonId: activeRow.dungeon_id,
      characterClassId: activeRow.class_id,
      gameVersion: activeRow.game_version,
      checkpoint,
    })

    expect(rpc).toHaveBeenCalledWith('start_dungeon_run', expect.objectContaining({
      p_run_id: 'run-1',
      p_initial_payload: checkpoint,
      p_dungeon_id: 'default-dungeon',
      p_mode_id: 'dungeon',
      p_class_id: 'ranger',
      p_preparation: { version: 1, items: [] },
    }))
  })

  it('appends a floor checkpoint and returns the refreshed active metadata', async () => {
    const rpc = vi.fn((name: string) => name === 'checkpoint_dungeon_run'
      ? [{ run_id: 'run-1', floor_number: 3, snapshot_id: 2, saved_at: checkpointRow.saved_at }]
      : [])
    const client = fakeClient({
      run: { ...activeRow, current_floor: 3 },
      snapshot: { ...checkpointRow, floor_number: 3 },
      rpc,
    })
    const service = createService(client)

    const result = await service.saveFloorCheckpoint({
      runId: 'run-1',
      floor: 3,
      checkpoint: { version: 1 },
    })

    expect(result.currentFloor).toBe(3)
    expect(result.checkpoint.floor).toBe(3)
    expect(rpc).toHaveBeenCalledWith('checkpoint_dungeon_run', {
      p_run_id: 'run-1',
      p_floor_number: 3,
      p_payload: { version: 1 },
    })
  })

  it('maps terminal rewards while retaining the terminal checkpoint', async () => {
    const terminalRow = { ...activeRow, status: 'defeat', current_floor: 2 }
    const terminalSnapshot = { ...checkpointRow, snapshot_kind: 'death' }
    const rpc = vi.fn((name: string) => name === 'complete_dungeon_run'
      ? [{
          run_id: 'run-1',
          essence_awarded: 12,
          essence_balance: 34,
          was_processed: true,
        }]
      : [])
    const client = fakeClient({ run: terminalRow, snapshot: terminalSnapshot, rpc })
    const service = createService(client)
    const result = await service.completeRun({
      runId: 'run-1',
      outcome: 'defeat',
      completedAt: '2026-09-01T00:02:00.000Z',
      checkpoint: { version: 1 },
      level: 12,
      killCount: 100,
      worldModifierIds: ['fast-start'],
    })

    expect(result.reward).toEqual({
      essenceAwarded: 12,
      essenceBalance: 34,
      wasProcessed: true,
    })
    expect(result.snapshot.kind).toBe('death')
    expect(rpc).toHaveBeenCalledWith('complete_dungeon_run', expect.objectContaining({
      p_outcome: 'defeat',
      p_result_payload: expect.objectContaining({
        checkpoint: { version: 1 },
        level: 12,
        killCount: 100,
      }),
    }))
  })

  it('pauses without attempting to write a replacement checkpoint', async () => {
    const rpc = vi.fn(() => [])
    const client = fakeClient({ rpc })
    const service = createService(client)

    await service.pauseRun('run-1')

    expect(rpc).toHaveBeenCalledWith('pause_dungeon_run', { p_run_id: 'run-1' })
  })

  it('rejects malformed active-run responses', async () => {
    const service = createService(fakeClient({
      run: {
        ...activeRow,
        class_id: 42,
      },
      snapshot: checkpointRow,
    }))

    await expect(service.loadActiveRun()).rejects.toThrow(/invalid response/)
  })

  it('rejects an unknown run mode or malformed preparation snapshot', async () => {
    const service = createService(fakeClient({
      run: {
        ...activeRow,
        mode_id: 'unknown',
      },
      snapshot: checkpointRow,
    }))

    await expect(service.loadActiveRun()).rejects.toThrow(/invalid response/)
  })
})
