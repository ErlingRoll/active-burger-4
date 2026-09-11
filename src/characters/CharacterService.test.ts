import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createCharacterService,
  isChampionRosterFullError,
} from './CharacterService'
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

  it('names the Champion it is displacing when the roster is full', async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        id: 'champion-11',
        name: 'Eleventh Champion',
        source_run_id: 'run-11',
        content_version: 'test',
        build,
        exhaustion_until: null,
        archived: false,
        created_at: '2026-09-10T00:00:00.000Z',
      }],
      error: null,
    }))
    const service = createService({ rpc } as unknown as SupabaseClient)

    await service.createChampionFromRun({
      championId: 'champion-11',
      sourceRunId: 'run-11',
      name: 'Eleventh Champion',
      contentVersion: 'test',
      replacedChampionId: 'champion-3',
    })

    // Archiving the old Champion and creating the new one are one call, so a
    // swap cannot half-happen and leave the roster a Champion short.
    expect(rpc).toHaveBeenCalledWith('create_champion_from_run', expect.objectContaining({
      p_champion_id: 'champion-11',
      p_replaced_champion_id: 'champion-3',
    }))
  })

  it('sends no replacement when there is room', async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        id: 'champion-2',
        name: 'Second Champion',
        source_run_id: 'run-2',
        content_version: 'test',
        build,
        exhaustion_until: null,
        archived: false,
        created_at: '2026-09-10T00:00:00.000Z',
      }],
      error: null,
    }))
    const service = createService({ rpc } as unknown as SupabaseClient)

    await service.createChampionFromRun({
      championId: 'champion-2',
      sourceRunId: 'run-2',
      name: 'Second Champion',
      contentVersion: 'test',
    })

    expect(rpc).toHaveBeenCalledWith('create_champion_from_run', expect.objectContaining({
      p_replaced_champion_id: null,
    }))
  })

  it('tells a full roster apart from any other refusal', () => {
    // The limit is enforced in the database, so the client learns about it from
    // the message the call raises — every `raise exception` shares a SQLSTATE.
    expect(isChampionRosterFullError(new Error('Champion roster is full.'))).toBe(true)
    expect(isChampionRosterFullError({ message: 'Champion roster is full.' })).toBe(true)
    expect(isChampionRosterFullError(new Error('The completed run has no checkpoint.')))
      .toBe(false)
    expect(isChampionRosterFullError(null)).toBe(false)
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

  it('creates a development Champion from a build, with its exhaustion in hours', async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        id: 'dev-1',
        name: 'Iron Knight 42',
        source_run_id: 'development:dev-1',
        content_version: 'test',
        build,
        exhaustion_until: '2026-09-12T00:00:00.000Z',
        archived: false,
        created_at: '2026-09-11T00:00:00.000Z',
      }],
      error: null,
    }))
    const service = createService({ rpc } as unknown as SupabaseClient)

    await expect(service.createDevelopmentChampion({
      championId: 'dev-1',
      name: 'Iron Knight 42',
      contentVersion: 'test',
      build,
      exhaustionHours: 24,
    })).resolves.toMatchObject({
      championId: 'dev-1',
      sourceRunId: 'development:dev-1',
      exhaustionUntil: '2026-09-12T00:00:00.000Z',
    })
    expect(rpc).toHaveBeenCalledWith('create_development_champion', {
      p_champion_id: 'dev-1',
      p_name: 'Iron Knight 42',
      p_content_version: 'test',
      p_build: build,
      p_exhaustion_hours: 24,
    })
  })

  it('rejects a development Champion whose build the game would not load', async () => {
    const rpc = vi.fn()
    const service = createService({ rpc } as unknown as SupabaseClient)

    await expect(service.createDevelopmentChampion({
      championId: 'dev-2',
      name: 'Broken',
      contentVersion: 'test',
      build: { ...build, classId: 'not-a-class' } as unknown as typeof build,
      exhaustionHours: 0,
    })).rejects.toThrow('Development Champion input is invalid.')
    expect(rpc).not.toHaveBeenCalled()
  })
})
