import {
  DEFAULT_BASIC_PROFILE,
  DEFAULT_SETTINGS,
  migrateBasicProfile,
  migrateSettings,
} from './migrations'
import type { PersistenceStore } from './database'
import type {
  BasicProfileDto,
  SettingsDto,
} from './types'

const SETTINGS_ID = 'settings' as const
const PROFILE_ID = 'profile' as const

export interface SettingsPatch {
  selectedBehaviorProfileId?: SettingsDto['selectedBehaviorProfileId']
  selectedDungeonMaxFloorContractId?: string
  selectedWorldModifierIds?: SettingsDto['selectedWorldModifierIds']
  selectedPlaystyleId?: SettingsDto['selectedPlaystyleId']
  keybinds?: SettingsDto['keybinds']
}

export interface PersistenceRepository {
  getSettings(): Promise<SettingsDto>
  saveSettings(patch: SettingsPatch | SettingsDto): Promise<SettingsDto>
  selectBehaviorProfile(
    profileId: SettingsDto['selectedBehaviorProfileId'],
  ): Promise<SettingsDto>
  selectDungeonMaxFloorContract(contractId: string): Promise<SettingsDto>
  getBasicProfile(): Promise<BasicProfileDto>
  saveBasicProfile(profile: BasicProfileDto): Promise<BasicProfileDto>
  unlockDungeonMaxFloor(contractId: string): Promise<BasicProfileDto>
}

export class LocalPersistenceRepositoryImpl implements PersistenceRepository {
  private readonly store: PersistenceStore

  constructor(store: PersistenceStore) {
    this.store = store
  }

  async getSettings(): Promise<SettingsDto> {
    return migrateSettings(await this.store.settings.get(SETTINGS_ID))
  }

  async saveSettings(patch: SettingsPatch | SettingsDto): Promise<SettingsDto> {
    const current = await this.getSettings()
    const next = migrateSettings({ ...current, ...patch })
    await this.store.settings.put({ id: SETTINGS_ID, ...next })
    return next
  }

  selectBehaviorProfile(
    profileId: SettingsDto['selectedBehaviorProfileId'],
  ): Promise<SettingsDto> {
    return this.saveSettings({ selectedBehaviorProfileId: profileId })
  }

  async selectDungeonMaxFloorContract(contractId: string): Promise<SettingsDto> {
    const profile = await this.getBasicProfile()
    if (!profile.unlockedDungeonMaxFloorIds.includes(contractId)) {
      throw new Error(`Dungeon maximum-floor contract "${contractId}" is not unlocked.`)
    }
    return this.saveSettings({ selectedDungeonMaxFloorContractId: contractId })
  }

  async getBasicProfile(): Promise<BasicProfileDto> {
    return migrateBasicProfile(await this.store.profile.get(PROFILE_ID))
  }

  async saveBasicProfile(profile: BasicProfileDto): Promise<BasicProfileDto> {
    const next = migrateBasicProfile(profile)
    await this.store.profile.put({ id: PROFILE_ID, ...next })
    return next
  }

  async unlockDungeonMaxFloor(contractId: string): Promise<BasicProfileDto> {
    if (contractId.length === 0) {
      throw new Error('A dungeon maximum-floor contract ID is required.')
    }
    const profile = await this.getBasicProfile()
    if (!profile.unlockedDungeonMaxFloorIds.includes(contractId)) {
      profile.unlockedDungeonMaxFloorIds.push(contractId)
    }
    return this.saveBasicProfile(profile)
  }
}

export function createPersistenceRepository(
  store: PersistenceStore,
): PersistenceRepository {
  return new LocalPersistenceRepositoryImpl(store)
}

export const DEFAULT_PERSISTENCE_SETTINGS = DEFAULT_SETTINGS
export const DEFAULT_PERSISTENCE_PROFILE = DEFAULT_BASIC_PROFILE
