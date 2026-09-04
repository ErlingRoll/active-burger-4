import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCharacterService } from './CharacterService'
import type { CharacterBuildSnapshot } from './CharacterTypes'

const build: CharacterBuildSnapshot = {
  schemaVersion: 1,
  classId: 'knight',
  skills: [
    { skillId: 'basic-attack', level: 1 },
    { skillId: 'whirlwind', level: 2 },
  ],
  selectedUpgradeIds: ['whirlwind-cyclone'],
  equipment: {},
  behaviorProfileId: 'balanced',
}

function fakeClient(rpcResult: unknown): SupabaseClient {
  return {
    rpc: vi.fn(async () => ({ data: rpcResult, error: null })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createCharacterService(
    {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'test-key',
    },
    () => client,
  )
}

describe('CharacterService', () => {
  it('creates a Champion from a completed run', async () => {
    const client = fakeClient([{
      id: 'champion-1',
      name: 'First Champion',
      source_run_id: 'run-1',
      content_version: 'test',
      build,
      exhaustion_until: null,
      archived: false,
      created_at: '2026-09-04T00:00:00.000Z',
    }])
    const service = createService(client)

    await expect(service.createChampionFromRun({
      championId: 'champion-1',
      sourceRunId: 'run-1',
      name: 'First Champion',
      contentVersion: 'test',
    })).resolves.toMatchObject({
      championId: 'champion-1',
      sourceRunId: 'run-1',
      build,
    })
  })

  it('rejects invalid build revisions before calling the server', async () => {
    const client = fakeClient([])
    const service = createService(client)

    await expect(service.saveCharacter({
      characterId: 'character-1',
      revisionId: 'revision-1',
      name: 'Invalid',
      contentVersion: 'test',
      build: { ...build, classId: 'missing-class' } as unknown as CharacterBuildSnapshot,
    })).rejects.toThrow(/input is invalid/)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('renames a Champion without accepting a new build', async () => {
    const client = fakeClient([{
      id: 'champion-1',
      name: 'Renamed Champion',
      source_run_id: 'run-1',
      content_version: 'test',
      build,
      exhaustion_until: null,
      archived: false,
      created_at: '2026-09-04T00:00:00.000Z',
    }])
    const service = createService(client)

    await expect(service.renameChampion('champion-1', 'Renamed Champion'))
      .resolves.toMatchObject({ championId: 'champion-1', name: 'Renamed Champion' })
    expect(client.rpc).toHaveBeenCalledWith('rename_champion', {
      p_champion_id: 'champion-1',
      p_name: 'Renamed Champion',
    })
  })

  it('maps Revival Koi recovery results', async () => {
    const client = fakeClient([{
      id: 'champion-1',
      name: 'First Champion',
      source_run_id: 'run-1',
      content_version: 'test',
      build,
      exhaustion_until: null,
      archived: false,
      created_at: '2026-09-04T00:00:00.000Z',
      fish_instance_id: 'fish-1',
      exhaustion_reduction_seconds: 14400,
      was_processed: true,
    }])
    const service = createService(client)

    await expect(service.reviveChampion('revival-1', 'champion-1', 'fish-1'))
      .resolves.toMatchObject({
        championId: 'champion-1',
        fishInstanceId: 'fish-1',
        exhaustionReductionSeconds: 14400,
        wasProcessed: true,
      })
    expect(client.rpc).toHaveBeenCalledWith('revive_champion_with_fish', {
      p_operation_id: 'revival-1',
      p_champion_id: 'champion-1',
      p_fish_instance_id: 'fish-1',
    })
  })
})
