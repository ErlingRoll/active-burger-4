import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isCharacterBuildSnapshot,
} from './CharacterSnapshots'
import type {
  CharacterBuildSnapshot,
  CharacterRevision,
  CharacterRecipe,
  ChampionRevivalResult,
  CharacterService,
  ChampionSnapshot,
  CreateChampionInput,
  SaveCharacterInput,
} from './CharacterTypes'

interface CharacterRow {
  id: string
  name: string
  current_revision_id: string
  archived: boolean
  created_at: string
  updated_at: string
}

interface RevisionRow {
  id: string
  character_id: string
  revision_number: number
  parent_revision_id: string | null
  content_version: string
  build: CharacterBuildSnapshot
  created_at: string
}

interface ChampionRow {
  id: string
  name: string
  source_run_id: string
  content_version: string
  build: CharacterBuildSnapshot
  exhaustion_until: string | null
  archived: boolean
  created_at: string
}

interface ChampionRevivalRow extends ChampionRow {
  fish_instance_id: string
  exhaustion_reduction_seconds: number
  was_processed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCharacterRow(value: unknown): value is CharacterRow {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.current_revision_id) &&
    typeof value.archived === 'boolean' &&
    isNonEmptyString(value.created_at) &&
    isNonEmptyString(value.updated_at)
}

function isRevisionRow(value: unknown): value is RevisionRow {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.character_id) &&
    typeof value.revision_number === 'number' &&
    Number.isSafeInteger(value.revision_number) &&
    value.revision_number >= 1 &&
    (value.parent_revision_id === null || isNonEmptyString(value.parent_revision_id)) &&
    isNonEmptyString(value.content_version) &&
    isCharacterBuildSnapshot(value.build) &&
    isNonEmptyString(value.created_at)
}

function isChampionRow(value: unknown): value is ChampionRow {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.source_run_id) &&
    isNonEmptyString(value.content_version) &&
    isCharacterBuildSnapshot(value.build) &&
    (value.exhaustion_until === null || isNonEmptyString(value.exhaustion_until)) &&
    typeof value.archived === 'boolean' &&
    isNonEmptyString(value.created_at)
}

function isChampionRevivalRow(value: unknown): value is ChampionRevivalRow {
  return isRecord(value) &&
    isChampionRow(value) &&
    isNonEmptyString(value.fish_instance_id) &&
    typeof value.exhaustion_reduction_seconds === 'number' &&
    Number.isSafeInteger(value.exhaustion_reduction_seconds) &&
    value.exhaustion_reduction_seconds >= 0 &&
    typeof value.was_processed === 'boolean'
}

function invalidResponse(message: string): Error {
  return new Error(`Character persistence returned an invalid response: ${message}`)
}

function mapCharacter(row: CharacterRow): CharacterRecipe {
  return {
    characterId: row.id,
    name: row.name,
    currentRevisionId: row.current_revision_id,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRevision(row: RevisionRow): CharacterRevision {
  return {
    revisionId: row.id,
    characterId: row.character_id,
    revisionNumber: row.revision_number,
    parentRevisionId: row.parent_revision_id,
    contentVersion: row.content_version,
    build: row.build,
    createdAt: row.created_at,
  }
}

function mapChampion(row: ChampionRow): ChampionSnapshot {
  return {
    championId: row.id,
    name: row.name,
    sourceRunId: row.source_run_id,
    contentVersion: row.content_version,
    build: row.build,
    exhaustionUntil: row.exhaustion_until,
    archived: row.archived,
    createdAt: row.created_at,
  }
}

export function createCharacterService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): CharacterService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  return {
    async loadCharacters() {
      const client = getClient()
      const [characterResponse, revisionResponse, championResponse] = await Promise.all([
        client.from('characters').select(
          'id, name, current_revision_id, archived, created_at, updated_at',
        ).eq('archived', false).order('created_at'),
        client.from('character_revisions').select(
          'id, character_id, revision_number, parent_revision_id, content_version, build, created_at',
        ).order('created_at'),
        client.from('champions').select(
          'id, name, source_run_id, content_version, build, exhaustion_until, archived, created_at',
        ).eq('archived', false).order('created_at'),
      ])
      if (characterResponse.error) throw characterResponse.error
      if (revisionResponse.error) throw revisionResponse.error
      if (championResponse.error) throw championResponse.error
      if (!Array.isArray(characterResponse.data) ||
        !characterResponse.data.every(isCharacterRow) ||
        !Array.isArray(revisionResponse.data) ||
        !revisionResponse.data.every(isRevisionRow) ||
        !Array.isArray(championResponse.data) ||
        !championResponse.data.every(isChampionRow)) {
        throw invalidResponse('character collection shape')
      }
      return {
        characters: characterResponse.data.map(mapCharacter),
        revisions: revisionResponse.data.map(mapRevision),
        champions: championResponse.data.map(mapChampion),
      }
    },

    async saveCharacter(input: SaveCharacterInput): Promise<CharacterRevision> {
      if (!isNonEmptyString(input.characterId) ||
        !isNonEmptyString(input.revisionId) ||
        !isNonEmptyString(input.name) ||
        !isNonEmptyString(input.contentVersion) ||
        !isCharacterBuildSnapshot(input.build)) {
        throw new Error('Character revision input is invalid.')
      }
      const response = await getClient().rpc('save_character_revision', {
        p_character_id: input.characterId,
        p_revision_id: input.revisionId,
        p_name: input.name,
        p_content_version: input.contentVersion,
        p_build: input.build,
      })
      if (response.error) throw response.error
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isRevisionRow(response.data[0])) {
        throw invalidResponse('saved character revision')
      }
      return mapRevision(response.data[0])
    },

    async createChampionFromRun(input: CreateChampionInput): Promise<ChampionSnapshot> {
      if (!isNonEmptyString(input.championId) ||
        !isNonEmptyString(input.sourceRunId) ||
        !isNonEmptyString(input.name) ||
        !isNonEmptyString(input.contentVersion)) {
        throw new Error('Champion input is invalid.')
      }
      const response = await getClient().rpc('create_champion_from_run', {
        p_champion_id: input.championId,
        p_source_run_id: input.sourceRunId,
        p_name: input.name,
        p_content_version: input.contentVersion,
      })
      if (response.error) throw response.error
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isChampionRow(response.data[0])) {
        throw invalidResponse('created Champion')
      }
      return mapChampion(response.data[0])
    },

    async renameChampion(championId: string, name: string): Promise<ChampionSnapshot> {
      if (!isNonEmptyString(championId) ||
        !isNonEmptyString(name) ||
        name.trim().length > 32) {
        throw new Error('Champion name input is invalid.')
      }
      const response = await getClient().rpc('rename_champion', {
        p_champion_id: championId,
        p_name: name.trim(),
      })
      if (response.error) throw response.error
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isChampionRow(response.data[0])) {
        throw invalidResponse('renamed Champion')
      }
      return mapChampion(response.data[0])
    },

    async reviveChampion(
      operationId: string,
      championId: string,
      fishInstanceId: string,
    ): Promise<ChampionRevivalResult> {
      if (!isNonEmptyString(operationId) ||
        !isNonEmptyString(championId) ||
        !isNonEmptyString(fishInstanceId)) {
        throw new Error('Champion revival input is invalid.')
      }
      const response = await getClient().rpc('revive_champion_with_fish', {
        p_operation_id: operationId,
        p_champion_id: championId,
        p_fish_instance_id: fishInstanceId,
      })
      if (response.error) throw response.error
      if (!Array.isArray(response.data) || response.data.length !== 1 ||
        !isChampionRevivalRow(response.data[0])) {
        throw invalidResponse('revived Champion')
      }
      const row = response.data[0]
      return {
        ...mapChampion(row),
        fishInstanceId: row.fish_instance_id,
        exhaustionReductionSeconds: row.exhaustion_reduction_seconds,
        wasProcessed: row.was_processed,
      }
    },

    async archiveCharacter(characterId: string): Promise<void> {
      if (!isNonEmptyString(characterId)) throw new Error('Character ID must be non-empty.')
      const response = await getClient().rpc('archive_character', { p_character_id: characterId })
      if (response.error) throw response.error
    },

    async archiveChampion(championId: string): Promise<void> {
      if (!isNonEmptyString(championId)) throw new Error('Champion ID must be non-empty.')
      const response = await getClient().rpc('archive_champion', { p_champion_id: championId })
      if (response.error) throw response.error
    },
  }
}
