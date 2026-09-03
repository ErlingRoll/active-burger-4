import {
  isCharacterClassId,
} from '../content/classes/CharacterClasses'
import {
  isBehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'
import { isSkillId } from '../content/skills/Skills'
import type { GameCheckpoint } from '../game/checkpoint/GameCheckpoint'
import {
  CHARACTER_SCHEMA_VERSION,
  type CharacterBuildSkill,
  type CharacterBuildSnapshot,
} from './CharacterTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

export function isCharacterBuildSnapshot(
  value: unknown,
): value is CharacterBuildSnapshot {
  if (!isRecord(value) ||
    value.schemaVersion !== CHARACTER_SCHEMA_VERSION ||
    !isCharacterClassId(value.classId) ||
    !Array.isArray(value.skills) ||
    !Array.isArray(value.selectedUpgradeIds) ||
    !isRecord(value.equipment) ||
    !isBehaviorProfileId(value.behaviorProfileId)) {
    return false
  }
  const seenSkills = new Set<string>()
  const validSkills = value.skills.every((skill): skill is CharacterBuildSkill => {
    if (!isRecord(skill) ||
      typeof skill.skillId !== 'string' ||
      !isSkillId(skill.skillId) ||
      !isPositiveInteger(skill.level) ||
      seenSkills.has(skill.skillId)) {
      return false
    }
    seenSkills.add(skill.skillId)
    return true
  })
  return validSkills &&
    value.selectedUpgradeIds.every((upgradeId) => typeof upgradeId === 'string')
}

export function createCharacterBuildSnapshot(
  checkpoint: GameCheckpoint,
): CharacterBuildSnapshot {
  const player = checkpoint.gameState.player
  const characterClassId = player.characterClassId
  if (!isCharacterClassId(characterClassId)) {
    throw new Error('The checkpoint has no valid character class.')
  }
  const behaviorProfileId = player.behaviorController?.profileId
  if (!isBehaviorProfileId(behaviorProfileId)) {
    throw new Error('The checkpoint has no valid behavior profile.')
  }
  const skills = player.skills.map((skill) => {
    if (!isSkillId(skill.skillId) || !isPositiveInteger(skill.level)) {
      throw new Error('The checkpoint contains an invalid skill.')
    }
    return {
      skillId: skill.skillId,
      level: skill.level,
    }
  })
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    classId: characterClassId,
    skills,
    selectedUpgradeIds: [...checkpoint.gameState.run.selectedUpgradeIds],
    equipment: JSON.parse(JSON.stringify(player.equipment ?? {})),
    behaviorProfileId,
  }
}
