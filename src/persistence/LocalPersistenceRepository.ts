import {
  DEFAULT_BASIC_PROFILE,
  DEFAULT_SETTINGS,
  migrateBasicProfile,
  migratePendingCompletedRunResult,
  migrateSettings,
} from './migrations'
import type { PersistenceStore } from './database'
import {
  PERSISTENCE_SCHEMA_VERSION,
  type BasicProfileDto,
  type PendingCompletedRunResultDto,
  type PendingCompletedRunResultInput,
  type SettingsDto,
} from './types'

const SETTINGS_ID = 'settings' as const
const PROFILE_ID = 'profile' as const

export interface SettingsPatch {
  selectedBehaviorProfileId?: SettingsDto['selectedBehaviorProfileId']
  selectedDungeonLengthContractId?: string
}

export interface PersistenceRepository {
  getSettings(): Promise<SettingsDto>
  saveSettings(patch: SettingsPatch | SettingsDto): Promise<SettingsDto>
  selectBehaviorProfile(
    profileId: SettingsDto['selectedBehaviorProfileId'],
  ): Promise<SettingsDto>
  selectDungeonLengthContract(contractId: string): Promise<SettingsDto>
  getBasicProfile(): Promise<BasicProfileDto>
  saveBasicProfile(profile: BasicProfileDto): Promise<BasicProfileDto>
  unlockDungeonLength(contractId: string): Promise<BasicProfileDto>
  listPendingRunResults(): Promise<PendingCompletedRunResultDto[]>
  enqueuePendingRunResult(
    result: PendingCompletedRunResultInput,
  ): Promise<PendingCompletedRunResultDto>
  removePendingRunResult(id: string): Promise<void>
}

export type PersistenceIdFactory = () => string

function defaultIdFactory(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  throw new Error(
    'A PersistenceIdFactory is required when crypto.randomUUID is unavailable.',
  )
}

export class LocalPersistenceRepositoryImpl implements PersistenceRepository {
  private readonly store: PersistenceStore
  private readonly createId: PersistenceIdFactory

  constructor(
    store: PersistenceStore,
    createId: PersistenceIdFactory = defaultIdFactory,
  ) {
    this.store = store
    this.createId = createId
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

  async selectDungeonLengthContract(contractId: string): Promise<SettingsDto> {
    const profile = await this.getBasicProfile()
    if (!profile.unlockedDungeonLengthIds.includes(contractId)) {
      throw new Error(`Dungeon length contract "${contractId}" is not unlocked.`)
    }
    return this.saveSettings({ selectedDungeonLengthContractId: contractId })
  }

  async getBasicProfile(): Promise<BasicProfileDto> {
    return migrateBasicProfile(await this.store.profile.get(PROFILE_ID))
  }

  async saveBasicProfile(profile: BasicProfileDto): Promise<BasicProfileDto> {
    const next = migrateBasicProfile(profile)
    await this.store.profile.put({ id: PROFILE_ID, ...next })
    return next
  }

  async unlockDungeonLength(contractId: string): Promise<BasicProfileDto> {
    if (contractId.length === 0) {
      throw new Error('A dungeon length contract ID is required.')
    }
    const profile = await this.getBasicProfile()
    if (!profile.unlockedDungeonLengthIds.includes(contractId)) {
      profile.unlockedDungeonLengthIds.push(contractId)
    }
    return this.saveBasicProfile(profile)
  }

  async listPendingRunResults(): Promise<PendingCompletedRunResultDto[]> {
    const records = await this.store.pendingResults.toArray()
    return records
      .map((record) => migratePendingCompletedRunResult(record, record.id))
      .sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id))
  }

  async enqueuePendingRunResult(
    result: PendingCompletedRunResultInput,
  ): Promise<PendingCompletedRunResultDto> {
    const id = result.id ?? this.createId()
    if (id.length === 0 || result.runId.length === 0) {
      throw new Error('A pending run result requires non-empty id and runId.')
    }
    const next = migratePendingCompletedRunResult({
      ...result,
      id,
      schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    })
    await this.store.pendingResults.put(next)
    return next
  }

  async removePendingRunResult(id: string): Promise<void> {
    await this.store.pendingResults.delete(id)
  }
}

export function createPersistenceRepository(
  store: PersistenceStore,
  createId?: PersistenceIdFactory,
): PersistenceRepository {
  return new LocalPersistenceRepositoryImpl(store, createId)
}

export const DEFAULT_PERSISTENCE_SETTINGS = DEFAULT_SETTINGS
export const DEFAULT_PERSISTENCE_PROFILE = DEFAULT_BASIC_PROFILE
