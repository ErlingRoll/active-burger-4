import type { CharacterClassId } from '../content/classes/CharacterClasses'
import type { SkillId } from '../content/skills/Skills'
import type { EquipmentLoadout } from '../game/equipment/EquipmentState'
import type { BehaviorProfileId } from '../content/behaviors/BehaviorProfiles'
import type { UpgradeId } from '../content/upgrades/Upgrades'

export const CHARACTER_SCHEMA_VERSION = 1 as const

export interface CharacterBuildSkill {
  skillId: SkillId
  level: number
}

export interface CharacterBuildSnapshot {
  schemaVersion: typeof CHARACTER_SCHEMA_VERSION
  classId: CharacterClassId
  skills: readonly CharacterBuildSkill[]
  selectedUpgradeIds: readonly UpgradeId[]
  equipment: EquipmentLoadout
  behaviorProfileId: BehaviorProfileId
}

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

export interface CharacterService {
  loadCharacters(): Promise<{
    characters: CharacterRecipe[]
    revisions: CharacterRevision[]
    champions: ChampionSnapshot[]
  }>
  saveCharacter(input: SaveCharacterInput): Promise<CharacterRevision>
  createChampionFromRun(input: CreateChampionInput): Promise<ChampionSnapshot>
  renameChampion(championId: string, name: string): Promise<ChampionSnapshot>
  archiveCharacter(characterId: string): Promise<void>
  archiveChampion(championId: string): Promise<void>
}
