import Dexie, { type Table } from 'dexie'
import type {
  BasicProfileRecord,
  PendingCompletedRunResultDto,
  SettingsRecord,
} from './types'
import { PERSISTENCE_SCHEMA_VERSION } from './types'

export const LOCAL_PERSISTENCE_DATABASE_NAME = 'active-burger-local'

/** A narrow table seam keeps repository tests independent of IndexedDB. */
export interface PersistenceTable<T extends { id: string }> {
  get(id: string): Promise<T | undefined>
  put(value: T): Promise<string | number>
  delete(id: string): Promise<void>
  toArray(): Promise<T[]>
}

export interface PersistenceStore {
  settings: PersistenceTable<SettingsRecord>
  profile: PersistenceTable<BasicProfileRecord>
  pendingResults: PersistenceTable<PendingCompletedRunResultDto>
}

/**
 * Opening this database is explicit. There is intentionally no browser
 * detection or fallback here: callers in SSR/tests inject a PersistenceStore.
 */
export class LocalPersistenceDatabase extends Dexie {
  settings!: Table<SettingsRecord, string>
  profile!: Table<BasicProfileRecord, string>
  pendingResults!: Table<PendingCompletedRunResultDto, string>

  constructor(name = LOCAL_PERSISTENCE_DATABASE_NAME) {
    super(name)
    this.version(PERSISTENCE_SCHEMA_VERSION).stores({
      settings: 'id',
      profile: 'id',
      pendingResults: 'id, runId, completedAt',
    })
  }
}

export function createDexiePersistenceStore(
  database = new LocalPersistenceDatabase(),
): PersistenceStore {
  return {
    settings: database.settings,
    profile: database.profile,
    pendingResults: database.pendingResults,
  }
}

