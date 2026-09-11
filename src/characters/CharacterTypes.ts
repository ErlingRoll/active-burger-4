// The build snapshot is simulation input and is owned by `game/checkpoint`;
// it is re-exported here so the character service keeps a single import site.
import type { CharacterBuildSnapshot } from '../game/checkpoint/CharacterBuild'

export {
  CHARACTER_SCHEMA_VERSION,
  isCharacterBuildSnapshot,
} from '../game/checkpoint/CharacterBuild'
export type {
  CharacterBuildSkill,
  CharacterBuildSnapshot,
} from '../game/checkpoint/CharacterBuild'

export interface CharacterRecipe {
  characterId: string
  name: string
  currentRevisionId: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CharacterRevision {
  revisionId: string
  characterId: string
  revisionNumber: number
  parentRevisionId: string | null
  contentVersion: string
  build: CharacterBuildSnapshot
  createdAt: string
}

export interface ChampionSnapshot {
  championId: string
  name: string
  sourceRunId: string
  contentVersion: string
  build: CharacterBuildSnapshot
  exhaustionUntil: string | null
  archived: boolean
  createdAt: string
}

export interface SaveCharacterInput {
  characterId: string
  revisionId: string
  name: string
  contentVersion: string
  build: CharacterBuildSnapshot
}

export interface CreateChampionInput {
  championId: string
  sourceRunId: string
  name: string
  contentVersion: string
  /**
   * The Champion this one takes the place of, when the roster is full.
   *
   * Archiving that Champion and creating this one are a single server
   * operation, so a swap cannot half-happen and leave the roster short.
   */
  replacedChampionId?: string
}

/**
 * A Champion made by the development tools rather than won. The build is
 * rolled in the browser from the content registries; the server stores it
 * under a "development:" source run id so it can always be told apart.
 */
export interface CreateDevelopmentChampionInput {
  championId: string
  name: string
  contentVersion: string
  build: CharacterBuildSnapshot
  /** Zero leaves the Champion rested; otherwise it starts exhausted for this long. */
  exhaustionHours: number
}

export interface ChampionRevivalResult extends ChampionSnapshot {
  fishInstanceId: string
  exhaustionReductionSeconds: number
  wasProcessed: boolean
}

export interface CharacterService {
  loadCharacters(): Promise<{
    characters: CharacterRecipe[]
    revisions: CharacterRevision[]
    champions: ChampionSnapshot[]
  }>
  saveCharacter(input: SaveCharacterInput): Promise<CharacterRevision>
  createChampionFromRun(input: CreateChampionInput): Promise<ChampionSnapshot>
  /** Administrators only; the server refuses anyone else. */
  createDevelopmentChampion(input: CreateDevelopmentChampionInput): Promise<ChampionSnapshot>
  renameChampion(championId: string, name: string): Promise<ChampionSnapshot>
  reviveChampion(
    operationId: string,
    championId: string,
    fishInstanceId: string,
  ): Promise<ChampionRevivalResult>
  archiveCharacter(characterId: string): Promise<void>
  archiveChampion(championId: string): Promise<void>
}
