import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  DEFAULT_BASIC_PROFILE,
  DEFAULT_SETTINGS,
  migrateBasicProfile,
  migratePendingCompletedRunResult,
  migrateSettings,
} from './index'
import type { PersistenceStore, PersistenceTable } from './database'
import type {
  BasicProfileRecord,
  PendingCompletedRunResultDto,
  SettingsRecord,
} from './types'
import { createPersistenceRepository } from './LocalPersistenceRepository'

function memoryTable<T extends { id: string }>(): PersistenceTable<T> {
  const values = new Map<string, T>()
  return {
    async get(id) {
      return values.get(id)
    },
    async put(value) {
      values.set(value.id, value)
      return value.id
    },
    async delete(id) {
      values.delete(id)
    },
    async toArray() {
      return [...values.values()]
    },
  }
}

function memoryStore(): PersistenceStore {
  return {
    settings: memoryTable<SettingsRecord>(),
    profile: memoryTable<BasicProfileRecord>(),
    pendingResults: memoryTable<PendingCompletedRunResultDto>(),
  }
}

describe('local persistence schema', () => {
  it('provides migration-safe defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      schemaVersion: 1,
      selectedBehaviorProfileId: 'balanced',
      selectedDungeonLengthContractId: DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
    })
    expect(DEFAULT_BASIC_PROFILE).toEqual({
      schemaVersion: 1,
      unlockedDungeonLengthIds: [DEFAULT_DUNGEON_LENGTH_CONTRACT_ID],
    })
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(migrateBasicProfile({})).toEqual(DEFAULT_BASIC_PROFILE)
  })

  it('falls back invalid settings and preserves future profile unlock IDs', () => {
    expect(
      migrateSettings({
        schemaVersion: 0,
        selectedBehaviorProfileId: 'not-authored',
        selectedDungeonLengthContractId: '',
      }),
    ).toEqual(DEFAULT_SETTINGS)
    expect(
      migrateBasicProfile({
        schemaVersion: 0,
        unlockedDungeonLengthIds: [
          DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
          DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
          'future-contract',
          42,
        ],
      }),
    ).toEqual({
      schemaVersion: 1,
      unlockedDungeonLengthIds: [
        DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
        'future-contract',
      ],
    })
  })

  it('uses the profile unlock set as the contract selection boundary', async () => {
    const repository = createPersistenceRepository(memoryStore(), () => 'result-1')
    const profile = await repository.getBasicProfile()
    expect(profile.unlockedDungeonLengthIds).toEqual([
      DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
    ])
    await expect(
      repository.selectDungeonLengthContract('default-dungeon-15-minute'),
    ).rejects.toThrow(/not unlocked/)
    await expect(repository.unlockDungeonLength('default-dungeon-15-minute')).resolves
      .toMatchObject({
        unlockedDungeonLengthIds: [
          DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
          'default-dungeon-15-minute',
        ],
      })
    await expect(
      repository.selectDungeonLengthContract('default-dungeon-15-minute'),
    ).resolves.toMatchObject({
      selectedDungeonLengthContractId: 'default-dungeon-15-minute',
    })
    expect((await repository.getBasicProfile()).unlockedDungeonLengthIds).toContain(
      'default-dungeon-15-minute',
    )
  })

  it('queues, orders, and removes completed run results', async () => {
    const repository = createPersistenceRepository(memoryStore(), () => 'generated-id')
    await repository.enqueuePendingRunResult({
      id: 'later',
      runId: 'run-later',
      completedAt: 20,
      payload: {
        phase: 'results',
        elapsedTime: 20,
        level: 3,
        xp: 12,
        killCount: 4,
      },
    })
    const queued = await repository.enqueuePendingRunResult({
      runId: 'run-first',
      completedAt: 10,
      payload: {
        phase: 'defeat',
        elapsedTime: 10,
        level: 1,
        xp: 2,
        killCount: 1,
      },
    })
    expect(queued.id).toBe('generated-id')
    expect(await repository.listPendingRunResults()).toMatchObject([
      { runId: 'run-first' },
      { runId: 'run-later' },
    ])
    await repository.removePendingRunResult(queued.id)
    expect(await repository.listPendingRunResults()).toHaveLength(1)
  })

  it('migrates a queued result with missing optional fields without dropping it', () => {
    expect(
      migratePendingCompletedRunResult({
        id: 'queued-1',
        runId: 'run-1',
        completedAt: 12,
        payload: { phase: 'defeat', elapsedSeconds: 12 },
      }),
    ).toEqual({
      id: 'queued-1',
      schemaVersion: 1,
      runId: 'run-1',
      completedAt: 12,
      payload: {
        phase: 'defeat',
        elapsedTime: 12,
        level: 1,
        xp: 0,
        killCount: 0,
      },
    })
  })
})
