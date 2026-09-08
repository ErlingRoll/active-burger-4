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
  renameChampion(championId: string, name: string): Promise<ChampionSnapshot>
  reviveChampion(
    operationId: string,
    championId: string,
    fishInstanceId: string,
  ): Promise<ChampionRevivalResult>
  archiveCharacter(characterId: string): Promise<void>
  archiveChampion(championId: string): Promise<void>
}
