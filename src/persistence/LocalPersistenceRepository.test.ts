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
  HiddenBugReportRecord,
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
    hiddenBugReports: memoryTable<HiddenBugReportRecord>(),
  }
}

describe('local persistence schema', () => {
  it('provides migration-safe defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      schemaVersion: 3,
      selectedBehaviorProfileId: 'balanced',
      selectedDungeonMaxFloorContractId: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
      selectedWorldModifierIds: [],
      selectedPlaystyleId: 'knight',
      keybinds: {
        behaviorAggressive: 'a',
        behaviorBalanced: 's',
        behaviorCautious: 'd',
        choiceLeft: '1',
        choiceMiddle: '2',
        choiceRight: '3',
        skipChoice: '5',
      },
    })
    expect(DEFAULT_BASIC_PROFILE).toEqual({
      schemaVersion: 3,
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
      schemaVersion: 3,
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

  it('migrates persisted legacy choice defaults while preserving custom choices', () => {
    expect(migrateSettings({
      keybinds: {
        choiceLeft: 'q',
        choiceMiddle: 'w',
        choiceRight: 'e',
      },
    }).keybinds).toMatchObject({
      choiceLeft: '1',
      choiceMiddle: '2',
      choiceRight: '3',
    })
    expect(migrateSettings({
      keybinds: {
        choiceLeft: 'j',
        choiceMiddle: 'k',
        choiceRight: 'l',
        skipChoice: 'x',
      },
    }).keybinds).toMatchObject({
      choiceLeft: 'j',
      choiceMiddle: 'k',
      choiceRight: 'l',
      skipChoice: 'x',
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

  it('persists hidden bug reports separately for each user', async () => {
    const repository = createPersistenceRepository(memoryStore())
    await repository.setBugReportHidden('user-a', 12, true)
    await repository.setBugReportHidden('user-b', 12, true)
    await repository.setBugReportHidden('user-a', 13, true)

    expect(await repository.getHiddenBugReportIds('user-a')).toEqual(new Set([12, 13]))
    expect(await repository.getHiddenBugReportIds('user-b')).toEqual(new Set([12]))

    await repository.setBugReportHidden('user-a', 12, false)
    expect(await repository.getHiddenBugReportIds('user-a')).toEqual(new Set([13]))
  })
})
