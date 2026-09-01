import Dexie, { type Table } from 'dexie'
import type {
  BasicProfileRecord,
  HiddenBugReportRecord,
  SettingsRecord,
} from './types'

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
  hiddenBugReports: PersistenceTable<HiddenBugReportRecord>
}

/**
 * Opening this database is explicit. There is intentionally no browser
 * detection or fallback here: callers in SSR/tests inject a PersistenceStore.
 *
 * These Dexie version numbers track the *physical* IndexedDB schema and are
 * intentionally independent of PERSISTENCE_SCHEMA_VERSION, which only
 * versions the shape of individual DTOs.
 */
export class LocalPersistenceDatabase extends Dexie {
  settings!: Table<SettingsRecord, string>
  profile!: Table<BasicProfileRecord, string>
  hiddenBugReports!: Table<HiddenBugReportRecord, string>

  constructor(name = LOCAL_PERSISTENCE_DATABASE_NAME) {
    super(name)
    // Version 1 is the original schema, which included a pendingResults
    // queue table for completed runs awaiting Supabase sync. Declaring it
    // here lets Dexie run the version 2 migration below for existing
    // installs instead of failing to open the database.
    this.version(1).stores({
      settings: 'id',
      profile: 'id',
      pendingResults: 'id, runId, completedAt',
    })
    // Version 2 drops the pending-result queue: runs no longer queue
    // locally for later sync, so remove the legacy table for anyone
    // upgrading from version 1.
    this.version(2).stores({
      settings: 'id',
      profile: 'id',
      pendingResults: null,
    })
    this.version(3).stores({
      settings: 'id',
      profile: 'id',
      hiddenBugReports: 'id, userId, reportId',
    })
  }
}

export function createDexiePersistenceStore(
  database = new LocalPersistenceDatabase(),
): PersistenceStore {
  return {
    settings: database.settings,
    profile: database.profile,
    hiddenBugReports: database.hiddenBugReports,
  }
}
