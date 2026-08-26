import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
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
      schemaVersion: 2,
      selectedBehaviorProfileId: 'balanced',
      selectedDungeonMaxFloorContractId: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
      selectedWorldModifierIds: [],
      selectedPlaystyleId: 'knight',
    })
    expect(DEFAULT_BASIC_PROFILE).toEqual({
      schemaVersion: 2,
      unlockedDungeonMaxFloorIds: [DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID],
    })
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(migrateBasicProfile({})).toEqual(DEFAULT_BASIC_PROFILE)
  })

  it('falls back invalid settings and preserves future profile unlock IDs', () => {
    expect(
      migrateSettings({
        schemaVersion: 0,
        selectedBehaviorProfileId: 'not-authored',
        selectedDungeonMaxFloorContractId: '',
      }),
    ).toEqual(DEFAULT_SETTINGS)
    expect(
      migrateBasicProfile({
        schemaVersion: 0,
        unlockedDungeonMaxFloorIds: [
          DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
          DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
          'future-contract',
          42,
        ],
      }),
    ).toEqual({
      schemaVersion: 2,
      unlockedDungeonMaxFloorIds: [
        DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
        'future-contract',
      ],
    })
    expect(
      migrateSettings({
        selectedDungeonLengthContractId: 'default-dungeon-15-minute',
      }),
    ).toMatchObject({
      selectedDungeonMaxFloorContractId: 'default-dungeon-20-floor',
    })
    expect(
      migrateBasicProfile({
        unlockedDungeonLengthIds: ['default-dungeon-20-minute'],
      }),
    ).toMatchObject({
      unlockedDungeonMaxFloorIds: [
        DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
        'default-dungeon-50-floor',
      ],
    })
  })

  it('uses the profile unlock set as the contract selection boundary', async () => {
    const repository = createPersistenceRepository(memoryStore())
    const profile = await repository.getBasicProfile()
    expect(profile.unlockedDungeonMaxFloorIds).toEqual([
      DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
    ])
    await expect(
      repository.selectDungeonMaxFloorContract('default-dungeon-20-floor'),
    ).rejects.toThrow(/not unlocked/)
    await expect(repository.unlockDungeonMaxFloor('default-dungeon-20-floor')).resolves
      .toMatchObject({
        unlockedDungeonMaxFloorIds: [
          DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
          'default-dungeon-20-floor',
        ],
      })
    await expect(
      repository.selectDungeonMaxFloorContract('default-dungeon-20-floor'),
    ).resolves.toMatchObject({
      selectedDungeonMaxFloorContractId: 'default-dungeon-20-floor',
    })
    expect((await repository.getBasicProfile()).unlockedDungeonMaxFloorIds).toContain(
      'default-dungeon-20-floor',
    )
  })
})
