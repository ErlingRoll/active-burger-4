import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  DEFAULT_BASIC_PROFILE,
  DEFAULT_SETTINGS,
  migrateBasicProfile,
  migrateSettings,
} from './index'
import type { PersistenceStore, PersistenceTable } from './database'
import type {
  BasicProfileRecord,
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
    const repository = createPersistenceRepository(memoryStore())
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
})
